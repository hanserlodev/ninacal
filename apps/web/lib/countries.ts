import type { BBox } from "./types";

export type CountryInfo = {
  code: string;
  name: string;
  iso3: string;
  /** Mainland view for fitBounds; remote islands are reachable through regions. */
  viewBbox: BBox;
  boundary: string;
};

/**
 * Countries with a published v2 bundle. The pipeline can register more
 * countries; add them here (and rerun the backend) to light them up.
 */
export const COUNTRIES: CountryInfo[] = [
  { code: "AR", name: "Argentina", iso3: "ARG", boundary: "arg_adm1_simplified.geojson", viewBbox: { minLon: -73.6, minLat: -55.1, maxLon: -53.6, maxLat: -21.8 } },
  { code: "AU", name: "Australia", iso3: "AUS", boundary: "aus_adm1_simplified.geojson", viewBbox: { minLon: 112.9, minLat: -43.8, maxLon: 153.7, maxLat: -10.6 } },
  { code: "BO", name: "Bolivia", iso3: "BOL", boundary: "bol_adm1_simplified.geojson", viewBbox: { minLon: -69.7, minLat: -22.9, maxLon: -57.5, maxLat: -9.7 } },
  { code: "BR", name: "Brazil", iso3: "BRA", boundary: "bra_adm1_simplified.geojson", viewBbox: { minLon: -74.1, minLat: -33.8, maxLon: -34.7, maxLat: 5.3 } },
  { code: "CL", name: "Chile", iso3: "CHL", boundary: "chl_adm1_simplified.geojson", viewBbox: { minLon: -75.7, minLat: -56.0, maxLon: -66.4, maxLat: -17.5 } },
  { code: "CO", name: "Colombia", iso3: "COL", boundary: "col_adm1_simplified.geojson", viewBbox: { minLon: -79.0, minLat: -4.3, maxLon: -66.9, maxLat: 13.4 } },
  { code: "EC", name: "Ecuador", iso3: "ECU", boundary: "ecu_adm1_simplified.geojson", viewBbox: { minLon: -81.1, minLat: -5.1, maxLon: -75.2, maxLat: 1.7 } },
  { code: "MX", name: "Mexico", iso3: "MEX", boundary: "mex_adm1_simplified.geojson", viewBbox: { minLon: -118.4, minLat: 14.5, maxLon: -86.7, maxLat: 32.7 } },
  { code: "PE", name: "Peru", iso3: "PER", boundary: "peru_adm1_simplified.geojson", viewBbox: { minLon: -81.4, minLat: -18.4, maxLon: -68.6, maxLat: 0.0 } },
  { code: "PY", name: "Paraguay", iso3: "PRY", boundary: "pry_adm1_simplified.geojson", viewBbox: { minLon: -62.7, minLat: -27.6, maxLon: -54.2, maxLat: -19.3 } },
  { code: "US", name: "United States", iso3: "US", boundary: "us_adm1_simplified.geojson", viewBbox: { minLon: -125.0, minLat: 24.0, maxLon: -66.5, maxLat: 49.5 } },
  { code: "VE", name: "Venezuela", iso3: "VEN", boundary: "ven_adm1_simplified.geojson", viewBbox: { minLon: -73.4, minLat: 0.6, maxLon: -59.8, maxLat: 12.5 } },
];

export const COUNTRY_BY_CODE = new Map(COUNTRIES.map((country) => [country.code, country]));
export const COUNTRY_CODES = COUNTRIES.map((country) => country.code);
export const COVERED_ISO2 = new Set(COUNTRIES.map((country) => country.code));

export const WORLD_VIEW: BBox = {
  minLon: -179.9,
  minLat: -60,
  maxLon: 179.9,
  maxLat: 75,
};

export function countryForIso2(iso2: string | null | undefined): CountryInfo | undefined {
  if (!iso2) return undefined;
  return COUNTRY_BY_CODE.get(iso2.toUpperCase());
}
