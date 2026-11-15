# NASA challenge compliance

Challenge: **Harmonization of MODIS and VIIRS Hot Spots** (NASA Space Apps 2026).
Official brief: <https://www.spaceappschallenge.org/2026/challenges/modis-and-viirs-hot-spots/>.

## Requirement → implementation

| Brief | Where it is satisfied |
| --- | --- |
| Harmonize MODIS and VIIRS into one record | Aqua/MODIS is converted to the Suomi-NPP scale with a Poisson block/quarter model; NOAA-20 fills selected Suomi-NPP outages. `harm` is the single harmonized field. |
| Sensor of origin no longer matters | The calendar, map, anomaly, comparison and CSV all use the harmonized field. Raw sensor columns remain available for audit only. |
| Web application | Next.js console at `/console/`, static or API-backed. |
| Burning activity calendar | Year × month calendar, 2003–2025, with a color-blind-safe viridis ramp and an accessible table. |
| Historical patterns / critical periods | Seasonality panel (median by month), range peak, year timeline, peak-season sentence. |
| Unusual conditions vs historical median | Robust median/MAD, percentile, Normal/Elevated/Critical (`Low` when below normal), multi-year comparison. |
| Current/latest month vs history | `Month status` toggle: **Year peak** and **Latest observed**. |
| Selected area of interest | Globe country/region selector, map click (Pan), rectangle/polygon drawing, manual lat/lon bbox. |
| Date range | From/To year selectors and map-year scrubber/playback. |
| Download hotspots | `Export CSV` downloads the cell-level hotspots for the selection: `cell,lat,lon,year,month,hotspot_days,source` (API `format=cells`; static export writes the same columns). |
| Download analytics / visualizations | The same CSV carries harmonized values and source; the on-screen charts are the visual analytics. |
| Map and coordinate entry | MapLibre globe with real country/ADM1 outlines; manual bbox form. |
| Accessible color ramp | Viridis ramp, numeric labels, table fallback for the calendar. |
| Emergency managers / scientists / land managers | Plain-language Normal/Elevated/Critical status and a generated percentile sentence; technical panel with CV WAPE/RMSE and empirical bands. |
| Uncertainty | Empirical 80% conversion bands for estimated months, explicitly labelled approximate, not confidence intervals. |

## Definitions used in the UI

- **Hotspot-day**: one 0.05° cell with at least one accepted FIRMS daytime hotspot on one
  local solar day. A cell counts at most once per day, which removes duplicate pixels and
  overlapping satellite passes.
- **Hotspots / hotspot-days**: the monthly value is the sum of hotspot-days in the selected
  cells. It is not a count of confirmed fires, burned hectares or individual pixels.
- **A thermal hotspot is not a confirmed fire.** This caveat stays visible in the console.

## Known limits (honest gaps)

- The shipped bundle ends in **2025**, the last complete FIRMS year. FIRMS country-level 2026
  CSV files returned 404 when checked on 2026-11-15; when they are published, add 2026 to the
  pipeline year list and rerun `download`, `prepare`, `models` and `export`. The UI already
  shows the **Latest observed** month, so it will pick up the new end date.
- Harmonization is valid for aggregates; cell-level agreement between sensors is about 55%,
  so do not use a single cell as proof that a specific fire occurred.
- 2003–January 2012 are estimates with an empirical band; observed VIIRS months have no band.
- The full world has 158 eligible FIRMS countries; the pipeline supports them, but this
  repository ships the 12 already computed. `make add-world` is the documented next step.
