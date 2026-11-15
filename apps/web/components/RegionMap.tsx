"use client";

import { useEffect, useRef, useState } from "react";
import type { Feature, FeatureCollection, Geometry, LineString, Polygon } from "geojson";
import {
  AttributionControl,
  FullscreenControl,
  Map as MapLibreMap,
  NavigationControl,
  ScaleControl,
  setWorkerUrl,
  type MapLayerMouseEvent,
  type StyleSpecification,
} from "maplibre-gl";
import { MAP_MAX_BOUNDS } from "@/lib/coverage";
import { COUNTRY_BY_CODE, countryForFeature } from "@/lib/countries";
import { DATA_BASE } from "@/lib/api";
import worldBoundaries from "@/lib/boundaries/world.json";
import { bboxLabel, bboxRing, parseCell, ringBBox } from "@/lib/geo";
import { formatCompact, formatCount } from "@/lib/format";
import type { BBox, Ring, Selection } from "@/lib/types";

type GeoJSONData = FeatureCollection | Feature | Geometry;
type SourceLike = { setData: (data: GeoJSONData) => void };

export type CellPoint = { cell: string; lat: number; lon: number; value: number };

const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };

// Building ~200k cell polygons per year costs seconds on big countries, and the
// timeline revisits the same years over and over. The cell arrays are stable per
// annual grid (see useExplorer's gridCells cache), so keep the built
// FeatureCollection attached to the array identity. A small LRU bounds memory.
const layerCache = new WeakMap<CellPoint[], Map<string, FeatureCollection>>();
const LAYER_CACHE_LIMIT = 8;

function cachedLayer(
  cells: CellPoint[],
  key: string,
  build: () => FeatureCollection,
): FeatureCollection {
  let entries = layerCache.get(cells);
  if (!entries) {
    entries = new Map();
    layerCache.set(cells, entries);
  }
  const hit = entries.get(key);
  if (hit) return hit;
  const built = build();
  entries.set(key, built);
  if (entries.size > LAYER_CACHE_LIMIT) {
    const oldest = entries.keys().next().value;
    if (oldest !== undefined) entries.delete(oldest);
  }
  return built;
}

const WORLD = worldBoundaries as unknown as FeatureCollection;

function coveredCollection(totals: Record<string, number>): FeatureCollection {
  const features: Feature[] = [];
  for (const feature of WORLD.features) {
    const country = countryForFeature(feature.properties as Record<string, unknown> | null);
    if (!country) continue;
    features.push({
      type: "Feature",
      properties: {
        ...(feature.properties ?? {}),
        code: country.code,
        total: totals[country.code] ?? 0,
      },
      geometry: feature.geometry,
    });
  }
  return { type: "FeatureCollection", features };
}

const WORLD_RING: Ring = [
  [-180, -85],
  [180, -85],
  [180, 85],
  [-180, 85],
  [-180, -85],
];

function signedArea(ring: Ring): number {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}

function oriented(ring: Ring, clockwise: boolean): Ring {
  const isClockwise = signedArea(ring) < 0;
  return isClockwise === clockwise ? ring : [...ring].reverse();
}

function maskForCountry(code: string | undefined): FeatureCollection {
  if (!code) return EMPTY;
  const feature = WORLD.features.find(
    (item) => countryForFeature(item.properties as Record<string, unknown> | null)?.code === code,
  );
  if (!feature || !feature.geometry) return EMPTY;
  const geometry = feature.geometry;
  const polygons =
    geometry.type === "Polygon"
      ? [geometry.coordinates]
      : geometry.type === "MultiPolygon"
        ? geometry.coordinates
        : [];
  if (polygons.length === 0) return EMPTY;
  const holes = polygons.map((polygon) => polygon[0]).filter(Boolean);
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [oriented(WORLD_RING, false), ...holes.map((ring) => oriented(ring as unknown as Ring, true))],
        },
      },
    ],
  };
}

function geometryBBox(geometry: Geometry): BBox | null {
  let minLat = 90;
  let maxLat = -90;
  let minLon = 180;
  let maxLon = -180;
  let found = false;
  const visit = (value: unknown) => {
    if (!Array.isArray(value)) return;
    if (typeof value[0] === "number" && typeof value[1] === "number") {
      found = true;
      minLon = Math.min(minLon, value[0]);
      maxLon = Math.max(maxLon, value[0]);
      minLat = Math.min(minLat, value[1]);
      maxLat = Math.max(maxLat, value[1]);
      return;
    }
    for (const child of value) visit(child);
  };
  visit((geometry as { coordinates?: unknown }).coordinates);
  return found ? { minLat, minLon, maxLat, maxLon } : null;
}

const ESRI_ATTRIBUTION =
  'Tiles © <a href="https://www.esri.com/">Esri</a> · Imagery © Esri, Maxar, Earthstar Geographics · © OpenStreetMap contributors';

const STYLE: StyleSpecification = {
  version: 8,
  projection: { type: "globe" },
  sources: {
    "basemap-dark": {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      maxzoom: 16,
      attribution: ESRI_ATTRIBUTION,
    },
    "basemap-sat": {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#0b0a09" },
    },
    { id: "basemap-dark", type: "raster", source: "basemap-dark" },
    {
      id: "basemap-sat",
      type: "raster",
      source: "basemap-sat",
      layout: { visibility: "none" },
    },
  ],
};

function ringFeature(ring: Ring): FeatureCollection<Polygon> {
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: { type: "Polygon", coordinates: [ring] },
      },
    ],
  };
}

function rectangleRing(start: [number, number], end: [number, number]): Ring {
  return [
    [start[0], start[1]],
    [end[0], start[1]],
    [end[0], end[1]],
    [start[0], end[1]],
    [start[0], start[1]],
  ];
}

function squareRing(lat: number, lon: number, size: number): Ring {
  const half = size / 2;
  return [
    [lon - half, lat - half],
    [lon + half, lat - half],
    [lon + half, lat + half],
    [lon - half, lat + half],
    [lon - half, lat - half],
  ];
}

/** The grid step of the current selection: 0.05° for published files, coarser for demo rows. */
function inferCellSize(cells: CellPoint[]): number {
  if (cells.length < 2) return 0.1;

  const axisDiffs = (values: number[]): number[] => {
    const unique = [...new Set(values.map((value) => Math.round(value * 10) / 10))].sort(
      (a, b) => a - b,
    );
    const diffs: number[] = [];
    for (let i = 1; i < unique.length; i += 1) {
      const diff = unique[i] - unique[i - 1];
      if (diff >= 0.15) diffs.push(diff);
    }
    return diffs;
  };

  const diffs = [
    ...axisDiffs(cells.map((cell) => cell.lat)),
    ...axisDiffs(cells.map((cell) => cell.lon)),
  ];
  if (diffs.length === 0) return 0.1;

  const smallest = Math.min(...diffs);
  return Math.min(3, Math.max(0.1, Math.round(smallest * 10) / 10));
}

function graticule(): FeatureCollection<LineString> {
  const features: Feature<LineString>[] = [];
  for (let lon = -180; lon <= 180; lon += 10) {
    features.push({
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: [
          [lon, -85],
          [lon, 85],
        ],
      },
    });
  }
  for (let lat = -80; lat <= 80; lat += 10) {
    features.push({
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: [
          [-180, lat],
          [180, lat],
        ],
      },
    });
  }
  return { type: "FeatureCollection", features };
}

function coordinateLabel(cell: string): string {
  const point = parseCell(cell);
  if (!point) return cell;
  const [lat, lon] = point;
  const latLabel = `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? "N" : "S"}`;
  const lonLabel = `${Math.abs(lon).toFixed(1)}°${lon >= 0 ? "E" : "W"}`;
  return `${latLabel} · ${lonLabel}`;
}

export default function RegionMap({
  selection,
  cells,
  valueScaleMax,
  cellCount,
  countryTotals,
  worldView,
  activeCountry,
  regionName,
  yearCount,
  mapYear,
  periodLabel,
  cellStep,
  measureLabel,
  busyLabel,
  onChange,
  onGlobe,
}: {
  selection: Selection;
  cells: CellPoint[];
  valueScaleMax: number;
  cellCount?: number;
  countryTotals?: Record<string, number>;
  worldView?: boolean;
  activeCountry?: string;
  regionName: string;
  yearCount: number;
  mapYear: number;
  periodLabel: string;
  cellStep?: number;
  measureLabel: string;
  busyLabel: string | null;
  onChange: (selection: Selection) => void;
  onGlobe?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<"rect" | "poly" | "pan">("pan");
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [basemap, setBasemap] = useState<"dark" | "satellite">("dark");
  const [zoomLevel, setZoomLevel] = useState(1.8);
  const [vertices, setVertices] = useState(0);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    cell: string;
    value: number;
  } | null>(null);
  const cellSize = cellStep ?? inferCellSize(cells);
  // Level of detail ladder for the drawn squares. A whole country fits at zoom
  // ~4, where 0.05° cells are sub-pixel; aggregate there, then reveal finer
  // cells as the user zooms. Very large selections (Brazil, USA, China) get an
  // extra 0.2° step so playback stays smooth; smaller ones keep 0.1°.
  // Display-only: totals never change.
  const selectionCells = cellCount ?? cells.length;
  const lodStep =
    cellSize < 0.075 && zoomLevel < 7
      ? selectionCells > 120_000 && zoomLevel < 5
        ? 0.2
        : 0.1
      : null;

  const modeRef = useRef(mode);
  const draggingRef = useRef<{ start: [number, number]; current: [number, number] } | null>(null);
  const polygonRef = useRef<Ring>([]);
  const onChangeRef = useRef(onChange);
  const selectionRef = useRef<Selection>(selection);
  const hoverCellRef = useRef<string | null>(null);
  const clockRef = useRef<HTMLSpanElement | null>(null);
  const cursorRef = useRef<HTMLSpanElement | null>(null);
  const zoomRef = useRef<HTMLSpanElement | null>(null);
  const lastBasemapRef = useRef<"dark" | "satellite">("dark");
  const worldViewRef = useRef(Boolean(worldView));

  modeRef.current = mode;
  onChangeRef.current = onChange;
  selectionRef.current = selection;
  worldViewRef.current = Boolean(worldView);

  const currentRing = (): Ring =>
    selectionRef.current.polygon && selectionRef.current.polygon.length >= 3
      ? selectionRef.current.polygon
      : bboxRing(selectionRef.current.bbox);

  const setFeature = (ring: Ring | null) => {
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource("region") as unknown as SourceLike | undefined;
    if (!source) return;
    source.setData(ring ? ringFeature(ring) : EMPTY);
  };

  const cancelDrawing = () => {
    draggingRef.current = null;
    polygonRef.current = [];
    setVertices(0);
    setFeature(currentRing());
  };

  const finishPolygon = () => {
    const vertices = [...polygonRef.current];
    if (vertices.length >= 2) {
      const last = vertices[vertices.length - 1];
      const previous = vertices[vertices.length - 2];
      if (Math.hypot(last[0] - previous[0], last[1] - previous[1]) < 1e-7) {
        vertices.pop();
      }
    }
    if (vertices.length < 3) {
      cancelDrawing();
      return;
    }
    const ring: Ring = [...vertices, vertices[0]];
    polygonRef.current = [];
    setVertices(0);
    onChangeRef.current({ bbox: ringBBox(ring), polygon: ring });
    setMode("pan");
  };

  const flyToBBox = (bbox: BBox, duration = 1100) => {
    const map = mapRef.current;
    if (!map) return;
    const camera = map.cameraForBounds(
      [
        [bbox.minLon, bbox.minLat],
        [bbox.maxLon, bbox.maxLat],
      ],
      { padding: 72, maxZoom: 8.5 },
    );
    if (!camera?.center || camera.zoom === undefined) return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    map.flyTo({
      center: camera.center,
      zoom: camera.zoom,
      bearing: 0,
      pitch: 0,
      duration: reduced ? 0 : duration,
      curve: 1.32,
      essential: true,
    });
  };

  const fitSelection = () => flyToBBox(selectionRef.current.bbox);

  const globeView = () => {
    const map = mapRef.current;
    if (!map) return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    map.flyTo({
      center: [-60, -6],
      zoom: 1.75,
      bearing: 0,
      pitch: 0,
      duration: reduced ? 0 : 1200,
      curve: 1.32,
      essential: true,
    });
  };

  const goHome = () => {
    onGlobe?.();
    globeView();
  };

  const finishPolygonRef = useRef(finishPolygon);
  finishPolygonRef.current = finishPolygon;
  const cancelDrawingRef = useRef(cancelDrawing);
  cancelDrawingRef.current = cancelDrawing;

  useEffect(() => {
    const tick = () => {
      if (clockRef.current) {
        clockRef.current.textContent = new Date().toISOString().slice(11, 19);
      }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Google-Earth-style keyboard shortcuts. Inputs/selects keep their keys.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        target?.matches("input, select, textarea, [contenteditable='true']")
      ) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "g") {
        event.preventDefault();
        goHome();
      } else if (key === "f") {
        event.preventDefault();
        fitSelection();
      } else if (key === "r") {
        event.preventDefault();
        mapRef.current?.easeTo({ bearing: 0, pitch: 0, duration: 450, essential: true });
      } else if (key === "?" || (event.shiftKey && key === "/")) {
        event.preventDefault();
        setShortcutsOpen((open) => !open);
      } else if (key === "1") {
        setMode("pan");
      } else if (key === "2") {
        setMode("rect");
      } else if (key === "3") {
        setMode("poly");
      } else if (event.key === "Escape") {
        cancelDrawingRef.current();
        setMode("pan");
        setShortcutsOpen(false);
      } else if (event.key === "Enter" && modeRef.current === "poly") {
        finishPolygonRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // The callbacks read the latest refs; the effect only needs the listeners.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    setWorkerUrl(new URL("/maplibre/worker.js", window.location.origin).href);

    const map = new MapLibreMap({
      container: containerRef.current,
      style: STYLE,
      center: [0, 8],
      zoom: 1.5,
      minZoom: 1.2,
      maxZoom: 14,
      maxPitch: 85,
      pitchWithRotate: true,
      attributionControl: false,
      renderWorldCopies: false,
      maxBounds: MAP_MAX_BOUNDS,
      canvasContextAttributes: { preserveDrawingBuffer: true },
    });
    mapRef.current = map;
    map.getCanvas().setAttribute(
      "aria-label",
      "Interactive world map. Drag to pan, scroll to zoom, right-drag or ctrl-drag to tilt.",
    );

    map.addControl(
      new NavigationControl({ showCompass: true, visualizePitch: true }),
      "top-right",
    );
    map.addControl(new FullscreenControl({}), "top-right");
    map.addControl(new ScaleControl({ maxWidth: 90, unit: "metric" }), "bottom-right");
    map.addControl(new AttributionControl({ compact: true }), "bottom-right");

    // Google-Earth-like gestures: pan inertia is on by default; make rotate
    // and tilt explicit for mouse, trackpad and touch.
    map.dragRotate.enable({ around: "pointer" });
    map.touchZoomRotate.enable();
    map.touchZoomRotate.enableRotation();
    map.touchPitch.enable();

    map.once("style.load", () => {
      map.addSource("graticule", { type: "geojson", data: graticule() });
      map.addLayer({
        id: "graticule",
        type: "line",
        source: "graticule",
        paint: {
          "line-color": "#7cc7c0",
          "line-width": 0.5,
          "line-opacity": 0.09,
          "line-dasharray": [2, 8],
        },
      });

      // Global context: all countries in a faint fill, then the published
      // countries highlighted with their annual total (choropleth when the
      // whole world is selected).
      map.addSource("world", {
        type: "geojson",
        data: worldBoundaries as FeatureCollection,
      });
      map.addSource("covered", {
        type: "geojson",
        data: coveredCollection(countryTotals ?? {}),
      });
      map.addLayer({
        id: "world-fill",
        type: "fill",
        source: "world",
        paint: { "fill-color": "#080706", "fill-opacity": 0.26 },
      });
      map.addLayer({
        id: "world-line",
        type: "line",
        source: "world",
        paint: {
          "line-color": "#7cc7c0",
          "line-width": 0.5,
          "line-opacity": 0.14,
        },
      });
      map.addLayer({
        id: "covered-fill",
        type: "fill",
        source: "covered",
        paint: {
          "fill-color": [
            "interpolate",
            ["linear"],
            ["sqrt", ["get", "total"]],
            0,
            "#2a1e5c",
            10,
            "#3e4989",
            40,
            "#26828e",
            120,
            "#35b779",
            300,
            "#b5de2b",
          ],
          "fill-opacity": 0.18,
        },
      });
      map.addLayer({
        id: "covered-line",
        type: "line",
        source: "covered",
        paint: {
          "line-color": "#6fd6d0",
          "line-width": 1.1,
          "line-opacity": 0.8,
        },
      });
      map.addSource("adm1", { type: "geojson", data: EMPTY });
      map.addLayer({
        id: "adm1-line",
        type: "line",
        source: "adm1",
        paint: {
          "line-color": "#7cc7c0",
          "line-width": 0.8,
          "line-opacity": ["interpolate", ["linear"], ["zoom"], 3, 0, 5, 0.55],
        },
      });

      map.addSource("region", { type: "geojson", data: EMPTY });
      map.addLayer({
        id: "region-fill",
        type: "fill",
        source: "region",
        paint: { "fill-color": "#ff6b3d", "fill-opacity": 0.08 },
      });

      map.addSource("country-mask", { type: "geojson", data: EMPTY });
      map.addSource("cells", { type: "geojson", data: EMPTY });
      map.addLayer({
        id: "cells-fill",
        type: "fill",
        source: "cells",
        paint: {
          "fill-color": [
            "interpolate",
            ["linear"],
            ["get", "t"],
            0,
            "#2a1e5c",
            0.22,
            "#3e4989",
            0.42,
            "#26828e",
            0.62,
            "#35b779",
            0.82,
            "#b5de2b",
            1,
            "#fde725",
          ],
          // Value drives saturation; zoom fades the wash so imagery stays
          // readable once a single 0.05° cell fills the viewport.
          "fill-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            6,
            ["interpolate", ["linear"], ["get", "t"], 0, 0.26, 0.45, 0.55, 1, 0.9],
            10.5,
            ["interpolate", ["linear"], ["get", "t"], 0, 0.11, 0.45, 0.23, 1, 0.38],
          ],
        },
      });
      map.addLayer({
        id: "cells-line",
        type: "line",
        source: "cells",
        paint: {
          "line-color": "#0a0a08",
          "line-width": ["interpolate", ["linear"], ["zoom"], 6, 0.4, 11, 1.2],
          "line-opacity": ["interpolate", ["linear"], ["zoom"], 4.5, 0, 6, 0.22, 9, 0.62],
        },
      });
      // Clip cell squares to the selected country so 0.1°/0.05° squares do not
      // spill over the coastline or into neighbouring countries (Alaska).
      map.addLayer({
        id: "country-mask",
        type: "fill",
        source: "country-mask",
        paint: { "fill-color": "#080706", "fill-opacity": 0.64 },
      });

      map.addLayer({
        id: "region-line",
        type: "line",
        source: "region",
        paint: { "line-color": "#ff6b3d", "line-width": 1.8 },
      });

      // Country selection on the globe (pan mode keeps drawing modes intact).
      map.on("mousemove", "world-fill", () => {
        if (worldViewRef.current && modeRef.current === "pan") {
          map.getCanvas().style.cursor = "pointer";
        }
      });
      map.on("mouseleave", "world-fill", () => {
        if (modeRef.current === "pan") map.getCanvas().style.cursor = "grab";
      });
      map.on("click", "world-fill", (event) => {
        if (!worldViewRef.current || modeRef.current !== "pan") return;
        const country = countryForFeature(
          (event.features?.[0]?.properties ?? null) as Record<string, unknown> | null,
        );
        if (!country) return;
        onChangeRef.current({
          bbox: country.viewBbox,
          allCellsFor: country.code,
          country: country.code,
          label: country.name,
        });
      });

      map.on("mousemove", "cells-fill", (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        const cell = String(feature.properties?.cell ?? "");
        if (!cell || cell === hoverCellRef.current) return;
        hoverCellRef.current = cell;
        const value = Number(feature.properties?.value ?? 0);
        const width = map.getCanvas().clientWidth;
        const height = map.getCanvas().clientHeight;
        setTooltip({
          x: Math.min(event.point.x, width - 200),
          y: Math.min(Math.max(event.point.y, 70), height - 70),
          cell,
          value,
        });
        if (modeRef.current === "pan") map.getCanvas().style.cursor = "pointer";
      });

      map.on("mouseleave", "cells-fill", () => {
        hoverCellRef.current = null;
        setTooltip(null);
        map.getCanvas().style.cursor = modeRef.current === "pan" ? "grab" : "crosshair";
      });

      // Tabs and click-to-inspect on touch (hover does not exist there).
      map.on("click", "cells-fill", (event) => {
        if (modeRef.current !== "pan") return;
        const feature = event.features?.[0];
        if (!feature) return;
        const cell = String(feature.properties?.cell ?? "");
        if (!cell) return;
        const value = Number(feature.properties?.value ?? 0);
        const width = map.getCanvas().clientWidth;
        const height = map.getCanvas().clientHeight;
        setTooltip({
          x: Math.min(event.point.x, width - 200),
          y: Math.min(Math.max(event.point.y, 70), height - 70),
          cell,
          value,
        });
      });

      map.on("movestart", () => {
        hoverCellRef.current = null;
        setTooltip(null);
      });

      setReady(true);
    });

    map.on("mousemove", (event) => {
      if (cursorRef.current) {
        cursorRef.current.textContent = `${event.lngLat.lat.toFixed(2)}°, ${event.lngLat.lng.toFixed(2)}°`;
      }
    });

    map.on("zoom", () => {
      const nextZoom = Math.round(map.getZoom() * 10) / 10;
      setZoomLevel((current) => (current === nextZoom ? current : nextZoom));
      if (zoomRef.current) {
        zoomRef.current.textContent = map.getZoom().toFixed(2);
      }
    });

    map.on("mousedown", (event) => {
      if (modeRef.current !== "rect" || event.originalEvent.button !== 0) return;
      const point: [number, number] = [event.lngLat.lng, event.lngLat.lat];
      draggingRef.current = { start: point, current: point };
      map.getCanvas().style.cursor = "crosshair";
    });

    map.on("mousemove", (event) => {
      const drag = draggingRef.current;
      if (!drag) return;
      drag.current = [event.lngLat.lng, event.lngLat.lat];
      setFeature(rectangleRing(drag.start, drag.current));
    });

    map.on("click", (event) => {
      if (modeRef.current !== "poly" || draggingRef.current) return;
      const vertex: [number, number] = [event.lngLat.lng, event.lngLat.lat];
      const next = [...polygonRef.current, vertex];
      polygonRef.current = next;
      setVertices(next.length);
      setFeature(next.length >= 3 ? [...next, next[0]] : null);
    });

    map.on("dblclick", () => {
      if (modeRef.current === "poly") finishPolygonRef.current();
    });

    const stopDrag = () => {
      const drag = draggingRef.current;
      draggingRef.current = null;
      map.getCanvas().style.cursor = modeRef.current === "pan" ? "grab" : "crosshair";
      if (!drag) return;
      const ring = rectangleRing(drag.start, drag.current);
      const bbox = ringBBox(ring);
      if (bbox.maxLat - bbox.minLat < 0.2 || bbox.maxLon - bbox.minLon < 0.2) {
        setFeature(currentRing());
        return;
      }
      onChangeRef.current({ bbox });
      setMode("pan");
    };

    map.on("touchstart", (event) => {
      if (modeRef.current !== "rect" || event.points.length !== 1) return;
      event.preventDefault();
      const point: [number, number] = [event.lngLat.lng, event.lngLat.lat];
      draggingRef.current = { start: point, current: point };
    });

    map.on("touchmove", (event) => {
      const drag = draggingRef.current;
      if (!drag || modeRef.current !== "rect") return;
      event.preventDefault();
      drag.current = [event.lngLat.lng, event.lngLat.lat];
      setFeature(rectangleRing(drag.start, drag.current));
    });

    map.on("touchend", () => {
      if (draggingRef.current) stopDrag();
    });

    window.addEventListener("mouseup", stopDrag);
    map.getCanvas().style.cursor = "grab";

    return () => {
      window.removeEventListener("mouseup", stopDrag);
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, []);

  // Basemap swap keeps both sources warm; only visibility changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || lastBasemapRef.current === basemap) return;
    lastBasemapRef.current = basemap;
    let cancelled = false;

    const applyBasemap = () => {
      if (cancelled) return;
      if (!map.isStyleLoaded() || !map.getLayer("basemap-sat")) {
        map.once("idle", applyBasemap);
        return;
      }
      try {
        // Keep the dark layer underneath satellite tiles for attribution and a
        // nonblank transition frame.
        map.setLayoutProperty("basemap-dark", "visibility", "visible");
        map.setLayoutProperty(
          "basemap-sat",
          "visibility",
          basemap === "satellite" ? "visible" : "none",
        );
      } catch {
        // MapLibre can briefly mark the style unloaded during dev hot refresh;
        // wait for the next idle frame instead of throwing into React.
        map.once("idle", applyBasemap);
      }
    };

    applyBasemap();
    return () => {
      cancelled = true;
      map.off("idle", applyBasemap);
    };
  }, [basemap, ready]);

  // Selection coming from presets, the bbox form or a finished drawing.
  useEffect(() => {
    if (!ready) return;
    const ring =
      selection.polygon && selection.polygon.length >= 3
        ? selection.polygon
        : bboxRing(selection.bbox);
    setFeature(ring);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, selection]);

  // Cell squares for the current selection.
  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource("cells") as unknown as SourceLike | undefined;
    if (!source) return;

    hoverCellRef.current = null;
    setTooltip(null);

    const values = cells.map((point) => point.value).sort((a, b) => a - b);
    const p98 = values.length
      ? values[Math.min(values.length - 1, Math.floor(values.length * 0.98))]
      : 1;
    const max = Math.max(1, valueScaleMax || p98);
    const size = lodStep ?? cellStep ?? inferCellSize(cells);

    // Precision follows zoom: 0.05° cells at country zoom would be tens of
    // thousands of sub-pixel polygons. Aggregate to 0.2°/0.1° until the user
    // zooms in, then reveal the full 0.05° support.
    const key = `${size}:${max}`;
    const collection = cachedLayer(cells, key, () => {
      let features: Feature<Polygon>[];
      if (lodStep) {
        const grouped = new Map<string, { lat: number; lon: number; value: number }>();
        for (const point of cells) {
          if (point.value <= 0) continue;
          const lat = Math.round(point.lat / lodStep) * lodStep;
          const lon = Math.round(point.lon / lodStep) * lodStep;
          const cellKey = `${lat.toFixed(2)}_${lon.toFixed(2)}`;
          const entry = grouped.get(cellKey);
          if (entry) entry.value += point.value;
          else grouped.set(cellKey, { lat, lon, value: point.value });
        }
        features = [...grouped.entries()].map(([cell, point]) => ({
          type: "Feature",
          properties: {
            cell,
            value: point.value,
            t: Math.sqrt(Math.max(0, point.value) / max),
          },
          geometry: { type: "Polygon", coordinates: [squareRing(point.lat, point.lon, size)] },
        }));
      } else {
        features = cells.filter((point) => point.value > 0).map((point) => ({
          type: "Feature",
          properties: {
            cell: point.cell,
            value: point.value,
            t: Math.sqrt(Math.max(0, point.value) / max),
          },
          geometry: { type: "Polygon", coordinates: [squareRing(point.lat, point.lon, size)] },
        }));
      }
      return { type: "FeatureCollection", features };
    });

    source.setData(collection);
  }, [ready, cells, cellStep, valueScaleMax, lodStep]);

  // Choropleth: annual totals for the published countries.
  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    const source = map?.getSource("covered") as unknown as SourceLike | undefined;
    source?.setData(coveredCollection(countryTotals ?? {}));
  }, [ready, countryTotals]);

  useEffect(() => {
    if (!ready) return;
    const source = mapRef.current?.getSource("country-mask") as unknown as SourceLike | undefined;
    source?.setData(worldView ? EMPTY : maskForCountry(activeCountry));
  }, [ready, worldView, activeCountry]);

  useEffect(() => {
    if (!ready) return;
    mapRef.current?.setPaintProperty("covered-fill", "fill-opacity", worldView ? 0.6 : 0.16);
    for (const layer of ["region-fill", "region-line"]) {
      mapRef.current?.setLayoutProperty(layer, "visibility", worldView ? "none" : "visible");
    }
  }, [ready, worldView]);

  // Administrative boundaries for the active country, loaded on demand.
  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    const source = map?.getSource("adm1") as unknown as SourceLike | undefined;
    const country = activeCountry ? COUNTRY_BY_CODE.get(activeCountry) : undefined;
    if (!source || !country) {
      source?.setData(EMPTY);
      return;
    }
    let cancelled = false;
    fetch(`${DATA_BASE}/boundaries/${country.boundary}`)
      .then((response) => (response.ok ? response.json() : EMPTY))
      .then((data: GeoJSONData) => {
        if (!cancelled) source.setData(data);
      })
      .catch(() => {
        if (!cancelled) source.setData(EMPTY);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, activeCountry]);

  // Click a first-level region to select it.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !activeCountry) return;
    const handler = (event: MapLayerMouseEvent) => {
      if (modeRef.current !== "pan") return;
      const feature = event.features?.[0];
      if (!feature || !feature.geometry) return;
      const bbox = geometryBBox(feature.geometry as Geometry);
      if (!bbox) return;
      const name = String(feature.properties?.shapeName ?? feature.properties?.name ?? "Region");
      onChangeRef.current({ bbox, label: name, country: activeCountry });
    };
    const enter = () => {
      if (modeRef.current === "pan") map.getCanvas().style.cursor = "pointer";
    };
    const leave = () => {
      if (modeRef.current === "pan") map.getCanvas().style.cursor = "grab";
    };
    map.on("click", "adm1-line", handler);
    map.on("mousemove", "adm1-line", enter);
    map.on("mouseleave", "adm1-line", leave);
    return () => {
      map.off("click", "adm1-line", handler);
      map.off("mousemove", "adm1-line", enter);
      map.off("mouseleave", "adm1-line", leave);
    };
  }, [ready, activeCountry]);

  // Fit once per externally-set region. World view keeps a globe framing
  // centred on the Americas instead of fitting the whole antimeridian.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (worldView) {
      globeView();
      return;
    }
    flyToBBox(selection.bbox);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, worldView, selection.bbox.minLat, selection.bbox.minLon, selection.bbox.maxLat, selection.bbox.maxLon]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    cancelDrawing();
    setTooltip(null);
    if (mode === "rect") {
      map.dragPan.disable();
      map.doubleClickZoom.enable();
    } else if (mode === "poly") {
      map.dragPan.enable();
      map.doubleClickZoom.disable();
    } else {
      map.dragPan.enable();
      map.doubleClickZoom.enable();
    }
    map.getCanvas().style.cursor = mode === "pan" ? "grab" : "crosshair";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const hint =
    mode === "rect"
      ? worldView
        ? "Switch to Pan to click a country, or drag a box"
        : "Drag to draw a box"
      : mode === "poly"
        ? vertices > 0
          ? `${vertices} point${vertices === 1 ? "" : "s"} · double-click or Enter to close`
          : "Click to add points · Esc to cancel"
        : worldView
          ? "Click a country · drag to orbit · scroll to zoom · right-drag to tilt"
          : "Drag to explore · scroll to zoom · right-drag to tilt · double-click to zoom";

  return (
    <div className="map-console">
      <div className="console-head">
        <div className="console-id">
          <span className="console-status">
            <span className="console-dot" aria-hidden="true" />
            Grid link
          </span>
          <span className="console-name">{regionName}</span>
        </div>
        <div className="console-readout">
          <span>
            <b>{busyLabel ? "—" : formatCount(cellCount ?? cells.length)}</b> cells
          </span>
          <span className="console-grid">
            <b>{cellSize.toFixed(cellSize < 0.1 ? 2 : 1)}°</b> grid
          </span>
          <span>
            <b>{mapYear}</b> map year
          </span>
          <span>
            <b>{yearCount}</b> yrs
          </span>
          <span className="console-clock">
            UTC <span ref={clockRef}>--:--:--</span>
          </span>
        </div>
      </div>

      <div className="console-tools">
        <div className="tool-group" role="group" aria-label="Map mode">
          <button
            type="button"
            className={mode === "pan" ? "tool-btn is-active" : "tool-btn"}
            aria-pressed={mode === "pan"}
            aria-keyshortcuts="1"
            onClick={() => setMode("pan")}
            title="Pan and explore (1)"
          >
            Pan
          </button>
          <button
            type="button"
            className={mode === "rect" ? "tool-btn is-active" : "tool-btn"}
            aria-pressed={mode === "rect"}
            aria-keyshortcuts="2"
            onClick={() => setMode("rect")}
            title="Draw a rectangular area (2)"
          >
            Box
          </button>
          <button
            type="button"
            className={mode === "poly" ? "tool-btn is-active" : "tool-btn"}
            aria-pressed={mode === "poly"}
            aria-keyshortcuts="3"
            onClick={() => setMode("poly")}
            title="Draw a polygon (3)"
          >
            Polygon
          </button>
        </div>

        <button
          type="button"
          className="tool-btn"
          onClick={fitSelection}
          title="Fit the selection (F)"
          aria-keyshortcuts="f"
        >
          Fit
        </button>
        <button
          type="button"
          className="tool-btn"
          onClick={goHome}
          title="Back to the globe (G)"
          aria-keyshortcuts="g"
        >
          Globe
        </button>
        <button
          type="button"
          className={shortcutsOpen ? "tool-btn is-active" : "tool-btn"}
          onClick={() => setShortcutsOpen((open) => !open)}
          aria-expanded={shortcutsOpen}
          title="Keyboard and map shortcuts (?)"
          aria-keyshortcuts="?"
        >
          ?
        </button>

        <label className="console-zoom-control">
          <span>Zoom</span>
          <input
            type="range"
            min="1.4"
            max="14"
            step="0.1"
            value={Math.min(14, Math.max(1.4, zoomLevel))}
            aria-label="Map zoom level"
            aria-valuetext={`Zoom ${zoomLevel.toFixed(1)}`}
            onChange={(event) => {
              const nextZoom = Number(event.target.value);
              setZoomLevel(nextZoom);
              const reduced =
                typeof window !== "undefined" &&
                window.matchMedia("(prefers-reduced-motion: reduce)").matches;
              mapRef.current?.easeTo({
                zoom: nextZoom,
                duration: reduced ? 0 : 180,
                essential: true,
              });
            }}
          />
          <span className="console-zoom-value">{zoomLevel.toFixed(1)}</span>
        </label>

        <div className="tool-group" role="group" aria-label="Basemap">
          <button
            type="button"
            className={basemap === "dark" ? "tool-btn is-active" : "tool-btn"}
            aria-pressed={basemap === "dark"}
            onClick={() => setBasemap("dark")}
          >
            Dark
          </button>
          <button
            type="button"
            className={basemap === "satellite" ? "tool-btn is-active" : "tool-btn"}
            aria-pressed={basemap === "satellite"}
            onClick={() => setBasemap("satellite")}
            title="Satellite imagery"
          >
            Sat
          </button>
        </div>

        <span className="console-hint">{hint}</span>

        {mode === "poly" && vertices > 0 ? (
          <div className="tool-actions">
            <button type="button" className="tool-btn is-primary" onClick={finishPolygon}>
              Finish
            </button>
            <button type="button" className="tool-btn" onClick={cancelDrawing}>
              Cancel
            </button>
          </div>
        ) : null}
      </div>

      <div className="map-shell">
        <div ref={containerRef} className="map-canvas" />

        {!ready ? (
          <div className="map-basemap-loading" role="status">
            <span className="spinner" aria-hidden="true" />
            Loading basemap…
          </div>
        ) : null}

        {busyLabel ? (
          <div className="map-overlay" role="status">
            <span className="spinner" aria-hidden="true" />
            {busyLabel}
          </div>
        ) : null}

        <div className="map-scan" aria-hidden="true" />

        {shortcutsOpen ? (
          <aside className="map-shortcuts" aria-label="Map shortcuts">
            <div className="map-shortcuts-head">
              <strong>Map controls</strong>
              <button type="button" onClick={() => setShortcutsOpen(false)} aria-label="Close shortcuts">
                ×
              </button>
            </div>
            <dl>
              <div><dt>Drag</dt><dd>Pan / orbit</dd></div>
              <div><dt>Scroll</dt><dd>Zoom at cursor</dd></div>
              <div><dt>Right-drag</dt><dd>Tilt and rotate</dd></div>
              <div><dt>Double-click</dt><dd>Zoom in</dd></div>
              <div><dt>Pan</dt><dd>Click a country to drill in</dd></div>
              <div><dt>1 / 2 / 3</dt><dd>Pan / box / polygon</dd></div>
              <div><dt>F / G</dt><dd>Fit selection / globe</dd></div>
              <div><dt>R</dt><dd>Reset north and tilt</dd></div>
              <div><dt>Esc</dt><dd>Cancel drawing</dd></div>
            </dl>
          </aside>
        ) : null}

        {tooltip ? (
          <div
            className="map-tooltip"
            style={{ left: tooltip.x, top: tooltip.y }}
            aria-hidden="true"
          >
            <span className="map-tooltip-cell">{coordinateLabel(tooltip.cell)}</span>
            <span className="map-tooltip-value">
              {formatCompact(tooltip.value)} {measureLabel} · {periodLabel}
            </span>
          </div>
        ) : null}
      </div>

      <div className="console-foot">
        <span className="console-region">{regionName}</span>
        <span className="console-bbox">{bboxLabel(selection.bbox)}</span>
        <span className="console-legend" aria-hidden="true">
          <span>low</span>
          <span className="console-legend-bar" />
          <span>high</span>
        </span>
        <span className="console-cursor">
          <span ref={cursorRef}>—°, —°</span>
          <span className="console-zoom">
            z<span ref={zoomRef}>—</span>
          </span>
        </span>
      </div>
    </div>
  );
}
