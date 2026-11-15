"use client";

import { useEffect, useMemo, useState } from "react";
import { formatCompact, formatDecimal } from "@/lib/format";
import { loadSeriesEntry, loadSeriesIndex, type SeriesLevel } from "@/lib/series";
import type { ApiSeriesRow } from "@/lib/api";
import type { DataCountry } from "@/lib/types";

type Option = { country: DataCountry; id: string; name: string };

const W = 520;
const H = 150;
const PAD = { top: 10, right: 8, bottom: 18, left: 8 };

function valueFor(rows: ApiSeriesRow[], year: number): number | null {
  const row = rows.find((entry) => entry.year === year);
  return row && row.value !== null ? row.value : null;
}

function seriesPath(rows: ApiSeriesRow[], years: number[], max: number, color: string): string {
  let open = false;
  let path = "";
  years.forEach((year, index) => {
    const value = valueFor(rows, year);
    if (value === null) {
      open = false;
      return;
    }
    const x = PAD.left + (years.length <= 1 ? 0 : (index / (years.length - 1)) * (W - PAD.left - PAD.right));
    const y = H - PAD.bottom - (value / max) * (H - PAD.top - PAD.bottom);
    path += `${open ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
    open = true;
  });
  return path ? `<path d="${path}" fill="none" stroke="${color}" stroke-width="1.6" />` : "";
}

export default function ComparisonPanel({
  range,
  country,
}: {
  range: [number, number];
  country?: string;
}) {
  const [options, setOptions] = useState<Option[]>([]);
  const [a, setA] = useState("PE");
  const [b, setB] = useState("US");
  const [rowsA, setRowsA] = useState<ApiSeriesRow[]>([]);
  const [rowsB, setRowsB] = useState<ApiSeriesRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const countries: DataCountry[] = ["PE", "US"];
    if (country && !countries.includes(country)) countries.push(country);
    Promise.all(countries.map((code) => loadSeriesIndex(code)))
      .then((indexes) => {
        if (!alive) return;
        const list: Option[] = indexes.flatMap((entries, position) =>
          entries.map((entry) => ({
            country: countries[position],
            id: entry.id,
            name: entry.name,
          })),
        );
        setOptions(list);
        if (!list.some((entry) => entry.id === "PE")) setA(list[0]?.id ?? "");
        if (!list.some((entry) => entry.id === "US")) setB(list[1]?.id ?? "");
      })
      .catch(() => {
        if (alive) setOptions([]);
      });
    return () => {
      alive = false;
    };
  }, [country]);

  useEffect(() => {
    if (!country || options.length === 0) return;
    if (!options.some((entry) => entry.id === country)) return;
    setA(country);
    const other = options.find((entry) => entry.id !== country && entry.id.length <= 3);
    if (other) setB(other.id);
  }, [country, options]);

  useEffect(() => {
    if (!a || !b || options.length === 0) return;
    const optionA = options.find((entry) => entry.id === a);
    const optionB = options.find((entry) => entry.id === b);
    if (!optionA || !optionB) return;
    let alive = true;
    setLoading(true);
    const level: SeriesLevel = "years";
    Promise.all([
      loadSeriesEntry(optionA.country, optionA.id, level),
      loadSeriesEntry(optionB.country, optionB.id, level),
    ])
      .then(([first, second]) => {
        if (!alive) return;
        setRowsA(first.rows);
        setRowsB(second.rows);
        setLoading(false);
      })
      .catch(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [a, b, options]);

  const years = useMemo(() => {
    const values: number[] = [];
    for (let year = range[0]; year <= range[1]; year += 1) values.push(year);
    return values;
  }, [range]);

  const max = useMemo(() => {
    let largest = 1;
    for (const year of years) {
      for (const rows of [rowsA, rowsB]) {
        const value = valueFor(rows, year);
        if (value !== null) largest = Math.max(largest, value);
      }
    }
    return largest;
  }, [years, rowsA, rowsB]);

  const labelA = options.find((entry) => entry.id === a)?.name ?? a;
  const labelB = options.find((entry) => entry.id === b)?.name ?? b;
  const totalA = years.reduce((sum, year) => sum + (valueFor(rowsA, year) ?? 0), 0);
  const totalB = years.reduce((sum, year) => sum + (valueFor(rowsB, year) ?? 0), 0);
  const delta = totalB > 0 ? ((totalA - totalB) / totalB) * 100 : 0;

  return (
    <div className="mc-compare">
      <div className="mc-compare-head">
        <div>
          <p className="eyebrow">Comparison</p>
          <h3>Two regions, one scale</h3>
        </div>
        <span className="mc-head-meta">
          {range[0]}–{range[1]}
        </span>
      </div>

      <div className="mc-compare-pickers">
        <label>
          <span>Region A</span>
          <select value={a} onChange={(event) => setA(event.target.value)}>
            {options.map((entry) => (
              <option key={`a-${entry.country}-${entry.id}`} value={entry.id}>
                {entry.country} · {entry.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Region B</span>
          <select value={b} onChange={(event) => setB(event.target.value)}>
            {options.map((entry) => (
              <option key={`b-${entry.country}-${entry.id}`} value={entry.id}>
                {entry.country} · {entry.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mc-compare-totals">
        <div>
          <span className="mc-compare-key is-a" aria-hidden="true" />
          <strong>{formatCompact(totalA)}</strong>
          <em>{labelA} hotspot-days</em>
        </div>
        <div>
          <span className="mc-compare-key is-b" aria-hidden="true" />
          <strong>{formatCompact(totalB)}</strong>
          <em>{labelB} hotspot-days</em>
        </div>
        <div className={delta >= 0 ? "mc-compare-delta is-up" : "mc-compare-delta is-down"}>
          {loading ? "…" : `${delta >= 0 ? "+" : ""}${formatDecimal(delta)}%`}
          <em>A vs B</em>
        </div>
      </div>

      <svg
        className="mc-compare-chart"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Annual hotspot-days for ${labelA} and ${labelB}, ${range[0]} to ${range[1]}.`}
        dangerouslySetInnerHTML={{
          __html:
            seriesPath(rowsA, years, max, "#6fd6d0") +
            seriesPath(rowsB, years, max, "#ff6b3d"),
        }}
      />

      <div className="mc-compare-legend" aria-hidden="true">
        <span className="is-a">A</span>
        <span className="is-b">B</span>
      </div>

      <p className="mc-compare-note">
        Annual totals from the country/department series. Compare shapes and levels; both use
        detected hotspot-days on the same Suomi-NPP scale.
      </p>
    </div>
  );
}
