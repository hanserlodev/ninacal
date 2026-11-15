# 0004 — Expand coverage from USA + Peru to 12 countries, world-ready

- **Date:** 2026-11-15
- **Status:** accepted

## Context

The first demo limited the grid to the United States and Peru to keep the payload and the
compute budget small. The analyst's v2.2 pipeline ships 12 countries (South America, the
United States and Australia) and can register up to 158 FIRMS countries, including a
documented `make add-world` path. The product direction is now global: a globe, a country
selector and first-level regions/state/province drill-down.

## Decision

- Ship the 12-country bundle in `data/v2/` and load every country in the backend manifest.
- Replace the two-country mask with a world outline: all countries are visible, published
  countries are highlighted, and their cell layer loads only for the selected country.
- Add `apps/web/lib/countries.ts` as the catalogue (code, name, ISO3, mainland view bbox,
  ADM1 boundary) and a country/region selector backed by `/api/series/{cc}` (with bboxes).
- Keep the whole world as the default globe framing; world mode does not load 0.1° cell
  polygons (about 267k) — it shows a country-level annual fill and asks the user to drill in.
- Full-world data remains a pipeline command, not a frontend assumption:
  `make add-world` (~33 GB download, ~4–5 h, ~50 GB disk).

## Alternatives considered

- **Keep USA + Peru.** Smaller payload, but contradicts the product direction.
- **Ship all 158 countries now.** Best coverage, but the download/compute time and the 0.1°
  cell volume are too large for this iteration; the architecture is ready for it.
- **World cell layer at once.** ~267k polygons for 12 countries already; a 158-country
  layer would be unrenderable on phones. Drill-down per country is the right shape.

## Consequences

- The static bundle grows to ~465 MB (uncompressed) / ~73 MB generated under `public/data`;
  API mode avoids shipping it to Vercel. The API build is ~8 MB without data.
- The backend loads 12 countries (~771 MB SQLite) and serves region/grid/series with bboxes;
  startup is still under 100 ms for cells and lazy activity.
- Countries not in the bundle are dimmed; the UI says "outside coverage" instead of zero.
- Boundaries have per-country licences; see the geoBoundaries metadata in the pipeline and
  the backend README.
- WebGPU is not used: MapLibre renders with WebGL2 and the bottleneck is data transfer, not
  GPU compute. Loading is addressed with server-side aggregation, annual grids, caching and
  playback prefetch.
