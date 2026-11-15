import type { BBox } from "./types";
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
