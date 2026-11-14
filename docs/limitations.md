# Limitations

Honest limits are part of the product. These are shown in the app and repeated here for
judges and users.

## What a hotspot is — and is not

- A **thermal anomaly** is a pixel that a satellite algorithm found hotter than its
  surroundings. It is **not a confirmed fire**, not an acreage, and not a damage estimate.
- Small, cool, short-lived or smoke-obscured fires can be missed entirely.
- Industrial heat sources ( flares, kilns) can appear as detections. NinaCal does not filter
  them out; it aggregates them.
- Attribution ("this is a wildfire" vs "this is agricultural burning") is **not** in the
  data. Do not infer it from the calendar.

## Sensor limits

- **MODIS** (1 km) is less sensitive to small fires than **VIIRS** (375 m). Part of the
  apparent increase after 2012 is instrumentation, not necessarily more fire. The
  calibration reduces this effect; it does not erase it.
- **VIIRS starts in 2012.** Pre-2012 values come from MODIS alone, so early years are
  structurally less sensitive. This is labeled in the interface.
- Detections depend on **cloud cover, overpass time and algorithm version**. Two products
  can observe the same fire different numbers of times.
- FIRMS timestamps are **UTC**. Local-time interpretations can shift a day (and therefore a
  month) at the edge of a month.

## Coverage and aggregation

- Data is processed for the **study region(s) committed by the team** — initially Peru. The
  app does not promise global coverage; drawing outside the covered grid returns no data.
- The exported CSV contains **harmonized counts per 0.1° cell and month**, not individual
  hotspot records. Individual points are far too heavy to ship as static files and are
  already available from FIRMS.
- A 0.1° cell is ~11 km at the equator. Small regions inside one cell cannot be separated.
- Counts are **detections**, not events: a single large fire can be detected many times.

## Harmonization uncertainty

- The calibration is validated on 2021 → 2026 held-out years, but it is a statistical
  correction. Expect residual error; see `metrics` in `calibration.json`.
- Ratios are fitted per month, not per ecosystem. A month with unusual burning patterns may
  fall outside the fitted range.
- Pre-2012 vs post-2012 comparability is **improved, not perfect**. The calendar is a
  planning and communication tool, not an official fire statistic.

## Product scope

- No live alerting, no fire spread modeling, no risk scoring, no AI.
- No accounts, no server, no database: the site is static and reads committed JSON files.
- Recently processed months may differ from later FIRMS revisions, because NRT data is
  replaced by standard processing after the fact.
