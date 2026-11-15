"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import CalendarHeatmap from "./CalendarHeatmap";
import CalibrationPanel from "./CalibrationPanel";
import ComparisonPanel from "./ComparisonPanel";
import SeasonalityChart from "./SeasonalityChart";
import SeriesChart from "./SeriesChart";
import WorldPicker from "./WorldPicker";
import { computeStats, median, monthHistory } from "@/lib/aggregate";
import { COVERAGE_LABEL } from "@/lib/coverage";
import { COUNTRIES } from "@/lib/countries";
import {
  formatCompact,
  formatCount,
  formatDecimal,
  formatPercent,
  monthName,
  MONTHS_SHORT,
} from "@/lib/format";
import { bboxLabel } from "@/lib/geo";
import { useExplorer, type ExplorerState } from "@/lib/useExplorer";
import type { Aggregated, Calibration, V2CountryMetadata } from "@/lib/types";

const RegionMap = dynamic(() => import("./RegionMap"), {
  ssr: false,
  loading: () => (
    <div className="map-shell map-loading">
      <span>Initialising map…</span>
    </div>
  ),
});

/* ------------------------------------------------------------------ */
/* Left rail                                                           */
/* ------------------------------------------------------------------ */

function SelectionPanel({ state }: { state: ExplorerState }) {
  return (
    <section className="mc-panel">
      <header className="mc-panel-head">
        <span className="mc-code">SEL</span>
        <h2>Selection</h2>
        <button type="button" className="mc-link" onClick={state.reset}>
          Reset
        </button>
      </header>

      <WorldPicker state={state} />

      <button type="button" className="mc-demo" onClick={state.showAmazon2024}>
        <span aria-hidden="true">▶</span>
        Demo · Amazon 2024
        <em>record year</em>
      </button>

      <div className="range-row mc-range">
        <label>
          <span>From</span>
          <select
            value={state.range[0]}
            onChange={(event) =>
              state.setRange([
                Number(event.target.value),
                Math.max(Number(event.target.value), state.range[1]),
              ])
            }
          >
            {state.availableYears.map((year) => (
              <option key={`from-${year}`} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>To</span>
          <select
            value={state.range[1]}
            onChange={(event) =>
              state.setRange([
                Math.min(state.range[0], Number(event.target.value)),
                Number(event.target.value),
              ])
            }
          >
            {state.availableYears.map((year) => (
              <option key={`to-${year}`} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>
      </div>

      <details className="manual-box">
        <summary>Manual coordinates</summary>
        <form className="bbox-form" onSubmit={state.applyDraft}>
          <p className="field-legend">Bounding box · degrees</p>
          <div className="bbox-grid">
            <label>
              <span>South</span>
              <input
                type="number"
                step="0.1"
                min="-90"
                max="90"
                value={state.draft.minLat}
                onChange={(event) => state.setDraft({ ...state.draft, minLat: event.target.value })}
                aria-label="Minimum latitude"
              />
            </label>
            <label>
              <span>West</span>
              <input
                type="number"
                step="0.1"
                min="-180"
                max="180"
                value={state.draft.minLon}
                onChange={(event) => state.setDraft({ ...state.draft, minLon: event.target.value })}
                aria-label="Minimum longitude"
              />
            </label>
            <label>
              <span>North</span>
              <input
                type="number"
                step="0.1"
                min="-90"
                max="90"
                value={state.draft.maxLat}
                onChange={(event) => state.setDraft({ ...state.draft, maxLat: event.target.value })}
                aria-label="Maximum latitude"
              />
            </label>
            <label>
              <span>East</span>
              <input
                type="number"
                step="0.1"
                min="-180"
                max="180"
                value={state.draft.maxLon}
                onChange={(event) => state.setDraft({ ...state.draft, maxLon: event.target.value })}
                aria-label="Maximum longitude"
              />
            </label>
          </div>
          <div className="bbox-actions">
            <button type="submit" className="btn btn--small">
              Apply box
            </button>
          </div>
          {state.draftError ? (
            <p className="form-error" role="alert">
              {state.draftError}
            </p>
          ) : null}
        </form>
      </details>

      <p className="mc-region-line">
        <span>{state.regionName}</span>
        <em>{bboxLabel(state.selection.bbox)}</em>
      </p>
    </section>
  );
}

function CoveragePanel() {
  return (
    <section className="mc-panel">
      <header className="mc-panel-head">
        <span className="mc-code">GEO</span>
        <h2>Coverage</h2>
        <span className="mc-head-meta">{COVERAGE_LABEL}</span>
      </header>
      <ul className="mc-coverage mc-coverage-world">
        {COUNTRIES.map((country) => (
          <li key={country.code}>
            <span className="mc-cdot" aria-hidden="true" />
            <div>
              <strong>{country.name}</strong>
              <em>{country.iso3} · {country.code}</em>
            </div>
          </li>
        ))}
      </ul>
      <p className="mc-note">
        Countries without a published bundle are dimmed. Select a country to load its 0.05°
        cells, then a region/state to narrow the selection. Boundaries:{" "}
        <a href="https://www.geoboundaries.org/" target="_blank" rel="noreferrer">
          geoBoundaries
        </a>{" "}
        ADM1 and Natural Earth. Outside the published support the app says so; it never
        invents a zero.
      </p>
    </section>
  );
}

function KeyPanel() {
  return (
    <section className="mc-panel">
      <header className="mc-panel-head">
        <span className="mc-code">KEY</span>
        <h2>Reading the map</h2>
      </header>
      <ul className="map-key">
        <li>
          <span className="key-square" aria-hidden="true" />
          Square = one 0.05° cell; colour = harmonized hotspot-days (a cell-day with ≥1 FIRMS hotspot).
        </li>
        <li>
          <span className="key-outline" aria-hidden="true" />
          Teal border = countries with published data.
        </li>
        <li>
          <span className="key-country" aria-hidden="true" />
          Country fill = total hotspot-days for the map year (world view).
        </li>
        <li>
          <span className="key-box" aria-hidden="true" />
          Orange outline = your selection.
        </li>
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Right rail                                                          */
/* ------------------------------------------------------------------ */

function AnomalyReadout({
  grid,
  measureLabel,
  year,
}: {
  grid: Aggregated;
  measureLabel: string;
  year: number;
}) {
  const [mode, setMode] = useState<"peak" | "latest">("peak");
  const yearIndex = grid.years.indexOf(year);
  const yearRow = yearIndex >= 0 ? grid.totals[yearIndex] ?? null : null;
  let month = 0;
  let value = 0;
  if (yearRow) {
    for (let index = 0; index < yearRow.length; index += 1) {
      const candidate = yearRow[index];
      if (candidate !== null && candidate > value) {
        value = candidate;
        month = index + 1;
      }
    }
  }
  if (!month) {
    if (mode === "latest" && grid.latest) {
      month = grid.latest.m;
      value = grid.latest.value;
    } else {
      return <p className="mc-note">No measured months in {year} for this selection.</p>;
    }
  }
  const latest =
    mode === "latest" && grid.latest
      ? { y: grid.latest.y, m: grid.latest.m, value: grid.latest.value }
      : { y: year, m: month, value };

  const history = monthHistory(grid, latest.m);
  const previous = history.filter((entry) => entry.y < latest.y);
  const values = previous.map((entry) => entry.value);
  const stats = computeStats(values, latest.value);
  const hasHistory = previous.length > 0 && stats.median > 0;
  const delta = hasHistory ? ((latest.value - stats.median) / stats.median) * 100 : null;
  const percentile = Math.round(stats.percentile * 100);
  const level = !hasHistory
    ? "normal"
    : percentile >= 90
      ? "critical"
      : percentile >= 75
        ? "elevated"
        : percentile <= 25
          ? "low"
          : "normal";
  const label = !hasHistory
    ? "No baseline"
    : level === "critical"
      ? "Critical"
      : level === "elevated"
        ? "Elevated"
        : level === "low"
          ? "Low"
          : "Normal";
  const barMax = Math.max(1, ...history.map((entry) => entry.value));
  const higher = previous.filter((entry) => entry.value < latest.value).length;
  const medians = Array.from({ length: 12 }, (_, index) =>
    median(monthHistory(grid, index + 1).map((entry) => entry.value)),
  );
  const peakMonth = medians.indexOf(Math.max(...medians)) + 1;
  const suffix =
    percentile % 100 >= 11 && percentile % 100 <= 13
      ? "th"
      : percentile % 10 === 1
        ? "st"
        : percentile % 10 === 2
          ? "nd"
          : percentile % 10 === 3
            ? "rd"
            : "th";
  const sentence =
    previous.length > 0
      ? `Peak season is ${monthName(peakMonth)}. ${monthName(latest.m)} ${latest.y} sits at the ${percentile}${suffix} percentile of the last ${previous.length} years.`
      : `Peak season is ${monthName(peakMonth)}. There are not enough prior years to rank this month.`;

  return (
    <div className="mc-anom">
      <div className="mc-anom-top">
        <p className="mc-anom-value">{formatCompact(latest.value)}</p>
        <span className={`mc-tone is-${level}`}>{label}</span>
      </div>
      <p className="mc-anom-date">
        {monthName(latest.m)} {latest.y}
        <span>{measureLabel}</span>
        <span className={delta === null ? "mc-delta" : delta >= 0 ? "mc-delta is-up" : "mc-delta is-down"}>
          {delta === null ? "—" : formatPercent(delta)}
        </span>
      </p>

      <div className="mc-anom-switch" role="group" aria-label="Month view">
        <button
          type="button"
          className={mode === "peak" ? "is-active" : ""}
          aria-pressed={mode === "peak"}
          onClick={() => setMode("peak")}
        >
          Year peak
        </button>
        <button
          type="button"
          className={mode === "latest" ? "is-active" : ""}
          aria-pressed={mode === "latest"}
          onClick={() => setMode("latest")}
        >
          Latest observed
        </button>
      </div>

      <div className="mc-anom-bars" aria-hidden="true">
        {history.map((entry) => (
          <span
            key={entry.y}
            className={entry.y === latest.y ? "mc-anom-bar is-latest" : "mc-anom-bar"}
            style={{ height: `${Math.max(3, (entry.value / barMax) * 100)}%` }}
            title={`${monthName(latest.m)} ${entry.y} — ${formatCount(entry.value)}`}
          />
        ))}
      </div>

      <p className="mc-anom-sentence" role="status">
        {sentence}
      </p>

      <dl className="mc-mini-stats">
        <div>
          <dt>Median</dt>
          <dd>{formatCount(stats.median)}</dd>
        </div>
        <div>
          <dt>Robust z</dt>
          <dd>{formatDecimal(stats.z)}</dd>
        </div>
        <div>
          <dt>Higher than</dt>
          <dd>
            {higher}/{previous.length}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function SeasonPeaks({ grid }: { grid: Aggregated }) {
  const medians = Array.from({ length: 12 }, (_, index) =>
    median(monthHistory(grid, index + 1).map((entry) => entry.value)),
  );
  const max = Math.max(1, ...medians);
  const ranked = medians
    .map((value, index) => ({ value, index }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);

  if (grid.rowCount === 0) {
    return <p className="mc-note">No measured months in this selection.</p>;
  }

  return (
    <div className="mc-peaks">
      {ranked.map((entry, rank) => (
        <div className="mc-peak" key={entry.index}>
          <span className="mc-peak-rank">{String(rank + 1).padStart(2, "0")}</span>
          <span className="mc-peak-month">{monthName(entry.index + 1, true)}</span>
          <span className="mc-peak-track">
            <span
              className={rank === 0 ? "mc-peak-bar is-peak" : "mc-peak-bar"}
              style={{ width: `${Math.max(2, (entry.value / max) * 100)}%` }}
            />
          </span>
          <span className="mc-peak-value">{formatCompact(entry.value)}</span>
        </div>
      ))}
      <p className="mc-note">
        Median hotspot-days by month (a hotspot-day = one detected cell on one day). The calendar below shows every year, not the median.
      </p>
    </div>
  );
}

function V2ValidationPanel({
  metadata,
  worldView,
}: {
  metadata: V2CountryMetadata[];
  worldView?: boolean;
}) {
  if (metadata.length === 0) {
    return (
      <p className="mc-note">
        {worldView
          ? "Select a single country to see its model choice, CV WAPE/RMSE and 2021–22 hold-out error."
          : "Loading model evaluation…"}
      </p>
    );
  }

  return (
    <div className="mc-v2-validation">
      {metadata.map((item) => {
        const cv = item.models.temporal_cv_selected_model?.country;
        const retrospective = item.models.retrospective_2021_2022?.country;
        return (
          <div className="mc-v2-country" key={item.country}>
            <div className="mc-v2-country-head">
              <strong>{item.name}</strong>
              <span>{item.calibration?.model?.name?.replaceAll("_", " ") ?? "—"}</span>
            </div>
            <dl className="mc-v2-metrics">
              <div>
                <dt>Ratio</dt>
                <dd>
                  {item.calibration?.model?.country_ratio != null
                    ? `${formatDecimal(item.calibration.model.country_ratio)}×`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt>CV WAPE</dt>
                <dd>{cv ? `${formatDecimal(cv.wape_pct)}%` : "—"}</dd>
              </div>
              <div>
                <dt>CV RMSE</dt>
                <dd>{cv ? formatDecimal(cv.rmse) : "—"}</dd>
              </div>
              <div>
                <dt>2021–22 WAPE</dt>
                <dd>{retrospective ? `${formatDecimal(retrospective.wape_pct)}%` : "—"}</dd>
              </div>
            </dl>
          </div>
        );
      })}
      <p className="mc-note">
        National-scale validation only. Error bands are approximate and experimental, not a
        confidence interval; a hand-drawn area has no validated band.
      </p>
    </div>
  );
}

function ValidationReadout({
  calibration,
  metadata,
  dataVersion,
  worldView,
}: {
  calibration: Calibration | null;
  metadata: V2CountryMetadata[];
  dataVersion: string;
  worldView?: boolean;
}) {
  if (dataVersion === "v2") {
    if (metadata.length === 0) {
      return (
        <p className="mc-note">
          {worldView
            ? "Select a single country to see its held-out error."
            : "Loading model evaluation…"}
        </p>
      );
    }
    return (
      <div className="mc-val-grid mc-val-grid--v2">
        {metadata.map((item) => {
          const cv = item.models.temporal_cv_selected_model?.country;
          return (
            <div key={item.country}>
              <span>{item.country} · CV WAPE</span>
              <strong>{cv ? `${formatDecimal(cv.wape_pct)}%` : "—"}</strong>
            </div>
          );
        })}
        <p className="mc-note mc-span-all">
          Research prototype · approximate ranges, not confidence intervals.
        </p>
      </div>
    );
  }

  if (!calibration) {
    return (
      <p className="mc-note">
        No calibration record is published yet. The calendar still uses the committed{" "}
        <code>harm</code> field.
      </p>
    );
  }

  return (
    <div className="mc-val">
      <div className="mc-val-grid">
        <div>
          <span>R²</span>
          <strong>{calibration.metrics.r2.toFixed(2)}</strong>
        </div>
        <div>
          <span>RMSE</span>
          <strong>{formatDecimal(calibration.metrics.rmse)}</strong>
        </div>
        <div>
          <span>n</span>
          <strong>{formatCount(calibration.metrics.n)}</strong>
        </div>
        <div>
          <span>Train</span>
          <strong>
            {calibration.train[0]}–{calibration.train[1]}
          </strong>
        </div>
      </div>
      <p className="mc-note">
        Test {calibration.test[0]}–{calibration.test[1]} · {calibration.method}.{" "}
        <a href="#validation">Full validation ↓</a>
      </p>
    </div>
  );
}

function SystemPanel({ state }: { state: ExplorerState }) {
  return (
    <section className="mc-panel">
      <header className="mc-panel-head">
        <span className="mc-code">SYS</span>
        <h2>System</h2>
        <span className={state.mode === "live" ? "mc-chip is-live" : "mc-chip is-demo"}>
          {state.dataVersion === "v2" ? "V2 DATA" : state.mode === "live" ? "LEGACY" : "SIM"}
        </span>
      </header>
      <dl className="mc-sys">
        <div>
          <dt>Grid</dt>
          <dd>{state.mode === "live" && state.cellStep ? `${state.cellStep.toFixed(2)}°` : "demo step"}</dd>
        </div>
        <div>
          <dt>Cells</dt>
          <dd>{formatCount(state.grid.cellCount)}</dd>
        </div>
        <div>
          <dt>Years</dt>
          <dd>{state.years.length}</dd>
        </div>
        <div>
          <dt>Coverage</dt>
          <dd>{COVERAGE_LABEL}</dd>
        </div>
      </dl>
      <p className="mc-note">
        {state.dataVersion === "v2"
          ? state.apiEnabled
            ? "Reading the read-only API. The VPS owns the data; the page ships no data copy."
            : "Editable static v2 bundle in data/v2. Set NEXT_PUBLIC_API_BASE to read the API."
          : state.mode === "demo"
          ? "Synthetic rows follow the real contract; the console shows the coarser demo grid step."
          : "Reading committed files from data/processed."}
      </p>
    </section>
  );
}

function mapSourceLabel(source: string): string {
  switch (source) {
    case "aqua_estimated":
      return "Aqua / MODIS estimate";
    case "snpp_observed":
      return "Suomi-NPP observed";
    case "noaa20_estimated":
      return "NOAA-20 estimated fallback";
    case "mixed":
      return "Mixed source months";
    case "partial":
      return "Partial year · unavailable source month(s)";
    default:
      return "Source unavailable";
  }
}

function MapTimeline({ state }: { state: ExplorerState }) {
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const start = state.years[0] ?? state.mapYear;
  const end = state.years[state.years.length - 1] ?? state.mapYear;
  const mapSource = mapSourceLabel(state.mapYearSource);

  useEffect(() => {
    if (!playing) return;
    const next = state.mapYear >= end ? start : state.mapYear + 1;
    // Never advance into a year whose grid still needs a network round-trip.
    // `ensureYear` warms it and bumps `gridVersion`, which re-runs this effect.
    // The first pass therefore stalls on missing years (allowed); every later
    // loop finds all years in memory and runs on the plain interval.
    const ready = state.ensureYear ? state.ensureYear(next) : true;
    setBuffering(!ready);
    if (!ready) return;
    const timer = window.setTimeout(
      () => {
        // Loop through the selected range: the second pass is local/cached.
        state.setMapYear(next);
      },
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 1500 : 850,
    );
    return () => window.clearTimeout(timer);
  }, [
    playing,
    state.mapYear,
    state.setMapYear,
    state.ensureYear,
    state.gridVersion,
    start,
    end,
  ]);

  useEffect(() => setPlaying(false), [start, end]);

  useEffect(() => {
    if (!playing) setBuffering(false);
  }, [playing]);

  const togglePlayback = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    // Fire-and-forget: the first loop warms every annual grid for the next one.
    state.warmTimeline?.();
    if (state.mapYear >= end && end > start) state.setMapYear(start);
    setPlaying(true);
  };

  return (
    <section className="mc-timeline" aria-label="Map year timeline">
      <div className="mc-timeline-top">
        <div className="mc-timeline-title">
          <span className="mc-code">TIME</span>
          <strong>Map year</strong>
          <span className={buffering ? "mc-timeline-source is-buffering" : "mc-timeline-source"}>
            {buffering ? "loading next year…" : mapSource}
          </span>
        </div>
        <div className="mc-timeline-current">
          <span>{state.mapYear}</span>
          <span className="sr-only" role="status" aria-live={playing ? "off" : "polite"}>
            Map year {state.mapYear}
          </span>
          <button
            type="button"
            className="mc-play"
            onClick={togglePlayback}
            disabled={start === end}
          >
            <span aria-hidden="true">{playing ? "Ⅱ" : "▶"}</span>
            {playing ? "Pause" : "Play years"}
          </button>
        </div>
      </div>

      <label className="mc-timeline-control">
        <span className="sr-only">Map year from {start} to {end}</span>
        <input
          type="range"
          min={start}
          max={end}
          step={1}
          value={Math.min(end, Math.max(start, state.mapYear))}
          aria-valuetext={`${state.mapYear}, ${mapSource}`}
          onChange={(event) => {
            setPlaying(false);
            state.setMapYear(Number(event.target.value));
          }}
        />
      </label>

      <div className="mc-timeline-years" aria-hidden="true">
        <span>{start}</span>
        <span className="mc-timeline-seam">Feb 2012 · Suomi-NPP begins</span>
        <span>{end}</span>
      </div>
      <p className="mc-timeline-context">
        Map colours keep one scale through playback · panels below use the selected year range.
      </p>
    </section>
  );
}

function ShareButton() {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };
  return (
    <button type="button" className="btn btn--ghost btn--small" onClick={share}>
      {copied ? "Link copied ✓" : "Share view"}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Console                                                             */
/* ------------------------------------------------------------------ */

export default function MissionControl() {
  const state = useExplorer();
  const { grid } = state;

  const kpiKey = useMemo(
    () =>
      `${state.selection.bbox.minLat}:${state.selection.bbox.minLon}:${state.selection.bbox.maxLat}:${state.selection.bbox.maxLon}:${state.range[0]}:${state.range[1]}`,
    [state.selection.bbox, state.range],
  );

  return (
    <div className="mc">
      <header className="mc-bar">
        <a className="mc-brand" href="/">
          ninacal<span aria-hidden="true">.</span>
        </a>
        <div className="mc-route">
          <span>Mission control</span>
          <a href="/">Overview</a>
          <a href="/#data">Data</a>
          <a href="https://github.com/hanserlodev/ninacal" rel="noreferrer">
            GitHub ↗
          </a>
        </div>
        <div className="mc-bar-right">
          <span className={state.mode === "live" ? "mc-mode is-live" : "mc-mode is-demo"}>
            <span aria-hidden="true" />
            {state.dataVersion === "v2"
              ? "Research data v2"
              : state.mode === "live"
                ? "Legacy files"
                : "Simulation"}
          </span>
          <span className="mc-bar-meta">{COVERAGE_LABEL}</span>
          <ShareButton />
          <button
            type="button"
            className="btn btn--primary btn--small"
            onClick={state.exportCsv}
            disabled={state.loading || grid.rowCount === 0 || state.worldView}
            title={state.worldView ? "Select a country or region to export cells" : undefined}
          >
            Export CSV <span aria-hidden="true">↓</span>
          </button>
        </div>
      </header>

      <main className="mc-grid">
        <aside className="mc-rail mc-rail--left" aria-label="Controls">
          <SelectionPanel state={state} />
          <CoveragePanel />
          <KeyPanel />
        </aside>

        <section className="mc-center" aria-label="Map">
          {state.notice ? (
            <p className="mc-alert is-info" role="status">
              {state.notice.text}
            </p>
          ) : null}

          {state.coverage === "outside" ? (
            <p className="mc-alert is-error" role="status">
              <strong>Outside coverage.</strong> NinaCal publishes {COUNTRIES.length} countries.
              Pick one from the selector or draw inside a highlighted area.
            </p>
          ) : null}

          <RegionMap
            selection={state.selection}
            cells={state.cellPoints}
            valueScaleMax={state.mapScaleMax}
            cellCount={state.grid.cellCount || undefined}
            countryTotals={state.countryTotals}
            worldView={state.worldView}
            activeCountry={
              state.dataCountries.length === 1
                ? state.dataCountries[0]
                : state.selection.allCellsFor ?? state.selection.country
            }
            onGlobe={state.showWorld}
            regionName={state.regionName}
            yearCount={state.years.length}
            mapYear={state.mapYear}
            periodLabel={String(state.mapYear)}
            cellStep={state.cellStep}
            measureLabel={state.measureLabel}
            busyLabel={state.busyLabel}
            onChange={state.handleSelection}
          />

          <MapTimeline state={state} />

          <dl className="kpi-strip mc-kpis" key={kpiKey} aria-label="Selection summary">
            <div>
              <dt>{state.measureLabel === "hotspot-days" ? "Hotspots" : "Detections"}</dt>
              <dd>{state.loading ? "—" : formatCompact(grid.sum)}</dd>
            </div>
            <div>
              <dt>Range peak</dt>
              <dd>{grid.peak ? `${monthName(grid.peak.m, true)} ${grid.peak.y}` : "—"}</dd>
            </div>
            <div>
              <dt>Grid cells</dt>
              <dd>{state.loading ? "—" : formatCount(grid.cellCount)}</dd>
            </div>
            <div>
              <dt>Years</dt>
              <dd>{state.years.length || "—"}</dd>
            </div>
            <div>
              <dt>Coverage</dt>
              <dd className="kpi-coverage">{COVERAGE_LABEL}</dd>
            </div>
          </dl>

          {state.grid.cellCount === 0 && !state.loading ? (
            <p className="mc-alert is-info" role="status">
              No grid cells fall inside this selection. Try a preset, or draw a smaller box
              inside the United States or Peru.
            </p>
          ) : null}
        </section>

        <aside className="mc-rail mc-rail--right" aria-label="Telemetry">
          <section className="mc-panel">
            <header className="mc-panel-head">
              <span className="mc-code">ANOM</span>
              <h2>Month status</h2>
              <span className="mc-head-meta">vs median</span>
            </header>
            <AnomalyReadout grid={grid} measureLabel={state.measureLabel} year={state.mapYear} />
          </section>

          <section className="mc-panel">
            <header className="mc-panel-head">
              <span className="mc-code">SEAS</span>
              <h2>Top months</h2>
              <span className="mc-head-meta">median</span>
            </header>
            <SeasonPeaks grid={grid} />
          </section>

          <section className="mc-panel">
            <header className="mc-panel-head">
              <span className="mc-code">VAL</span>
              <h2>Calibration</h2>
            </header>
            <ValidationReadout
              calibration={state.calibration}
              metadata={state.v2Metadata}
              dataVersion={state.dataVersion}
              worldView={state.worldView}
            />
          </section>

          <SystemPanel state={state} />
        </aside>
      </main>

      <section className="mc-deck" aria-labelledby="deck-title">
        <div className="mc-deck-head">
          <span className="mc-code">DECK</span>
          <h2 id="deck-title">Analysis</h2>
          <span>Year × month archive · seasonality · held-out validation</span>
        </div>

        <div className="mc-deck-grid">
          <div className="panel mc-card mc-card--signal">
            <SeriesChart grid={grid} bands={state.bands} />
          </div>
          <SeasonalityChart grid={grid} />
          <div className="panel mc-card mc-card--compare">
            <ComparisonPanel
              range={state.range}
              country={state.dataCountries.length === 1 ? state.dataCountries[0] : undefined}
            />
          </div>
          <div className="panel mc-card mc-card--archive" id="archive">
            <CalendarHeatmap grid={grid} />
          </div>
          <div
            id="validation"
            className={state.dataVersion === "v2" ? "mc-validation-panel" : undefined}
          >
            {state.dataVersion === "v2" ? (
              <V2ValidationPanel metadata={state.v2Metadata} worldView={state.worldView} />
            ) : (
              <CalibrationPanel calibration={state.calibration} live={state.mode === "live"} />
            )}
          </div>
        </div>
      </section>

      <footer className="mc-foot">
        <span>NASA FIRMS · Aqua/MODIS · Suomi-NPP · NOAA-20</span>
        <span>
          Coverage {COVERAGE_LABEL} · {state.years.length} years
        </span>
        <span>A thermal hotspot is not a confirmed fire.</span>
      </footer>
    </div>
  );
}
