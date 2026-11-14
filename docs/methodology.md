# Methodology

How NinaCal turns two incompatible satellite fire records into one series you can compare
across 25 years. This document is written to be read by a judge: it states what we do, what
we measured, and what we could not fix.

## 1. Sources

| Product        | Instrument        | Resolution | Period  | Use in NinaCal                    |
| -------------- | ----------------- | ---------- | ------- | --------------------------------- |
| MODIS C6.1     | Terra + Aqua      | 1 km       | 2000 →  | Baseline series before 2012       |
| VIIRS S-NPP    | VIIRS (I-band)    | 375 m      | 2012 →  | Modern series, calibrated to MODIS |

Both come from **NASA FIRMS** (Fire Information for Resource Management System) as
per-country or archive CSVs. We use the standard-processing (SP) archive for the historical
record and NRT only for the most recent months, because NRT files are revised later.

Selection bias to keep in mind: MODIS and VIIRS have different pixel sizes, overpass times,
cloud masking and detection thresholds. That is exactly why a raw comparison of the two
counts is wrong, and why we calibrate instead of concatenating.

## 2. Aggregation

1. Read FIRMS CSVs and keep the detection timestamp, latitude and longitude.
2. Snap each detection to a **0.1° × 0.1° grid cell** (roughly 11 km at the equator).
3. Count detections per cell per month for each product independently.
4. Write one row per cell-month per product; the final file merges them.

The grid anchor (lower-left corner vs cell center) is fixed once and recorded in
[`data-dictionary.md`](data-dictionary.md). It must match on both sides of the pipeline and
in the frontend filter, or cells silently shift by half a cell.

Empty cell-months are **omitted**, not written as zero. Absence of a row means "we have no
measurement"; `null` inside a row means "this product has no value for that cell-month"
(for example, a cloud-obscured month). The frontend distinguishes both.

## 3. Calibration on the overlap

From 2012 onward we observe MODIS and VIIRS for the same cell-months. That overlap is the
training signal.

1. Build paired samples: `(viirs_count, modis_count)` per cell-month, 2012 → latest complete
   year.
2. Fit a conversion from VIIRS to **MODIS-equivalent** counts:
   - **Ratio per month** (`modis ≈ k_m · viirs`), default and simplest to explain;
   - **Regression per region-month** when the ratio drifts with density;
   - **Quantile mapping** as fallback when the relationship is non-monotonic or the fit is
     unstable.
3. Store the chosen method, the coefficients `k_m` and the fit metrics in
   `data/processed/calibration.json`.

Ratios are computed on aggregated counts, not on single detections: at 0.1° and one month,
the counts are large enough for a stable factor, and the calendar only ever shows those
aggregates.

## 4. Validation (mandatory)

We **train on 2012–2020 and test on 2021 → today**. No test year is allowed into the fit.

Reported in `calibration.json` and shown in the app:

- **R²** and **RMSE** between observed MODIS and predicted MODIS-equivalent on the test set;
- a scatter/line chart of observed vs predicted for the test years;
- sample size `n` (cell-months) so the reader can judge the estimate.

If held-out performance is poor, we say so in [limitations](limitations.md) and in the
interface. A calibration that cannot be validated is not presented as truth.

## 5. Final series

```text
harm(y, m, cell) = modis(y, m, cell)                      if y < 2012
                 = k_m · viirs(y, m, cell)                if y ≥ 2012
```

`harm` is the only field the calendar aggregates. Raw `modis` and `viirs` stay in the file
for transparency and for the validation chart. Because VIIRS starts in 2012, the pre-2012
part of the series is pure MODIS, and the harmonized series inherits MODIS's blind spots for
those years — this is stated in the UI.

## 6. Known open questions

These are documented rather than hidden, and resolved in the data dictionary as soon as they
are decided:

- exact first date available per product (checked on the FIRMS download page, not assumed);
- grid anchor convention (corner vs center);
- treatment of months with partial coverage at the edges of the requested archive;
- whether to report UTC or local acquisition dates (FIRMS uses UTC).

## 7. Plan B

If the archive download does not arrive in time:

1. Use FIRMS **per-country files** (direct download) for the same products.
2. If the overlap is too short to calibrate, ship the calendar on the available years only
   and declare the gap explicitly. Scope shrinks; claims do not grow.
