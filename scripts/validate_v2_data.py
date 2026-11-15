#!/usr/bin/env python3
"""Cheap structural validation for the committed v2 bundle."""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "v2"
CELL_COLUMNS = ["cell", "lat", "lon", "area_km2", "admin"]
YEAR_COLUMNS = ["cell", "y", "m", "modis", "terra", "viirs", "noaa20", "harm"]



def fail(message: str) -> None:
    raise ValueError(message)


def read_json(path: Path):
    try:
        with path.open(encoding="utf-8") as stream:
            return json.load(stream)
    except Exception as error:  # noqa: BLE001 - report the precise data file
        fail(f"{path.relative_to(ROOT)}: invalid JSON ({error})")


def main() -> int:
    manifest_path = DATA / "manifest.json"
    if not manifest_path.is_file():
        fail("missing data/v2/manifest.json")

    manifest = read_json(manifest_path)
    if manifest.get("schema_version") != 2:
        fail("data/v2/manifest.json: schema_version must be 2")
    if manifest.get("resolution_degrees") not in (0.1, 0.05):
        fail("data/v2/manifest.json: expected a 0.1° or 0.05° grid")
    if manifest.get("scale") != "daytime Suomi-NPP-equivalent detected cell-days":
        fail("data/v2/manifest.json: unexpected units")

    countries = tuple(manifest.get("countries", {}))
    if not countries:
        fail("data/v2/manifest.json: no countries")

    for country in countries:
        country_dir = DATA / country
        inventory = manifest.get("countries", {}).get(country)
        if not isinstance(inventory, dict):
            fail(f"manifest is missing country {country}")
        boundary = inventory.get("boundary")
        if not isinstance(boundary, str) or not boundary:
            fail(f"manifest: {country} has no ADM1 boundary")
        elif not (DATA / "boundaries" / boundary).exists():
            fail(f"manifest: {country} boundary file not found: {boundary}")
        view = inventory.get("view_bbox")
        if not (
            isinstance(view, list)
            and len(view) == 4
            and all(isinstance(value, (int, float)) and math.isfinite(value) for value in view)
        ):
            fail(f"manifest: {country} has no finite view_bbox")
        if not isinstance(inventory.get("name"), str) or not inventory["name"].strip():
            fail(f"manifest: {country} has no name")
        if not isinstance(inventory.get("iso3"), str) or len(inventory["iso3"]) != 3:
            fail(f"manifest: {country} has no ISO3")

        cells = read_json(country_dir / "cells.json")
        if cells.get("columns") != CELL_COLUMNS:
            fail(f"{country}/cells.json: unexpected column contract")
        cell_rows = cells.get("rows")
        if not isinstance(cell_rows, list) or len(cell_rows) != inventory.get("cells"):
            fail(f"{country}/cells.json: row count does not match manifest")
        for index, row in enumerate(cell_rows):
            if (
                not isinstance(row, list)
                or len(row) != len(CELL_COLUMNS)
                or not isinstance(row[0], str)
                or not isinstance(row[1], (int, float))
                or not isinstance(row[2], (int, float))
                or not isinstance(row[3], (int, float))
                or not isinstance(row[4], str)
            ):
                fail(f"{country}/cells.json: invalid row {index}")
            if not all(math.isfinite(value) for value in row[1:4]):
                fail(f"{country}/cells.json: non-finite geometry at row {index}")
            if not (-90 <= row[1] <= 90 and -180 <= row[2] <= 180):
                fail(f"{country}/cells.json: out-of-range lat/lon at row {index}")

        files = inventory.get("files")
        if not isinstance(files, list) or not files:
            fail(f"manifest: {country} has no year file inventory")

        for item in files:
            year = item.get("year")
            relative = item.get("path")
            if not isinstance(year, int) or not isinstance(relative, str):
                fail(f"manifest: invalid year file entry for {country}")
            year_file = country_dir / relative
            if not year_file.is_file():
                fail(f"missing {year_file.relative_to(ROOT)}")
            data = read_json(year_file)
            if data.get("columns") != YEAR_COLUMNS:
                fail(f"{year_file.relative_to(ROOT)}: unexpected column contract")
            rows = data.get("rows")
            if not isinstance(rows, list) or len(rows) != item.get("rows"):
                fail(f"{year_file.relative_to(ROOT)}: row count does not match manifest")

            for index, row in enumerate(rows):
                if not isinstance(row, list) or len(row) != len(YEAR_COLUMNS):
                    fail(f"{year_file.relative_to(ROOT)}: invalid columnar row {index}")
                cell, row_year, month, *_sensor_values, harm = row
                if not isinstance(cell, str) or row_year != year or not isinstance(month, int) or not 1 <= month <= 12:
                    fail(f"{year_file.relative_to(ROOT)}: invalid cell/year/month at row {index}")
                if harm is not None and (
                    not isinstance(harm, (int, float)) or not math.isfinite(harm) or harm < 0
                ):
                    fail(f"{year_file.relative_to(ROOT)}: invalid harm at row {index}")

        series = read_json(country_dir / "series.json")
        country_series = series.get(country)
        months = country_series.get("months") if isinstance(country_series, dict) else None
        if not isinstance(months, list) or len(months) != 276:
            fail(f"{country}/series.json: expected 276 monthly country rows")

        calibration = read_json(country_dir / "calibration.json")
        models = read_json(country_dir / "models.json")
        if not isinstance(calibration.get("model"), dict) or not models.get("chosen"):
            fail(f"{country}: missing calibration/model summary")

        print(f"  ok    {country}: {len(cell_rows):,} cells, {len(files)} years, 276 series months")

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except ValueError as error:
        print(f"FAIL  {error}", file=sys.stderr)
        raise SystemExit(1)
