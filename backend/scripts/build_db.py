#!/usr/bin/env python3
"""Build the read-only SQLite database the C++ server queries.

The editable source of truth stays `data/v2/` (plain JSON). This script turns
that bundle into the columnar tables in `backend/data/ninacal.sqlite`, so the
repository does not need to store a second 150 MB copy of the data.

The database is written to a temporary file and only promoted with
`os.replace` after `PRAGMA integrity_check` and row-count reconciliation, so an
interrupted build can never leave a truncated database in place.

    python3 backend/scripts/build_db.py
    python3 backend/scripts/build_db.py --countries PE US --output /tmp/ninacal.sqlite
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sqlite3
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
BACKEND = HERE.parent
REPO = BACKEND.parent


def column_rows(path: Path) -> tuple[list[str], list[list[object]]]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict) or not isinstance(value.get("columns"), list):
        raise SystemExit(f"invalid columnar file: {path}")
    return value["columns"], value["rows"]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=REPO / "data" / "v2")
    parser.add_argument("--output", type=Path, default=BACKEND / "data" / "ninacal.sqlite")
    parser.add_argument("--countries", nargs="+", default=None)
    args = parser.parse_args()

    source = args.source.resolve()
    output = args.output.resolve()
    manifest_path = source / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    requested = args.countries if args.countries else list(manifest.get("countries", {}))
    countries = list(dict.fromkeys(code.upper() for code in requested))
    missing = [code for code in countries if code not in manifest.get("countries", {})]
    if missing:
        raise SystemExit(f"countries not in manifest: {', '.join(missing)}")

    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_name(output.name + ".tmp")
    temporary.unlink(missing_ok=True)

    database = sqlite3.connect(temporary)
    started = time.time()
    total_rows = 0
    per_country: dict[str, int] = {}
    finished = False
    try:
        database.executescript(
            """
            PRAGMA journal_mode = OFF;
            PRAGMA synchronous = OFF;
            PRAGMA temp_store = MEMORY;
            CREATE TABLE cells(country TEXT, cell TEXT, lat REAL, lon REAL, area_km2 REAL, admin TEXT,
                               PRIMARY KEY(country, cell));
            CREATE TABLE availability(country TEXT, year INTEGER, month INTEGER, source TEXT,
                                      PRIMARY KEY(country, year, month));
            CREATE TABLE activity(country TEXT, cell TEXT, year INTEGER, month INTEGER,
                                  aqua INTEGER, terra INTEGER, snpp INTEGER, noaa20 INTEGER, harm REAL,
                                  PRIMARY KEY(country, cell, year, month));
            CREATE TABLE metadata(key TEXT PRIMARY KEY, value TEXT);
            """
        )
        # execscript() above committed the schema; keep all rows in one transaction.
        database.execute("BEGIN")

        for code in countries:
            entry = manifest["countries"][code]
            columns, rows = column_rows(source / code / "cells.json")
            index = {name: i for i, name in enumerate(columns)}
            cells = [
                (
                    code,
                    row[index["cell"]],
                    row[index["lat"]],
                    row[index["lon"]],
                    row[index["area_km2"]] if "area_km2" in index else 0.0,
                    row[index["admin"]] if "admin" in index else "",
                )
                for row in rows
            ]
            database.executemany("INSERT INTO cells VALUES (?,?,?,?,?,?)", cells)
            print(f"{code}: {len(cells):,} cells", flush=True)

            availability = [
                (code, item["year"], item["month"], item["source"])
                for item in entry.get("availability", [])
                if 2000 <= item["year"] <= 2025
            ]
            database.executemany("INSERT INTO availability VALUES (?,?,?,?)", availability)

            country_rows = 0
            expected_rows = 0
            for item in entry.get("files", []):
                year = int(item["year"])
                if year < 2000 or year > 2025:
                    continue
                expected_rows += int(item.get("rows", 0))
                path = source / code / "years" / f"{year}.json"
                if not path.exists():
                    raise SystemExit(
                        f"missing year file for {code}: {path}. Refusing to build a partial database."
                    )
                columns, rows = column_rows(path)
                index = {name: i for i, name in enumerate(columns)}
                values = [
                    (
                        code,
                        row[index["cell"]],
                        row[index["y"]],
                        row[index["m"]],
                        row[index["modis"]] if "modis" in index else None,
                        row[index["terra"]] if "terra" in index else None,
                        row[index["viirs"]] if "viirs" in index else None,
                        row[index["noaa20"]] if "noaa20" in index else None,
                        row[index["harm"]] if "harm" in index else None,
                    )
                    for row in rows
                ]
                database.executemany(
                    "INSERT INTO activity VALUES (?,?,?,?,?,?,?,?,?)", values
                )
                country_rows += len(values)
                print(f"  {code} {year}: {len(values):,} rows", flush=True)
            if expected_rows and country_rows != expected_rows:
                raise SystemExit(
                    f"{code}: manifest expects {expected_rows:,} activity rows, "
                    f"but the year files contain {country_rows:,}"
                )
            per_country[code] = country_rows
            total_rows += country_rows

        database.executescript(
            """
            CREATE INDEX activity_time ON activity(country, year, month);
            CREATE INDEX cell_location ON cells(country, lat, lon);
            """
        )
        database.execute(
            "INSERT INTO metadata VALUES (?,?)",
            ("build_started", time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(started))),
        )
        database.execute(
            "INSERT INTO metadata VALUES (?,?)",
            ("manifest_sha256", hashlib.sha256(manifest_path.read_bytes()).hexdigest()),
        )
        database.execute("COMMIT")

        integrity = database.execute("PRAGMA integrity_check").fetchone()[0]
        if integrity != "ok":
            raise SystemExit(f"integrity_check failed: {integrity}")
        stored = database.execute("SELECT count(*) FROM activity").fetchone()[0]
        if stored != total_rows:
            raise SystemExit(f"activity rows mismatch: inserted {total_rows:,}, stored {stored:,}")
        countries_stored = database.execute("SELECT count(DISTINCT country) FROM activity").fetchone()[0]
        if countries_stored != len(countries):
            raise SystemExit(
                f"only {countries_stored} countries have activity rows, expected {len(countries)}"
            )
        orphans = database.execute(
            "SELECT count(*) FROM activity a LEFT JOIN cells c "
            "ON c.country = a.country AND c.cell = a.cell WHERE c.cell IS NULL"
        ).fetchone()[0]
        if orphans:
            raise SystemExit(f"{orphans:,} activity rows reference cells that do not exist")

        database.execute("VACUUM")
        database.execute("PRAGMA optimize")
        database.close()
        os.replace(temporary, output)
        finished = True
    finally:
        if not finished:
            try:
                database.close()
            finally:
                temporary.unlink(missing_ok=True)

    size = output.stat().st_size / (1024 * 1024)
    elapsed = time.time() - started
    print(
        f"wrote {output} ({size:.1f} MiB) with {total_rows:,} activity rows "
        f"for {len(countries)} countries in {elapsed:.1f}s"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
