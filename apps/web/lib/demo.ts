import { COVERAGE_AREAS, bboxIntersectsCoverage, inCoverage } from "./coverage";
import type { BBox, Calibration, Row } from "./types";

/**
 * Synthetic data, used only when data/processed/ has no years yet.
 * It follows the exact row contract so the whole pipeline downstream is real.
 * The UI labels it as demo data; it is never mixed with published years.
 */

export const DEMO_START = 2000;

export const DEMO_FACTORS = [
  0.74, 0.76, 0.79, 0.81, 0.78, 0.72, 0.68, 0.7, 0.75, 0.82, 0.8, 0.77,
];

export function demoEndYear(): number {
  return Math.max(2026, new Date().getFullYear());
}

/** Deterministic hash in [0, 1). */
function hash(a: number, b: number, salt: number): number {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(salt | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function cellKey(lat: number, lon: number): string {
  const fix = (value: number) => {
    const text = value.toFixed(1);
    return text === "-0.0" ? "0.0" : text;
  };
  return `${fix(lat)}_${fix(lon)}`;
}

function pickPeakMonth(bbox: BBox, seed: number): number {
  const midLat = (bbox.minLat + bbox.maxLat) / 2;
  const midLon = (bbox.minLon + bbox.maxLon) / 2;
  if (midLat < -10) return midLon > 100 ? 2 : seed % 2 === 0 ? 9 : 2;
  if (midLat > 45) return 7;
  if (midLat > 20) return 6 + (seed % 3);
  return 8 + (seed % 3);
}

type Spot = { lat: number; lon: number; weight: number; scale: number };

export function generateDemoRows(bbox: BBox, startYear: number, endYear: number): Row[] {
  if (!bboxIntersectsCoverage(bbox)) return [];

  const spanLat = Math.max(0.2, bbox.maxLat - bbox.minLat);
  const spanLon = Math.max(0.2, bbox.maxLon - bbox.minLon);

  // Only the parts of the box inside the covered countries count.
  const pieces = COVERAGE_AREAS.map((entry) => {
    const minLat = Math.max(bbox.minLat, entry.bbox.minLat);
    const maxLat = Math.min(bbox.maxLat, entry.bbox.maxLat);
    const minLon = Math.max(bbox.minLon, entry.bbox.minLon);
    const maxLon = Math.min(bbox.maxLon, entry.bbox.maxLon);
    if (maxLat - minLat <= 0 || maxLon - minLon <= 0) return null;
    return { entry, minLat, maxLat, minLon, maxLon, width: maxLon - minLon, height: maxLat - minLat };
  }).filter((piece): piece is NonNullable<typeof piece> => piece !== null);

  if (pieces.length === 0) return [];
  const coveredArea = pieces.reduce((total, piece) => total + piece.width * piece.height, 0);

  // Aim for a few hundred demo cells regardless of how much the user draws.
  const step = Math.max(0.1, Math.round(Math.sqrt(coveredArea / 340) * 10) / 10);

  const nLat = Math.max(1, Math.min(140, Math.floor(spanLat / step)));
  const nLon = Math.max(1, Math.min(180, Math.floor(spanLon / step)));
  const seed = Math.round(
    Math.abs(
      (bbox.minLat + 90) * 31 +
        (bbox.minLon + 180) * 57 +
        spanLat * 7 +
        spanLon * 11 +
        coveredArea,
    ),
  );

  // Clusters are seeded per covered piece, so a two-country box has fires in both.
  const spots: Spot[] = [];
  pieces.forEach((piece, pieceIndex) => {
    const areaSeed = seed + pieceIndex * 97;
    const count = 7 + Math.floor(hash(pieceIndex, 1, seed) * 5);
    for (let i = 0; i < count; i += 1) {
      spots.push({
        lat: piece.minLat + hash(i, 2, areaSeed) * piece.height,
        lon: piece.minLon + hash(i, 3, areaSeed) * piece.width,
        weight: 0.55 + hash(i, 4, areaSeed) * 0.45,
        scale: Math.max(
          0.5,
          Math.min(7, Math.max(piece.width, piece.height) / (3.2 + hash(i, 5, areaSeed) * 2.2)),
        ),
      });
    }
  });

  const peakMonth = pickPeakMonth(bbox, seed);
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = Math.max(1, now.getMonth()); // last complete month

  const rows: Row[] = [];

  for (let i = 0; i < nLat; i += 1) {
    const lat = round1(bbox.minLat + step / 2 + i * step);
    if (lat > bbox.maxLat) continue;

    for (let j = 0; j < nLon; j += 1) {
      const lon = round1(bbox.minLon + step / 2 + j * step);
      if (lon > bbox.maxLon) continue;
      if (!inCoverage(lat, lon)) continue;

      let cluster = 0;
      for (const spot of spots) {
        const dLat = lat - spot.lat;
        const dLon = (lon - spot.lon) * Math.cos((lat * Math.PI) / 180);
        const distance = Math.hypot(dLat, dLon);
        cluster = Math.max(cluster, spot.weight * Math.exp(-((distance / spot.scale) ** 2)));
      }

      // A deterministic "land" mask so the region does not glow as a rectangle.
      if (hash(i, j, seed + 9) < 0.52 && cluster < 0.12) continue;

      const base = 0.35 + 5.2 * hash(i, j, seed + 3) ** 2;
      const hotspot = 0.4 + cluster * 1.9;
      const cell = cellKey(lat, lon);

      for (let y = Math.max(DEMO_START, startYear); y <= endYear; y += 1) {
        const yearFactor =
          0.86 +
          0.28 * Math.sin((y - DEMO_START) * 0.52 + (seed % 11)) +
          0.012 * (y - DEMO_START) +
          (hash(y, 1, seed) - 0.5) * 0.18;

        const maxMonth = y === currentYear ? currentMonth : 12;

        for (let m = 1; m <= maxMonth; m += 1) {
          const rawDistance = Math.abs(m - peakMonth);
          const distance = Math.min(rawDistance, 12 - rawDistance);
          const season = 0.025 + Math.exp(-((distance / 1.55) ** 2));
          const noise = 0.5 + hash(y * 12 + m, i * 31 + j, seed + 5) * 1.1;
          const count = base * hotspot * season * yearFactor * noise;

          const k = DEMO_FACTORS[m - 1];
          const draw = hash(y * 12 + m, i * 7 + j + 1, seed + 13);

          if (y < 2012) {
            const modis = Math.max(0, Math.round(count));
            rows.push({
              cell,
              y,
              m,
              modis: draw > 0.994 ? null : modis,
              viirs: 0,
              harm: draw > 0.994 ? null : modis,
            });
          } else {
            const viirs = Math.max(0, Math.round(count / k));
            const harm = round1(k * viirs);
            const modis = Math.max(0, Math.round(count * (0.84 + draw * 0.3)));
            rows.push({
              cell,
              y,
              m,
              modis: draw > 0.985 ? null : modis,
              viirs,
              harm: draw > 0.992 ? null : harm,
            });
          }
        }
      }
    }
  }

  return rows;
}

export function demoCalibration(): Calibration {
  const end = demoEndYear();
  const points = Array.from({ length: 260 }, (_, i) => {
    const observed = 1 + Math.round(hash(i, 1, 7) * 92);
    const predicted =
      observed * (0.82 + hash(i, 2, 7) * 0.3) + (hash(i, 3, 7) - 0.5) * 7;
    return {
      observed,
      predicted: Math.max(0, Math.round(predicted * 10) / 10),
      y: 2021 + (i % Math.max(1, end - 2020)),
      m: 1 + (i % 12),
    };
  });

  return {
    generated_at: new Date().toISOString(),
    products: { baseline: "MODIS C6.1", target: "VIIRS S-NPP" },
    method: "ratio",
    train: [2012, 2020],
    test: [2021, end],
    metrics: { r2: 0.87, rmse: 3.4, n: 4820 },
    by_month: Object.fromEntries(DEMO_FACTORS.map((value, i) => [String(i + 1), value])),
    points,
  };
}
