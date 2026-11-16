# NinaCal

**A 23-year fire activity calendar for 153 countries, on a globe you can explore.**

[![License: MIT](https://img.shields.io/badge/license-MIT-c8f04a?style=flat-square)](LICENSE)
[![NASA Space Apps 2026](https://img.shields.io/badge/NASA%20Space%20Apps-2026-0b3d91?style=flat-square)](https://www.spaceappschallenge.org/)
[![Datos: NASA FIRMS](https://img.shields.io/badge/data-NASA%20FIRMS-e03b2f?style=flat-square)](https://firms.modaps.eosdis.nasa.gov/)
[![Sitio estático](https://img.shields.io/badge/deploy-static-4a9eff?style=flat-square)](docs/ARCHITECTURE.md)

NinaCal harmonizes **Aqua/MODIS** and **Suomi-NPP/VIIRS** onto one detected-hotspot-day scale.
The current v2 bundle covers **2003–2025**; it uses NOAA-20 as a fallback in selected
Suomi-NPP outage months. NinaCal shows that series as a **year × month activity calendar**
for any country, region or drawn area inside the **153 published countries**, compares the map year’s peak month with its earlier-year
median, labels the month **Normal / Elevated / Critical**, draws the approximate conversion
band and lets you **share the exact view** or download the numbers.

Built in the open for the [NASA Space Apps Challenge 2026](https://www.spaceappschallenge.org/)
challenge *Harmonization of MODIS and VIIRS Hot Spots*. See the
[requirement-to-feature checklist](docs/NASA-COMPLIANCE.md).

![NinaCal mission-control console: world globe with published-country highlights, country/region selector and analysis deck](docs/screenshot.png)

> A thermal hotspot is not a confirmed fire. NinaCal reports satellite detections, not
> fire incidents. See [limitations](docs/limitations.md).

## Coverage and data version

Shipping data currently covers **153 countries** across the Americas, Europe, Africa, Asia and
Oceania (the full list is in `data/v2/manifest.json`). The bundle is 3.2 GB on disk, its SQLite
build is 5.1 GB with 57,298,469 monthly cell rows, and the minimal static export is 547 MB. The
pipeline can register up to 158 FIRMS countries with all 48 source-years. The globe always shows the whole world; countries
without a published bundle are dimmed, and a selection outside the published support returns an
explicit "outside coverage" message instead of a fake zero. First-level boundaries come from
geoBoundaries ADM1 (licences per country) and the country outlines from Natural Earth.

The frontend currently reads the team’s **v2 research prototype** in `data/v2/`. Its unit is
detected hotspot-days on the Suomi-NPP scale, and harmonized values begin in 2003; raw-only
2000–2002 files are retained but not plotted. The v2 README and full formal contract are in
[`docs/data-v2/`](docs/data-v2/). The older `data/processed/` + `pipelines/` contract remains
separate and is not overwritten.

## What it does

- **Pick a country or region.** Use the country/region selector, click a country on the globe
  (Pan mode), draw a polygon or type a bounding box, then choose a date range.
- **See 23 harmonized years at a glance.** A calendar heatmap (year × month) built from a single
  harmonized series, not two incompatible ones.
- **Read the map like a console.** Accurate country outlines, satellite imagery, square cells,
  zoom and hover/tap totals. Scrub or play the year timeline to see the map evolve; the color
  scale stays fixed during playback.
- **Compare with history.** The selected year’s peak month against the median of the same
  month in previous years, with a Normal/Elevated/Critical level and a generated sentence.
- **See how much to trust the fit.** The monthly series shades the empirical 80 % conversion
  band for estimated months (Aqua → VIIRS and NOAA-20 fallbacks).
- **Share and compare.** Region, year range and map year live in the URL; the compare panel
  puts any two country/department series side by side on one scale.
- **Open with the story.** The “Amazon 2024” button jumps to the record year for that region.
- **Inspect the model.** The chosen calibration and country-scale cross-validation WAPE/RMSE
  are in the console. Experimental error ranges are explicitly not confidence intervals.
- **Take the data.** Export the selected monthly series as CSV (value, empirical band,
  source and median) or use the static bundle’s per-cell export.

## How it works

```text
Data team v2 bundle (Aqua/MODIS + Suomi-NPP/VIIRS + NOAA-20 fallback)
        │
        ▼
data/v2/{CC}/years/YYYY.json   columnar, detected hotspot-days, 0.05° grid
        │
        ▼
apps/web/scripts/sync-data.mjs    gzip JSON into public/data/v2/ before dev/build
        │
        ▼
/console/                         select country + years → filter centers → sum → views + CSV
```

The current v2 bundle and formal data contract are documented in
[`docs/data-v2/`](docs/data-v2/). The older v1 pipeline and schema remain under
[`pipelines/`](pipelines/) and [`data/schemas/`](data/schemas/) as a separate legacy contract.

## Quick start

The homepage (`/`) is the project overview. The full mission-control console lives at
`/console/` so the landing page stays focused; the header and hero link directly to it. The
console opens on a globe centred on the Americas; the country selector lists every published
country and its first-level regions.

Requires Node.js ≥ 20.9 for the frontend, and CMake + a C++20 compiler for the optional API.
The frontend can run fully static or read a small C++/SQLite API (see below).

```bash
git clone https://github.com/hanserlodev/ninacal.git
cd ninacal/apps/web
npm install
npm run dev        # http://localhost:3000
```

The current v2 dataset is already available locally in `data/v2/`; no Python pipeline is
needed to run the frontend. To run the API locally (recommended for the full experience):

```bash
cd ninacal/backend
./scripts/setup.sh          # builds the server and backend/data/ninacal.sqlite from data/v2
./scripts/run-dev.sh        # http://127.0.0.1:8080

cd ../apps/web
echo 'NEXT_PUBLIC_API_BASE=http://127.0.0.1:8080' > .env.local
npm run dev
```

In API mode the frontend skips the static data copy and reads `/data` and `/api` from the
backend. Without `NEXT_PUBLIC_API_BASE` it builds the original self-contained static app.

The legacy v1 pipeline can still be run separately:

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r pipelines/requirements.txt
# see pipelines/README.md for the expected inputs and outputs
```

The current v2 bundle is already copied into `data/v2/` for editing and local testing. Keep
the analyst’s original download folder as the untouched source backup; update the repo copy
when the data team ships a new version. The static app lazily loads only the selected country
and year range. JSON is gzipped into `public/data/v2/` at build/dev sync time, so the editable
source stays readable while the browser bundle stays much smaller.

In **API mode**, the C++ backend (`backend/`) opens a read-only SQLite database generated from
`data/v2/` and serves region, grid and series endpoints with CORS and gzip. The Vercel
deployment then ships only code: `NEXT_PUBLIC_API_BASE` points at the VPS, and
`.vercelignore` keeps `data/` and `backend/` out of the upload. Local development can still use
the static provider by leaving that variable unset.

Everything else:

```bash
make check         # repo + data-contract checks (also runs in CI)
make build         # static production build in apps/web/out
make help          # list targets
```

## Performance and WebGPU

The globe is MapLibre GL (WebGL2); WebGPU is **not** used and would not speed up the data
path. The expensive part is not GPU drawing: world view asks for 12 small country series and
draws country fills (~0.6 s locally), and a country drill-down fetches one annual grid plus
its ADM1 outlines (~0.7 s locally) instead of 267k cell polygons. Playback warms the previous
and next annual grid in the background. Put Caddy/Nginx in front of the API for TLS and
gzip/brotli; the frontend already caches grids by country/year/bbox.

A 158-country cell layer at 0.05° would be tens of millions of polygons; that is why world view
shows a country-level annual fill and the cell layer loads only for the selected country/region.

## Coverage

The shipped bundle covers the **153 countries** in the manifest. Five FIRMS countries are not
published because they lack a complete 48-year archive or a usable ADM1 boundary. The catalogue
is read from the API at runtime, so adding a country does not require a frontend release.

The full inventory (counts, sizes, checksums and file layout) is in [`docs/DATA.md`](docs/DATA.md).

## Deploy

**API (VPS, Docker).** The backend owns the data; the frontend never uploads it.

```bash
cd ninacal
make api                       # build the SQLite database on the host
docker compose build
docker compose up -d api       # http://127.0.0.1:8080/health
```

The image contains only the compiled server. `data/v2/` and
`backend/data/ninacal.sqlite` are mounted read-only from the host, so rebuilding the data does
not rebuild the image. `deploy/Caddyfile` adds TLS, gzip and a domain in front of the API.

Without Docker, use `backend/scripts/setup.sh` and `backend/scripts/run-vps.sh`.

**API (VPS, native).**

```bash
cd ninacal/backend
./scripts/setup.sh
PORT=8080 HOST=0.0.0.0 ./scripts/run-vps.sh
```

Put Caddy or Nginx in front for TLS and compression, for example
`api.example.com { reverse_proxy 127.0.0.1:8080 }`.

**Frontend (Vercel).** Use `apps/web` as the project root, `npm run build` as the build
command and `out` as the output directory. Set:

```text
NEXT_PUBLIC_API_BASE=https://api.example.com
```

With that variable present, `prebuild` skips the data copy, so the deployment is code only
(about 9 MB, no `data/`). Leave the variable unset to produce the original self-contained
static build.

## Repository layout

```text
ninacal/
├── apps/web/              # Next.js app (static export)
│   ├── app/               # routes, metadata, global styles
│   ├── components/        # mission control, map, calendar, charts, anomaly
│   ├── lib/               # data loading, coverage, aggregation, explorer state
│   └── scripts/           # sync-data: editable datasets → compressed public assets
├── backend/               # C++20 API + SQLite built from data/v2 (local/VPS)
├── pipelines/             # Python aggregation + calibration (offline)
├── data/
│   ├── v2/                # 153-country v2 bundle (distributed separately, see docs/DATA.md)
│   ├── samples/mock.json  # legacy fixture with the old row shape
│   ├── processed/         # legacy pipeline output; kept separate, not overwritten
│   └── schemas/           # legacy JSON Schemas
├── docs/                  # data-v2 contract, methodology, limitations, decisions
├── scripts/               # repo checks + v1/v2 data validators
└── .github/               # CI, issue/PR templates, dependabot
```

## Legacy v1 data contract

The current console uses the v2 contract in [`docs/data-v2/`](docs/data-v2/). This section
describes only the older pipeline files that remain in `data/processed/`.

`data/processed/{year}.json` is an array of rows. One row = one 0.1° cell, one month:

```json
{ "cell": "-10.2_-73.5", "y": 2019, "m": 9, "modis": 12, "viirs": 51, "harm": 12.4 }
```

| Field    | Meaning                                                          |
| -------- | ---------------------------------------------------------------- |
| `cell`   | `lat_lon` anchor of the 0.1° grid cell (`-?\d+(\.\d+)?`).         |
| `y`, `m` | Year and month (1–12).                                           |
| `modis`  | Raw MODIS detection count.                                       |
| `viirs`  | Raw VIIRS S-NPP detection count (`0` before 2012).               |
| `harm`   | Harmonized count in **MODIS-equivalent** units. The calendar uses only this field. |

Rules: **missing data is `null`, never `0`**; the grid anchor is fixed and documented in
[docs/data-dictionary.md](docs/data-dictionary.md); the harmonized series is MODIS before
2012 and calibrated VIIRS from 2012 onward.

## Documentation

- [Current v2 README + formal contract](docs/data-v2/) — units, null/sparse semantics, sources and limitations.
- [Methodology](docs/methodology.md) — aggregation, calibration, validation, plan B.
- [Data dictionary](docs/data-dictionary.md) — every field, type and null rule.
- [Limitations](docs/limitations.md) — what the data can and cannot tell you.
- [Architecture](docs/ARCHITECTURE.md) — why a static app and how it stays fast.
- [Submission checklist](docs/CHECKLIST.md) — what "done" means for the hackathon.
- [Pitch & video script](docs/pitch.md) — the 30-second story.
- [Decision log](docs/decisions/) — architecture decisions with context.

## Team

| Role                | Owns                                                  |
| ------------------- | ----------------------------------------------------- |
| **Hans**            | Tech lead, frontend, integration, deployment          |
| **Data**            | FIRMS pipeline, harmonization, calibration, schemas   |
| **Pitch**           | Research, methodology text, video, copy, QA           |

## Contributing

Issues, ideas and PRs are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). By
participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md). For security reports,
follow [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) © 2026 NinaCal contributors. Data © NASA FIRMS / EOSDIS, used under NASA's
open data policy.
