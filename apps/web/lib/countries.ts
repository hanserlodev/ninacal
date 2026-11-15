import type { BBox, V2Manifest } from "./types";
import generated from "./countries.generated.json";

export type CountryInfo = {
  code: string;
  name: string;
  iso3: string;
  /** Mainland view for fitBounds; remote islands are reachable through regions. */
  viewBbox: BBox;
  boundary: string;
};

/**
 * Countries with a published v2 bundle. The JSON is generated from
 * `data/v2/manifest.json` by `scripts/generate_countries.py`; the API remains
 * the runtime source of truth for data queries.
 */
export const COUNTRIES: CountryInfo[] = generated as unknown as CountryInfo[];

export const COUNTRY_BY_CODE = new Map(COUNTRIES.map((country) => [country.code, country]));
export const COUNTRY_BY_ISO3 = new Map(
  COUNTRIES.map((country) => [country.iso3.toUpperCase(), country]),
);
export const COUNTRY_CODES = COUNTRIES.map((country) => country.code);

const listeners = new Set<() => void>();

/** Register a module that derives data from the catalogue (regions, coverage). */
export function onCountriesChanged(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Replace the catalogue with the countries the live API reports. The API is the
 * runtime source of truth, so adding a country to the bundle does not require a
 * frontend rebuild: the selector and coverage pick it up on the next load.
 */
export function setCountries(next: CountryInfo[]): void {
  COUNTRIES.splice(0, COUNTRIES.length, ...next);
  COUNTRY_BY_CODE.clear();
  COUNTRY_BY_ISO3.clear();
  for (const country of next) {
    COUNTRY_BY_CODE.set(country.code, country);
    COUNTRY_BY_ISO3.set(country.iso3.toUpperCase(), country);
  }
  COUNTRY_CODES.splice(0, COUNTRY_CODES.length, ...next.map((country) => country.code));
  for (const listener of listeners) listener();
}

/**
 * Build the runtime catalogue from the API manifest. The manifest already
 * carries name/iso3/boundary/view_bbox, so adding a country to the bundle is
 * enough: no frontend rebuild is required.
 */
export function countriesFromManifest(manifest: V2Manifest): CountryInfo[] {
  const known = new Map(COUNTRIES.map((country) => [country.code, country]));
  return Object.entries(manifest.countries ?? {})
    .map(([code, raw]) => {
      const entry = raw as Record<string, unknown>;
      const base = known.get(code);
      const box = Array.isArray(entry.view_bbox)
        ? entry.view_bbox.map(Number)
        : Array.isArray(entry.bbox)
          ? entry.bbox.map(Number)
          : [];
      const viewBbox: BBox =
        box.length === 4 && box.every(Number.isFinite)
          ? { minLon: box[0], minLat: box[1], maxLon: box[2], maxLat: box[3] }
          : base?.viewBbox ?? { minLon: -180, minLat: -60, maxLon: 180, maxLat: 75 };
      return {
        code,
        name:
          typeof entry.name === "string" && entry.name.trim()
            ? entry.name
            : base?.name ?? code,
        iso3: String(entry.iso3 ?? base?.iso3 ?? code).toUpperCase(),
        boundary: String(entry.boundary ?? base?.boundary ?? ""),
        viewBbox,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export const WORLD_VIEW: BBox = {
  minLon: -179.9,
  minLat: -60,
  maxLon: 179.9,
  maxLat: 75,
};

/** Resolve a Natural Earth feature by ISO2 or ISO3. */
export function countryForFeature(properties: Record<string, unknown> | null | undefined): CountryInfo | undefined {
  if (!properties) return undefined;
  const iso3 = String(properties.iso3 ?? "").toUpperCase();
  const iso2 = String(properties.iso2 ?? "").toUpperCase();
  return COUNTRY_BY_ISO3.get(iso3) ?? COUNTRY_BY_CODE.get(iso2) ?? COUNTRY_BY_CODE.get(iso3);
}

export function countryForIso2(iso2: string | null | undefined): CountryInfo | undefined {
  if (!iso2) return undefined;
  return countryForFeature({ iso2 });
}
