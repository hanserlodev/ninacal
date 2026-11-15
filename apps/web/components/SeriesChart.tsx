"use client";

import { useMemo, useState } from "react";
import { formatCompact, formatCount, formatDataValue, monthName } from "@/lib/format";
import type { Aggregated } from "@/lib/types";

const W = 880;
const H = 300;
const PAD = { top: 26, right: 16, bottom: 34, left: 58 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

type Point = { index: number; y: number; m: number; value: number | null };

function niceMax(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const exponent = Math.floor(Math.log10(value));
  const base = 10 ** exponent;
  const scaled = value / base;
  const step = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10;
  return step * base;
}

export default function SeriesChart({
  grid,
  bands,
}: {
  grid: Aggregated;
  bands?: Map<string, { low: number | null; high: number | null }>;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const points = useMemo<Point[]>(() => {
    const out: Point[] = [];
    grid.years.forEach((year, yi) => {
      grid.totals[yi].forEach((value, mi) => {
        out.push({ index: out.length, y: year, m: mi + 1, value });
      });
    });
    return out;
  }, [grid]);

  const hasData = points.some((point) => point.value !== null);

  const max = useMemo(() => {
    let largest = 0;
    for (const point of points) {
      if (point.value !== null) largest = Math.max(largest, point.value);
    }
    return niceMax(largest * 1.03);
  }, [points]);

  const xFor = (index: number) =>
    PAD.left + (points.length <= 1 ? 0 : (index / (points.length - 1)) * PLOT_W);
  const yFor = (value: number) => H - PAD.bottom - (value / max) * PLOT_H;

  const segments = useMemo(() => {
    const groups: Point[][] = [];
    let current: Point[] = [];
    for (const point of points) {
      if (point.value === null) {
        if (current.length) groups.push(current);
        current = [];
      } else {
        current.push(point);
      }
    }
    if (current.length) groups.push(current);
    return groups;
  }, [points]);

  const bandSegments = useMemo(() => {
    const groups: { index: number; low: number; high: number }[][] = [];
    let current: { index: number; low: number; high: number }[] = [];
    for (const point of points) {
      const band = point.value === null ? undefined : bands?.get(`${point.y}-${point.m}`);
      if (!band || band.low === null || band.high === null) {
        if (current.length) groups.push(current);
        current = [];
        continue;
      }
      current.push({ index: point.index, low: band.low, high: band.high });
    }
    if (current.length) groups.push(current);
    return groups;
  }, [points, bands]);

  const bandPath = bandSegments
    .map((group) => {
      const upper = group
        .map((point, index) => `${index === 0 ? "M" : "L"}${xFor(point.index).toFixed(1)},${yFor(point.high).toFixed(1)}`)
        .join(" ");
      const lower = [...group]
        .reverse()
        .map((point) => `L${xFor(point.index).toFixed(1)},${yFor(point.low).toFixed(1)}`)
        .join(" ");
      return `${upper} ${lower} Z`;
    })
    .join(" ");

  const linePath = segments
    .map((group) =>
      group
        .map(
          (point, i) =>
            `${i === 0 ? "M" : "L"}${xFor(point.index).toFixed(1)},${yFor(point.value ?? 0).toFixed(1)}`,
        )
        .join(" "),
    )
    .join(" ");

  const areaPath = segments
    .map((group) => {
      const first = group[0];
      const last = group[group.length - 1];
      const body = group
        .map(
          (point, i) =>
            `${i === 0 ? "M" : "L"}${xFor(point.index).toFixed(1)},${yFor(point.value ?? 0).toFixed(1)}`,
        )
        .join(" ");
      return `${body} L${xFor(last.index).toFixed(1)},${H - PAD.bottom} L${xFor(first.index).toFixed(1)},${H - PAD.bottom} Z`;
    })
    .join(" ");

  const seam = points.find((point) => point.y === 2012 && point.m === 2);
  const hoverPoint = hover !== null ? points[hover] : null;
  const tips = hoverPoint
    ? {
        cx: xFor(hoverPoint.index),
        cy:
          hoverPoint.value === null
            ? H - PAD.bottom
            : yFor(hoverPoint.value),
      }
    : null;

  const yearTicks = points.filter(
    (point) =>
      point.m === 1 &&
      (point.y % 5 === 0 || point.y === grid.years[grid.years.length - 1]),
  );

  const hoverBand =
    hoverPoint && hoverPoint.value !== null
      ? (() => {
          const band = bands?.get(`${hoverPoint.y}-${hoverPoint.m}`);
          return band && band.low !== null && band.high !== null ? { low: band.low, high: band.high } : null;
        })()
      : null;

  const onMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (points.length === 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * W;
    const raw = ((x - PAD.left) / PLOT_W) * (points.length - 1);
    const index = Math.round(Math.min(points.length - 1, Math.max(0, raw)));
    setHover(index);
  };

  return (
    <figure className="chart">
      <div className="card-head">
        <div>
          <p className="eyebrow">Monthly record</p>
          <h3>Hotspots detected per month</h3>
        </div>
        <p className="chart-legend">
          <span className="chart-legend-swatch" aria-hidden="true" />
          Harmonized hotspot-days
          {bandSegments.length > 0 ? (
            <>
              <span className="chart-legend-band" aria-hidden="true" />
              <span className="chart-legend-text">approx. range</span>
            </>
          ) : null}
        </p>
      </div>

      {points.length === 0 || !hasData ? (
        <p className="empty-inline">No data in this region for the selected years.</p>
      ) : (
        <>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="chart-svg"
            role="img"
            aria-label={`Monthly harmonized hotspot-days from ${grid.years[0]} to ${grid.years[grid.years.length - 1]}. Peak ${grid.peak ? `${monthName(grid.peak.m)} ${grid.peak.y} with ${formatCount(grid.peak.value)}` : "not available"}.`}
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
          >
            <defs>
              <linearGradient id="series-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ff6b3d" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#ff6b3d" stopOpacity="0.01" />
              </linearGradient>
            </defs>

            {Array.from({ length: 5 }, (_, i) => {
              const value = (max / 4) * i;
              const y = yFor(value);
              return (
                <g key={`grid-${i}`}>
                  <line
                    x1={PAD.left}
                    x2={W - PAD.right}
                    y1={y}
                    y2={y}
                    className="chart-grid"
                  />
                  <text x={PAD.left - 10} y={y + 4} className="chart-axis" textAnchor="end">
                    {formatCompact(value)}
                  </text>
                </g>
              );
            })}

            {bandPath ? <path d={bandPath} className="chart-band" /> : null}
            <path d={areaPath} fill="url(#series-fill)" />
            <path d={linePath} className="chart-line" fill="none" />

            {seam ? (
              <g>
                <line
                  x1={xFor(seam.index)}
                  x2={xFor(seam.index)}
                  y1={PAD.top}
                  y2={H - PAD.bottom}
                  className="chart-seam"
                />
                <text
                  x={xFor(seam.index) + 6}
                  y={PAD.top + 10}
                  className="chart-seam-label"
                >
                  Suomi-NPP observed →
                </text>
              </g>
            ) : null}

            {yearTicks.map((point) => (
              <text
                key={`year-${point.y}`}
                x={xFor(point.index)}
                y={H - PAD.bottom + 20}
                className="chart-axis"
                textAnchor={point.y === grid.years[0] ? "start" : "middle"}
              >
                {point.y}
              </text>
            ))}

            {hoverPoint && tips ? (
              <g>
                <line
                  x1={tips.cx}
                  x2={tips.cx}
                  y1={PAD.top}
                  y2={H - PAD.bottom}
                  className="chart-cross"
                />
                <circle
                  cx={tips.cx}
                  cy={tips.cy}
                  r={4}
                  className="chart-dot"
                />
                <g transform={`translate(${Math.min(W - 170, Math.max(4, tips.cx - 80))}, ${
                  tips.cy - 70 < 4 ? tips.cy + 16 : tips.cy - 70
                })`}>
                  <rect width={164} height={hoverBand ? 58 : 44} rx={8} className="chart-tip-bg" />
                  <text x={10} y={18} className="chart-tip-title">
                    {monthName(hoverPoint.m, true)} {hoverPoint.y}
                  </text>
                  <text x={10} y={34} className="chart-tip-value">
                    {hoverPoint.value === null
                      ? "no measurement"
                      : `${formatDataValue(hoverPoint.value)} hotspot-days`}
                  </text>
                  {hoverBand ? (
                    <text x={10} y={50} className="chart-tip-band">
                      approx. {formatCompact(hoverBand.low)}–{formatCompact(hoverBand.high)}
                    </text>
                  ) : null}
                </g>
              </g>
            ) : null}
          </svg>

          <figcaption className="chart-note">
            {grid.peak
              ? `Peak: ${monthName(grid.peak.m)} ${grid.peak.y} · ${formatCompact(grid.peak.value)} hotspot-days`
              : "No peak available"}
            {grid.missing > 0
              ? ` · ${formatCount(grid.missing)} cell-months without a measurement`
              : ""}
            {bandSegments.length > 0
              ? " · shaded range: approximate 80% conversion error for estimated months"
              : ""}
          </figcaption>
        </>
      )}
    </figure>
  );
}
