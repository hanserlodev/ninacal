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

## v2 data and sensor limits

- The current bundle covers **2003–2025**. `harm` is daytime detected **hotspot-days** on the
  Suomi-NPP scale, not raw pixel detections or fire counts. Raw 2000–2002 rows are present
  only for audit and are not plotted because they are not harmonized.
- Aqua/MODIS is converted to the Suomi-NPP scale through January 2012; Suomi-NPP is observed
  from February 2012. **NOAA-20** provides an estimated fallback for selected Suomi-NPP
  outage months. The calendar marks estimated and mixed-source months.
- Aqua/MODIS (1 km), Suomi-NPP/VIIRS (375 m) and NOAA-20 have different sensitivity and
  overpass times. Harmonization reduces the seam; it does not remove sensor or cloud bias.
- Detections depend on **cloud cover, overpass time and algorithm version**. Two products
  can observe the same fire different numbers of times.
- v2 dates use **local mean solar time**, not a national civil timezone.

## Coverage and aggregation

- Data is processed for **12 countries** (South America, the United States and Australia); the
  pipeline can add more, up to the whole world. Within those countries, only
  cells represented in the published support are known. Selecting an area with no published
  cells is not evidence of zero activity.
- The exported CSV contains **harmonized detected hotspot-days per 0.05° cell and month**, not individual
  hotspot records. Individual points are far too heavy to ship as static files and are
  already available from FIRMS.
- A 0.05° cell is ~5.5 km at the equator. Cells have different physical areas by latitude;
  small regions within one cell cannot be separated.
- A hotspot-day is counted at most once per day for a cell. It is still not an incident count,
  acreage or fire probability.

## Harmonization uncertainty

- v2 is a **research prototype**. Error ranges are exploratory empirical ranges, never
  confidence intervals. National measured coverage for 2021–2022 is about 65% for Peru and
  70% for the U.S.; quarterly/annual national ranges are not validated.
- Error is much larger for small selections: the source validation reports roughly 52–67%
  WAPE for 0.5° rectangles, 35–50% at 1°, 25–35% at 2°, and lower errors for departments or
  states and national totals. The map does not show a confidence band for arbitrary polygons.
- A national model score must not be presented as the accuracy of a hand-drawn area.
- Pre-2012 vs post-2012 comparability is **improved, not perfect**. The calendar is a
  seasonal exploration tool, not an official fire statistic.

## Demo mode

- Only when neither the v2 bundle nor legacy processed files are available does the explorer
  generate **synthetic rows**. The interface labels demo data, and the CSV filename says
  `demo`.
- Demo numbers are for reviewing the interface, never for citing a trend. As soon as a
  published year exists, the app switches to real data automatically.

## Product scope

- No live alerting, no fire spread modeling, no risk scoring, no AI.
- No accounts, no server, no database: the site is static and reads committed JSON files.
- Recently processed months may differ from later FIRMS revisions, because NRT data is
  replaced by standard processing after the fact.
