import type { Feature, MultiLineString, MultiPolygon, Polygon } from "geojson";
import { COUNTRIES, WORLD_VIEW, onCountriesChanged } from "./countries";
import type { BBox } from "./types";

/**
 * Global shipping coverage. The pipeline can register more countries; this
 * module only needs their view bbox for selection and status. Exact country
 * outlines come from the bundled 110m world GeoJSON.
 */

export type CoverageArea = {
  id: string;
  country: string;
  name: string;
  bbox: BBox;
};

export const COVERAGE_AREAS: CoverageArea[] = [];

function rebuildCoverage(): void {
  COVERAGE_AREAS.splice(
    0,
    COVERAGE_AREAS.length,
    ...COUNTRIES.map((country) => ({
      id: country.code.toLowerCase(),
      country: country.code,
      name: country.name,
      bbox: country.viewBbox,
    })),
  );
  COVERAGE_LABEL = `Global · ${COUNTRIES.length} countries`;
}

export let COVERAGE_LABEL = `Global · ${COUNTRIES.length} countries`;
rebuildCoverage();
onCountriesChanged(rebuildCoverage);

/** Pan/zoom guard for the map: the whole planet. */
export const MAP_MAX_BOUNDS: [[number, number], [number, number]] = [
  [-180, -85],
  [180, 85],
];

/** Initial globe view. */
export const OVERVIEW_BBOX: BBox = WORLD_VIEW;

function intersects(a: BBox, b: BBox): boolean {
  return (
    a.minLat <= b.maxLat &&
    a.maxLat >= b.minLat &&
    a.minLon <= b.maxLon &&
    a.maxLon >= b.minLon
  );
}

export function inCoverage(lat: number, lon: number): boolean {
  return COVERAGE_AREAS.some(
    (entry) =>
      lat >= entry.bbox.minLat &&
      lat <= entry.bbox.maxLat &&
      lon >= entry.bbox.minLon &&
      lon <= entry.bbox.maxLon,
  );
}

export function bboxIntersectsCoverage(bbox: BBox): boolean {
  return COVERAGE_AREAS.some((entry) => intersects(bbox, entry.bbox));
}

export type CoverageStatus = "full" | "partial" | "outside";

export function coverageStatus(bbox: BBox): CoverageStatus {
  if (!bboxIntersectsCoverage(bbox)) return "outside";
  const contained = COVERAGE_AREAS.some(
    (entry) =>
      bbox.minLat >= entry.bbox.minLat &&
      bbox.maxLat <= entry.bbox.maxLat &&
      bbox.minLon >= entry.bbox.minLon &&
      bbox.maxLon <= entry.bbox.maxLon,
  );
  return contained ? "full" : "partial";
}

/** Countries whose published support may intersect a selection bbox. */
export function countriesForBBox(bbox: BBox): string[] {
  return COVERAGE_AREAS.filter((entry) => intersects(bbox, entry.bbox)).map(
    (entry) => entry.country,
  );
}

export type CoverageFeature = Feature<
  Polygon | MultiPolygon | MultiLineString,
  Record<string, string>
>;

/** Kept for API compatibility; the global map draws world outlines instead. */
export function coverageMaskFeature(): CoverageFeature {
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [[[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]]],
    },
  };
}

/** Kept for API compatibility; the global map draws world outlines instead. */
export function coveragePolygonFeatures(): CoverageFeature[] {
  return [];
}

/** Kept for API compatibility; the global map draws world outlines instead. */
export function coverageLineFeatures(): CoverageFeature[] {
  return [];
}
