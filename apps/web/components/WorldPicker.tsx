"use client";

import { useEffect, useMemo, useState } from "react";
import { COUNTRIES, COUNTRY_BY_CODE, COUNTRY_CODES, WORLD_VIEW } from "@/lib/countries";
import { loadSeriesIndex } from "@/lib/series";
import type { ApiSeriesSummary } from "@/lib/api";
import type { ExplorerState } from "@/lib/useExplorer";

const WHOLE_COUNTRY = "__country__";

export default function WorldPicker({ state }: { state: ExplorerState }) {
  const [country, setCountry] = useState(
    state.worldView
      ? ""
      : state.selection.allCellsFor ??
          (state.dataCountries.length === 1 ? state.dataCountries[0] : "PE"),
  );
  const [region, setRegion] = useState(WHOLE_COUNTRY);
  const [regions, setRegions] = useState<ApiSeriesSummary[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (state.worldView) {
      setCountry("");
      setRegion(WHOLE_COUNTRY);
      return;
    }
    const code =
      state.selection.allCellsFor ??
      (state.dataCountries.length === 1 ? state.dataCountries[0] : undefined);
    if (code) setCountry(code);
  }, [state.worldView, state.selection.allCellsFor, state.dataCountries]);

  useEffect(() => {
    if (!country) {
      setRegions([]);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    loadSeriesIndex(country, controller.signal)
      .then((entries) => {
        if (!controller.signal.aborted) {
          setRegions(entries.filter((entry) => entry.id !== country));
          setLoading(false);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setRegions([]);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [country]);

  const info = COUNTRY_BY_CODE.get(country);
  const options = useMemo(
    () => [...regions].sort((a, b) => a.name.localeCompare(b.name)),
    [regions],
  );

  const selectCountry = (code: string) => {
    if (!code) {
      setCountry("");
      setRegion(WHOLE_COUNTRY);
      state.setSelection({
        bbox: WORLD_VIEW,
        countries: COUNTRY_CODES,
        label: "World",
      });
      return;
    }
    const next = COUNTRY_BY_CODE.get(code);
    if (!next) return;
    setCountry(code);
    setRegion(WHOLE_COUNTRY);
    state.setSelection({
      bbox: next.viewBbox,
      allCellsFor: next.code,
      country: next.code,
      label: next.name,
    });
  };

  const selectRegion = (value: string) => {
    setRegion(value);
    if (!info) return;
    if (value === WHOLE_COUNTRY) {
      state.setSelection({
        bbox: info.viewBbox,
        allCellsFor: info.code,
        country: info.code,
        label: info.name,
      });
      return;
    }
    const entry = options.find((item) => item.id === value);
    if (!entry) return;
    const bbox = entry.bbox
      ? {
          minLon: entry.bbox[0],
          minLat: entry.bbox[1],
          maxLon: entry.bbox[2],
          maxLat: entry.bbox[3],
        }
      : info.viewBbox;
    state.setSelection({
      bbox,
      country: info.code,
      label: entry.name,
    });
  };

  return (
    <div className="world-picker">
      <button
        type="button"
        className={state.worldView ? "world-picker-world is-active" : "world-picker-world"}
        onClick={() =>
          state.setSelection({
            bbox: WORLD_VIEW,
            countries: COUNTRY_CODES,
            label: "World",
          })
        }
      >
        <span aria-hidden="true">◎</span>
        World view
        <em>{COUNTRIES.length} countries</em>
      </button>

      <label>
        <span>Country</span>
        <select value={country} onChange={(event) => selectCountry(event.target.value)}>
          <option value="">— World overview —</option>
          {COUNTRIES.map((entry) => (
            <option key={entry.code} value={entry.code}>
              {entry.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>Region / state</span>
        <select
          value={region}
          onChange={(event) => selectRegion(event.target.value)}
          disabled={!info}
        >
          <option value={WHOLE_COUNTRY}>Whole country</option>
          {options.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name} · {entry.cells} cells
            </option>
          ))}
        </select>
      </label>

      <p className="world-picker-note">
        {!state.apiEnabled && state.worldView
          ? "World totals and cell drill-down load from the API. Pick a country for the static bundle."
          : loading
            ? "Loading administrative regions…"
            : info
              ? `${info.name} · ${info.iso3}${regions.length ? ` · ${regions.length} regions` : ""}`
              : "Select a country to load its 0.05° cells."}
      </p>
    </div>
  );
}
