# NinaCal API (v2.2)

Small C++20 HTTP server over the NinaCal v2.2 data for **153 countries** worldwide:
harmonized MODIS + VIIRS detected activity, 2003–2025, 0.05° grid. It answers region queries from SQLite and serves the exported JSON bundle; the
pipeline can register up to the whole world.

```
backend/
├── README.md            this guide
├── DATA_CONTRACT.md     meaning of every field and null
├── CMakeLists.txt
├── src/                 server source (main.cpp, store.*, region.*)
├── third_party/         vendored httplib.h + nlohmann/json.hpp (header-only)
├── scripts/             build_db.py, setup.sh, run-dev.sh, run-vps.sh
└── data/
    └── ninacal.sqlite   generated from data/v2 (git-ignored)
```

The **editable source of truth stays `data/v2/`**. `scripts/build_db.py` turns that bundle
into a read-only SQLite database; the server never writes to it. It loads every country in
`data/v2/manifest.json` by default (`--countries PE US` narrows it).

## Local build and run

No system `cpp-httplib` or `nlohmann-json` packages are required: both headers are vendored.

```sh
cd backend
./scripts/setup.sh          # cmake build + python3 scripts/build_db.py
./scripts/run-dev.sh        # http://127.0.0.1:8080
```

`setup.sh` builds `build/ninacal-server` and writes `data/ninacal.sqlite` (about 1.3 GiB
for the 153-country 0.05° bundle, ~5 min). The database is git-ignored; regenerate it whenever `data/v2/` changes, then restart the
server so it opens the new file.

Requires CMake, Ninja, a C++20 compiler, SQLite 3 and zlib:

```sh
# Arch
sudo pacman -S --needed sqlite zlib cmake ninja gcc python
# Debian/Ubuntu
sudo apt install libsqlite3-dev zlib1g-dev cmake ninja-build g++ python3
```

Then open `http://127.0.0.1:8080/health`. Other options: `--host 0.0.0.0` to accept other
machines, `--threads N`. With the server running, `./scripts/smoke.sh` checks the main
endpoints and the presence of bands. At startup the server loads cell coordinates (~83k) and error-band
tables; the first region query of a country loads its monthly values into memory (US: <1 s
once), after which any region answers in milliseconds. Every response allows cross-origin
requests; put Caddy/Nginx in front for TLS and gzip/brotli compression.

## Frontend in API mode

The Next.js app reads the backend when `NEXT_PUBLIC_API_BASE` is set:

```sh
# apps/web/.env.local
NEXT_PUBLIC_API_BASE=http://127.0.0.1:8080
```

In this mode `npm run dev` / `npm run build` skip the static data copy. The frontend then uses:

- `GET /api/region` for the current selection (monthly values, bands and anomalies);
- `GET /api/grid/{cc}?year=Y` for the annual map layer and playback;
- `GET /api/series/{cc}/{id}` for the compare panel;
- `GET /data/...` for the manifest, cells, calibration and model metadata.

For the Vercel deployment, set `NEXT_PUBLIC_API_BASE=https://api.example.com` **and leave
`data/` and `backend/` out of the upload** (see the repository `.vercelignore`). The static
frontend has no data of its own; the VPS owns the database and the JSON bundle.

## VPS

```sh
cd ninacal/backend
./scripts/setup.sh
PORT=8080 HOST=0.0.0.0 ./scripts/run-vps.sh
```

Put it behind Caddy/Nginx with TLS. A minimal Caddyfile:

```
api.example.com {
    reverse_proxy 127.0.0.1:8080
}
```

Then set the Vercel environment variable to `https://api.example.com`. CORS is already `*`;
tighten it in `src/main.cpp` if you publish under a fixed domain.

## Full world

The included bundle has 153 countries. After running the analyst pipeline for more countries
and copying its `web/data/v2/` into this repo, rerun `scripts/build_db.py`. The server loads every country in the manifest; no code change
is needed. Country names, ISO3, boundary file and view bbox come from the manifest when
present.

## Endpoints

Country codes come from the manifest: `PE US EC CL CO PY MX BO VE AR AU BR`. Errors return `{"error": "..."}` with status 400 (bad
input) or 404 (unknown country, series or path).

### `GET /health`

`{"status": "ok", "countries": 12}`

### `GET /api/countries`

One object per country: `code`, `name`, number of `cells`, the `chosen` model and the measured interval limits.

### `GET /api/series/{cc}`

The series available for a country: `[{"id": "PE-JUN", "name": "Junín", "cells": 353}, …]`. The first entry is
the whole country (`id` = `cc`).

### `GET /api/series/{cc}/{id}?level=months|quarters|years`

One entry of `series.json`. Without `level` it returns the full entry; with `level` it returns
`{id, name, cells, interval_status, level, rows}`. Row fields are described in `DATA_CONTRACT.md`.

```sh
curl 'http://127.0.0.1:8080/api/series/PE/PE-JUN?level=years'
```

### `GET /api/grid/{cc}?year=Y[&month=M][&bbox=W,S,E,N]`

Every published cell with activity in one month, or in the whole year when `month` is omitted
(or `month=0`), for map layers. Columnar:
`{"columns": ["cell", "lat", "lon", "harm"], "rows": [...], "source": "snpp_observed", ...}`.
Cells not listed have 0. `harm` is `null` for 2000–2002. If `source` is `unavailable`, show the month as
missing, not as 0.

```sh
curl 'http://127.0.0.1:8080/api/grid/PE?year=2024'          # annual sums for playback
curl 'http://127.0.0.1:8080/api/grid/PE?year=2024&month=9'  # one month
```

### `GET /api/region?country=CC[&bbox=W,S,E,N][&start=2003][&end=2025][&format=json|csv|cells]`

Monthly totals for the cells whose **center** falls in the box (west inclusive, east exclusive; a box with
west > east crosses the antimeridian). Without `bbox` it covers the whole country.

```sh
curl 'http://127.0.0.1:8080/api/region?country=PE&bbox=-76,-13,-74,-10&start=2015&end=2020'
curl -o junin.csv 'http://127.0.0.1:8080/api/region?country=PE&bbox=-76,-13,-74,-10&format=csv'
curl -o hotspots.csv 'http://127.0.0.1:8080/api/region?country=PE&bbox=-76,-13,-74,-10&format=cells'
```

`format=csv` returns the monthly series with bands and source. `format=cells` returns one row
per published cell-month with a positive harmonized value
(`cell,lat,lon,year,month,hotspot_days,source`); it is capped at 4 million rows, so narrow
large selections.

### `POST /api/region[?format=json|csv|cells]`

Same as above for a drawn region. Body:

```json
{"country": "PE", "polygon": {"type": "Polygon", "coordinates": [[[-76, -13], [-74, -13], [-74, -10], [-76, -13]]]},
 "start": 2003, "end": 2025}
```

`polygon` accepts a GeoJSON `Polygon`, `MultiPolygon` or a `Feature` holding one; holes are respected.
`bbox` (`[W, S, E, N]`) may be sent too, and both filters then apply.

Response:

```json
{"country": "PE", "cells": 412, "cell_center_selection": true, "support_area_km2": 49123.4,
 "observation_coverage": "unknown", "interval_status": "exploratory_not_validated",
 "cell_year_p98": 39.1,
 "months": [{"year": 2003, "month": 1, "value": 12.4, "low": 6.1, "high": 21.0, "source": "aqua_estimated",
             "band_group": "2:2", "median": null, "anomaly_mad": null, "reference_years": 0}, …]}
```

If no published cell falls inside, the answer is `{"cells": 0, "status": "outside_published_support",
"months": []}`: show "outside the data coverage", not "no fire".

Bands for drawn regions use the same empirical tables as `harmonize.query`, chosen by the number of cells.
They are less validated than the national and departmental bands: label them "approximate".

### `GET /data/...`

The exported files, unchanged (`/data/manifest.json`, `/data/PE/years/2020.json`, …).
