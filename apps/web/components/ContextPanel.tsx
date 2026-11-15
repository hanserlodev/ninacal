"use client";

import { useEffect, useState } from "react";
import { DATA_BASE } from "@/lib/api";

type Context = {
  landcover?: {
    collection?: string;
    year?: number;
    classes?: Record<string, number>;
  };
  burned_area?: {
    year?: number;
    area_km2?: number | null;
  };
};

const LABELS: Record<string, string> = {
  trees: "Trees",
  rangeland: "Rangeland",
  crops: "Crops",
  water: "Water",
  built_area: "Built",
  bare_ground: "Bare",
  flooded_vegetation: "Flooded",
  snow_ice: "Snow/ice",
  clouds: "Clouds",
  shrubland: "Shrub",
  grassland: "Grass",
  bare_sparse: "Bare/sparse",
  wetland: "Wetland",
  mangroves: "Mangroves",
  moss_lichen: "Moss",
};

export default function ContextPanel({ code, year }: { code?: string; year: number }) {
  const [data, setData] = useState<Context | null>(null);

  useEffect(() => {
    if (!code) {
      setData(null);
      return;
    }
    let alive = true;
    setData(null);
    fetch(`${DATA_BASE}/context/${code}-${year}.json`, { cache: "force-cache" })
      .then((response) => (response.ok ? (response.json() as Promise<Context>) : null))
      .then((value) => {
        if (alive) setData(value);
      })
      .catch(() => {
        if (alive) setData(null);
      });
    return () => {
      alive = false;
    };
  }, [code, year]);

  if (!data?.landcover?.classes) return null;
  const classes = Object.entries(data.landcover.classes)
    .filter(([, share]) => share > 0.0005)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const burned = data.burned_area?.area_km2;

  return (
    <section className="mc-panel">
      <header className="mc-panel-head">
        <span className="mc-code">CTX</span>
        <h2>Land context</h2>
        <span className="mc-head-meta">{data.landcover.year ?? year}</span>
      </header>
      <ul className="mc-context-bars">
        {classes.map(([key, share]) => (
          <li className="mc-context-bar" key={key}>
            <span>{LABELS[key] ?? key.replaceAll("_", " ")}</span>
            <span className="mc-context-track" aria-hidden="true">
              <i style={{ width: `${Math.max(2, Math.round(share * 100))}%` }} />
            </span>
            <b>{Math.round(share * 100)}%</b>
          </li>
        ))}
      </ul>
      {burned != null ? (
        <p className="mc-context-burned">
          <strong>{Math.round(burned).toLocaleString("en-US")} km²</strong> burned area
          <span>MODIS MCD64A1 · {data.burned_area?.year ?? year}</span>
        </p>
      ) : null}
      <p className="mc-note">
        Planetary Computer context for this country box. Not a hotspot count and not burned-area
        validation of NinaCal.
      </p>
    </section>
  );
}
