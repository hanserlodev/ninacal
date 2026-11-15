"use client";

import { useState } from "react";
import { median, monthHistory } from "@/lib/aggregate";
import { formatCompact, formatCount, monthName, MONTHS_SHORT } from "@/lib/format";
import type { Aggregated } from "@/lib/types";

export default function SeasonalityChart({ grid }: { grid: Aggregated }) {
  const [hover, setHover] = useState<number | null>(null);

  const medians = Array.from({ length: 12 }, (_, index) =>
    median(monthHistory(grid, index + 1).map((entry) => entry.value)),
  );
  const max = Math.max(1, ...medians);
  const peak = medians.indexOf(Math.max(...medians));
  const hasData = grid.totals.flat().some((value) => value !== null);

  const readout =
    hover !== null
      ? `${monthName(hover + 1)} · ${formatCount(medians[hover])} median hotspot-days`
      : hasData
        ? `Median of ${grid.years.length} years · peak in ${monthName(peak + 1)}`
        : "No measured months in this selection";

  return (
    <div className="panel seasonality-card">
      <div className="card-head">
        <div>
          <p className="eyebrow">Seasonality</p>
          <h3>A typical year in this region</h3>
        </div>
        <p className="season-readout" aria-live="polite">
          {readout}
        </p>
      </div>

      {hasData ? (
        <div
          className="season-bars"
          role="img"
          aria-label={`Median monthly hotspot-days. Peak in ${monthName(peak + 1)}.`}
          onMouseLeave={() => setHover(null)}
        >
          {medians.map((value, index) => (
            <div
              className="season-col"
              key={index}
              onMouseEnter={() => setHover(index)}
              onFocus={() => setHover(index)}
              tabIndex={0}
            >
              <span className={index === peak ? "season-value is-peak" : "season-value"}>
                {formatCompact(value)}
              </span>
              <span className="season-plot">
                <span
                  className={
                    index === peak
                      ? "season-bar is-peak"
                      : hover === index
                        ? "season-bar is-hover"
                        : "season-bar"
                  }
                  style={{ height: `${Math.max(2, (value / max) * 100)}%` }}
                />
              </span>
              <span className="season-month">{MONTHS_SHORT[index]}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="empty-inline">No measured months in this region yet.</p>
      )}
    </div>
  );
}
