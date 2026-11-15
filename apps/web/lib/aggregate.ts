import { parseCell } from "./geo";
import type { Aggregated, Row, Stats } from "./types";

const MONTHS = 12;

export type GridMatcher = (lat: number, lon: number) => boolean;

export type AggregateOptions = {
  /** Published cells in the selection, including cells with no detections in range. */
  knownCells?: string[];
  /** Availability of each period. Sparse absence is zero only for available months. */
  availability?: { y: number; m: number; source: string }[];
};

/**
 * Filter rows to the region and year range, then sum `harm` per (year, month).
 * `null` means "not measured"; a missing month stays null instead of pretending zero.
 */
export function aggregate(
  rows: Row[],
  years: number[],
  match: GridMatcher,
  options: AggregateOptions = {},
): Aggregated {
  const index = new Map<number, number>();
  years.forEach((year, i) => index.set(year, i));

  const totals: (number | null)[][] = years.map(() => Array(MONTHS).fill(null) as (number | null)[]);
  const sources: (string | null)[][] = years.map(() => Array(MONTHS).fill(null) as (string | null)[]);
  const unavailable = new Set(
    (options.availability ?? [])
      .filter((item) => item.source === "unavailable" || item.source === "not_harmonized")
      .map((item) => `${item.y}-${item.m}`),
  );
  const cells = new Set<string>();
  const cellTotals = new Map<string, number>();
  for (const cell of options.knownCells ?? []) {
    cells.add(cell);
    cellTotals.set(cell, 0);
  }
  let rowCount = 0;
  let missing = 0;
  let sum = 0;

  for (const row of rows) {
    const yi = index.get(row.y);
    if (yi === undefined) continue;
    const point = parseCell(row.cell);
    if (!point) continue;
    if (!match(point[0], point[1])) continue;

    rowCount += 1;
    cells.add(row.cell);

    if (row.harm === null || unavailable.has(`${row.y}-${row.m}`)) {
      missing += 1;
      continue;
    }
    const value = row.harm;
    const bucket = totals[yi][row.m - 1] ?? 0;
    totals[yi][row.m - 1] = bucket + value;
    cellTotals.set(row.cell, (cellTotals.get(row.cell) ?? 0) + value);
    sum += value;
  }

  for (const item of options.availability ?? []) {
    const yi = index.get(item.y);
    if (yi === undefined || item.m < 1 || item.m > MONTHS) continue;
    const mi = item.m - 1;
    if (item.source === "unavailable" || item.source === "not_harmonized") {
      sources[yi][mi] = item.source;
      totals[yi][mi] = null;
      continue;
    }
    totals[yi][mi] ??= 0;
    const previous = sources[yi][mi];
    sources[yi][mi] = previous && previous !== item.source ? "mixed" : item.source;
  }

  let peak: Aggregated["peak"] = null;
  let latest: Aggregated["latest"] = null;
  const annual: Aggregated["annual"] = [];

  for (let yi = 0; yi < years.length; yi += 1) {
    let yearSum = 0;
    for (let m = 0; m < MONTHS; m += 1) {
      const value = totals[yi][m];
      if (value === null) continue;
      yearSum += value;
      if (!peak || value > peak.value) {
        peak = { y: years[yi], m: m + 1, value };
      }
      if (
        !latest ||
        years[yi] > latest.y ||
        (years[yi] === latest.y && m + 1 > latest.m)
      ) {
        latest = { y: years[yi], m: m + 1, value };
      }
    }
    annual.push({ y: years[yi], value: yearSum });
  }

  return {
    years,
    totals,
    sources,
    annual,
    cellCount: cells.size,
    cellTotals,
    rowCount,
    missing,
    sum,
    peak,
    latest,
  };
}

/** Non-null totals for one calendar month across the selected years. */
export function monthHistory(
  grid: Aggregated,
  month: number,
): { y: number; value: number }[] {
  const out: { y: number; value: number }[] = [];
  grid.years.forEach((year, yi) => {
    const value = grid.totals[yi]?.[month - 1] ?? null;
    if (value !== null) out.push({ y: year, value });
  });
  return out;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function computeStats(values: number[], latest?: number): Stats {
  const sorted = [...values].sort((a, b) => a - b);
  const med = median(sorted);
  const deviations = sorted.map((value) => Math.abs(value - med));
  const mad = median(deviations);
  const mean = sorted.reduce((acc, value) => acc + value, 0) / Math.max(1, sorted.length);
  const variance =
    sorted.reduce((acc, value) => acc + (value - mean) ** 2, 0) / Math.max(1, sorted.length);
  const sd = Math.sqrt(variance);

  // Robust z-score; fall back to the standard deviation when MAD collapses.
  let z = 0;
  if (latest !== undefined) {
    const scale = mad > 0 ? mad * 1.4826 : sd;
    z = scale > 0 ? (latest - med) / scale : 0;
  }

  let percentile = 0;
  if (latest !== undefined && sorted.length > 0) {
    const below = sorted.filter((value) => value <= latest).length;
    percentile = below / sorted.length;
  }

  return {
    values: sorted,
    median: med,
    mad,
    z,
    percentile,
    min: sorted[0] ?? 0,
    max: sorted[sorted.length - 1] ?? 0,
  };
}

export function csvFor(rows: Row[], years: number[], match: GridMatcher): string {
  const allowed = new Set(years);
  const lines = ["cell,y,m,modis,viirs,harm"];
  for (const row of rows) {
    if (!allowed.has(row.y)) continue;
    const point = parseCell(row.cell);
    if (!point || !match(point[0], point[1])) continue;
    lines.push(
      [
        row.cell,
        row.y,
        row.m,
        row.modis ?? "",
        row.viirs ?? "",
        row.harm ?? "",
      ].join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

/** v2 export uses the sensor names and cell-day field from DATA_CONTRACT.md. */
export function csvForV2(rows: Row[], years: number[]): string {
  const allowed = new Set(years);
  const lines = ["cell,year,month,aqua,terra,snpp,noaa20,harmonized_hotspot_days"];
  for (const row of rows) {
    if (!allowed.has(row.y)) continue;
    lines.push(
      [
        row.cell,
        row.y,
        row.m,
        row.modis ?? "",
        row.terra ?? "",
        row.viirs ?? "",
        row.noaa20 ?? "",
        row.harm ?? "",
      ].join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}
