# Pipelines

Offline Python that turns NASA FIRMS CSVs into the JSON the app reads. It runs on a laptop,
never in CI, and its output is committed.

## Requirements

Python 3.11+.

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Input

FIRMS CSVs, one file per product and period, with at least:

| Column     | Used for                       |
| ---------- | ------------------------------ |
| `latitude` | Cell assignment                |
| `longitude`| Cell assignment                |
| `acq_date` | Year/month aggregation         |
| `acq_time` | Not aggregated (monthly bins)  |
| `confidence` | Optional quality filtering   |
| `frp`      | Not used in v0                 |

Products: MODIS C6.1 (`MODIS_SP`) and VIIRS S-NPP (`VIIRS_SNPP_SP`). Use standard
processing (SP) for history; NRT only for the current month.

## Output contract

- `data/processed/{year}.json` — array of rows
  `{cell, y, m, modis, viirs, harm}`, validated against
  [`../data/schemas/processed-year.schema.json`](../data/schemas/processed-year.schema.json).
- `data/processed/calibration.json` — method, monthly factors, train/test windows and
  metrics, validated against
  [`../data/schemas/calibration.schema.json`](../data/schemas/calibration.schema.json).

The exact meaning of every field is in
[`../docs/data-dictionary.md`](../docs/data-dictionary.md). Do not add fields without
updating the schema and the dictionary in the same PR.

## Method (summary)

1. Snap detections to the 0.1° grid (cell **center** anchor).
2. Count per product, cell and month. Missing measurements stay `null`.
3. Fit VIIRS → MODIS-equivalent factors on 2012–2020, validate on 2021 → today.
4. Write `harm`: MODIS before 2012, calibrated VIIRS after.
5. Validate JSON files, sort rows and commit.

Full protocol and failure modes: [`../docs/methodology.md`](../docs/methodology.md).

## Conventions

- Keep scripts deterministic: same inputs, same output bytes (sorted keys, sorted rows).
- Print a small summary (rows, cells, years, coverage) at the end of a run.
- Fail loudly on schema violations; never silently drop rows.
- No network calls inside the aggregation step: download first, process second.
