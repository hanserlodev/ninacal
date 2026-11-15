import {
  DATA_BASE,
  hasApi,
  loadApiSeries,
  loadApiSeriesIndex,
  type ApiSeriesRow,
  type ApiSeriesSummary,
} from "./api";
import { fetchV2Json } from "./data-v2";
import type { DataCountry } from "./types";

export type SeriesLevel = "months" | "quarters" | "years";

type StaticSeries = {
  name: string;
  cells: number;
  bbox?: [number, number, number, number];
  months: ApiSeriesRow[];
  quarters: ApiSeriesRow[];
  years: ApiSeriesRow[];
};

const cache = new Map<DataCountry, Promise<Record<string, StaticSeries>>>();

function staticSeries(country: DataCountry): Promise<Record<string, StaticSeries>> {
  const pending = cache.get(country);
  if (pending) return pending;
  const request = fetchV2Json<Record<string, StaticSeries>>(
    `${DATA_BASE}/${country}/series.json`,
  );
  cache.set(country, request);
  request.catch(() => cache.delete(country));
  return request;
}

export async function loadSeriesIndex(
  country: DataCountry,
  signal?: AbortSignal,
): Promise<ApiSeriesSummary[]> {
  if (hasApi) return loadApiSeriesIndex(country, signal);
  const series = await staticSeries(country);
  return Object.entries(series).map(([id, entry]) => ({
    id,
    name: entry.name,
    cells: entry.cells,
    bbox: entry.bbox,
  }));
}

export async function loadSeriesEntry(
  country: DataCountry,
  id: string,
  level: SeriesLevel,
  signal?: AbortSignal,
): Promise<{ id: string; name: string; rows: ApiSeriesRow[] }> {
  if (hasApi) return loadApiSeries(country, id, level, signal);
  const series = await staticSeries(country);
  const entry = series[id];
  if (!entry) throw new Error(`Unknown series ${id}`);
  return { id, name: entry.name, rows: entry[level] ?? [] };
}

export function bandsFromSeries(rows: ApiSeriesRow[]): Map<string, { low: number | null; high: number | null }> {
  const result = new Map<string, { low: number | null; high: number | null }>();
  for (const row of rows) {
    if (row.month === undefined || row.low === null || row.high === null) continue;
    result.set(`${row.year}-${row.month}`, { low: row.low, high: row.high });
  }
  return result;
}
