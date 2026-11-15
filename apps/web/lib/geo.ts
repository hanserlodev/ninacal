import type { BBox, Ring, Selection } from "./types";

const CELL_CACHE = new Map<string, [number, number] | null>();

/**
 * Parse a grid cell anchor ("<lat>_<lon>") into [lat, lon].
 * The contract fixes the anchor at the cell centre (docs/data-dictionary.md).
 */
export function parseCell(cell: string): [number, number] | null {
  const cached = CELL_CACHE.get(cell);
  if (cached !== undefined) return cached;

  const index = cell.indexOf("_");
  if (index < 1) {
    CELL_CACHE.set(cell, null);
    return null;
  }
  const lat = Number(cell.slice(0, index));
  const lon = Number(cell.slice(index + 1));
  const parsed: [number, number] | null =
    Number.isFinite(lat) && Number.isFinite(lon) ? [lat, lon] : null;
  CELL_CACHE.set(cell, parsed);
  return parsed;
}

export function bboxContains(bbox: BBox, lat: number, lon: number): boolean {
  return (
    lat >= bbox.minLat &&
    lat <= bbox.maxLat &&
    lon >= bbox.minLon &&
    lon <= bbox.maxLon
  );
}

/** Ray casting, [lon, lat] ring. Boundary points are treated as inside. */
export function pointInRing(lon: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const crosses = yi > lat !== yj > lat;
    if (crosses && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export function ringContains(ring: Ring, lat: number, lon: number): boolean {
  if (!pointInRing(lon, lat, ring)) {
    // Also accept points on a vertex or edge (cheap epsilon check).
    return ring.some(([x, y]) => Math.abs(x - lon) < 1e-9 && Math.abs(y - lat) < 1e-9);
  }
  return true;
}

/** Build the predicate used by the aggregator: bbox fast path, polygon when present. */
export function selectionMatcher(selection: Selection): (lat: number, lon: number) => boolean {
  const { bbox, polygon } = selection;
  if (!polygon || polygon.length < 3) {
    return (lat, lon) => bboxContains(bbox, lat, lon);
  }
  return (lat, lon) => bboxContains(bbox, lat, lon) && ringContains(polygon, lat, lon);
}

export function bboxRing(bbox: BBox): Ring {
  return [
    [bbox.minLon, bbox.minLat],
    [bbox.maxLon, bbox.minLat],
    [bbox.maxLon, bbox.maxLat],
    [bbox.minLon, bbox.maxLat],
    [bbox.minLon, bbox.minLat],
  ];
}

export function ringBBox(ring: Ring): BBox {
  let minLat = 90;
  let maxLat = -90;
  let minLon = 180;
  let maxLon = -180;
  for (const [lon, lat] of ring) {
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
  }
  return { minLat, minLon, maxLat, maxLon };
}

export function normalizeBBox(input: {
  minLat: number;
  minLon: number;
  maxLat: number;
  maxLon: number;
}): BBox | null {
  let { minLat, minLon, maxLat, maxLon } = input;
  if (![minLat, minLon, maxLat, maxLon].every(Number.isFinite)) return null;

  minLat = Math.max(-90, Math.min(90, minLat));
  maxLat = Math.max(-90, Math.min(90, maxLat));
  minLon = Math.max(-180, Math.min(180, minLon));
  maxLon = Math.max(-180, Math.min(180, maxLon));

  if (minLat > maxLat) [minLat, maxLat] = [maxLat, minLat];
  if (minLon > maxLon) [minLon, maxLon] = [maxLon, minLon];
  if (maxLat - minLat < 0.2 || maxLon - minLon < 0.2) return null;

  return { minLat, minLon, maxLat, maxLon };
}

export function sameBBox(a: BBox, b: BBox): boolean {
  const near = (x: number, y: number) => Math.abs(x - y) < 0.001;
  return (
    near(a.minLat, b.minLat) &&
    near(a.minLon, b.minLon) &&
    near(a.maxLat, b.maxLat) &&
    near(a.maxLon, b.maxLon)
  );
}

export function bboxLabel(bbox: BBox): string {
  const fmt = (value: number) => value.toFixed(1).replace(/\.0$/, "");
  return `${fmt(bbox.minLat)}, ${fmt(bbox.minLon)} → ${fmt(bbox.maxLat)}, ${fmt(bbox.maxLon)}`;
}
