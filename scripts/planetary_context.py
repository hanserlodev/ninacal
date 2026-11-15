#!/usr/bin/env python3
"""Summarize land cover and burned area for a bbox using Microsoft Planetary Computer.

Uses the public STAC API and COG assets; no account or token is required. This is
context for NinaCal, not a replacement for its harmonized hotspot-day product.

    pip install -r scripts/requirements-planetary.txt
    python3 scripts/planetary_context.py --bbox -73.88,-11.12,-66.62,-7.32 --year 2023
    python3 scripts/planetary_context.py --bbox ... --year 2023 --output context.json
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import numpy as np
import planetary_computer
import rasterio
from pystac_client import Client
from rasterio.enums import Resampling
from rasterio.features import rasterize
from rasterio.transform import Affine
from rasterio.warp import transform_geom
from rasterio.windows import Window, from_bounds

STAC = "https://planetarycomputer.microsoft.com/api/stac/v1"

IO_LULC_CLASSES = {
    1: "water",
    2: "trees",
    4: "flooded_vegetation",
    5: "crops",
    7: "built_area",
    8: "bare_ground",
    9: "snow_ice",
    10: "clouds",
    11: "rangeland",
}
ESA_WORLDCOVER_CLASSES = {
    10: "trees",
    20: "shrubland",
    30: "grassland",
    40: "cropland",
    50: "built_area",
    60: "bare_sparse",
    70: "snow_ice",
    80: "water",
    90: "wetland",
    95: "mangroves",
    100: "moss_lichen",
}


def search(collection: str, bbox: list[float], start: str, end: str):
    client = Client.open(STAC)
    items = list(
        client.search(
            collections=[collection],
            bbox=bbox,
            datetime=f"{start}/{end}",
            max_items=200,
        ).items()
    )
    return [planetary_computer.sign(item) for item in items]


def clip_window(dataset, bbox: list[float]) -> Window | None:
    from rasterio.warp import transform_bounds

    west, south, east, north = bbox
    left, bottom, right, top = transform_bounds(
        "EPSG:4326", dataset.crs, west, south, east, north, densify_pts=21
    )
    bounds = dataset.bounds
    # STAC searches return every overlapping tile; skip tiles outside the box.
    if right <= bounds.left or left >= bounds.right or top <= bounds.bottom or bottom >= bounds.top:
        return None
    window = from_bounds(left, bottom, right, top, dataset.transform)
    window = window.intersection(Window(0, 0, dataset.width, dataset.height))
    if window.width < 1 or window.height < 1:
        return None
    return window


def boundary_mask(dataset, window: Window, width: int, height: int, boundary: Path | None):
    """Rasterize the country polygon onto the sampled window (True inside)."""
    if boundary is None:
        return None
    document = json.loads(boundary.read_text(encoding="utf-8"))
    shapes = []
    for feature in document.get("features", []):
        geometry = feature.get("geometry")
        if not geometry:
            continue
        transformed = transform_geom("EPSG:4326", dataset.crs, geometry)
        shapes.append((transformed, 1))
    if not shapes:
        return None
    transform = dataset.window_transform(window) * Affine.scale(
        window.width / width, window.height / height
    )
    return rasterize(
        shapes,
        out_shape=(height, width),
        transform=transform,
        fill=0,
        dtype="uint8",
    ).astype(bool)


def window_pixel_area_km2(dataset, window: Window, width: int, height: int) -> float:
    transform = dataset.window_transform(window)
    dx = abs(transform.a) * window.width / width
    dy = abs(transform.e) * window.height / height
    if dataset.crs and dataset.crs.is_projected:
        return dx * dy / 1_000_000
    # Geographic CRS: approximate metres at the dataset's mid latitude.
    lat = math.radians((dataset.bounds.bottom + dataset.bounds.top) / 2)
    return (dx * 111_320.0) * (dy * 111_320.0 * max(0.05, math.cos(lat))) / 1_000_000


def landcover(bbox: list[float], year: int, max_pixels: int, boundary: Path | None = None) -> dict:
    # io-lulc-annual-v02 is annual from 2017; esa-worldcover is 2020/2021 only.
    if year >= 2017:
        collection, classes = "io-lulc-annual-v02", IO_LULC_CLASSES
        start, end = f"{year}-01-01", f"{year}-12-31"
    else:
        collection, classes = "esa-worldcover", ESA_WORLDCOVER_CLASSES
        start, end = "2020-01-01", "2021-12-31"
    items = search(collection, bbox, start, end)
    if not items:
        return {"collection": collection, "status": "no_items", "classes": {}}
    counts: dict[int, int] = {}
    total_valid = 0
    for item in items:
        asset = item.assets.get("data") or item.assets.get("map")
        if asset is None:
            continue
        with rasterio.open(asset.href) as dataset:
            window = clip_window(dataset, bbox)
            if window is None:
                continue
            scale = max(1.0, max(window.width, window.height) / max_pixels)
            width = max(1, int(window.width / scale))
            height = max(1, int(window.height / scale))
            data = dataset.read(
                1,
                window=window,
                out_shape=(height, width),
                resampling=Resampling.nearest,
                masked=True,
            )
            inside = boundary_mask(dataset, window, width, height, boundary)
            valid = ~np.ma.getmaskarray(data)
            if inside is not None:
                valid &= inside
            values = data.filled(0).astype("int64")[valid]
            if values.size == 0:
                continue
            labels, frequency = np.unique(values, return_counts=True)
            for label, count in zip(labels.tolist(), frequency.tolist()):
                if label in classes:
                    counts[label] = counts.get(label, 0) + count
                    total_valid += count
    shares = {
        classes[label]: round(count / total_valid, 6)
        for label, count in sorted(counts.items())
    } if total_valid else {}
    return {
        "collection": collection,
        "year": year if collection == "io-lulc-annual-v02" else 2021,
        "tiles": len(items),
        "valid_pixels": total_valid,
        "classes": shares,
    }


def burned_area(bbox: list[float], year: int, max_pixels: int, boundary: Path | None = None) -> dict:
    items = search("modis-64A1-061", bbox, f"{year}-01-01", f"{year}-12-31")
    if not items:
        return {"collection": "modis-64A1-061", "status": "no_items", "area_km2": None}
    area = 0.0
    pixels = 0
    tiles = 0
    for item in items:
        asset = item.assets.get("Burn_Date")
        if asset is None:
            continue
        with rasterio.open(asset.href) as dataset:
            window = clip_window(dataset, bbox)
            if window is None:
                continue
            scale = max(1.0, max(window.width, window.height) / max_pixels)
            width = max(1, int(window.width / scale))
            height = max(1, int(window.height / scale))
            data = dataset.read(
                1,
                window=window,
                out_shape=(height, width),
                resampling=Resampling.nearest,
                masked=True,
            )
            values = data.filled(0)
            burned = (values > 0) & (values <= 366)
            burned &= ~np.ma.getmaskarray(data)
            inside = boundary_mask(dataset, window, width, height, boundary)
            if inside is not None:
                burned &= inside
            count = int(burned.sum())
            if count:
                area += count * window_pixel_area_km2(dataset, window, width, height)
                pixels += count
            tiles += 1
    return {
        "collection": "modis-64A1-061",
        "year": year,
        "tiles": tiles,
        "burned_pixels": pixels,
        "area_km2": round(area, 3),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bbox", required=True, help="west,south,east,north in WGS84")
    parser.add_argument("--year", type=int, default=2023)
    parser.add_argument("--max-pixels", type=int, default=512, help="sampling cap per tile")
    parser.add_argument("--output", type=Path)
    parser.add_argument("--boundary", type=Path, help="ADM1 GeoJSON used to mask the box")
    parser.add_argument("--skip-burned", action="store_true")
    args = parser.parse_args()
    try:
        bbox = [float(value) for value in args.bbox.split(",")]
    except ValueError:
        parser.error("--bbox must be west,south,east,north")
    if len(bbox) != 4 or not (-180 <= bbox[0] < bbox[2] <= 180) or not (-90 <= bbox[1] < bbox[3] <= 90):
        parser.error("--bbox must be a valid WGS84 box")

    result = {
        "bbox": bbox,
        "year": args.year,
        "source": "Microsoft Planetary Computer STAC",
        "landcover": landcover(bbox, args.year, args.max_pixels, args.boundary),
    }
    if not args.skip_burned:
        result["burned_area"] = burned_area(bbox, args.year, max(args.max_pixels, 1024), args.boundary)
    text = json.dumps(result, indent=2, ensure_ascii=False)
    if args.output:
        args.output.write_text(text + "\n", encoding="utf-8")
        print(f"wrote {args.output}")
    else:
        print(text)
    return 0


if __name__ == "__main__":
    sys.exit(main())
