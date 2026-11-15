"use client";

import { computeStats, monthHistory } from "@/lib/aggregate";
import { formatCompact, formatCount, formatDecimal, formatPercent, monthName } from "@/lib/format";
import type { Aggregated } from "@/lib/types";

export default function AnomalyPanel({ grid }: { grid: Aggregated }) {
  const latest = grid.latest;
  if (!latest) {
    return (
      <div className="panel anomaly-card">
        <div className="card-head">
          <div>
            <p className="eyebrow">Anomaly</p>
            <h3>Is this month unusual?</h3>
          </div>
        </div>
        <p className="empty-inline">No measured month in this selection yet.</p>
      </div>
    );
  }

  const history = monthHistory(grid, latest.m);
  const values = history.map((entry) => entry.value);
  const stats = computeStats(values, latest.value);
  const delta = stats.median > 0 ? ((latest.value - stats.median) / stats.median) * 100 : 0;
  const absZ = Math.abs(stats.z);
  const tone = absZ >= 2 ? "strong" : absZ >= 1 ? "mild" : "normal";
  const label =
    absZ >= 2
      ? "Highly unusual"
      : absZ >= 1
        ? stats.z > 0
          ? "Above the usual range"
          : "Below the usual range"
        : "Within the usual range";

  const previous = history.filter((entry) => entry.y !== latest.y);
  const higher = previous.filter((entry) => entry.value < latest.value).length;
  const barMax = Math.max(...values, 1);
  const medianLine = (stats.median / barMax) * 100;
  const magnitude = Math.abs(delta).toFixed(0);
  const comparison =
    stats.median > 0
      ? Math.abs(delta) < 0.5
        ? "in line with"
        : `${magnitude}% ${delta > 0 ? "above" : "below"}`
      : "compared with";

  return (
    <div className="panel anomaly-card">
      <div className="card-head">
        <div>
          <p className="eyebrow">Anomaly</p>
          <h3>Is this month unusual?</h3>
        </div>
        <span className={`badge badge--${tone}`}>{label}</span>
      </div>

      <div className="anom-headline">
        <p className="anom-value">{formatCompact(latest.value)}</p>
        <p className="anom-when">
          {monthName(latest.m)} {latest.y}
          <span className={`anom-delta is-${tone}`}>{formatPercent(delta)}</span>
        </p>
      </div>

      <div className="anom-bars" aria-hidden="true">
        <span className="anom-median" style={{ bottom: `${medianLine}%` }} />
        {history.map((entry) => {
          const isLatest = entry.y === latest.y;
          return (
            <span
              key={entry.y}
              className={isLatest ? "anom-bar is-latest" : "anom-bar"}
              style={{ height: `${Math.max(3, (entry.value / barMax) * 100)}%` }}
              title={`${monthName(latest.m)} ${entry.y} — ${formatCount(entry.value)}`}
            />
          );
        })}
      </div>
      <div className="anom-axis">
        <span>{history[0]?.y}</span>
        <span className="anom-axis-mid">same month, year by year</span>
        <span>{history[history.length - 1]?.y}</span>
      </div>

      <p className="anom-copy">
        <strong>
          {monthName(latest.m)} {latest.y}
        </strong>{" "}
        is {comparison} the {history[0]?.y}–{history[history.length - 1]?.y} median for{" "}
        {monthName(latest.m)}.
        {previous.length > 0
          ? ` Higher than ${higher} of ${previous.length} previous ${monthName(latest.m)}s.`
          : ""}
      </p>

      <dl className="anom-meta">
        <div>
          <dt>Median</dt>
          <dd>{formatCount(stats.median)}</dd>
        </div>
        <div>
          <dt>Robust z</dt>
          <dd>{formatDecimal(stats.z)}</dd>
        </div>
        <div>
          <dt>MAD</dt>
          <dd>{formatCount(stats.mad)}</dd>
        </div>
      </dl>

      <p className="anom-note">
        {values.length < 8
          ? `Only ${values.length} comparable years — treat this comparison as indicative.`
          : "Robust z uses the median absolute deviation, so one extreme year cannot hide a trend."}{" "}
        The latest month in the record may be a partial month.
      </p>
    </div>
  );
}
