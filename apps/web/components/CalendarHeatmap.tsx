"use client";

import { Fragment, useMemo, useState } from "react";
import {
  formatCompact,
  formatCount,
  formatDataValue,
  monthName,
  MONTHS_MIN,
} from "@/lib/format";
import { rampColor } from "@/lib/ramp";
import type { Aggregated } from "@/lib/types";

export default function CalendarHeatmap({ grid }: { grid: Aggregated }) {
  const [readout, setReadout] = useState<{ y: number; m: number; value: number | null } | null>(
    null,
  );

  const { max, min } = useMemo(() => {
    const values = grid.totals.flat().filter((v): v is number => v !== null);
    if (values.length === 0) return { max: 1, min: 0 };
    const sorted = [...values].sort((a, b) => a - b);
    const p98 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.98))];
    return { max: Math.max(1, p98), min: sorted[0] };
  }, [grid]);

  const color = (value: number) => {
    const t = 0.08 + 0.92 * Math.sqrt(Math.max(0, value) / max);
    return rampColor(t);
  };

  const valueFor = (yi: number, m: number) => grid.totals[yi]?.[m - 1] ?? null;

  if (grid.cellCount === 0) {
    return (
      <figure className="calendar">
        <div className="card-head">
          <div>
            <p className="eyebrow">Year × month</p>
            <h3>No calendar yet</h3>
          </div>
        </div>
        <p className="empty-inline">
          No grid cells fall inside this selection. Pick a preset, or draw a smaller box
          inside the United States or Peru.
        </p>
      </figure>
    );
  }

  return (
    <figure className="calendar">
      <div className="card-head">
        <div>
          <p className="eyebrow">Year × month</p>
          <h3>Every month since {grid.years[0] ?? "—"}</h3>
        </div>
        <div className="calendar-readout" aria-live="polite">
          {readout ? (
            <>
              <strong>{monthName(readout.m, true)} {readout.y}</strong>
              <span>
                {readout.value === null ? "no measurement" : `${formatDataValue(readout.value)} hotspot-days`}
              </span>
            </>
          ) : (
            <span className="muted">Hover a cell for its monthly total</span>
          )}
        </div>
      </div>

      <div
        className="cal-grid"
        role="img"
        aria-label={`Calendar heatmap of harmonized detected hotspot-days by year and month, ${grid.years[0]} to ${grid.years[grid.years.length - 1]}. Exact values are available in the table below.`}
      >
        <span className="cal-corner" />
        {MONTHS_MIN.map((letter, index) => (
          <span className="cal-month" key={`m-${index}`} title={monthName(index + 1)}>
            {letter}
          </span>
        ))}
        <span className="cal-total cal-total-head" title="Annual total, measured months only">
          Total
        </span>

        {grid.years.map((year, yi) => (
          <Fragment key={year}>
            <span className={year < 2012 ? "cal-year is-pre" : "cal-year"}>{year}</span>
            {Array.from({ length: 12 }, (_, mi) => {
              const value = valueFor(yi, mi + 1);
              const source = grid.sources[yi]?.[mi] ?? null;
              const sourceClass =
                source === "aqua_estimated" || source === "noaa20_estimated"
                  ? " is-estimated"
                  : source === "mixed"
                    ? " is-mixed"
                    : "";
              return (
                <span
                  key={`${year}-${mi}`}
                  className={`${value === null ? "cal-cell is-empty" : "cal-cell"}${sourceClass}`}
                  style={value === null ? undefined : { backgroundColor: color(value) }}
                  onMouseEnter={() => setReadout({ y: year, m: mi + 1, value })}
                  onMouseLeave={() => setReadout(null)}
                  title={`${monthName(mi + 1)} ${year} — ${
                    value === null
                      ? source === "unavailable"
                        ? "sensor unavailable"
                        : "no measurement"
                      : `${formatDataValue(value)} detected hotspot-days${source ? ` · ${source.replaceAll("_", " ")}` : ""}`
                  }`}
                />
              );
            })}
            <span className="cal-total" title={`${year} annual total`}>
              {formatCompact(grid.annual[yi]?.value ?? 0)}
            </span>
          </Fragment>
        ))}
      </div>

      <div className="cal-legend">
        <span className="cal-legend-label">low</span>
        <span className="cal-legend-bar" aria-hidden="true" />
        <span className="cal-legend-label">high</span>
        <span className="cal-legend-note">
          {formatCompact(min)}–{formatCompact(max)} hotspot-days per month · colour scale is
          square-root to keep small months visible
        </span>
      </div>

      <p className="cal-note">
        The calendar uses harmonized detected hotspot-days. Dotted cells use an estimated
        satellite conversion; hatch indicates unavailable source coverage. The right-hand
        column sums measured months of each year. Values before 2003 are not harmonized.
      </p>

      <details className="cal-table">
        <summary>View these numbers as a table</summary>
        <div className="table-scroll">
          <table>
            <caption className="sr-only">
              Harmonized detected hotspot-days by year and month
            </caption>
            <thead>
              <tr>
                <th scope="col">Year</th>
                {Array.from({ length: 12 }, (_, mi) => (
                  <th scope="col" key={`th-${mi}`}>
                    {monthName(mi + 1, true)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.years.map((year, yi) => (
                <tr key={`row-${year}`}>
                  <th scope="row">{year}</th>
                  {Array.from({ length: 12 }, (_, mi) => {
                    const value = valueFor(yi, mi + 1);
                    return (
                      <td key={`td-${year}-${mi}`}>
                         {value === null ? "—" : formatDataValue(value)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
