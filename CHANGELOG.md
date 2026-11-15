# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Data issue template with cell/year/month fields, to trace numbers back to the pipeline.
- `scripts/validate_data.py`: contract checks for processed files, calibration and the mock.
- Interactive explorer: MapLibre map with rectangle/polygon drawing, region presets, bounding
  box and year range controls.
- Year × month calendar with a viridis ramp and an accessible table view, monthly time series,
  current-month anomaly (median + MAD), and the validation panel with held-out metrics.
- In-browser CSV export for the current selection.
- Shipping coverage limited to the United States and Peru (ADR 0002): covered-country
  outlines, an inverse mask, coverage-aware presets and demo cells.
- Map cell layer, KPI strip, seasonality chart, annual totals in the calendar, and a
  two-column hero with the coverage card.
- Mission-control map console: coverage mask, square grid cells, satellite basemap toggle,
  fit control, live cursor/zoom/UTC telemetry and hover/tap cell readouts.
- Accurate U.S. CONUS/Alaska/Hawaii outlines from geoBoundaries ADM0, plus a globe projection
  to avoid Mercator's high-latitude stretch.
- Annual map timeline with native range scrubbing, user-controlled play/pause, source labels,
  stable cross-year color scale and a fine-grain zoom slider.
- Dedicated `/console/` route with left selection/coverage rail, central map, right-side
  anomaly/seasonality/calibration telemetry and the analysis deck below; the `/` overview
  remains map-free.
- Subtle motion: console status pulse, scan line, KPI refresh, hero entrance.
- `apps/web/scripts/sync-data.mjs`: prepares editable v2 and legacy data for static delivery;
  the app falls back to clearly-labelled demo rows only when neither dataset is available.
- Current v2 data imported under `data/v2/` with the source README and formal contract; the
  original Downloads folder remains as backup.
- Static v2 data provider reads columnar PE/US cells and selected years, honors sparse-zero
  and source-availability semantics, and exports the data-team CSV schema.
- `ExplorerDataProvider` seam for the data team's planned API; static JSON files are gzip
  compressed into `public/data/v2/` at sync time.
- v2 validation panel uses actual model choice, ratio, cross-validation WAPE/RMSE and the
  research-prototype interval caveats.

### Added

- 0.05° delivery grid (about 5.5 km) for all 12 countries, rebuilt from the analyst pipeline;
  the map aggregates to 0.1° below zoom 7 and reveals 0.05° cells when zoomed in.
- Country mask clipped to the active country outline, so Alaska/Chile/Ecuador cells no longer
  spill over water or neighbouring countries; robust antimeridian-aware region bboxes.
- “Hotspots” / “hotspot-days” terminology across the UI, calendar, charts, CSV and docs, with
  the thermal-anomaly caveat kept visible.
- Cell-level hotspot CSV export (`format=cells`, `cell,lat,lon,year,month,hotspot_days,source`)
  with a 4M-row guard; API monthly-series CSV remains available.
- Dockerfile and `docker-compose.yml` for the API; image is 139 MB and mounts the data bundle
  and SQLite database read-only.
- `docs/NASA-COMPLIANCE.md` maps every official challenge requirement to a feature.
- Global coverage: the analyst v2.2 pipeline output for 12 countries (South America, the
  United States and Australia), rebuilt and verified locally; `data/v2/` now carries the
  12-country bundle and ADM1 boundaries.
- Globe-first console with a world country outline layer, published-country highlighting,
  click-to-select (Pan mode) and a country/region selector backed by bboxes from the API.
- World mode avoids loading ~267k cell polygons: it shows a country-level annual fill for
  the map year and drills into a country/region for 0.1° cells.
- Playback prefetch for the previous/next annual grid.
- Read-only C++20 API (`backend/`) over the v2 bundle for Peru + USA: region, annual/monthly
  grid, series, health and static `/data` endpoints; SQLite built from `data/v2/`.
- `NEXT_PUBLIC_API_BASE` data mode: the Vercel deployment ships code only and reads the API on
  a VPS; `sync-data` skips the data copy and `.vercelignore` keeps it out of the upload.
- Empirical uncertainty band on the monthly series, drawn from the server's 80 % conversion
  tables for estimated months.
- Normal / Elevated / Critical semáforo with a generated sentence tied to the map year's peak
  month, plus the percentile against previous years.
- Shareable URL state (region or bbox, year range, map year) and a “Share view” clipboard action.
- “Amazon 2024” demo shortcut: the region's record year, verified at the 100th percentile of
  2003–2024 for Loreto + Ucayali + Madre de Dios.
- Two-region comparison panel over the country/department series.

### Changed

- Playbook, roadmap and submission checklist rewritten around the NASA Space Apps challenge.
- Architecture notes updated to the shipped frontend (no chart library, Esri dark basemap,
  generated `public/data`).
- Current UI copy and metadata updated to 2003–2025 detected hotspot-days; legacy v1 schemas and
  pipeline outputs remain separate and are not overwritten.

## [0.1.0] - 2026-11-14

### Added

- Repository scaffold for the NASA Space Apps 2026 challenge *Harmonization of MODIS and
  VIIRS Hot Spots*.
- Data contract, JSON Schemas, calibration record shape and a three-row mock fixture.
- Next.js static app shell with the project story, the data contract and a design preview of
  the calendar.
- Methodology, data dictionary, limitations, architecture, FAQ and pitch documents.
- CI (repo checks + static build), issue/PR templates and dependency automation.
- Community documents: contributing guide, code of conduct, security policy, support,
  governance, MIT license.

[Unreleased]: ../../compare/0.1.0...HEAD
[0.1.0]: ../../releases/tag/0.1.0
