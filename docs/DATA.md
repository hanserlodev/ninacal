# Data inventory

Single source of truth for what NinaCal ships, how big it is, and how to rebuild it. The bundle
itself is **not committed** (see `.gitignore`); this file describes it.

## Release 2026-11-15 (current)

| Item | Value |
|---|---|
| Countries | **153** |
| Period | 2003–2025 (276 months) |
| Grid | **0.05°** (≈5.5 km), country-masked |
| Cells | **2,794,550** |
| Monthly cell rows | **57,298,469** |
| Bundle on disk (`data/v2/`) | **3.2 GB** |
| SQLite (`backend/data/ninacal.sqlite`) | **5.1 GB** |
| Minimal static export | **547 MB** |
| Release tarball (`ninacal-153-payload.tar.zst`) | **1.17 GB**, sha256 `bcc1200e481cb7edb475a14ed0d5e3de23df62c00d2fe455324068bfa8af8f02` |
| Verification | `make verify` → **153/153** countries (two grids, 276 months, administrative sums, quarters, years, SQLite, query and 26 JSON/CSV exports) |

Five FIRMS countries with a complete archive are not published because they lack a usable ADM1
boundary or fail the coverage check. Coverage is derived from `manifest.json`, never hardcoded.

## Layout

```text
data/v2/
├── manifest.json          # names, iso3, boundary file and view bbox per country, file inventory
├── boundaries/            # ADM1 GeoJSON (305 files) used by the frontend and the API
└── <CC>/                  # one folder per country
    ├── series.json        # monthly/quarterly/yearly series, country + every ADM1 unit
    ├── cells.json         # every published 0.05° cell: id, centre, area, ADM1 unit
    ├── cells/YYYY/MM.json # monthly cell values (the calendar reads these)
    ├── models.json        # chosen calibration, held-out error, bands, closure checks
    ├── queries/*.json     # precomputed query fixtures used by the tests
    └── exports/           # JSON/CSV fixtures for the export endpoints
backend/data/ninacal.sqlite # built from data/v2 by backend/scripts/build_db.py
```

## Provenance

- **NASA FIRMS** country-year archives: Aqua/MODIS (2003–2012), Suomi-NPP/VIIRS (2012–2025) and
  NOAA-20/VIIRS (2018–2025) as a bridge for documented outage months.
- **geoBoundaries** ADM1 boundaries and **Natural Earth** country outlines.
- Context layers (not part of the bundle): Microsoft Planetary Computer (IO land cover, MCD64A1
  burned area) and Meteomatics weather, proxied separately.

## Rebuild and verify

```bash
# regenerate the bundle (analyst pipeline, ~4–5 h for the full world)
cd ninacal-pipeline-v2.2 && make all WORKERS=4

# rebuild SQLite from data/v2
python3 backend/scripts/build_db.py

# validate the bundle and the API contract
python3 scripts/validate_v2_data.py
make verify   # inside the pipeline: 153/153 countries
```

## Unit and caveats

`harm` is **detected hotspot-days on the Suomi-NPP scale** per 0.05° cell and month: one cell adds
one per day with at least one accepted detection. It is not a fire count, not pixels and not burned
area. Sparse absence means zero only inside the published support and an available month; a month
with an unavailable source stays unknown. Country-level monthly error is 5–31% depending on how
much fire a country has; 0.5° tiles are noisier than departments. See
[`methodology.md`](methodology.md), [`limitations.md`](limitations.md) and the
[method paper](paper/ninacal-method-paper.pdf).
