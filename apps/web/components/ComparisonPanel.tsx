"use client";

import { useEffect, useMemo, useState } from "react";
import { COUNTRIES } from "@/lib/countries";
import { formatCompact, formatDecimal } from "@/lib/format";
import { loadSeriesEntry, loadSeriesIndex, type SeriesLevel } from "@/lib/series";
import type { ApiSeriesRow, ApiSeriesSummary } from "@/lib/api";
import CountryPicker from "./CountryPicker";
import RegionPicker from "./RegionPicker";

const W = 520;
const H = 150;
const PAD = { top: 10, right: 8, bottom: 18, left: 8 };

type Side = {
  country: string;
  region: string;
  options: ApiSeriesSummary[];
  rows: ApiSeriesRow[];
  loading: boolean;
};

function valueFor(rows: ApiSeriesRow[], year: number): number | null {
  const row = rows.find((entry) => entry.year === year);
  return row && row.value !== null ? row.value : null;
}

function seriesMarkup(
  rows: ApiSeriesRow[],
  years: number[],
  max: number,
  color: string,
  scale = 1,
): string {
  let open = false;
  let path = "";
  let dots = "";
  years.forEach((year, index) => {
    const value = valueFor(rows, year);
    if (value === null) {
      open = false;
      return;
    }
    const x =
      PAD.left +
      (years.length <= 1 ? (W - PAD.left - PAD.right) / 2 : (index / (years.length - 1)) * (W - PAD.left - PAD.right));
    const y = H - PAD.bottom - ((value * scale) / max) * (H - PAD.top - PAD.bottom);
    path += `${open ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
    dots += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.3" fill="${color}" />`;
    open = true;
  });
  return `${path ? `<path d="${path}" fill="none" stroke="${color}" stroke-width="1.6" />` : ""}${dots}`;
}

function countryName(code: string): string {
  return COUNTRIES.find((country) => country.code === code)?.name ?? code;
}

function defaultB(code: string): string {
  if (code !== "US" && COUNTRIES.some((country) => country.code === "US")) return "US";
  if (code !== "PE" && COUNTRIES.some((country) => country.code === "PE")) return "PE";
  return COUNTRIES.find((country) => country.code !== code)?.code ?? code;
}

function SidePicker({
  side,
  label,
  state,
  onChange,
  catalogVersion,
}: {
  side: "a" | "b";
  label: string;
  state: Side;
  onChange: (patch: Partial<Side>) => void;
  catalogVersion?: number;
}) {
  const regions = state.options.filter((entry) => entry.id !== state.country);
  return (
    <div className="mc-compare-side">
      <div className="mc-compare-side-head">
        <span className={`mc-compare-key is-${side}`} aria-hidden="true" />
        <strong>{label}</strong>
        {state.loading ? <em>loading…</em> : null}
      </div>
      <div className="world-picker-field">
        <span>Country</span>
        <CountryPicker
          value={state.country}
          version={catalogVersion}
          onChange={(code) => {
            if (code === state.country) return;
            onChange({ country: code, region: code });
          }}
        />
      </div>
      <div className="world-picker-field">
        <span>Region / state</span>
        <RegionPicker
          value={state.region}
          options={regions}
          wholeValue={state.country}
          wholeLabel={`${countryName(state.country)} · whole country`}
          onChange={(value) => onChange({ region: value })}
        />
      </div>
    </div>
  );
}

export default function ComparisonPanel({
  range,
  country,
  catalogVersion,
}: {
  range: [number, number];
  country?: string;
  catalogVersion?: number;
}) {
  const [mode, setMode] = useState<"absolute" | "indexed">("absolute");
  const initialA = country && COUNTRIES.some((entry) => entry.code === country) ? country : "PE";
  const [a, setA] = useState<Side>({
    country: initialA,
    region: initialA,
    options: [],
    rows: [],
    loading: true,
  });
  const [b, setB] = useState<Side>({
    country: defaultB(initialA),
    region: defaultB(initialA),
    options: [],
    rows: [],
    loading: true,
  });

  // Map selection drives side A, but manual comparison choices stay put unless
  // the selected country actually changes.
  useEffect(() => {
    if (!country || !COUNTRIES.some((entry) => entry.code === country)) return;
    setA((current) =>
      current.country === country
        ? current
        : { ...current, country, region: country, options: [], rows: [], loading: true },
    );
  }, [country]);

  useEffect(() => {
    let alive = true;
    setA((current) => ({ ...current, options: [], loading: true }));
    loadSeriesIndex(a.country)
      .then((options) => {
        if (!alive) return;
        setA((current) => ({ ...current, options, loading: false }));
      })
      .catch(() => {
        if (alive) setA((current) => ({ ...current, options: [], loading: false }));
      });
    return () => {
      alive = false;
    };
  }, [a.country]);

  useEffect(() => {
    let alive = true;
    setB((current) => ({ ...current, options: [], loading: true }));
    loadSeriesIndex(b.country)
      .then((options) => {
        if (!alive) return;
        setB((current) => ({ ...current, options, loading: false }));
      })
      .catch(() => {
        if (alive) setB((current) => ({ ...current, options: [], loading: false }));
      });
    return () => {
      alive = false;
    };
  }, [b.country]);

  useEffect(() => {
    let alive = true;
    const level: SeriesLevel = "years";
    const id = a.region || a.country;
    loadSeriesEntry(a.country, id, level)
      .then((entry) => {
        if (alive) setA((current) => ({ ...current, rows: entry.rows }));
      })
      .catch(() => {
        if (alive) setA((current) => ({ ...current, rows: [] }));
      });
    return () => {
      alive = false;
    };
  }, [a.country, a.region]);

  useEffect(() => {
    let alive = true;
    const level: SeriesLevel = "years";
    const id = b.region || b.country;
    loadSeriesEntry(b.country, id, level)
      .then((entry) => {
        if (alive) setB((current) => ({ ...current, rows: entry.rows }));
      })
      .catch(() => {
        if (alive) setB((current) => ({ ...current, rows: [] }));
      });
    return () => {
      alive = false;
    };
  }, [b.country, b.region]);

  const years = useMemo(() => {
    const values: number[] = [];
    for (let year = range[0]; year <= range[1]; year += 1) values.push(year);
    return values;
  }, [range]);

  const ownMax = (rows: ApiSeriesRow[]): number => {
    let largest = 1;
    for (const year of years) {
      const value = valueFor(rows, year);
      if (value !== null) largest = Math.max(largest, value);
    }
    return largest;
  };
  const maxA = useMemo(() => ownMax(a.rows), [a.rows, years]);
  const maxB = useMemo(() => ownMax(b.rows), [b.rows, years]);
  const indexed = mode === "indexed";
  const max = indexed ? 100 : Math.max(maxA, maxB);
  const scaleA = indexed ? 100 / maxA : 1;
  const scaleB = indexed ? 100 / maxB : 1;
  const ratio = Math.max(maxA, maxB) / Math.max(1, Math.min(maxA, maxB));

  const regionName = (side: Side): string => {
    if (side.region === side.country) return countryName(side.country);
    return side.options.find((entry) => entry.id === side.region)?.name ?? side.region;
  };

  const labelA = regionName(a);
  const labelB = regionName(b);
  const totalA = years.reduce((sum, year) => sum + (valueFor(a.rows, year) ?? 0), 0);
  const totalB = years.reduce((sum, year) => sum + (valueFor(b.rows, year) ?? 0), 0);
  const delta = totalB > 0 ? ((totalA - totalB) / totalB) * 100 : 0;

  return (
    <div className="mc-compare">
      <div className="mc-compare-head">
        <div>
          <p className="eyebrow">Comparison</p>
          <h3>Two regions, one scale</h3>
        </div>
        <div className="mc-compare-head-right">
          <div className="mc-compare-mode" role="group" aria-label="Comparison scale">
            <button
              type="button"
              className={mode === "absolute" ? "is-active" : ""}
              aria-pressed={mode === "absolute"}
              onClick={() => setMode("absolute")}
            >
              Absolute
            </button>
            <button
              type="button"
              className={mode === "indexed" ? "is-active" : ""}
              aria-pressed={mode === "indexed"}
              onClick={() => setMode("indexed")}
            >
              Indexed
            </button>
          </div>
          <span className="mc-head-meta">
            {range[0]}–{range[1]}
          </span>
        </div>
      </div>

      <div className="mc-compare-pickers">
        <SidePicker
          side="a"
          label="Region A"
          state={a}
          catalogVersion={catalogVersion}
          onChange={(patch) => setA((current) => ({ ...current, ...patch, rows: [] }))}
        />
        <SidePicker
          side="b"
          label="Region B"
          state={b}
          catalogVersion={catalogVersion}
          onChange={(patch) => setB((current) => ({ ...current, ...patch, rows: [] }))}
        />
      </div>

      <div className="mc-compare-totals">
        <div>
          <span className="mc-compare-key is-a" aria-hidden="true" />
          <strong>{a.rows.length === 0 ? "…" : formatCompact(totalA)}</strong>
          <em>{labelA} hotspot-days</em>
        </div>
        <div>
          <span className="mc-compare-key is-b" aria-hidden="true" />
          <strong>{b.rows.length === 0 ? "…" : formatCompact(totalB)}</strong>
          <em>{labelB} hotspot-days</em>
        </div>
        <div className={delta >= 0 ? "mc-compare-delta is-up" : "mc-compare-delta is-down"}>
          {a.loading || b.loading || a.rows.length === 0 || b.rows.length === 0
            ? "…"
            : `${delta >= 0 ? "+" : ""}${formatDecimal(delta)}%`}
          <em>A vs B</em>
        </div>
      </div>

      <svg
        className="mc-compare-chart"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${indexed ? "Indexed" : "Absolute"} annual hotspot-days for ${labelA} and ${labelB}, ${range[0]} to ${range[1]}.`}
        dangerouslySetInnerHTML={{
          __html:
            seriesMarkup(a.rows, years, max, "#6fd6d0", scaleA) +
            seriesMarkup(b.rows, years, max, "#ff6b3d", scaleB),
        }}
      />

      <div className="mc-compare-legend" aria-hidden="true">
        <span className="is-a">A</span>
        <span className="is-b">B</span>
      </div>

      {!indexed && ratio > 8 ? (
        <p className="mc-compare-scale-note">
          A and B differ by {ratio.toFixed(0)}×. Relative heights are correct; switch to
          <strong> Indexed</strong> to compare their yearly shapes.
        </p>
      ) : null}

      <p className="mc-compare-note">
        Annual totals from the country/department series. Pick any country and region on each
        side; both use detected hotspot-days on the same Suomi-NPP scale.
      </p>
    </div>
  );
}
