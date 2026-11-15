import type { Region } from "./types";
import { COUNTRIES, COUNTRY_CODES, WORLD_VIEW, onCountriesChanged } from "./countries";
import { OVERVIEW_BBOX } from "./coverage";

/**
 * Selection shortcuts. URL compatibility keeps the old `peru`, `usa` and
 * `peru-amazon` ids; the country entries are rebuilt whenever the API reports a
 * different catalogue.
 */
const PRESETS: Region[] = [
  {
    id: "peru-amazon",
    name: "Peruvian Amazon",
    detail: "Loreto · Ucayali · Madre de Dios",
    bbox: { minLat: -13.5, minLon: -77.5, maxLat: -2.5, maxLon: -69.0 },
    label: "Peruvian Amazon",
  },
  {
    id: "peru-andes",
    name: "Peruvian Andes",
    detail: "Highlands",
    bbox: { minLat: -17.5, minLon: -77.2, maxLat: -7.5, maxLon: -69.5 },
    label: "Peruvian Andes",
  },
  {
    id: "southeast",
    name: "Southeast US",
    detail: "Gulf · Atlantic",
    bbox: { minLat: 24.0, minLon: -92.0, maxLat: 35.5, maxLon: -75.0 },
    label: "Southeast US",
  },
  {
    id: "alaska",
    name: "Alaska",
    detail: "Boreal",
    bbox: { minLat: 54.0, minLon: -168.0, maxLat: 71.5, maxLon: -130.0 },
    label: "Alaska",
  },
];

function buildRegions(): Region[] {
  return [
    {
      id: "world",
      name: "World",
      detail: `${COUNTRIES.length} countries with published data`,
      bbox: OVERVIEW_BBOX,
      countries: COUNTRY_CODES,
      label: "World",
    },
    ...COUNTRIES.map((country) => ({
      id: country.code === "PE" ? "peru" : country.code === "US" ? "usa" : country.code.toLowerCase(),
      name: country.name,
      detail: country.iso3,
      bbox: country.viewBbox,
      allCellsFor: country.code,
      label: country.name,
    })),
    ...PRESETS,
  ];
}

export const REGIONS: Region[] = buildRegions();
export let DEFAULT_REGION: Region = REGIONS[0];
export let WORLD_REGION: Region = REGIONS[0];
export { WORLD_VIEW };

onCountriesChanged(() => {
  REGIONS.splice(0, REGIONS.length, ...buildRegions());
  DEFAULT_REGION = REGIONS[0];
  WORLD_REGION = REGIONS[0];
});
