#!/usr/bin/env python3
"""Validate committed JSON against the NinaCal data contract (stdlib only)."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CELL_RE = re.compile(r"^-?\d+(\.\d+)?_-?\d+(\.\d+)?$")
ROW_KEYS = {"cell", "y", "m", "modis", "viirs", "harm"}
CALIBRATION_KEYS = {
    "generated_at",
    "products",
    "method",
    "train",
    "test",
    "metrics",
    "by_month",
}

errors: list[str] = []


def load(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        errors.append(f"{path.relative_to(ROOT)}: invalid JSON ({exc})")
        return None


def is_int(value) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


def check_row(path: Path, index: int, row) -> None:
    where = f"{path.relative_to(ROOT)}[{index}]"
    if not isinstance(row, dict):
        errors.append(f"{where}: row must be an object")
        return
    if set(row) != ROW_KEYS:
        errors.append(f"{where}: keys must be exactly {sorted(ROW_KEYS)}")
        return
    if not isinstance(row["cell"], str) or not CELL_RE.match(row["cell"]):
        errors.append(f"{where}: invalid cell {row['cell']!r}")
    if not is_int(row["y"]) or not 2000 <= row["y"] <= 2100:
        errors.append(f"{where}: invalid y {row['y']!r}")
    if not is_int(row["m"]) or not 1 <= row["m"] <= 12:
        errors.append(f"{where}: invalid m {row['m']!r}")
    for key in ("modis", "viirs"):
        value = row[key]
        if value is not None and (not is_int(value) or value < 0):
            errors.append(f"{where}: {key} must be a non-negative integer or null")
    harm = row["harm"]
    if harm is not None and (not isinstance(harm, (int, float)) or harm < 0):
        errors.append(f"{where}: harm must be a non-negative number or null")
    if is_int(row["y"]) and row["y"] < 2012 and row["viirs"] not in (0, None):
        errors.append(f"{where}: viirs must be 0 before 2012")


def check_year_file(path: Path) -> None:
    data = load(path)
    if data is None:
        return
    if not isinstance(data, list):
        errors.append(f"{path.relative_to(ROOT)}: must be an array of rows")
        return
    for index, row in enumerate(data):
        check_row(path, index, row)


def check_calibration(path: Path) -> None:
    data = load(path)
    if data is None:
        return
    if not isinstance(data, dict):
        errors.append(f"{path.relative_to(ROOT)}: must be an object")
        return
    missing = CALIBRATION_KEYS - set(data)
    if missing:
        errors.append(f"{path.relative_to(ROOT)}: missing keys {sorted(missing)}")
        return
    if data["method"] not in {"ratio", "regression", "quantile"}:
        errors.append(f"{path.relative_to(ROOT)}: unknown method {data['method']!r}")
    by_month = data["by_month"]
    if not isinstance(by_month, dict) or set(by_month) != {str(i) for i in range(1, 13)}:
        errors.append(f'{path.relative_to(ROOT)}: by_month must have keys "1" through "12"')


def main() -> int:
    schemas = sorted((ROOT / "data" / "schemas").glob("*.json"))
    for schema_path in schemas:
        if load(schema_path) is not None:
            print(f"  ok    parsed {schema_path.relative_to(ROOT)}")

    for path in sorted((ROOT / "data" / "processed").glob("*.json")):
        if path.name == "calibration.json":
            check_calibration(path)
        else:
            check_year_file(path)

    mock = ROOT / "data" / "samples" / "mock.json"
    if mock.exists():
        check_year_file(mock)

    for error in errors:
        print(f"  FAIL  {error}")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
