# Pitch

Copy for the platform, the demo and the 30-second video. Keep the numbers you see in the app;
do not invent coverage.

## One-liner

> NinaCal harmonizes 25 years of NASA MODIS and VIIRS fire detections into one calendar of
> burning activity for any region you draw.

## 30-second video script

| Time | Voice-over |
| ---- | ---------- |
| 0–5 s | "Satellites have tracked fires for more than 20 years, but MODIS and VIIRS records can't be compared directly." |
| 5–15 s | "NinaCal harmonizes both sensors into one continuous burning-activity calendar, from 2000 to today." |
| 15–25 s | "Pick any area, see which months burned most, compare the current month to the historical median, and download the data." |
| 25–30 s | "Built for emergency managers. Open, static, and validated on real NASA FIRMS data." |

Visual beats: map with a drawn polygon → calendar filling in → current month vs median chart
→ CSV button. No talking heads required.

## Short description (platform, ~80 words)

NinaCal turns NASA's two satellite fire records into one. MODIS (2000–) and VIIRS (2012–)
detect thermal anomalies differently, so their counts cannot be compared as-is. We calibrate
VIIRS against MODIS on the years both exist, validate the fit on held-out years, and render
the resulting series as a year × month calendar for any region a user draws. Emergency
managers can see which months burn most, whether the current month is unusual, and export the
numbers. Fully static, no backend.

## Demo flow (2 minutes)

1. Open the map, draw a region over the study area.
2. Calendar appears; point out the strong seasonality and the pre-2012 boundary.
3. Show current month vs the median of previous years, and the anomaly badge.
4. Open the validation chart: "this is the MODIS–VIIRS calibration, tested on years it never
   saw."
5. Download the CSV and open it in one click.
6. Close with the disclaimer: hotspot ≠ confirmed fire.

## Talking points for questions

- **Why not just use FIRMS directly?** FIRMS gives you detections; it does not give you a
  comparable 25-year series or a per-region calendar.
- **What is the biggest error source?** Sensor sensitivity and cloud cover before 2012; the
  calibration chart and [limitations](limitations.md) say so.
- **Does it scale?** Yes: aggregation is done offline; the browser only filters and sums
  committed JSON.
- **What would you do with more time?** More regions, coarser-grid fallback for huge areas,
  and a published validation report.
