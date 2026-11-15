# NinaCal v2 data contract

Version 2 data live under `data/v2/` in this repository; the API database is generated at
`backend/data/ninacal.sqlite` by `backend/scripts/build_db.py`. The web app consumes this interface
through the static provider or the API provider.

The manifest labels this a `research_prototype`. Error intervals in the manifest, series, query results and
uncertainty tables are explicitly marked `exploratory_not_validated`. Monthly bands reach about 80% measured
coverage at most scales, but national coverage is lower in 2021–2022 (50–90% depending on the country, from 20 months) and
quarterly/annual national bands are not validated. Show them as an approximate range, not a confidence interval.
`manifest.json` → `countries_interval_limit` states each country's measured national coverage.

## Units and null semantics

All channels count **daytime detected hotspot-days**, after confidence screening and `type=0` filtering.
`harm` is on the Suomi-NPP scale. `modis` means Aqua only; Terra is a separate channel.
Neither channel is the number of raw FIRMS pixels. The main period is 2003–2025; 2000–2002 retain raw counts
with null harmonized values. Dates use local mean solar time, not a national civil timezone.

The grid is 0.05° WGS84, anchored at (−180, −90), with center coordinates.
IDs are `latitude_longitude` formatted to two decimal places, for example `-12.05_-75.05`.
Cells cover unequal physical area at different latitudes; `area_km2` records the full spherical grid-cell area.
It is not land-only or polygon-intersection area.

Cells are published only if any accepted detection of any type occurred somewhere in the archive.
For a published cell and available channel/month, an omitted sparse record means zero recorded hotspot-days
or zero model prediction. Outside that support the state is unknown. Missing source coverage is also unknown;
zero detections never establishes that the satellite observed clear land with no fire.

## Files

| File | Contents |
|---|---|
| `manifest.json` | schema, units, source links, country/file inventory, monthly source availability |
| `{CC}` | one folder per shipped country code (12 countries: PE, US, EC, CL, CO, PY, MX, BO, VE, AR, AU, BR) |
| `{CC}/cells.json` | cell IDs, centers, areas and administrative source IDs |
| `{CC}/years/YYYY.json` | sparse cell-month data, columnar wrapper |
| `{CC}/years/YYYY.csv.gz` | same records, CSV header, empty fields for null |
| `{CC}/series.json` | country and administrative monthly, quarterly and annual aggregates |
| `{CC}/calibration.json` | fitted country/block/quarter and NOAA-20 conversion factors |
| `{CC}/uncertainty.json` | empirical error tables and retrospective measured coverage |
| `{CC}/models.json` | candidate comparison, temporal/spatial evaluation, sensitivity and drift |

Columnar files have `{"columns": [...], "rows": [[...], ...]}`. A row's positions are defined by `columns`.
Yearly columns are `cell,y,m,modis,terra,viirs,noaa20,harm`. Sensor fields are integers or null;
`harm` is a nonnegative real or null, rounded to six decimals in sparse exports/SQLite.
Full-precision NPZ and aggregated series can differ from summed exports by small rounding errors.
The per-cell cap is the month's day count, applied before polygon aggregation.

## Availability

The manifest gives each country/month one `source`:

| Source | Meaning |
|---|---|
| `not_harmonized` | raw-only 2000–2002, `harm=null` |
| `aqua_estimated` | Aqua converted into Suomi-NPP detected-hotspot-day units |
| `snpp_observed` | screened Suomi-NPP count, no conversion |
| `noaa20_estimated` | whole-month fallback, NOAA-20 converted into Suomi-NPP units |
| `unavailable` | neither primary nor valid fallback, value null |

Known disruption months and pre-operation dates are explicit in `harmonize/common.py` and
[METHODS.md](METHODS.md). They do not constitute a complete per-cell observation mask.
Check availability even when a sparse row is absent. Existing raw detections during a flagged source month
are retained in SQLite for auditing but replaced by null in that sensor's JSON/CSV channel.
Terra is raw-only and does not have a certified complete outage calendar.

## Aggregated series

Each `series.json` key is the country code (`PE`, `US`, `BR`, …) or an administrative identifier from the source boundary.
Only administrative units represented by cells have series; the explicit `*-UNASSIGNED` bucket is included.
Identifiers are not guaranteed valid ISO codes: the downloaded US source uses `SU-SD` for South Dakota.
Use the accompanying name instead of guessing a label from a code.

Each object contains `name`, `cells`, `months` (276 rows), `quarters` (92) and `years` (23).
Rows include `year`, optional `month`/`quarter`, `value`, `low`, `high`, `source`, `median`, `anomaly_mad`
and `reference_years`. Monthly rows also expose raw `aqua`, `snpp`, diagnostic `aqua_estimated`,
`band_group` and `low_activity` (value below 20 hotspot-days, a descriptive flag).
Raw `aqua` and `snpp` are null when that sensor is unavailable: Suomi NPP before February 2012, and either sensor
in a flagged disruption month.

`low/high` are empirical 80% conversion-error bounds. They are null for directly observed counts or where an
interval cannot be justified/computed. Null bounds do not mean zero uncertainty. Mixed-source aggregate
bounds are null. Annual coverage is unverified, and coverage at any arbitrary polygon is not guaranteed.
Use the retrospective coverage table before interpreting an interval. Bounds from different cells/months
must not be added as if their errors were independent.

Anomaly uses only earlier values of the same calendar period and needs at least five years; zero MAD gives
null. Country totals equal the sum of all administrative buckets, including unassigned cells.

## SQLite and polygon queries

Tables are `cells`, `availability`, `activity`, and `metadata`; `metadata.manifest` is the file manifest.
The activity key is `(country,cell,year,month)`. Read with SQLite URI `mode=ro`.
Country/time and cell-location indexes are provided. Absence of a row has the sparse semantics above.

From the project directory:

```sh
python3 -m harmonize.query --country PE --bbox -76 -13 -74 -10 --start 2003 --end 2025
python3 -m harmonize.query --country US --bbox -123 37 -120 40 --start 2020 --end 2025 --format csv
python3 -m harmonize.query --country PE --polygon area.geojson --start 2010 --end 2020
```

GeoJSON accepts Polygon, MultiPolygon or a Feature containing either, including holes and date-line crossings.
Bounding boxes are west, south, east, north; west greater than east crosses the date line.
Cells are selected by center, not fractional area intersection. Empty selections return
`status=outside_published_support`, `cells=0`, and no monthly rows; they do not return a claimed zero-fire series.
For nonempty selections the result includes selected-cell count, summed support area, unknown observation
coverage, and monthly values/bands/anomalies. Bounds are computed at the selected aggregate scale from error
tables, rather than summing cell bounds. The query currently returns monthly records only; calendar aggregates
are already provided for country and administrative areas.

The v2 code, local artifacts and database are ready for integration. No external service, deployment or
existing frontend is modified by running the pipeline.
