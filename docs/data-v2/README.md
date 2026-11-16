# NinaCal data v2 — web-app integration

This directory documents the editable bundle stored at `data/v2/`. The original download
folder in `~/Descargas/ninacal-data-v2` was left untouched; update the repository copy when
the data team publishes a new version.

Harmonized MODIS + VIIRS burning activity for **153 countries**, 2003–2025, on a **0.05°
grid**, by month, quarter and year. Coverage is derived from `manifest.json`. Version 2.2, regenerated on
15 November 2026 by `make all` in the analyst's pipeline.

> **Status: research prototype.** The values are usable for the demo. The error bands (`low`/`high`) are
> **approximate**: monthly bands contain the real value about 80% of the time at most scales, but less at
> country level in recent years (65–70%), and quarterly/annual country bands are not validated. Show them as
> "approximate range", never as a confidence interval.
>
> **Changes since 2.0:** better calibrated bands (US country coverage went from 0% to 70–87%), raw `aqua`/`snpp`
> are now `null` when the sensor was unavailable, and the error figures below use 20 test months instead of 8.
> Same files, same fields: just replace the `data/` folder.

## What is in here

```
ninacal-data-v2/
├── README.md               this guide
├── DATA_CONTRACT.md        the full, formal specification (read it when in doubt)
└── data/
    ├── manifest.json       units, sources, which sensor each month comes from, file inventory
    ├── PE/ US/ … BR/       one folder per country, same structure
    │   ├── series.json     ready-made monthly/quarterly/yearly series: country + every department/state
    │   ├── cells.json      every 0.05° cell: id, center, area, department/state
    │   ├── years/2003.json … one file per year: cell-month values (2000–2025)
    │   ├── years/2003.csv.gz  the same per year as CSV (for the "download CSV" button)
    │   ├── calibration.json   conversion factors (for the "how it works" page)
    │   ├── uncertainty.json   error tables and measured coverage
    │   └── models.json        comparison of the 8 candidate models
```

Per-country validation numbers are in [`RESULTS.md`](RESULTS.md).

The app reads `data/v2/` through either `apps/web/scripts/sync-data.mjs` (static mode) or
the C++ API in `backend/` (API mode). The sync script emits the JSON assets as `.json.gz`
under `apps/web/public/data/v2/`; the API serves the same bundle at `/data` and answers
region/grid/series queries. Run `npm run dev` or `npm run build` from `apps/web` to refresh
the static copy, or `backend/scripts/setup.sh` to rebuild the SQLite database.

## The one number to plot

**`harm`** (cell files) or **`value`** (series): harmonized activity in **detected hotspot-days**.
A hotspot-day is "this 0.05° cell had at least one fire detection on this day". A cell counts at most once per day,
so a month has between 0 and 28–31 per cell.

- It is on the **Suomi NPP (VIIRS) scale**: older years (Aqua/MODIS) were converted up to that scale.
- It is **not** a number of fires, hectares burned, or a probability. A hotspot is not a confirmed fire.

## Use case 1: a department, a state or the whole country → `series.json`

The easiest path: everything is already aggregated.

```js
const series = await (await fetch('/data/PE/series.json')).json();
const junin = series['PE-JUN'];          // keys: 'PE', 'US', departments/states, '*-UNASSIGNED'
junin.name;                              // 'Junín'
junin.months;                            // 276 rows, 2003-01 … 2025-12
junin.quarters;                          // 92 rows
junin.years;                             // 23 rows
```

A monthly row:

```json
{"year": 2005, "month": 9, "value": 659.3, "low": 589.7, "high": 826.0,
 "source": "aqua_estimated", "low_activity": false,
 "median": null, "anomaly_mad": null, "reference_years": 2,
 "aqua": 164, "snpp": 0, "aqua_estimated": 659.3, "band_group": "3:3"}
```

| Field | Use |
|---|---|
| `value` | the value to plot |
| `low`, `high` | approximate range, **only** when the value is estimated; `null` for observed months |
| `source` | `aqua_estimated` (2003 – Jan 2012), `snpp_observed`, `noaa20_estimated` (months when Suomi NPP was down), `mixed` (quarters/years combining several) |
| `low_activity` | `true` when `value` < 20: show it dimmed, the relative error is large |
| `median` | historical median of the same month in **earlier** years (`null` until 5 earlier years exist, i.e. before ~2008) |
| `anomaly_mad` | how unusual the month is: 0 = typical, ±1 = clearly above/below, ±2 or more = exceptional. `null` if there is no reference |
| `aqua`, `snpp`, `aqua_estimated` | raw diagnostics for the "how it works" chart. `snpp` is `null` before February 2012; `aqua` or `snpp` is `null` in months when that satellite was down |

Do not use names as keys: identifiers come from the boundary file and are not all valid ISO codes
(South Dakota is `SU-SD`). Always display `name`.

## Use case 2: a region drawn by the user → `cells.json` + `years/YYYY.json`

1. Load the cells once and keep those whose **center** falls inside the drawn polygon (or the lat/lon box).
2. Load the year files of the date range and sum `harm` of those cells per month.

The year and cell files are **columnar** to save space. Convert them to objects like this:

```js
const rows = ({columns, rows}) => rows.map(r => Object.fromEntries(columns.map((c, i) => [c, r[i]])));

const cells = rows(await (await fetch('/data/PE/cells.json')).json());
// [{cell: '-12.05_-75.05', lat: -12.05, lon: -75.05, area_km2: 120.9, admin: 'PE-HUV'}, …]

const inBox = (c, [w, s, e, n]) => c.lon >= w && c.lon <= e && c.lat >= s && c.lat <= n;
const selected = new Set(cells.filter(c => inBox(c, [-76, -13, -74, -10])).map(c => c.cell));

const total = {};                                    // 'YYYY-MM' -> harmonized hotspot-days
for (let y = 2003; y <= 2025; y++) {
  const year = rows(await (await fetch(`/data/PE/years/${y}.json`)).json());
  for (const r of year) {
    if (!selected.has(r.cell) || r.harm === null) continue;
    const k = `${r.y}-${String(r.m).padStart(2, '0')}`;
    total[k] = (total[k] ?? 0) + r.harm;
  }
}
```

For a drawn polygon use a point-in-polygon test on the cell center (for example `@turf/boolean-point-in-polygon`).

Rules that matter:
- Files are **sparse**: a cell-month that is not listed means 0 for a published cell. A month with no rows at all is
  still a valid month with 0. Fill the 12 months of each year before plotting.
- If the selection contains **no cells**, show "outside the data coverage", not "no fire".
- A month whose `source` in `manifest.json` is `unavailable` must be shown as missing, not as 0.
- Year files from 2000 to 2002 have raw counts but `harm` = `null`: the calendar starts in **2003**.
- **Small areas are unreliable.** Measured monthly error in 2021–2022: about 52–67 % for 0.5° rectangles,
  35–50 % at 1°, 25–35 % at 2°, 22–24 % for a department/state and 10–13 % for the whole country.
  Warn the user below ~1° × 1°, or show quarters instead of months.
- Bands for a drawn region cannot be built by adding the cell bands. For drawn regions, show the value without a
  band for now.

Each cell row in `years/YYYY.json`: `cell, y, m, modis (Aqua), terra, viirs (Suomi NPP), noaa20, harm`.
Raw sensor fields are `null` for months when that sensor was flagged as unreliable.

## The CSV download

`years/YYYY.csv.gz` already contains every cell-month of a year (empty field = null). For a drawn region, build
the CSV in the browser from the rows you summed:

```js
const csv = 'year,month,harmonized_cell_days\n' +
  Object.entries(total).sort().map(([k, v]) => `${k.slice(0, 4)},${+k.slice(5)},${v.toFixed(2)}`).join('\n');
const url = URL.createObjectURL(new Blob([csv], {type: 'text/csv'}));
```

## Calendar heatmap (year × month)

Use `series.json` → `months` (or the summed drawn-region totals). Suggested encoding:
- colour = `value` with an accessible ramp (viridis/cividis);
- outline or hatch the `aqua_estimated` months (2003 – Jan 2012) so the sensor change is visible;
- dim `low_activity` months;
- a vertical marker at February 2012 (start of VIIRS).

"This month vs normal": `value` against `median`, with `anomaly_mad` as the label.

## Texts the UI should show

- "A hotspot is a satellite detection of heat, not a confirmed fire."
- "Values before 2012 are estimated from MODIS and converted to the VIIRS scale."
- "Ranges are approximate and experimental."
- "Clouds can hide fires: a month with little activity may be a cloudy month."

## Questions

The static provider lives in `apps/web/lib/data-v2.ts`; the UI depends on the
`ExplorerDataProvider` contract in `apps/web/lib/data-provider.ts`. The planned API can replace
the provider without changing the map, charts or controls. Method and limits from the source
project remain in `project/docs/v2/METHODS.md` and `project/docs/v2/RESULTS.md`.
