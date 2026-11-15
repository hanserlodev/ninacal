# Pitch

Copy for the platform, the demo and the 30-second video. Keep the numbers you see in the app;
do not invent coverage.

## One-liner

> NinaCal harmonizes 23 years of Aqua/MODIS and Suomi-NPP/VIIRS detected hotspot-days into one
> seasonal activity calendar for 78 countries worldwide, on a globe.

## 30-second video script

| Time | Voice-over |
| ---- | ---------- |
| 0–5 s | "Satellite sensors don't count activity the same way. A raw jump can be a sensor change, not a fire trend." |
| 5–15 s | "NinaCal brings Aqua/MODIS and Suomi-NPP/VIIRS onto one detected-hotspot-day scale, from 2003 to 2025." |
| 15–25 s | "Choose an area in Peru or the United States, inspect its square-cell map, play the 23 years, and see the uncertainty band around the converted months." |
| 25–30 s | "It flags the selected year as Normal, Elevated or Critical, compares two regions, shares the exact view and exports the hotspot-days. A hotspot is not a confirmed fire." |

Visual beats: map with a drawn polygon → timeline playback → shaded uncertainty band →
Critical badge and generated sentence → share link → CSV button. No talking heads required.

## Short description (platform, ~80 words)

NinaCal uses the v2 research bundle of satellite thermal detections for the United States and
Peru. Values are detected hotspot-days on the Suomi-NPP scale: Aqua/MODIS is estimated onto that
scale, Suomi-NPP/VIIRS is observed from February 2012, and NOAA-20 supplies explicitly marked
fallback months during selected outages. The console maps 0.05° cells, compares seasonal
activity and exports the selected rows. It is a historical exploration tool, not an incident
counter or alert system. Calibration error ranges are experimental, not confidence intervals.

## Demo flow (2 minutes)

1. Open `/console/` and press **Demo · Amazon 2024**: the map jumps to the record year for
   Loreto + Ucayali + Madre de Dios (100th percentile of 2003–2024).
2. Show the detected hotspot-days on the 0.05° square grid, then scrub the year timeline.
3. Point at the shaded band: it is the empirical ~80 % conversion error, not a confidence
   interval; observed months have no band.
4. Read the semáforo and the generated sentence: peak season is September; September 2024 is
   at the 100th percentile of the previous 21 years.
5. Compare Peru with the United States in the comparison panel, then copy the share link.
6. Open the model panel and quote the actual cross-validation WAPE/RMSE; clarify that
   small-region error is higher.
7. Download the CSV and open it in one click.
6. Close with the disclaimer: hotspot ≠ confirmed fire.

## Talking points for questions

- **Why not just use FIRMS directly?** FIRMS gives detections; it does not give a harmonized
  detected-hotspot-day series or a per-region calendar.
- **What is the biggest error source?** Small-area model error, sensor sensitivity and cloud
  cover. The v2 contract and [limitations](limitations.md) state the bounds.
- **Does it scale?** Yes: aggregation is done offline; the browser only filters and sums
  committed JSON.
- **What would you do with more time?** Connect the data provider interface to the team's
  API, validate the experimental uncertainty bands and expand coverage deliberately.
