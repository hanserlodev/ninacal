"use client";

import { useEffect, useState } from "react";
import type { BBox } from "@/lib/types";

type Weather = {
  date: string;
  tMaxC: number | null;
  tMinC: number | null;
  humidityPct: number | null;
  windKmh: number | null;
  precipMm: number | null;
  source?: string;
};

const WEATHER_API = process.env.NEXT_PUBLIC_WEATHER_API ?? "";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function value(value: number | null | undefined, suffix: string): string {
  return typeof value === "number" && Number.isFinite(value) ? `${Math.round(value * 10) / 10}${suffix}` : "—";
}

export default function WeatherPanel({
  bbox,
  year,
  peakMonth,
  hidden,
}: {
  bbox: BBox;
  year: number;
  peakMonth?: number | null;
  hidden?: boolean;
}) {
  const month = peakMonth && peakMonth >= 1 && peakMonth <= 12 ? peakMonth : 9;
  const [date, setDate] = useState(`${year}-${pad(month)}-15`);
  const [data, setData] = useState<Weather | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  useEffect(() => {
    setDate(`${year}-${pad(month)}-15`);
  }, [year, month]);

  const lat = ((bbox.minLat + bbox.maxLat) / 2).toFixed(3);
  const lon = ((bbox.minLon + bbox.maxLon) / 2).toFixed(3);

  useEffect(() => {
    if (!WEATHER_API || hidden) return;
    let alive = true;
    setStatus("loading");
    fetch(`${WEATHER_API}?lat=${lat}&lon=${lon}&date=${date}`)
      .then((response) => (response.ok ? (response.json() as Promise<Weather>) : Promise.reject()))
      .then((payload) => {
        if (!alive) return;
        setData(payload);
        setStatus("idle");
      })
      .catch(() => {
        if (!alive) return;
        setData(null);
        setStatus("error");
      });
    return () => {
      alive = false;
    };
  }, [date, lat, lon, hidden]);

  if (!WEATHER_API || hidden) return null;

  return (
    <section className="mc-panel">
      <header className="mc-panel-head">
        <span className="mc-code">WX</span>
        <h2>Weather</h2>
        <span className="mc-head-meta">Meteomatics</span>
      </header>
      <label className="mc-weather-date">
        <span>Day at the selection centre</span>
        <input
          type="date"
          min={`${year}-01-01`}
          max={`${year}-12-31`}
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
      </label>
      {status === "loading" ? <p className="mc-note">Loading weather…</p> : null}
      {status === "error" ? <p className="mc-note">Weather is unavailable for this point.</p> : null}
      {status === "idle" && data ? (
        <dl className="mc-weather-grid">
          <div>
            <dt>Max / min</dt>
            <dd>
              {value(data.tMaxC, "°")} / {value(data.tMinC, "°")}
            </dd>
          </div>
          <div>
            <dt>Humidity</dt>
            <dd>{value(data.humidityPct, "%")}</dd>
          </div>
          <div>
            <dt>Wind</dt>
            <dd>{value(data.windKmh, " km/h")}</dd>
          </div>
          <div>
            <dt>Rain</dt>
            <dd>{value(data.precipMm, " mm")}</dd>
          </div>
        </dl>
      ) : null}
      <p className="mc-note">
        Daily conditions at {lat}, {lon}. Context for the selected day, not a fire-danger index.
      </p>
    </section>
  );
}
