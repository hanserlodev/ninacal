import type { Aggregated, BBox, DataCountry, Row, V2CountryMetadata, V2Manifest } from "./types";
import type { LoadProgress } from "./data";
import { cachedJson } from "./cache";

const RAW_API = (process.env.NEXT_PUBLIC_API_BASE ?? "").replace(/\/+$/, "");
const RAW_DATA = (process.env.NEXT_PUBLIC_DATA_BASE ?? "").replace(/\/+$/, "");

/** Absolute backend origin, e.g. https://api.example.com. Empty = static mode. */
export const API_BASE = RAW_API;
export const hasApi = API_BASE.length > 0;
/** Where JSON files live. The backend mounts its data bundle at /data. */
export const DATA_BASE = RAW_DATA || (hasApi ? `${API_BASE}/data` : "/data/v2");

export type ApiMonth = {
  year: number;
  month: number;
  value: number | null;
  low: number | null;
  high: number | null;
  source: string;
  band_group: string | null;
  median: number | null;
  anomaly_mad: number | null;
  reference_years: number;
};

export type ApiRegion = {
  country: string;
  cells: number;
  support_area_km2?: number;
  cell_year_p98?: number;
  interval_status?: string;
  observation_coverage?: string;
  status?: string;
  months: ApiMonth[];
};

export type ApiGridRow = { cell: string; lat: number; lon: number; harm: number | null };
export type ApiGrid = {
  country: string;
  year: number;
  month: number;
  source: string;
  columns: string[];
  rows: [string, number, number, number | null][];
};

export type ApiSeriesSummary = {
  id: string;
  name: string;
  cells: number;
  bbox?: [number, number, number, number];
};
export type ApiSeriesRow = {
  year: number;
  month?: number;
  quarter?: number | null;
  value: number | null;
  low: number | null;
  high: number | null;
  source?: string;
  median?: number | null;
  anomaly_mad?: number | null;
  reference_years?: number;
};

export async function loadApiManifest(signal?: AbortSignal): Promise<V2Manifest | null> {
  try {
    const value = await cachedJson<V2Manifest>(`${DATA_BASE}/manifest.json`, {
      signal,
      ttl: 5 * 60 * 1000,
    });
    if (value.schema_version !== 2 || !value.countries?.PE || !value.countries?.US) return null;
    return value;
  } catch {
    return null;
  }
}

export async function loadApiMetadata(
  countries: DataCountry[],
  signal?: AbortSignal,
): Promise<V2CountryMetadata[]> {
  return Promise.all(
    countries.map(async (country) => {
      const [calibration, models] = await Promise.all([
        cachedJson(`${DATA_BASE}/${country}/calibration.json`, { signal }),
        cachedJson(`${DATA_BASE}/${country}/models.json`, { signal }),
      ]);
      return {
        country,
        name: country === "PE" ? "Peru" : "United States",
        calibration,
        models,
      } as V2CountryMetadata;
    }),
  );
}

function bboxParam(bbox: BBox): string {
  return [bbox.minLon, bbox.minLat, bbox.maxLon, bbox.maxLat].map((value) => value.toFixed(4)).join(",");
}

export type RegionQuery = {
  country: DataCountry;
  bbox?: BBox;
  polygon?: [number, number][];
  start: number;
  end: number;
};

export async function loadApiRegion(query: RegionQuery, signal?: AbortSignal): Promise<ApiRegion> {
  if (query.polygon && query.polygon.length >= 3) {
    const response = await fetch(`${API_BASE}/api/region`, {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        country: query.country,
        bbox: query.bbox ? bboxParam(query.bbox).split(",").map(Number) : undefined,
        polygon: { type: "Polygon", coordinates: [query.polygon] },
        start: query.start,
        end: query.end,
      }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: /api/region`);
    return (await response.json()) as ApiRegion;
  }

  const params = new URLSearchParams({
    country: query.country,
    start: String(query.start),
    end: String(query.end),
  });
  if (query.bbox) params.set("bbox", bboxParam(query.bbox));
  return cachedJson<ApiRegion>(`${API_BASE}/api/region?${params.toString()}`, { signal });
}

const gridCache = new Map<string, ApiGrid>();
const gridInflight = new Map<string, Promise<ApiGrid>>();

function gridKey(country: DataCountry, year: number, bbox: BBox | undefined): string {
  return `${country}:${year}:${bbox ? bboxParam(bbox) : "all"}`;
}

/**
 * Synchronous cache lookup. Playback uses this to swap years without a single
 * loading frame once the warm-up has finished: if every grid for the new year
 * is already in memory, the map updates in the same render.
 */
export function peekApiGrid(
  country: DataCountry,
  year: number,
  bbox: BBox | undefined,
): ApiGrid | undefined {
  return gridCache.get(gridKey(country, year, bbox));
}

export async function loadApiGrid(
  country: DataCountry,
  year: number,
  bbox: BBox | undefined,
  _signal?: AbortSignal,
): Promise<ApiGrid> {
  const key = gridKey(country, year, bbox);
  const cached = gridCache.get(key);
  if (cached) return cached;
  const pending = gridInflight.get(key);
  if (pending) return pending;

  const params = new URLSearchParams({ year: String(year) });
  if (bbox) params.set("bbox", bboxParam(bbox));
  // Playback advances year every ~850 ms. Do not abort the underlying request
  // when the component moves on: let it finish and warm both the in-memory and
  // IndexedDB caches, so the next loop through the timeline is instantaneous.
  const request = cachedJson<ApiGrid>(
    `${API_BASE}/api/grid/${country}?${params.toString()}`,
    { ttl: 24 * 60 * 60 * 1000 },
  )
    .then((value) => {
      gridCache.set(key, value);
      return value;
    })
    .finally(() => gridInflight.delete(key));
  gridInflight.set(key, request);
  return request;
}

export async function loadApiSeriesIndex(
  country: DataCountry,
  signal?: AbortSignal,
): Promise<ApiSeriesSummary[]> {
  return cachedJson<ApiSeriesSummary[]>(`${API_BASE}/api/series/${country}`, { signal });
}

export async function loadApiSeries(
  country: DataCountry,
  id: string,
  level: "months" | "quarters" | "years",
  signal?: AbortSignal,
): Promise<{ id: string; name: string; rows: ApiSeriesRow[] }> {
  return cachedJson(`${API_BASE}/api/series/${country}/${encodeURIComponent(id)}?level=${level}`, {
    signal,
  });
}

export function mergeRegions(regions: ApiRegion[], years: number[]): Aggregated | null {
  const valid = regions.filter(
    (region) => Array.isArray(region.months) && region.months.length > 0,
  );
  if (valid.length === 0) return null;

  const index = new Map<number, number>();
  years.forEach((year, position) => index.set(year, position));
  const totals: (number | null)[][] = years.map(() => Array(12).fill(null));
  const sources: (string | null)[][] = years.map(() => Array(12).fill(null));
  const monthly = new Map<
    string,
    { value: number; count: number; low: number | null; high: number | null; sources: Set<string> }
  >();

  for (const region of valid) {
    for (const row of region.months) {
      const position = index.get(row.year);
      if (position === undefined || row.month < 1 || row.month > 12) continue;
      const key = `${row.year}-${row.month}`;
      const entry =
        monthly.get(key) ?? { value: 0, count: 0, low: 0, high: 0, sources: new Set<string>() };
      if (row.value !== null) {
        entry.value += row.value;
        entry.count += 1;
      }
      entry.low = entry.low === null || row.low === null ? null : entry.low + row.low;
      entry.high = entry.high === null || row.high === null ? null : entry.high + row.high;
      entry.sources.add(row.source);
      monthly.set(key, entry);
      const monthIndex = row.month - 1;
      totals[position][monthIndex] = entry.count > 0 ? entry.value : null;
      sources[position][monthIndex] =
        entry.sources.size > 1 ? "mixed" : [...entry.sources][0] ?? null;
    }
  }

  let peak: Aggregated["peak"] = null;
  let latest: Aggregated["latest"] = null;
  let sum = 0;
  let rowCount = 0;
  const annual: Aggregated["annual"] = [];
  for (let position = 0; position < years.length; position += 1) {
    let yearSum = 0;
    for (let month = 0; month < 12; month += 1) {
      const value = totals[position][month];
      if (value === null) continue;
      yearSum += value;
      sum += value;
      rowCount += 1;
      if (!peak || value > peak.value) peak = { y: years[position], m: month + 1, value };
      if (
        !latest ||
        years[position] > latest.y ||
        (years[position] === latest.y && month + 1 > latest.m)
      ) {
        latest = { y: years[position], m: month + 1, value };
      }
    }
    annual.push({ y: years[position], value: yearSum });
  }

  return {
    years,
    totals,
    sources,
    annual,
    cellCount: valid.reduce((total, region) => total + region.cells, 0),
    cellTotals: new Map(),
    rowCount,
    missing: 0,
    sum,
    peak,
    latest,
  };
}

export function bandsFor(regions: ApiRegion[]): Map<string, { low: number | null; high: number | null }> {
  const result = new Map<string, { low: number | null; high: number | null }>();
  for (const region of regions) {
    for (const row of region.months ?? []) {
      if (row.low === null || row.high === null) continue;
      const key = `${row.year}-${row.month}`;
      const previous = result.get(key);
      result.set(key, {
        low: !previous ? row.low : previous.low === null || row.low === null ? null : previous.low + row.low,
        high: !previous ? row.high : previous.high === null || row.high === null ? null : previous.high + row.high,
      });
    }
  }
  return result;
}

export async function downloadApiCsv(query: RegionQuery): Promise<Blob> {
  const params = new URLSearchParams({
    country: query.country,
    start: String(query.start),
    end: String(query.end),
    format: "cells",
  });
  if (query.bbox) params.set("bbox", bboxParam(query.bbox));
  if (query.polygon && query.polygon.length >= 3) {
    const response = await fetch(`${API_BASE}/api/region?format=cells`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        country: query.country,
        bbox: query.bbox ? bboxParam(query.bbox).split(",").map(Number) : undefined,
        polygon: { type: "Polygon", coordinates: [query.polygon] },
        start: query.start,
        end: query.end,
      }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: /api/region`);
    return response.blob();
  }
  const response = await fetch(`${API_BASE}/api/region?${params.toString()}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}: /api/region`);
  return response.blob();
}

/** Convenience for the progress UI: the API answers in two requests. */
export function apiProgress(done: number, total: number, failed: string[] = []): LoadProgress {
  return { done, total, failed };
}
