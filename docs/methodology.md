# Methodology

> **Current web data:** the console now reads the v2 research bundle documented in
> [`data-v2/README.md`](data-v2/README.md) and [`data-v2/DATA_CONTRACT.md`](data-v2/DATA_CONTRACT.md).
> It is 2003–2025 detected hotspot-days on the Suomi-NPP scale, using Aqua/MODIS estimation,
> observed Suomi-NPP from February 2012, and selected NOAA-20 outage fallbacks. The earlier
> v1 pipeline below describes the original project design; do not use its MODIS-equivalent
> units or schema to interpret v2 values.

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
2. Snap each detection to a **0.05° × 0.05° grid cell** (roughly 5.5 km at the equator).
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

Ratios are computed on aggregated counts, not on single detections: at 0.05° and one month,
the counts are large enough for a stable factor, and the calendar only ever shows those
aggregates.

## 4. Validation (mandatory)

The design is fixed before the evaluation and reported in `models.json` for every country:

| Purpose | Years |
|---|---|
| Fit model coefficients | 2013–2017 |
| Select the candidate model | 2018–2020 |
| Calibrate uncertainty bands | 2013–2017, out of fold |
| Retrospective evaluation | 2021–2022 |
| Drift stress test (not used for calibration) | 2023–2025 |

Nine candidates compete per country: country, block, block-by-quarter and cell ratios, a
two-part ratio, and three Poisson regressions. The selection score is the mean WAPE over five
spatial levels (0.5°, 1°, 2°, administrative units, country) on 2018–2020; the chosen model is
frozen before 2021–2022 is evaluated. Error is reported at those five levels, plus drawn
rectangles, a spatial cross-validation that holds out whole 2° blocks, and leave-one-year-out
within 2013–2017.

Uncertainty bands use a scaled residual with both a Poisson and a multiplicative term; the
multiplicative scale is estimated on out-of-fold residuals and the band quantiles are empirical.
Naive Poisson bands failed at country scale (coverage 3/8 and 0/8 months); the overdispersed
scale restores 80–82% nested coverage. Forward coverage in 2021–2022 is lower (65–70% at country
scale), and the app says so.

If held-out performance is poor, we say so in [limitations](limitations.md) and in the
interface. A calibration that cannot be validated is not presented as truth.

The full method, equations and the 78-country evaluation are in
[`docs/paper/ninacal-method-paper.pdf`](paper/ninacal-method-paper.pdf).

## 5. Final series

```text
harm(y, m, cell) = r_{b(cell), quarter(m)} · aqua(y, m, cell)   if y, m <= 2012-01
                 = viirs(y, m, cell)                            if y, m >= 2012-02
                 = rho_country · noaa20(y, m, cell)             for a missing Suomi-NPP month
```

`r` is a hierarchically shrunk block-by-quarter ratio (kappa = 200) and is linear in the Aqua
count, so any drawn region is the sum of its cells. `rho` is fitted on 2019–2020 and compared
with 2021–2025. `harm` is the only field the calendar aggregates; raw Aqua and VIIRS stay in the
data for transparency.

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
