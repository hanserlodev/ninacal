/** Shared types. They mirror the contracts in data/schemas/ and docs/data-dictionary.md. */

export type Row = {
  cell: string;
  y: number;
  m: number;
  modis: number | null;
  terra?: number | null;
  viirs: number | null;
  noaa20?: number | null;
  harm: number | null;
  source?: string;
};

export type BBox = {
  minLat: number;
  minLon: number;
  maxLat: number;
  maxLon: number;
};

/** A polygon ring as [lon, lat] pairs, closed (first === last). */
export type Ring = [number, number][];

export type Selection = {
  bbox: BBox;
  polygon?: Ring;
  /** Whole-country selection includes all published cells, including border anchors. */
  allCellsFor?: DataCountry;
  /** Country that owns the selection (for administrative outlines and labels). */
  country?: DataCountry;
  /** Countries requested when the selection spans more than one (world view). */
  countries?: DataCountry[];
  /** Human label for a selected country or administrative region. */
  label?: string;
};

export type Region = {
  id: string;
  name: string;
  detail: string;
  bbox: BBox;
  allCellsFor?: DataCountry;
  countries?: DataCountry[];
  label?: string;
};

export type Manifest = {
  generated_at: string;
  years: number[];
  calibration: boolean;
};

export type CalibrationPoint = {
  observed: number;
  predicted: number;
  y?: number;
  m?: number;
};

export type Calibration = {
  generated_at: string;
  products: { baseline: string; target: string };
  method: "ratio" | "regression" | "quantile";
  train: [number, number];
  test: [number, number];
  metrics: { r2: number; rmse: number; n: number };
  by_month: Record<string, number>;
  /** Optional cell-month pairs for the observed-vs-predicted scatter. */
  points?: CalibrationPoint[];
};

export type MonthPoint = {
  y: number;
  m: number;
  value: number | null;
};

export type Aggregated = {
  years: number[];
  /** totals[yearIndex][monthIndex] — null when nothing was measured that month. */
  totals: (number | null)[][];
  /** Source label per year/month (e.g. aqua_estimated, snpp_observed). */
  sources: (string | null)[][];
  annual: { y: number; value: number }[];
  cellCount: number;
  /** Sum of harm per cell anchor, for the map layer. */
  cellTotals: Map<string, number>;
  rowCount: number;
  missing: number;
  sum: number;
  peak: { y: number; m: number; value: number } | null;
  latest: { y: number; m: number; value: number } | null;
};

/** FIRMS/backend country code (PE, US, BR, ...). The pipeline can add more. */
export type DataCountry = string;

export type V2Manifest = {
  schema_version: number;
  publication_status: string;
  interval_status: string;
  interval_limit: string;
  scale: string;
  resolution_degrees: number;
  cell_location: string;
  time_basis: string;
  countries: Record<
    DataCountry,
    {
      cells: number;
      chosen: string;
      files: { year: number; path: string; rows: number; bytes: number }[];
      availability: { year: number; month: number; source: string }[];
    }
  >;
};

export type V2CountryMetadata = {
  country: DataCountry;
  name: string;
  calibration: {
    model: { name: string; country_ratio: number; training_supported_cells: number; cells: number };
    fit_years: [number, number];
  };
  models: {
    chosen: string;
    temporal_cv_selected_model?: {
      country?: { wape_pct: number; bias_pct: number; rmse: number; n: number };
    };
    retrospective_2021_2022?: {
      country?: { wape_pct: number; bias_pct: number; rmse: number; n: number };
    };
    retrospective_2022?: {
      country?: { wape_pct: number; bias_pct: number; rmse: number; n: number };
    };
  };
};

export type Stats = {
  values: number[];
  median: number;
  mad: number;
  z: number;
  percentile: number;
  min: number;
  max: number;
};
