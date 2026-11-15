"use client";

import { formatCount, formatDecimal, MONTHS_MIN } from "@/lib/format";
import type { Calibration } from "@/lib/types";

const METHOD_LABEL: Record<Calibration["method"], string> = {
  ratio: "Monthly ratio",
  regression: "Regression",
  quantile: "Quantile mapping",
};

function niceMax(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const exponent = Math.floor(Math.log10(value));
  const base = 10 ** exponent;
  const scaled = value / base;
  const step = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10;
  return step * base;
}

function FactorsChart({ byMonth }: { byMonth: Record<string, number> }) {
  const W = 560;
  const H = 210;
  const pad = { top: 18, right: 12, bottom: 28, left: 46 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  const factors = Array.from({ length: 12 }, (_, i) => byMonth[String(i + 1)] ?? 0);
  const largest = Math.max(...factors);
  const max = largest <= 1 ? 1 : niceMax(largest * 1.1);
  const y = (value: number) => H - pad.bottom - (value / max) * plotH;
  const band = plotW / 12;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="mini-chart"
      role="img"
      aria-label="MODIS-to-VIIRS conversion factor for each month"
    >
      {[0, 0.5, 1].map((fraction) => {
        const value = max * fraction;
        return (
          <g key={fraction}>
            <line
              x1={pad.left}
              x2={W - pad.right}
              y1={y(value)}
              y2={y(value)}
              className="chart-grid"
            />
            <text x={pad.left - 8} y={y(value) + 4} className="chart-axis" textAnchor="end">
              {value.toFixed(1)}
            </text>
          </g>
        );
      })}

      {factors.map((factor, i) => {
        const barW = band * 0.58;
        const x = pad.left + band * i + (band - barW) / 2;
        const top = y(factor);
        return (
          <g key={i}>
            <rect
              x={x}
              y={top}
              width={barW}
              height={Math.max(1, H - pad.bottom - top)}
              rx={3}
              className={factor === Math.max(...factors) ? "factor-bar is-max" : "factor-bar"}
            />
            <text
              x={x + barW / 2}
              y={top - 4}
              className="chart-axis"
              textAnchor="middle"
            >
              {factor.toFixed(2)}
            </text>
            <text
              x={x + barW / 2}
              y={H - pad.bottom + 17}
              className="chart-axis"
              textAnchor="middle"
            >
              {MONTHS_MIN[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function ScatterChart({ calibration }: { calibration: Calibration }) {
  const points = calibration.points ?? [];
  const W = 460;
  const H = 260;
  const pad = { top: 18, right: 16, bottom: 34, left: 46 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  const values = points.flatMap((point) => [point.observed, point.predicted]);
  const sorted = [...values].sort((a, b) => a - b);
  const p99 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99))] ?? 1;
  const max = niceMax(p99 * 1.05);

  const x = (value: number) => pad.left + (value / max) * plotW;
  const y = (value: number) => H - pad.bottom - (value / max) * plotH;

  const stride = Math.max(1, Math.ceil(points.length / 520));
  const sampled = points.filter((_, i) => i % stride === 0);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="mini-chart"
      role="img"
      aria-label={`Observed versus predicted MODIS counts on held-out years, R squared ${calibration.metrics.r2}`}
    >
      <line
        x1={pad.left}
        x2={W - pad.right}
        y1={H - pad.bottom}
        y2={pad.top}
        className="chart-diagonal"
      />
      {[0, 0.5, 1].map((fraction) => (
        <g key={fraction}>
          <text
            x={pad.left - 6}
            y={y(max * fraction) + 4}
            className="chart-axis"
            textAnchor="end"
          >
            {formatCount(max * fraction)}
          </text>
          <text
            x={x(max * fraction)}
            y={H - pad.bottom + 18}
            className="chart-axis"
            textAnchor="middle"
          >
            {formatCount(max * fraction)}
          </text>
        </g>
      ))}

      {sampled.map((point, i) => (
        <circle
          key={i}
          cx={x(Math.min(max, point.observed))}
          cy={y(Math.min(max, point.predicted))}
          r={2}
          className="scatter-dot"
        />
      ))}

      <text
        x={pad.left + plotW / 2}
        y={H - 4}
        className="chart-axis"
        textAnchor="middle"
      >
        observed MODIS
      </text>
      <text x={4} y={pad.top + 4} className="chart-axis">
        predicted
      </text>
    </svg>
  );
}

export default function CalibrationPanel({
  calibration,
  live,
}: {
  calibration: Calibration | null;
  live: boolean;
}) {
  if (!calibration) {
    return (
      <div className="panel calibration-card">
        <div className="card-head">
          <div>
            <p className="eyebrow">Validation</p>
            <h3>Can the 2012 seam be trusted?</h3>
          </div>
          <span className="badge badge--normal">Not published</span>
        </div>
        <p className="empty-inline">
          {live
            ? "This build has no calibration.json yet, so the VIIRS → MODIS conversion cannot be shown. The calendar still uses the published harm field."
            : "No calibration record is available."}
        </p>
      </div>
    );
  }

  const { metrics, by_month: byMonth, train, test, method, products, points } = calibration;

  return (
    <div className="panel calibration-card">
      <div className="card-head">
        <div>
          <p className="eyebrow">Validation</p>
          <h3>Can the 2012 seam be trusted?</h3>
        </div>
        <span className="badge badge--normal">{METHOD_LABEL[method]}</span>
      </div>

      <div className="calib-metrics">
        <div>
          <span className="metric-value">{metrics.r2.toFixed(2)}</span>
          <span className="metric-label">R² on held-out years</span>
        </div>
        <div>
          <span className="metric-value">{formatDecimal(metrics.rmse)}</span>
          <span className="metric-label">RMSE, MODIS-equivalent</span>
        </div>
        <div>
          <span className="metric-value">{formatCount(metrics.n)}</span>
          <span className="metric-label">cell-months tested</span>
        </div>
        <div>
          <span className="metric-value">
            {train[0]}–{train[1]}
          </span>
          <span className="metric-label">
            train · test {test[0]}–{test[1]}
          </span>
        </div>
      </div>

      <div className="calib-grid">
        <div>
          <p className="chart-caption">
            Conversion factor <em>k</em> by month — <code>harm = k · VIIRS</code>. Train{" "}
            {train[0]}–{train[1]}, test {test[0]}–{test[1]}.
          </p>
          <FactorsChart byMonth={byMonth} />
        </div>
        <div>
          <p className="chart-caption">
            Observed MODIS vs predicted MODIS-equivalent on the held-out test years.
          </p>
          {points && points.length > 0 ? (
            <ScatterChart calibration={calibration} />
          ) : (
            <div className="chart-empty">
              <p>
                The calibration file publishes factors and held-out metrics, but not the
                cell-month pairs needed for a scatter.
              </p>
              <p className="muted">
                {products.baseline} → {products.target}. A calibration that cannot be plotted is
                not presented as truth.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
