# Data dictionary

Every committed data file, its fields and its rules. The JSON Schemas in
[`data/schemas/`](../data/schemas/) are the machine-readable version of this document; if
they disagree, the schema wins and this file gets fixed.

## `data/processed/{year}.json`

Array of rows. One row = one grid cell, one month, one year.

```json
[{ "cell": "-10.2_-73.5", "y": 2019, "m": 9, "modis": 12, "viirs": 51, "harm": 12.4 }]
```

| Field   | Type             | Required | Description                                                       |
| ------- | ---------------- | -------- | ----------------------------------------------------------------- |
| `cell`  | string           | yes      | Anchor of the 0.05° cell: `"<lat>_<lon>"`, e.g. `"-10.2_-73.5"`.    |
| `y`     | integer          | yes      | Calendar year, 2000–2100.                                         |
| `m`     | integer          | yes      | Calendar month, 1–12.                                             |
| `modis` | integer \| null  | yes      | Raw MODIS C6.1 detection count for the cell-month.                |
| `viirs` | integer \| null  | yes      | Raw VIIRS S-NPP detection count. `0` for years before 2012.       |
| `harm`  | number \| null   | yes      | Harmonized count in MODIS-equivalent units. Used by the calendar. |

### Rules

- **`cell` format**: `^-?\d+(\.\d+)?_-?\d+(\.\d+)?$`. Latitude first, longitude second.
  Anchor convention: **cell center** (decision recorded here; the pipeline and frontend must
  both use it).
- **Precision**: one decimal place is enough for a 0.05° grid (`-10.2`, not `-10.200001`).
- **`null` vs `0`**: `null` means "no measurement / not applicable". `0` means "measured,
  nothing detected". Never use `0` to fill a missing value, and never drop a row because a
  field is null.
- **`viirs` before 2012**: `0`, because the product does not exist and the count is
  structurally zero. Not `null`.
- **`harm`**: `modis` for `y < 2012`; `k_m · viirs` for `y ≥ 2012` (see
  [methodology](methodology.md)). It may be fractional; do not round in the data file.
- **No duplicate rows** for the same `(cell, y, m)` in a file.
- **Ordering**: not significant; the frontend sorts as needed. Keep files stable in diffs
  (sort by `cell`, then `y`, then `m`) to keep PRs reviewable.

## `data/processed/calibration.json`

Produced by the calibration step. Consumed by the app's validation chart.

```json
{
  "generated_at": "2026-11-14T18:00:00Z",
  "products": { "baseline": "MODIS C6.1", "target": "VIIRS S-NPP" },
  "method": "ratio",
  "train": [2012, 2020],
  "test": [2021, 2026],
  "metrics": { "r2": 0.86, "rmse": 3.1, "n": 1240 },
  "by_month": { "1": 1.12, "2": 1.08, "3": 1.01, "4": 0.97, "5": 0.94, "6": 0.92,
                "7": 0.95, "8": 0.99, "9": 1.02, "10": 1.05, "11": 1.09, "12": 1.11 }
}
```

| Field          | Description                                                             |
| -------------- | ----------------------------------------------------------------------- |
| `generated_at` | ISO-8601 UTC timestamp of the run.                                      |
| `products`     | Baseline and target products; kept explicit to avoid ambiguity.         |
| `method`       | `ratio` \| `regression` \| `quantile`.                                  |
| `train`        | `[start_year, end_year]` used to fit.                                   |
| `test`         | `[start_year, end_year]` held out for validation.                       |
| `metrics`      | `r2`, `rmse` and `n` on the test set.                                   |
| `by_month`     | Conversion factors keyed by month (`"1"`–`"12"`). For `regression`, the   |
|                | equivalent coefficients are documented in the pipeline output README.    |

## `data/samples/mock.json`

The same row shape as a processed file, with 3 hand-written rows. It exists so the frontend
can be built before the pipeline finishes. Never import the mock in production code paths;
swap the fetch target, not the code.

## File naming and size

- Processed files: `data/processed/<YYYY>.json`, one per year.
- Keep each file under ~5 MB gzipped-equivalent. If a year exceeds that, the frontend loads
  a coarser grid instead — the schema does not change.
