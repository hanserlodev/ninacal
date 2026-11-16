# NASA Space Apps 2026 submission draft

Project: **NinaCal** (team **MODIS Operandi**)
Live app: https://ninacal.earth
Demo: https://ninacal.earth/demo/ (embeds the 30 s video; opens the console when it ends)
Video: https://www.youtube.com/watch?v=u7yML7gKgFg
Code: https://github.com/hanserlodev/ninacal
Deadline: Sunday, November 15, 11:59 PM local time.

## Project name

NinaCal — one calendar for 23 years of satellite fire detections

## Summary (about 150 words)

NinaCal (MODIS Operandi) harmonizes NASA FIRMS Aqua/MODIS and Suomi-NPP/VIIRS active-fire
detections into one detected-hotspot-day scale from 2003 to 2025 on a 0.05° grid. A public globe
console lets anyone search 78 live countries and their regions, scrub or loop the timeline,
inspect a year × month calendar and anomalies, compare any two places on one scale, and export
CSV. A read-only C++/SQLite API serves the data; a Python pipeline derives satellite availability
from daily observations, calibrates MODIS to the VIIRS scale and validates out of sample. Context
layers from Microsoft Planetary Computer and Meteomatics add land cover, burned area and daily
weather. The project is open source and runs on a static frontend. It states its limits clearly: a
thermal hotspot is not a confirmed fire. The same pipeline is validated to scale to 153 countries.

## Project details

**What it does.** NinaCal turns six disagreeing satellite fire files into one comparable calendar.
Users open a globe, pick a country or region, and see detected hotspot-days per 0.05° cell and
month from 2003 to 2025. They can loop the map through the years, read a year × month heatmap, see
whether the latest month is anomalous against the same month in previous years, compare two
countries or regions on one scale (absolute or indexed), and download the current selection as CSV.

**How it works.** A Python pipeline downloads NASA FIRMS country files, aggregates daily detections
to monthly cell counts, assigns cells to ADM1 units, and fits a per-cell/per-block calibration from
Aqua/MODIS to the Suomi-NPP scale. Availability is derived from the daily caches: a month is only
replaced by a NOAA-20 estimate when the satellite really lacks most of its days, not from a static
outage list. Validation is out of sample: 2013–2017 training, 2018–2020 development, 2021–2022
hold-out. A C++20 API reads a SQLite database and serves grids, region aggregates, series and CSV;
the static Next.js frontend caches API JSON in IndexedDB so a second timeline loop makes no network
requests.

**Benefits and impact.** Researchers, journalists, agencies and students can compare places and
years without rebuilding a harmonization stack. The app works with no account, is fast after the
first load, and keeps the source and the uncertainty visible. It is designed to scale: the country
catalogue is read from the API at runtime, so adding a country to the bundle does not require a
frontend release.

**Tools.** Next.js, React, TypeScript, MapLibre GL JS, CSS; C++20, SQLite, Docker, Nginx; Python,
NumPy, Pandas; Vercel, a Linux VPS; Microsoft Planetary Computer, Meteomatics; geoBoundaries and
Natural Earth. AI coding assistance is disclosed in `docs/AI-USE.md`.

**Creativity.** The globe, the 0.05° country-masked cells, the loop from cache, the any-country
comparison with an indexed scale, the land-cover/burned-area context and the weather panel are
combined in one instrument rather than a dashboard of disconnected charts.

**Factors considered.** Sensor disagreement and the 2012 seam; sparse data versus true zero; real
outage months; low-activity countries where WAPE is unstable; the difference between a thermal
hotspot, a fire and burned area; accessibility; attribution; and the cost of large payloads.

## Demo

Recommended: https://ninacal.earth/demo/ — a public page that embeds the 30-second video, no
login or password. When the video ends it opens the console automatically, so a judge lands on
the live app without an extra click. Direct video link:
https://www.youtube.com/watch?v=u7yML7gKgFg. Alternative: https://ninacal.earth.

## NASA data and resources

| Link text | URL |
|---|---|
| NASA FIRMS — Fire Information for Resource Management System | https://firms.modaps.eosdis.nasa.gov/ |
| NASA FIRMS country-year active-fire files | https://firms.modaps.eosdis.nasa.gov/data/country/ |
| NASA FIRMS sensor outage notices | https://firms.modaps.eosdis.nasa.gov/content/notifications/firms/outages.html |
| NASA EOSDIS — Earthdata | https://www.earthdata.nasa.gov/ |
| NASA Aqua/MODIS | https://modis.gsfc.nasa.gov/ |

## Space Agency Partner and other data/resources

| Link text | URL |
|---|---|
| NOAA-20 VIIRS (NOAA) | https://www.nesdis.noaa.gov/our-satellites/currently-flying/joint-polar-satellite-system |
| Suomi NPP (NASA/NOAA) | https://www.nesdis.noaa.gov/our-satellites/currently-flying/suomi-npp |
| Microsoft Planetary Computer (IO LULC, MCD64A1) | https://planetarycomputer.microsoft.com/ |
| Meteomatics Weather API | https://www.meteomatics.com/en/weather-api/ |
| geoBoundaries ADM1 | https://www.geoboundaries.org/ |
| Natural Earth | https://www.naturalearthdata.com/ |
| MapLibre GL JS | https://maplibre.org/ |
| Next.js | https://nextjs.org/ |
| React | https://react.dev/ |
| Vercel | https://vercel.com/ |
| SQLite | https://sqlite.org/ |
| Docker | https://www.docker.com/ |
| Nginx | https://nginx.org/ |
| NumPy | https://numpy.org/ |
| Pandas | https://pandas.pydata.org/ |
| OpenStreetMap contributors | https://www.openstreetmap.org/copyright |
| Esri World Imagery | https://www.esri.com/en-us/arcgis/products/arcgis-online/overview |
| NinaCal source code | https://github.com/hanserlodev/ninacal |

## Super Intelligence use

Select the options that match your actual use. For this project: **code generation/assistance**,
**text generation/editing**, **data analysis**. Do not select image/audio/video generation unless
the team generated them. Details: `docs/AI-USE.md`. No NASA branding was used.

## Before clicking Submit

- [ ] Demo link opens without login: https://ninacal.earth/demo/
      (direct video: https://www.youtube.com/watch?v=u7yML7gKgFg)
- [ ] Project link opens: https://ninacal.earth
- [ ] All external resources are listed above.
- [ ] AI use is disclosed in the form and in the project.
- [ ] The team can honestly confirm the work is original and that it was created under the
      challenge rules. If any component predates the event, disclose it; do not claim it as new.
- [ ] Save Progress, then Submit for Judging before 11:59 PM local time.
