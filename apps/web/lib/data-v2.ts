import type { GridMatcher } from "./aggregate";
import type {
  DataCountry,
  Row,
  V2CountryMetadata,
  V2Manifest,
} from "./types";
import type { LoadProgress } from "./data";
import { DATA_BASE, hasApi } from "./api";

const BASE = DATA_BASE;
const cellCache = new Map<DataCountry, Promise<V2Cell[]>>();
const metadataCache = new Map<DataCountry, Promise<V2CountryMetadata>>();

type Columnar = { columns: string[]; rows: unknown[][] };
export type V2Cell = {
  cell: string;
  lat: number;
  lon: number;
  areaKm2: number;
  admin: string;
  country: DataCountry;
};

export type V2LoadResult = {
  rows: Row[];
  cells: V2Cell[];
  availability: { y: number; m: number; source: string }[];
  failed: string[];
};

export async function fetchV2Json<T>(url: string, signal?: AbortSignal): Promise<T> {
  // Static builds ship pre-compressed files; the API serves plain JSON.
  const compressedUrl = !hasApi && url.endsWith(".json") ? `${url}.gz` : url;
  const compressed = !hasApi ? await fetch(compressedUrl, { signal }) : null;
  if (compressed?.ok && compressed.body && "DecompressionStream" in window) {
    const stream = compressed.body.pipeThrough(new DecompressionStream("gzip"));
    return (await new Response(stream).json()) as T;
  }

  // Keep development/API adapters usable if they expose ordinary JSON instead
  // of the compressed files produced by sync-data.
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return (await response.json()) as T;
}

export async function loadV2Manifest(): Promise<V2Manifest | null> {
  try {
    const response = await fetch(`${BASE}/manifest.json`, { cache: "no-cache" });
    if (!response.ok) return null;
    const value = (await response.json()) as V2Manifest;
    if (value.schema_version !== 2 || !value.countries?.PE || !value.countries?.US) {
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

export function v2Years(manifest: V2Manifest): number[] {
  const peruYears = new Set(manifest.countries.PE.files.map((file) => file.year));
  return manifest.countries.US.files
    .map((file) => file.year)
    .filter((year) => year >= 2003 && peruYears.has(year))
    .sort((a, b) => a - b);
}

async function fetchColumnar(url: string, signal?: AbortSignal): Promise<Columnar> {
  const value = (await fetchV2Json<Partial<Columnar>>(url, signal));
  if (!Array.isArray(value.columns) || !Array.isArray(value.rows)) {
    throw new Error(`Invalid columnar data: ${url}`);
  }
  return value as Columnar;
}

function columnIndex(columns: string[]): Map<string, number> {
  return new Map(columns.map((column, index) => [column, index]));
}

function valueAt(row: unknown[], indexes: Map<string, number>, name: string): unknown {
  const index = indexes.get(name);
  return index === undefined ? undefined : row[index];
}

function nullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function fetchCells(country: DataCountry): Promise<V2Cell[]> {
  const pending = cellCache.get(country);
  if (pending) return pending;

  const request = fetchColumnar(`${BASE}/${country}/cells.json`).then((data) => {
    const indexes = columnIndex(data.columns);
    const cells: V2Cell[] = [];
    for (const row of data.rows) {
      const cell = valueAt(row, indexes, "cell");
      const lat = valueAt(row, indexes, "lat");
      const lon = valueAt(row, indexes, "lon");
      if (
        typeof cell !== "string" ||
        typeof lat !== "number" ||
        typeof lon !== "number"
      ) {
        continue;
      }
      cells.push({
        cell,
        lat,
        lon,
        areaKm2: nullableNumber(valueAt(row, indexes, "area_km2")) ?? 0,
        admin: String(valueAt(row, indexes, "admin") ?? ""),
        country,
      });
    }
    return cells;
  });

  cellCache.set(country, request);
  request.catch(() => cellCache.delete(country));
  return request;
}

export async function loadV2Metadata(
  countries: DataCountry[],
  signal?: AbortSignal,
): Promise<V2CountryMetadata[]> {
  return Promise.all(
    countries.map(async (country) => {
      const pending = metadataCache.get(country);
      if (pending) return pending;

      const request = Promise.all([
        fetchV2Json(`${BASE}/${country}/calibration.json`, signal),
        fetchV2Json(`${BASE}/${country}/models.json`, signal),
      ]).then(([calibration, models]) => {
        return {
          country,
          name: country === "PE" ? "Peru" : "United States",
          calibration,
          models,
        } as V2CountryMetadata;
      });

      metadataCache.set(country, request);
      request.catch(() => metadataCache.delete(country));
      return request;
    }),
  );
}

type YearTask = { country: DataCountry; year: number; cells: Set<string> };

/**
 * Static v2 provider. It loads only the selected countries and requested years,
 * filters columnar rows to the selected cell IDs immediately, and discards the
 * large file wrapper after each year. An API adapter can implement this same
 * request/result contract later without changing the console.
 */
export async function loadV2Selection(
  manifest: V2Manifest,
  countries: DataCountry[],
  years: number[],
  match: GridMatcher,
  signal: AbortSignal,
  onProgress?: (progress: LoadProgress) => void,
): Promise<V2LoadResult> {
  const failed: string[] = [];
  const cells: V2Cell[] = [];
  const selectedByCountry = new Map<DataCountry, Set<string>>();
  const requestedCountries = [...new Set(countries)];
  const total = requestedCountries.length + requestedCountries.length * years.length;
  let done = 0;
  const report = () => onProgress?.({ done, total, failed: [...failed] });

  await Promise.all(
    requestedCountries.map(async (country) => {
      try {
        const countryCells = await fetchCells(country);
        const selected = countryCells.filter((cell) => match(cell.lat, cell.lon));
        cells.push(...selected);
        selectedByCountry.set(country, new Set(selected.map((cell) => cell.cell)));
      } catch {
        if (signal.aborted) return;
        failed.push(`${country}/cells`);
        selectedByCountry.set(country, new Set());
      } finally {
        done += 1;
        report();
      }
    }),
  );

  const activeCountries = requestedCountries.filter(
    (country) => (selectedByCountry.get(country)?.size ?? 0) > 0,
  );
  const availability = new Map<string, string[]>();
  for (const country of activeCountries) {
    for (const item of manifest.countries[country].availability) {
      if (item.year < 2003) continue;
      const key = `${item.year}-${item.month}`;
      const list = availability.get(key) ?? [];
      list.push(item.source);
      availability.set(key, list);
    }
  }

  const monthlyAvailability: V2LoadResult["availability"] = [];
  for (const year of years) {
    for (let month = 1; month <= 12; month += 1) {
      const sources = availability.get(`${year}-${month}`) ?? [];
      if (sources.length !== activeCountries.length || sources.length === 0) continue;
      if (sources.some((source) => source === "unavailable" || source === "not_harmonized")) {
        monthlyAvailability.push({ y: year, m: month, source: "unavailable" });
      } else {
        monthlyAvailability.push({
          y: year,
          m: month,
          source: [...new Set(sources)].length > 1 ? "mixed" : sources[0],
        });
      }
    }
  }
  const sourceByMonth = new Map(
    monthlyAvailability.map((item) => [`${item.y}-${item.m}`, item.source]),
  );

  const tasks: YearTask[] = [];
  for (const country of requestedCountries) {
    const selected = selectedByCountry.get(country);
    for (const year of years) {
      if (!selected || selected.size === 0) {
        done += 1;
        report();
        continue;
      }
      tasks.push({ country, year, cells: selected });
    }
  }

  const rows: Row[] = [];
  const queue = [...tasks];
  const worker = async () => {
    while (queue.length > 0 && !signal.aborted) {
      const task = queue.shift();
      if (!task) return;
      const file = `${BASE}/${task.country}/years/${task.year}.json`;
      try {
        const data = await fetchColumnar(file, signal);
        const indexes = columnIndex(data.columns);
        for (const sourceRow of data.rows) {
          const cell = valueAt(sourceRow, indexes, "cell");
          if (typeof cell !== "string" || !task.cells.has(cell)) continue;
          const y = valueAt(sourceRow, indexes, "y");
          const m = valueAt(sourceRow, indexes, "m");
          if (typeof y !== "number" || typeof m !== "number") continue;
          rows.push({
            cell,
            y,
            m,
            modis: nullableNumber(valueAt(sourceRow, indexes, "modis")),
            terra: nullableNumber(valueAt(sourceRow, indexes, "terra")),
            viirs: nullableNumber(valueAt(sourceRow, indexes, "viirs")),
            noaa20: nullableNumber(valueAt(sourceRow, indexes, "noaa20")),
            harm: nullableNumber(valueAt(sourceRow, indexes, "harm")),
            source: sourceByMonth.get(`${y}-${m}`),
          });
        }
      } catch {
        if (signal.aborted) return;
        failed.push(`${task.country}/${task.year}`);
      } finally {
        done += 1;
        report();
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(2, Math.max(1, tasks.length)) }, () => worker()),
  );
  report();

  return { rows, cells, availability: monthlyAvailability, failed };
}
