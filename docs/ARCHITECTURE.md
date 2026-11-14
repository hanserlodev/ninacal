# Architecture

NinaCal is a **static web app**: no backend, no database, no API keys at runtime. The heavy
lifting (satellite CSVs → aggregated JSON) happens offline on a laptop; the browser only
reads committed JSON, filters it and draws charts.

## Data flow

```text
FIRMS CSV ──► pipelines/ (Python, offline) ──► data/processed/{year}.json ──► git
                                                                              │
                                                          static hosting (Vercel/Pages)
                                                                              │
                                                              apps/web/ (Next.js)
                                                                              │
                                                          browser: fetch → filter → sum
```

## Frontend

| Piece            | Library / approach                              | Responsibility                                   |
| ---------------- | ----------------------------------------------- | ------------------------------------------------ |
| Framework        | Next.js (App Router), `output: "export"`        | Static build, routing, bundling                  |
| Map + region     | MapLibre GL JS + `maplibre-gl-draw`             | Draw a polygon / pick a bounding box             |
| Calendar         | Apache ECharts (`heatmap` + `calendar` coords)  | Year × month matrix with an accessible color ramp |
| Time series      | ECharts `line`                                  | Harmonized monthly totals                        |
| Validation chart | ECharts `scatter`                               | Observed vs predicted MODIS on held-out years    |
| Export           | `Blob` + `URL.createObjectURL`                  | CSV of the current selection                     |
| Styling          | Plain CSS with custom properties                | Tokens, layout, dark theme                       |

These libraries are added when the feature lands, not before: an unused dependency is a
maintenance cost during a 36-hour event.

## How a selection becomes a number

1. The user draws a polygon (GeoJSON) or types `minLat, minLon, maxLat, maxLon`.
2. The app computes the set of grid cells whose **anchor point** falls inside the region.
   Point-in-polygon, not cell-overlap: it matches the aggregation exactly and is cheap.
3. It fetches `data/processed/{year}.json` for each year in the range, **only once**, and
   caches them in memory.
4. Rows whose `cell` is in the set are summed per `(year, month)` using `harm` only.
5. The calendar, the time series, the current-month comparison and the CSV all read from
   that single aggregate. One computation, four views.

Bounding-box case is an index comparison (`lat` between min and max, `lon` between min and
max) with no geometry library needed.

## Performance

- One JSON per year keeps payloads small and lets the app fetch lazily; a year that is out of
  range is never downloaded.
- Fetching is parallel with a small concurrency cap and an `AbortController` so a new
  selection cancels in-flight requests.
- Aggregation is O(rows) per year; 0.1° cells keep a country-year in the low hundreds of
  thousands of rows at most. That is a few hundred milliseconds in a modern browser.
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
