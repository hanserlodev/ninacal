# Architecture

NinaCal is a **static frontend with an optional read-only API**. The heavy lifting (satellite
CSVs → aggregated JSON) happens offline; the browser either reads the compressed JSON bundle
or queries the small C++/SQLite backend. No API keys are needed at runtime.

## Data flow

```text
Legacy v1: FIRMS CSV → pipelines/ → data/processed/

Current v2: data team → data/v2/{CC}/ ─┬→ sync-data (gzip JSON) → public/data/v2/
                                          │                                  │
                                          │                   static hosting (Vercel)
                                          │                                  │
                                          └→ backend/build_db.py → SQLite → C++ API (VPS)
                                                                             │
                                                              /console/ → API provider → region/grid/series
```

## Frontend

| Piece            | Library / approach                                   | Responsibility                                      |
| ---------------- | ---------------------------------------------------- | --------------------------------------------------- |
| Framework        | Next.js (App Router), `output: "export"`             | Static build, routing, bundling                     |
| API              | C++20, cpp-httplib, SQLite, nlohmann/json            | Region/grid/series queries with empirical bands     |
| Data mode        | `NEXT_PUBLIC_API_BASE` switches static ↔ API         | One UI, two providers                               |
| Map + region     | MapLibre GL JS, globe projection, box/polygon tools    | Draw, pan, fit, scrub years and zoom precisely      |
| Map cells        | MapLibre fill layer, one square per grid cell          | Per-cell harmonized total, zoom-revealed grid       |
| Basemap          | Esri Dark Gray + World Imagery raster tiles           | Dark console or satellite context, no API key       |
| Map console      | React + CSS                                           | Telemetry, modes, fit, basemap, hover readout       |
| Coverage frame   | geoBoundaries ADM0 + inverse mask                     | Real U.S./Peru outlines; dim cells outside coverage  |
| Calendar         | Custom CSS grid + viridis ramp                       | Year × month matrix, colour-blind safe              |
| Time series      | Custom SVG                                           | Harmonized monthly totals + approximate error band  |
| Anomaly          | Median + MAD (robust z-score) + percentile           | Map-year peak vs. the same month in past years      |
| Compare          | Two series + SVG lines                               | Any two country/department series on one scale      |
| Validation chart | Custom SVG                                           | Metrics, monthly factors, optional observed scatter |
| Export           | `Blob` + `URL.createObjectURL`                       | CSV of the current selection                        |
| Styling          | Plain CSS with custom properties                     | Tokens, layout, dark theme                          |

No chart library ships with the app: the calendar, the series and the validation views are
small SVG/DOM components, which keeps the bundle lean and the accessibility story explicit.
The MapLibre worker is copied to `public/maplibre/` by the build script so the static export
does not depend on a bundler-emitted worker chunk.

### Routes

- `/` is the editorial overview: project story, method, contract and a clear CTA. It contains
  no live map.
- `/console/` is the dedicated mission-control instrument: map in the centre, region/year
  controls and coverage on the left, anomaly/seasonality/calibration/system telemetry on the
  right, and the full analysis deck below. The left and right rails collapse around the map
  on tablet and mobile.

The data and worker URLs are rooted at `/data/` and `/maplibre/worker.js`; this matters because
static export also emits the nested `/console/` route. The map uses the globe projection for
the Americas overview, avoiding the strong high-latitude vertical stretch of Mercator; a year
slider and user-started playback animate the selected annual hotspot-day layer on one stable color
scale.

## Data delivery

`apps/web/scripts/sync-data.mjs` runs before `next dev` and `next build`:

1. copies legacy `data/processed/*.json` and its manifest into `apps/web/public/data/`;
2. copies `data/v2/manifest.json` and compresses its JSON assets to `.json.gz`;
3. copies the MapLibre worker next to them. The editable source remains uncompressed in
   `data/v2/`.

`public/data/` is generated and git-ignored. The static v2 provider loads only the selected
countries, their grid cells and the requested year files, then filters to selected cell IDs as
each columnar file is decoded. If no v2 manifest exists, it falls back to the legacy data
contract, then to clearly-labelled synthetic demo rows.

When `NEXT_PUBLIC_API_BASE` is set, `sync-data` keeps only the MapLibre worker and skips the
data copy. `lib/api.ts` then answers three questions against the backend:

| Need | Endpoint | Use |
| --- | --- | --- |
| Monthly values, bands, anomalies | `GET/POST /api/region` | charts, calendar, semáforo, CSV |
| Annual cell layer | `GET /api/grid/{cc}?year=Y` | map + timeline playback |
| Country/department series | `GET /api/series/{cc}/{id}` | compare panel |

The backend (`backend/`) opens `backend/data/ninacal.sqlite` read-only. `scripts/build_db.py`
rebuilds it from `data/v2/` in a few seconds; only `PE` and `US` are loaded. The Vercel build
sets `NEXT_PUBLIC_API_BASE` to the VPS and `.vercelignore` keeps `data/` and `backend/` out of
the upload, so the deployed frontend carries no data.

## Coverage

Shipping coverage is **78 countries** worldwide (ADR 0002, amended by 0004 and the 2026-11
world release). The pipeline can register up to 158 FIRMS countries. `apps/web/lib/countries.ts` is
the catalogue; `apps/web/lib/coverage.ts` provides bbox selection/status; the globe uses
Natural Earth 110m outlines (`lib/boundaries/world.json`) and geoBoundaries ADM1 for regions.
The same shapes are used to:

1. seed and mask demo cells, so the demo never invents fires outside the published countries;
2. draw world outlines and highlight countries with data;
3. flag selections that fall outside coverage instead of showing an empty screen with no
   explanation.

With real data, the committed rows are the source of truth. Country outlines are Natural
Earth (public domain); first-level regions are geoBoundaries ADM1 with the licence recorded
per country. They are rendering/selection references, not legal boundaries.

## How a selection becomes a number

1. The user chooses a country/region preset, clicks the globe, draws a polygon, or types a bbox.
2. The provider fetches that country's `cells.json` once and selects published cell centres
   inside the selection. Whole-country presets include every published country cell,
   including border anchors.
3. It fetches only the selected countries and requested `years/YYYY.json.gz` files. Each
   columnar row is decoded and immediately discarded if its cell is not selected.
4. It sums non-null `harm` using detected hotspot-days. For a published cell and available
   source month, a sparse omitted row is zero; a manifest month marked `unavailable` remains
   null, not zero.
5. The map, calendar, time series, anomaly and CSV all read from that aggregate. The data
   provider interface lets the analyst's API replace the static bundle later.

Bounding-box case is an index comparison (`lat` between min and max, `lon` between min and
max) with no geometry library needed. A missing month stays `null`: the interface shows
“no measurement” instead of inventing a zero.

## Performance

- One compressed JSON per country/year keeps payloads small and lets the app fetch lazily; a
  year that is out of range is never decompressed.
- Fetching is parallel with a small concurrency cap and an `AbortController` so a new
  selection cancels in-flight year requests.
- Aggregation is O(rows) per year; 0.05° cells keep a country-year in the low hundreds of thousands of
  thousands of rows at most. That is a few hundred milliseconds in a modern browser.
- The map is loaded with `next/dynamic` and a stable worker URL, so MapLibre never enters the
  server render or the initial page bundle.
- The map draws one square polygon per active cell (not one per row): the aggregator keeps a
  `cellTotals` map while summing, and MapLibre fills a single GeoJSON source. Cell borders
  fade in with zoom, so the grid reads as coverage at low zoom and resolves into cells up
  close.
- If a year grows beyond the size budget, the pipeline emits a coarser grid — same schema,
  fewer cells — instead of changing the frontend.

## Deployment

`npm run build` in `apps/web` produces a fully static `out/` directory. It is deployed to
Vercel, Cloudflare Pages or GitHub Pages with no server-side runtime. Any environment
variable that exists at build time is baked into the bundle; there are no secrets at runtime.

## Repo-wide conventions

- **One source of truth for data**: [`data/schemas/`](../data/schemas/) and
  [`docs/data-dictionary.md`](data-dictionary.md). Changing them is a PR that updates both.
- **The pipeline never runs in CI**: CI validates committed data, it does not regenerate it.
- **`main` is always deployable.** Feature branches, small PRs.
- **Documentation lives next to what it describes**; architectural choices become ADRs in
  [`docs/decisions/`](decisions/).

## Why not a backend?

See [ADR 0001](decisions/0001-static-next-export.md). In short: the data is small enough
after aggregation, precomputation is free at build time, and a static app survives a
hackathon deadline and a judge's phone alike.
