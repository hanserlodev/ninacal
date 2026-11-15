import type { Calibration, Manifest, Row } from "./types";

const BASE = "/data";

const yearCache = new Map<number, Row[]>();
const inflight = new Map<number, Promise<Row[]>>();

export async function loadManifest(): Promise<Manifest | null> {
  try {
    const response = await fetch(`${BASE}/manifest.json`, { cache: "no-cache" });
    if (!response.ok) return null;
    const data = (await response.json()) as Partial<Manifest>;
    const years = Array.isArray(data.years)
      ? [...new Set(data.years.filter((y): y is number => Number.isInteger(y)))].sort(
          (a, b) => a - b,
        )
      : [];
    return {
      generated_at: typeof data.generated_at === "string" ? data.generated_at : "",
      calibration: Boolean(data.calibration),
      years,
    };
  } catch {
    return null;
  }
}

export async function loadCalibration(): Promise<Calibration | null> {
  try {
    const response = await fetch(`${BASE}/processed/calibration.json`, { cache: "no-cache" });
    if (!response.ok) return null;
    const data = (await response.json()) as Calibration;
    if (!data?.metrics || !data?.by_month) return null;
    return data;
  } catch {
    return null;
  }
}

async function loadYear(year: number, signal?: AbortSignal): Promise<Row[]> {
  const cached = yearCache.get(year);
  if (cached) return cached;

  const pending = inflight.get(year);
  if (pending) return pending;

  const request = fetch(`${BASE}/processed/${year}.json`, { signal })
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${year}`);
      return response.json() as Promise<Row[]>;
    })
    .then((rows) => {
      if (!Array.isArray(rows)) throw new Error(`Invalid year file ${year}`);
      yearCache.set(year, rows);
      return rows;
    })
    .finally(() => {
      inflight.delete(year);
    });

  inflight.set(year, request);
  return request;
}

export type LoadProgress = {
  done: number;
  total: number;
  failed: (number | string)[];
};

/**
 * Fetch years with a small concurrency cap. A new selection aborts the old loop,
 * and already downloaded years stay cached in memory.
 */
export async function loadYears(
  years: number[],
  signal: AbortSignal,
  onProgress?: (progress: LoadProgress) => void,
): Promise<{ rows: Row[]; failed: number[] }> {
  const queue = [...years];
  const rows: Row[] = [];
  const failed: number[] = [];
  let done = 0;

  const report = () => onProgress?.({ done, total: years.length, failed: [...failed].sort() });

  const worker = async () => {
    while (queue.length > 0 && !signal.aborted) {
      const year = queue.shift();
      if (year === undefined) break;
      try {
        const data = await loadYear(year, signal);
        rows.push(...data);
      } catch {
        if (signal.aborted) return;
        failed.push(year);
      }
      done += 1;
      report();
    }
  };

  const workers = Array.from(
    { length: Math.max(1, Math.min(4, years.length)) },
    () => worker(),
  );
  await Promise.all(workers);
  report();

  return { rows, failed: [...failed].sort((a, b) => a - b) };
}
