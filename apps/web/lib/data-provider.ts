import type { GridMatcher } from "./aggregate";
import {
  loadV2Manifest,
  loadV2Metadata,
  loadV2Selection,
  v2Years,
} from "./data-v2";
import type { DataCountry, V2Manifest } from "./types";
import type { LoadProgress } from "./data";

/**
 * Stable frontend/data seam. The current provider reads the editable static
 * v2 bundle; the analyst's API can implement this contract later without
 * changing map, charts or controls.
 */
export interface ExplorerDataProvider {
  readonly id: string;
  loadManifest(): Promise<V2Manifest | null>;
  getYears(manifest: V2Manifest): number[];
  loadMetadata(countries: DataCountry[], signal?: AbortSignal): ReturnType<typeof loadV2Metadata>;
  loadSelection(
    manifest: V2Manifest,
    countries: DataCountry[],
    years: number[],
    match: GridMatcher,
    signal: AbortSignal,
    onProgress?: (progress: LoadProgress) => void,
  ): ReturnType<typeof loadV2Selection>;
}

export const staticV2Provider: ExplorerDataProvider = {
  id: "static-v2",
  loadManifest: loadV2Manifest,
  getYears: v2Years,
  loadMetadata: loadV2Metadata,
  loadSelection: loadV2Selection,
};
