"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { aggregate, csvFor, csvForV2 } from "@/lib/aggregate";
import { countriesForBBox, coverageStatus } from "@/lib/coverage";
import { loadCalibration, loadManifest, loadYears, type LoadProgress } from "@/lib/data";
import { staticV2Provider } from "@/lib/data-provider";
import {
  bandsFor,
  downloadApiCsv,
  hasApi,
  loadApiGrid,
  loadApiManifest,
  loadApiMetadata,
  loadApiRegion,
  mergeRegions,
  peekApiGrid,
  type ApiGrid,
  type ApiGridRow,
} from "@/lib/api";
import { demoCalibration, demoEndYear, generateDemoRows } from "@/lib/demo";
import { bandsFromSeries, loadSeriesEntry } from "@/lib/series";
import {
  normalizeBBox,
  parseCell,
  sameBBox,
  selectionMatcher,
} from "@/lib/geo";
import { slugify } from "@/lib/format";
import { DEFAULT_REGION, REGIONS } from "@/lib/regions";
import type {
  Aggregated,
  BBox,
  Calibration,
  DataCountry,
  Row,
  Selection,
  V2CountryMetadata,
  V2Manifest,
} from "@/lib/types";

export type Mode = "live" | "demo";
export type Draft = { minLat: string; minLon: string; maxLat: string; maxLon: string };

const INITIAL_YEAR = 2025;
const INITIAL_REGION = hasApi
  ? DEFAULT_REGION
  : REGIONS.find((region) => region.id === "pe") ?? DEFAULT_REGION;
const FIRST_HARMONIZED_YEAR = 2003;
type DataVersion = "v2" | "legacy" | "demo";

// Rebuilding the flat cell array on every timeline tick is the other half of
// the second-loop cost. Keep it attached to the grid object, which the cache
// reuses across renders, so a warm pass only concatenates arrays.
const gridCellsCache = new WeakMap<ApiGrid, ApiGridRow[]>();

function gridCells(grid: ApiGrid): ApiGridRow[] {
  const cached = gridCellsCache.get(grid);
  if (cached) return cached;
  const cells: ApiGridRow[] = [];
  for (const [cell, lat, lon, harm] of grid.rows) {
    if (typeof harm !== "number") continue;
    cells.push({ cell, lat, lon, harm });
  }
  gridCellsCache.set(grid, cells);
  return cells;
}

function combineGridCells(grids: ApiGrid[]): ApiGridRow[] {
  if (grids.length === 1) return gridCells(grids[0]);
  return grids.flatMap(gridCells);
}

function yearsBetween(start: number, end: number): number[] {
  return Array.from({ length: Math.max(0, end - start + 1) }, (_, i) => start + i);
}

/** Run async work with bounded concurrency and keep every outcome. */
async function mapSettledLimit<T, R>(
  items: T[],
  limit: number,
  work: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      try {
        results[index] = { status: "fulfilled", value: await work(items[index]) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  });
  await Promise.all(workers);
  return results;
}

function toDraft(bbox: BBox): Draft {
  const one = (value: number) => value.toFixed(1);
  return {
    minLat: one(bbox.minLat),
    minLon: one(bbox.minLon),
    maxLat: one(bbox.maxLat),
    maxLon: one(bbox.maxLon),
  };
}

function parseDraft(draft: Draft): BBox | null {
  const box = {
    minLat: Number(draft.minLat),
    minLon: Number(draft.minLon),
    maxLat: Number(draft.maxLat),
    maxLon: Number(draft.maxLon),
  };
  if (!Object.values(box).every(Number.isFinite)) return null;
  if (box.minLon >= box.maxLon || box.minLat >= box.maxLat) return null;
  if (box.maxLon - box.minLon > 180) return null;
  return normalizeBBox(box);
}

type UrlState = {
  region?: string;
  bbox?: BBox;
  country?: string;
  label?: string;
  from?: number;
  to?: number;
  year?: number;
};

function readUrlState(): UrlState {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const state: UrlState = {};
  const region = params.get("region");
  if (region) state.region = region;
  const country = params.get("country");
  if (country) state.country = country;
  const label = params.get("label");
  if (label) state.label = label;
  const bbox = params.get("bbox");
  if (bbox) {
    const values = bbox.split(",").map(Number);
    if (values.length === 4 && values.every(Number.isFinite)) {
      const parsed = normalizeBBox({
        minLon: values[0],
        minLat: values[1],
        maxLon: values[2],
        maxLat: values[3],
      });
      if (parsed) state.bbox = parsed;
    }
  }
  const readNumber = (name: string): number | undefined => {
    const raw = params.get(name);
    if (raw === null || raw.trim() === "") return undefined;
    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
  };
  const from = readNumber("from");
  const to = readNumber("to");
  const year = readNumber("year");
  if (from !== undefined) state.from = from;
  if (to !== undefined) state.to = to;
  if (year !== undefined) state.year = year;
  return state;
}

function bboxParam(bbox: BBox): string {
  return [bbox.minLon, bbox.minLat, bbox.maxLon, bbox.maxLat].map((value) => value.toFixed(2)).join(",");
}

export function useExplorer() {
  const [mounted, setMounted] = useState(false);
  const [booted, setBooted] = useState(false);
  const [mode, setMode] = useState<Mode>("demo");
  const [dataVersion, setDataVersion] = useState<DataVersion>("demo");
  const [v2Manifest, setV2Manifest] = useState<V2Manifest | null>(null);
  const [endYear, setEndYear] = useState(INITIAL_YEAR);
  const [availableYears, setAvailableYears] = useState<number[]>(() =>
    yearsBetween(FIRST_HARMONIZED_YEAR, INITIAL_YEAR),
  );
  const [range, setRange] = useState<[number, number]>([FIRST_HARMONIZED_YEAR, INITIAL_YEAR]);
  const [mapYear, setMapYear] = useState(INITIAL_YEAR);
  const [calibration, setCalibration] = useState<Calibration | null>(null);
  const [selection, setSelectionState] = useState<Selection>({
    bbox: INITIAL_REGION.bbox,
    allCellsFor: INITIAL_REGION.allCellsFor,
    countries: INITIAL_REGION.countries,
    label: INITIAL_REGION.label,
  });
  const userSelected = useRef(false);
  // Public setter: marks the selection as user-driven. Without this, the
  // shared-link restore can run a few seconds after load and overwrite a
  // country the user just picked.
  const setSelection = useCallback((next: Selection) => {
    userSelected.current = true;
    setSelectionState(next);
  }, []);
  const [liveRows, setLiveRows] = useState<Row[]>([]);
  const [v2Rows, setV2Rows] = useState<Row[]>([]);
  const [knownCells, setKnownCells] = useState<string[]>([]);
  const [availableMonths, setAvailableMonths] = useState<
    { y: number; m: number; source: string }[]
  >([]);
  const [v2Metadata, setV2Metadata] = useState<V2CountryMetadata[]>([]);
  const [dataCountries, setDataCountries] = useState<DataCountry[]>([]);
  const [apiRegion, setApiRegion] = useState<Aggregated | null>(null);
  const [apiCells, setApiCells] = useState<ApiGridRow[]>([]);
  const [apiScale, setApiScale] = useState(1);
  const [countryYearTotals, setCountryYearTotals] = useState<Record<string, Record<number, number>>>({});
  const [mapLoading, setMapLoading] = useState(false);
  const [gridVersion, setGridVersion] = useState(0);
  const yearAttempts = useRef(new Map<number, number>());
  const failedYears = useRef(new Set<number>());
  const [bands, setBands] = useState<Map<string, { low: number | null; high: number | null }>>(new Map());
  const [urlReady, setUrlReady] = useState(false);
  const [progress, setProgress] = useState<LoadProgress | null>(null);
  const [notice, setNotice] = useState<{ kind: "info" | "error"; text: string } | null>(null);
  const [draft, setDraft] = useState<Draft>(() => toDraft(DEFAULT_REGION.bbox));
  const [draftError, setDraftError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (hasApi) {
        const apiManifest = await loadApiManifest();
        if (!alive) return;
        if (apiManifest) {
          const years = staticV2Provider.getYears(apiManifest);
          setDataVersion("v2");
          setV2Manifest(apiManifest);
          setMode("live");
          setAvailableYears(years);
          setEndYear(years[years.length - 1] ?? INITIAL_YEAR);
          setRange([years[0] ?? FIRST_HARMONIZED_YEAR, years[years.length - 1] ?? INITIAL_YEAR]);
          setMapYear(years[years.length - 1] ?? INITIAL_YEAR);
          setNotice({
            kind: "info",
            text: "Live API · detected hotspot-days on the Suomi-NPP scale, 2003–2025. Error ranges are empirical and approximate, not confidence intervals.",
          });
          if (alive) setBooted(true);
          return;
        }
      }

      const v2 = await staticV2Provider.loadManifest();
      if (!alive) return;

      if (v2) {
        const years = staticV2Provider.getYears(v2);
        setDataVersion("v2");
        setV2Manifest(v2);
        setMode("live");
        setAvailableYears(years);
        setEndYear(years[years.length - 1] ?? INITIAL_YEAR);
        setRange([years[0] ?? FIRST_HARMONIZED_YEAR, years[years.length - 1] ?? INITIAL_YEAR]);
        setMapYear(years[years.length - 1] ?? INITIAL_YEAR);
        setNotice({
          kind: "info",
          text: "Research prototype · detected hotspot-days on the Suomi-NPP scale, 2003–2025. Dates use local mean solar time. Error ranges are approximate experiments, not confidence intervals.",
        });
        try {
          const metadata = await staticV2Provider.loadMetadata(["PE"]);
          if (alive) setV2Metadata(metadata);
        } catch {
          if (alive) setV2Metadata([]);
        } finally {
          if (alive) setBooted(true);
        }
        return;
      }

      const manifest = await loadManifest();
      if (!alive) return;

      if (manifest && manifest.years.length > 0) {
        setDataVersion("legacy");
        setMode("live");
        setAvailableYears(manifest.years);
        setEndYear(manifest.years[manifest.years.length - 1]);
        setRange([manifest.years[0], manifest.years[manifest.years.length - 1]]);
        setMapYear(manifest.years[manifest.years.length - 1]);
        setCalibration(await loadCalibration());
        if (manifest.years.length < 3) {
          setNotice({
            kind: "info",
            text: `Only ${manifest.years.length} published year${manifest.years.length === 1 ? "" : "s"} — the trend and anomaly need more.`,
          });
        }
      } else {
        const end = demoEndYear();
        setDataVersion("demo");
        setMode("demo");
        setEndYear(end);
        setAvailableYears(yearsBetween(2000, end));
        setRange([2000, end]);
        setMapYear(end);
        setCalibration(demoCalibration());
      }
      if (alive) setBooted(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const years = useMemo(
    () => availableYears.filter((year) => year >= range[0] && year <= range[1]),
    [availableYears, range],
  );

  useEffect(() => {
    if (years.length === 0) return;
    setMapYear((current) => Math.min(years[years.length - 1], Math.max(years[0], current)));
  }, [years]);

  // Restore a shared link once the year catalogue is known.
  useEffect(() => {
    if (!booted || urlReady || availableYears.length === 0) return;
    if (userSelected.current) {
      // The user already chose something while the app was booting: respect it.
      setUrlReady(true);
      return;
    }
    const url = readUrlState();
    const low = availableYears[0];
    const high = availableYears[availableYears.length - 1];
    if (url.region) {
      const region = REGIONS.find((entry) => entry.id === url.region);
      if (region)
        setSelectionState({
          bbox: region.bbox,
          allCellsFor: region.allCellsFor,
          countries: region.countries,
          label: region.label ?? region.name,
        });
    } else if (url.bbox) {
      setSelectionState({ bbox: url.bbox, country: url.country, label: url.label });
    }
    if (url.from !== undefined || url.to !== undefined) {
      const from = Math.max(low, Math.min(high, url.from ?? low));
      const to = Math.max(from, Math.min(high, url.to ?? high));
      setRange([from, to]);
    }
    if (url.year !== undefined) {
      setMapYear(Math.max(low, Math.min(high, url.year)));
    }
    setUrlReady(true);
  }, [booted, urlReady, availableYears]);

  // Keep the address bar in sync with region, range and map year.
  useEffect(() => {
    if (!urlReady || typeof window === "undefined") return;
    const params = new URLSearchParams();
    const preset = REGIONS.find(
      (region) =>
        !selection.polygon &&
        sameBBox(region.bbox, selection.bbox) &&
        (region.allCellsFor ?? "") === (selection.allCellsFor ?? "") &&
        (region.countries?.length ?? 0) === (selection.countries?.length ?? 0),
    );
    if (preset) params.set("region", preset.id);
    else {
      params.set("bbox", bboxParam(selection.bbox));
      if (selection.country) params.set("country", selection.country);
      if (selection.label) params.set("label", selection.label);
    }
    params.set("from", String(range[0]));
    params.set("to", String(range[1]));
    params.set("year", String(mapYear));
    const next = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
    if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      window.history.replaceState(null, "", next);
    }
  }, [urlReady, selection, range, mapYear]);

  useEffect(() => {
    if (mode !== "live" || dataVersion !== "legacy") return;
    const requested = availableYears.filter(
      (year) => year >= range[0] && year <= range[1],
    );
    if (requested.length === 0) return;

    const controller = new AbortController();
    setProgress({ done: 0, total: requested.length, failed: [] });

    loadYears(requested, controller.signal, (update) => {
      if (!controller.signal.aborted) setProgress(update);
    })
      .then((result) => {
        if (controller.signal.aborted) return;
        setLiveRows(result.rows);
        setProgress({ done: requested.length, total: requested.length, failed: result.failed });
        setNotice((previous) => (previous?.kind === "error" ? null : previous));
        if (result.failed.length > 0) {
          setNotice({
            kind: "error",
            text: `Could not load ${result.failed.join(", ")}. The views use the years that did load.`,
          });
        }
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setNotice({ kind: "error", text: "Could not load the processed data files." });
      });

    return () => controller.abort();
  }, [mode, dataVersion, availableYears, range]);

  const match = useMemo(() => selectionMatcher(selection), [selection]);
  const requestedCountries = useMemo(
    () => {
      if (!hasApi && selection.countries && selection.countries.length > 1) return [];
      return selection.allCellsFor
        ? [selection.allCellsFor]
        : selection.country
          ? [selection.country]
          : selection.countries && selection.countries.length > 0
            ? selection.countries
            : countriesForBBox(selection.bbox);
    },
    [selection.allCellsFor, selection.country, selection.countries, selection.bbox],
  );
  const worldView =
    (selection.countries?.length ?? 0) > 1 || requestedCountries.length > 1;

  useEffect(() => {
    if (hasApi || !urlReady) return;
    if (dataVersion !== "v2" || !v2Manifest) return;
    const requestedYears = availableYears.filter(
      (year) => year >= range[0] && year <= range[1],
    );
    const controller = new AbortController();
    const total = requestedCountries.length * (requestedYears.length + 1);
    setDataCountries(requestedCountries);
    setKnownCells([]);
    setV2Rows([]);
    setAvailableMonths([]);
    setProgress({ done: 0, total, failed: [] });

    staticV2Provider
      .loadSelection(
        v2Manifest,
        requestedCountries,
        requestedYears,
        selection.allCellsFor ? () => true : match,
        controller.signal,
        (update) => {
          if (!controller.signal.aborted) setProgress(update);
        },
      )
      .then((result) => {
        if (controller.signal.aborted) return;
        setV2Rows(result.rows);
        setKnownCells(result.cells.map((cell) => cell.cell));
        setAvailableMonths(result.availability);
        setProgress({ done: total, total, failed: result.failed });
        setNotice((previous) => (previous?.kind === "error" ? null : previous));
        if (result.failed.length > 0) {
          setNotice({
            kind: "error",
            text: `Could not load ${result.failed.join(", ")}. The view uses files that did load.`,
          });
        }
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setNotice({ kind: "error", text: "Could not load the v2 cell or year files." });
        setProgress({ done: total, total, failed: ["v2 data"] });
      });

    if (requestedCountries.length > 0) {
      staticV2Provider
        .loadMetadata(requestedCountries, controller.signal)
        .then((metadata) => {
          if (!controller.signal.aborted) setV2Metadata(metadata);
        })
        .catch(() => {
          if (!controller.signal.aborted) setV2Metadata([]);
        });
    } else {
      setV2Metadata([]);
    }

    return () => controller.abort();
  }, [
    hasApi,
    urlReady,
    dataVersion,
    v2Manifest,
    availableYears,
    range,
    requestedCountries,
    match,
    selection.allCellsFor,
  ]);

  // API mode: region aggregates (charts, bands, anomalies) come from the
  // backend so arbitrary boxes/polygons get the same empirical bands.
  useEffect(() => {
    if (!hasApi || !urlReady || dataVersion !== "v2") return;
    if (requestedCountries.length === 0) {
      setApiRegion(null);
      setBands(new Map());
      setApiCells([]);
      setProgress({ done: 0, total: 0, failed: [] });
      return;
    }
    const controller = new AbortController();
    const start = range[0];
    const end = range[1];
    setDataCountries(requestedCountries);
    setProgress({ done: 0, total: requestedCountries.length, failed: [] });
    // Never leave the previous selection's aggregate on screen while the new
    // one is loading: it would be labelled with the new selection.
    setApiRegion(null);
    setBands(new Map());
    setCountryYearTotals({});

    const fetchOne = (country: string) =>
      loadApiRegion(
        {
          country,
          bbox: selection.allCellsFor || worldView ? undefined : selection.bbox,
          polygon: selection.polygon,
          start,
          end,
        },
        controller.signal,
      );

    void (async () => {
      // World view means 78 national aggregates, so keep the fan-out bounded
      // and never let one flaky country discard the whole world.
      const first = await mapSettledLimit(requestedCountries, 8, fetchOne);
      let settled = first;
      const retryCountries = requestedCountries.filter((_, index) => first[index].status === "rejected");
      if (retryCountries.length > 0 && !controller.signal.aborted) {
        const retry = await mapSettledLimit(retryCountries, 4, fetchOne);
        let cursor = 0;
        settled = first.map((entry) =>
          entry.status === "rejected" ? retry[cursor++] : entry,
        );
      }
      if (controller.signal.aborted) return;
      const results = settled
        .filter((entry): entry is PromiseFulfilledResult<Awaited<ReturnType<typeof fetchOne>>> =>
          entry.status === "fulfilled",
        )
        .map((entry) => entry.value);
      const failedCountries = requestedCountries.filter(
        (_, index) => settled[index].status === "rejected",
      );
      if (results.length === 0) {
        setNotice({ kind: "error", text: "Could not reach the NinaCal API for this selection." });
        setProgress({ done: requestedCountries.length, total: requestedCountries.length, failed: ["api"] });
        return;
      }
      setApiRegion(mergeRegions(results, years));
      setBands(bandsFor(results));
      setApiScale(Math.max(1, ...results.map((result) => result.cell_year_p98 ?? 1)));
      const totals: Record<string, Record<number, number>> = {};
      for (const result of results) {
        const byYear: Record<number, number> = {};
        for (const row of result.months) {
          if (row.value === null) continue;
          byYear[row.year] = (byYear[row.year] ?? 0) + row.value;
        }
        totals[result.country] = byYear;
      }
      setCountryYearTotals(totals);
      setProgress({
        done: requestedCountries.length,
        total: requestedCountries.length,
        failed: failedCountries,
      });
      if (failedCountries.length > 0) {
        setNotice({
          kind: "error",
          text: `Loaded ${results.length} of ${requestedCountries.length} countries (${failedCountries
            .slice(0, 4)
            .join(", ")}${failedCountries.length > 4 ? "…" : ""} failed). Totals are partial.`,
        });
      } else {
        setNotice((previous) => (previous?.kind === "error" ? null : previous));
      }
      if (results.every((result) => result.status === "outside_published_support")) {
        setNotice({
          kind: "info",
          text: "This selection is outside the published data coverage. Pick a country or draw inside a highlighted area.",
        });
      }
    })();

    return () => controller.abort();
  }, [hasApi, urlReady, dataVersion, requestedCountries, selection, range, years]);

  // API mode: the map needs one annual grid per active year, cached by the
  // provider so playback does not refetch the same year twice.
  // Playback prefetch: warm the previous/next annual grid while idle.
  useEffect(() => {
    if (!hasApi || worldView || requestedCountries.length !== 1) return;
    const country = requestedCountries[0];
    const bbox = selection.allCellsFor ? undefined : selection.bbox;
    const timer = window.setTimeout(() => {
      for (const year of [mapYear + 1, mapYear - 1]) {
        if (year >= range[0] && year <= range[1]) {
          loadApiGrid(country, year, bbox).catch(() => {});
        }
      }
    }, 1400);
    return () => window.clearTimeout(timer);
  }, [hasApi, worldView, requestedCountries, mapYear, selection, range]);

  // Warm every annual grid in the current range when the user starts the
  // timeline. The first pass may still be network-bound; the next loop is
  // served from the in-memory + IndexedDB caches. Five workers keep the VPS
  // from being hit with 23 simultaneous requests.
  const warmTimeline = useCallback(() => {
    if (!hasApi || worldView || requestedCountries.length !== 1) return;
    const country = requestedCountries[0];
    const bbox = selection.allCellsFor ? undefined : selection.bbox;
    const targetYears = years.filter((year) => year !== mapYear);
    let cursor = 0;
    const worker = async () => {
      while (cursor < targetYears.length) {
        const year = targetYears[cursor];
        cursor += 1;
        try {
          await loadApiGrid(country, year, bbox);
        } catch {
          // A failed year should not stop the rest of the warm-up.
        }
      }
    };
    void Promise.all([worker(), worker(), worker(), worker(), worker()]);
  }, [hasApi, worldView, requestedCountries, selection, years, mapYear]);

  // Playback gate: `ensureYear` returns true when the annual grid for that year
  // is already in memory. If it is not, it starts the request and reports the
  // cache fill through `gridVersion`, so the timeline never advances into a
  // year that would need a network round-trip. That is what makes the first
  // pass slow (it waits for data) and every later loop instant.
  const ensureYear = useCallback(
    (year: number): boolean => {
      if (!hasApi || worldView || requestedCountries.length !== 1) return true;
      const bbox = selection.allCellsFor ? undefined : selection.bbox;
      if (peekApiGrid(requestedCountries[0], year, bbox)) return true;
      if (failedYears.current.has(year)) return true;
      loadApiGrid(requestedCountries[0], year, bbox)
        .then(() => {
          yearAttempts.current.delete(year);
          failedYears.current.delete(year);
          setGridVersion((version) => version + 1);
        })
        .catch(() => {
          // A transient API failure must not freeze playback forever: retry a
          // few times, then let the timeline move on instead of hanging.
          const attempts = (yearAttempts.current.get(year) ?? 0) + 1;
          yearAttempts.current.set(year, attempts);
          if (attempts >= 4) failedYears.current.add(year);
          window.setTimeout(() => setGridVersion((version) => version + 1), 2500);
        });
      return false;
    },
    [hasApi, worldView, requestedCountries, selection],
  );

  useEffect(() => {
    yearAttempts.current.clear();
    failedYears.current.clear();
  }, [requestedCountries, selection, range]);

  useEffect(() => {
    if (!hasApi || !urlReady || dataVersion !== "v2" || requestedCountries.length === 0) return;
    if (requestedCountries.length > 1) {
      setApiCells([]);
      setMapLoading(false);
      return;
    }
    const bbox = selection.allCellsFor ? undefined : selection.bbox;
    const cached = requestedCountries.map((country) => peekApiGrid(country, mapYear, bbox));
    if (cached.every((grid): grid is ApiGrid => Boolean(grid))) {
      // Warm loop: swap the year in the same render. No request, no loading
      // overlay, no flash. This is what makes the second playback pass feel
      // instantaneous.
      setApiCells(combineGridCells(cached));
      setMapLoading(false);
      return;
    }

    const controller = new AbortController();
    setMapLoading(true);

    Promise.all(
      requestedCountries.map((country) => loadApiGrid(country, mapYear, bbox, controller.signal)),
    )
      .then((grids) => {
        if (controller.signal.aborted) return;
        setApiCells(combineGridCells(grids));
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setNotice({ kind: "error", text: "Could not load the map grid for this year." });
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setMapLoading(false);
      });

    return () => controller.abort();
  }, [hasApi, urlReady, dataVersion, requestedCountries, selection, mapYear]);

  useEffect(() => {
    if (!hasApi || !urlReady || dataVersion !== "v2" || requestedCountries.length === 0) return;
    if (requestedCountries.length > 1) {
      setV2Metadata([]);
      return;
    }
    const controller = new AbortController();
    loadApiMetadata(requestedCountries, controller.signal)
      .then((metadata) => {
        if (!controller.signal.aborted) setV2Metadata(metadata);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [hasApi, urlReady, dataVersion, requestedCountries]);

  // Static fallback: the country series already carries the empirical bands.
  useEffect(() => {
    if (hasApi || dataVersion !== "v2" || !selection.allCellsFor) return;
    let alive = true;
    loadSeriesEntry(selection.allCellsFor, selection.allCellsFor, "months")
      .then(({ rows }) => {
        if (alive) setBands(bandsFromSeries(rows));
      })
      .catch(() => {
        if (alive) setBands(new Map());
      });
    return () => {
      alive = false;
    };
  }, [hasApi, dataVersion, selection.allCellsFor]);

  const demoRows = useMemo(() => {
    if (!mounted || mode !== "demo") return [];
    return generateDemoRows(selection.bbox, 2000, endYear);
  }, [mounted, mode, selection.bbox, endYear]);

  const rows =
    dataVersion === "v2" ? v2Rows : mode === "demo" ? demoRows : liveRows;
  const grid = useMemo(() => {
    if (hasApi && dataVersion === "v2") {
      return apiRegion ?? aggregate([], years, () => false);
    }
    return aggregate(
      rows,
      years,
      match,
      dataVersion === "v2"
        ? { knownCells, availability: availableMonths }
        : undefined,
    );
  }, [hasApi, dataVersion, apiRegion, rows, years, match, knownCells, availableMonths]);

  useEffect(() => {
    setDraft(toDraft(selection.bbox));
    setDraftError(null);
  }, [selection]);

  const yearlyCells = useMemo(() => {
    const cellIds = new Set(knownCells);
    if (dataVersion !== "v2") {
      for (const row of rows) {
        const point = parseCell(row.cell);
        if (point && match(point[0], point[1])) cellIds.add(row.cell);
      }
    }

    const orderedCells = [...cellIds];
    const indexes = new Map(orderedCells.map((cell, index) => [cell, index]));
    const values = new Map(years.map((year) => [year, new Float32Array(orderedCells.length)]));

    for (const row of rows) {
      const yearValues = values.get(row.y);
      const index = indexes.get(row.cell);
      if (!yearValues || index === undefined || row.harm === null) continue;
      yearValues[index] += row.harm;
    }

    const cells = orderedCells.flatMap((cell, index) => {
      const point = parseCell(cell);
      return point ? [{ cell, lat: point[0], lon: point[1], index }] : [];
    });
    return { cells, values };
  }, [knownCells, dataVersion, rows, match, years]);

  const cellPoints = useMemo(() => {
    if (hasApi && dataVersion === "v2") {
      return apiCells
        .filter((row) => row.harm !== null && row.harm > 0)
        .filter((row) => !selection.polygon || match(row.lat, row.lon))
        .map((row) => ({
          cell: row.cell,
          lat: row.lat,
          lon: row.lon,
          value: row.harm ?? 0,
        }));
    }
    const values = yearlyCells.values.get(mapYear);
    return yearlyCells.cells.map((cell) => ({
      cell: cell.cell,
      lat: cell.lat,
      lon: cell.lon,
      value: values?.[cell.index] ?? 0,
    }));
  }, [hasApi, dataVersion, apiCells, selection.polygon, match, yearlyCells, mapYear]);

  const mapScaleMax = useMemo(() => {
    if (hasApi && dataVersion === "v2") return Math.max(1, apiScale);
    const cellMaxima = yearlyCells.cells.map((cell) => {
      let max = 0;
      for (const values of yearlyCells.values.values()) {
        max = Math.max(max, values[cell.index] ?? 0);
      }
      return max;
    });
    if (cellMaxima.length === 0) return 1;
    cellMaxima.sort((a, b) => a - b);
    return Math.max(1, cellMaxima[Math.floor((cellMaxima.length - 1) * 0.98)] ?? 1);
  }, [hasApi, dataVersion, apiScale, yearlyCells]);
  const countryTotals = useMemo(() => {
    const result: Record<string, number> = {};
    for (const [country, byYear] of Object.entries(countryYearTotals)) {
      result[country] = byYear[mapYear] ?? 0;
    }
    return result;
  }, [countryYearTotals, mapYear]);

  // Use the grid's own year axis: while a new range is loading, `years` can be
  // ahead of the grid and indexing it with `years` would be out of bounds.
  const mapYearIndex = grid.years.indexOf(mapYear);
  const mapYearRow = mapYearIndex >= 0 ? grid.sources?.[mapYearIndex] : undefined;
  const mapYearSources = mapYearRow
    ? [...new Set(mapYearRow.filter((source): source is string => source !== null))]
    : [];
  const hasUnavailable = mapYearSources.includes("unavailable");
  const mapYearSource = hasUnavailable
    ? mapYearSources.length > 1
      ? "partial"
      : "unavailable"
    : mapYearSources.length > 1
      ? "mixed"
      : mapYearSources[0] ?? "unavailable";

  const preset = REGIONS.find(
    (region) => !selection.polygon && sameBBox(region.bbox, selection.bbox),
  );
  const regionName =
    preset?.name ??
    selection.label ??
    (selection.polygon ? "Custom polygon" : "Custom box");
  const coverage =
    selection.allCellsFor || selection.country ? "full" : coverageStatus(selection.bbox);

  const handleSelection = useCallback((next: Selection) => {
    if (next.bbox.maxLon - next.bbox.minLon > 180) {
      setNotice({
        kind: "info",
        text: "That box crosses the antimeridian. Draw one box west of 180° and another east of it.",
      });
      return;
    }
    setSelection(next);
  }, []);

  const applyDraft = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const parsed = parseDraft(draft);
      if (!parsed) {
        setDraftError("Enter four numbers, south < north and west < east, at least 0.2° wide.");
        return;
      }
      setSelection({ bbox: parsed });
    },
    [draft],
  );

  const reset = useCallback(() => {
    setSelection({
      bbox: INITIAL_REGION.bbox,
      allCellsFor: INITIAL_REGION.allCellsFor,
      countries: INITIAL_REGION.countries,
      label: INITIAL_REGION.label,
    });
    setRange([availableYears[0], availableYears[availableYears.length - 1]]);
  }, [availableYears]);

  const download = useCallback((blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, []);

  const showWorld = useCallback(() => {
    const world = REGIONS.find((entry) => entry.id === "world");
    if (!world) return;
    setSelection({
      bbox: world.bbox,
      countries: world.countries,
      label: world.label ?? world.name,
    });
  }, []);

  const exportCsv = useCallback(() => {
    if (years.length === 0) return;
    const from = years[0];
    const to = years[years.length - 1];
    if (hasApi && dataVersion === "v2") {
      const query = {
        bbox: selection.allCellsFor || worldView ? undefined : selection.bbox,
        polygon: selection.polygon,
        start: from,
        end: to,
      };
      const countries = requestedCountries.length > 0 ? requestedCountries : (["PE"] as DataCountry[]);
      Promise.all(
        countries.map((country) => downloadApiCsv({ country, ...query })),
      )
        .then(async (blobs) => {
          const parts = await Promise.all(blobs.map((blob) => blob.text()));
          const csv = parts
            .map((text, index) => (index === 0 ? text : text.split("\n").slice(1).join("\n")))
            .join("\n");
          download(new Blob([csv], { type: "text/csv;charset=utf-8" }), `ninacal-hotspots-${slugify(regionName)}-${from}-${to}.csv`);
        })
        .catch(() => {
          setNotice({ kind: "error", text: "Could not export this selection as CSV." });
        });
      return;
    }
    const csv =
      dataVersion === "v2"
        ? csvForV2(rows, years)
        : csvFor(rows, years, match);
    download(new Blob([csv], { type: "text/csv;charset=utf-8" }), `ninacal-${dataVersion}-${slugify(regionName)}-${from}-${to}.csv`);
  }, [years, rows, match, dataVersion, regionName, selection, requestedCountries, worldView, download]);

  const showAmazon2024 = useCallback(() => {
    const region = REGIONS.find((entry) => entry.id === "peru-amazon");
    if (region) setSelection({ bbox: region.bbox, label: region.name });
    const first = availableYears[0];
    const last = availableYears[availableYears.length - 1];
    if (first !== undefined && last !== undefined) {
      setRange([first, last]);
      setMapYear(Math.max(first, Math.min(last, 2024)));
    }
  }, [availableYears]);

  const loadingLive =
    mode === "live" && progress !== null && progress.total > 0 && progress.done < progress.total;
  const loading = !mounted || !booted || loadingLive;
  const busyLabel = !mounted || !booted
    ? "Preparing grid…"
    : loadingLive
      ? progress
        ? hasApi
          ? "Loading selection from API…"
          : `Loading ${progress.done}/${progress.total} data files…`
        : "Loading years…"
      : hasApi && mapLoading
        ? "Loading map year…"
        : null;

  return {
    mounted,
    booted,
    mode,
    dataVersion,
    loading,
    busyLabel,
    progress,
    availableYears,
    years,
    range,
    setRange,
    mapYear,
    setMapYear,
    mapYearSource,
    selection,
    setSelection,
    handleSelection,
    regionName,
    preset,
    coverage,
    calibration,
    v2Metadata,
    dataCountries,
    measureLabel: dataVersion === "v2" ? "hotspot-days" : "detections",
    cellStep: dataVersion === "v2" ? (v2Manifest?.resolution_degrees ?? 0.05) : undefined,
    grid,
    cellPoints,
    mapScaleMax,
    countryTotals,
    worldView,
    bands,
    apiEnabled: hasApi,
    mapLoading,
    notice,
    draft,
    setDraft,
    draftError,
    applyDraft,
    reset,
    showWorld,
    warmTimeline,
    ensureYear,
    gridVersion,
    showAmazon2024,
    exportCsv,
  };
}

export type ExplorerState = ReturnType<typeof useExplorer>;
