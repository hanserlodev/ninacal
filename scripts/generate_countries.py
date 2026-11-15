#!/usr/bin/env python3
"""Generate the frontend country catalogue from the v2 manifest.

The API still returns the authoritative list; this JSON keeps the static
frontend (and the map country picker) in sync without hand-writing entries.
Run it after `make export` and before committing/deploying:

    python3 scripts/generate_countries.py
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "v2"
REGISTRY = ROOT.parent / "pipeline-work" / "ninacal-pipeline-v2.2" / "harmonize" / "countries.json"
OUTPUT = ROOT / "apps" / "web" / "lib" / "countries.generated.json"

# Mainland framing for countries whose published cells include remote islands.
VIEW_OVERRIDES = {
    "US": {"minLon": -125.0, "minLat": 24.0, "maxLon": -66.5, "maxLat": 49.5},
    "CL": {"minLon": -75.7, "minLat": -56.0, "maxLon": -66.4, "maxLat": -17.5},
    "EC": {"minLon": -81.1, "minLat": -5.1, "maxLon": -75.2, "maxLat": 1.7},
    "AU": {"minLon": 112.9, "minLat": -43.8, "maxLon": 153.7, "maxLat": -10.6},
}


def robust_bbox(points: list[tuple[float, float]]) -> dict[str, float]:
    if not points:
        return {"minLon": -180, "minLat": -90, "maxLon": 180, "maxLat": 90}
    points = sorted(points)
    largest = 0.0
    split = 0
    for index in range(len(points) - 1):
        gap = points[index + 1][0] - points[index][0]
        if gap > largest:
            largest = gap
            split = index + 1
    start, end = 0, len(points)
    if largest > 180:
        if split >= len(points) - split:
            end = split
        else:
            start = split
    subset = points[start:end]
    lons = [point[0] for point in subset]
    lats = [point[1] for point in subset]
    return {
        "minLon": min(lons),
        "minLat": min(lats),
        "maxLon": max(lons),
        "maxLat": max(lats),
    }


def main() -> int:
    manifest = json.loads((DATA / "manifest.json").read_text())
    registry = {}
    if REGISTRY.exists():
        registry = {entry["code"]: entry for entry in json.loads(REGISTRY.read_text())}
    countries = []
    for code, entry in manifest["countries"].items():
        meta = registry.get(code, {})
        cells = json.loads((DATA / code / "cells.json").read_text())
        index = {name: position for position, name in enumerate(cells["columns"])}
        points = [
            (float(row[index["lon"]]), float(row[index["lat"]]))
            for row in cells["rows"]
        ]
        view = VIEW_OVERRIDES.get(code, robust_bbox(points))
        name = entry.get("name") or meta.get("firms", code).replace("_", " ")
        iso3 = entry.get("iso3") or meta.get("iso3") or code
        boundary = entry.get("boundary") or meta.get("boundary") or ""
        if not boundary or not (DATA / "boundaries" / boundary).exists():
            print(f"SKIP {code}: boundary {boundary!r} missing")
            continue
        rounded = {key: round(value, 4) for key, value in view.items()}
        entry["name"] = name
        entry["iso3"] = iso3
        entry["boundary"] = boundary
        entry["view_bbox"] = [
            rounded["minLon"],
            rounded["minLat"],
            rounded["maxLon"],
            rounded["maxLat"],
        ]
        countries.append(
            {
                "code": code,
                "name": name,
                "iso3": iso3,
                "boundary": boundary,
                "viewBbox": rounded,
            }
        )

    countries.sort(key=lambda item: item["name"].lower())
    OUTPUT.write_text(json.dumps(countries, ensure_ascii=False, indent=2) + "\n")
    (DATA / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, separators=(",", ":")) + "\n"
    )
    print(f"wrote {OUTPUT.relative_to(ROOT)} with {len(countries)} countries")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
