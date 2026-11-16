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

NinaCal harmonizes 23 years of NASA FIRMS Aqua/MODIS and Suomi-NPP/VIIRS fire detections into
one comparable hotspot-day calendar for 153 countries, so a question like "was this October
normal?" has an answer in seconds: Peru's 2024 was 25% above its typical year, Bolivia's +32%,
Australia's October 2025 +43%. Users pick any country, region or drawn area, scrub 2003–2025,
compare two places on one scale, and export CSV. Every country is validated out of sample and the
app shows its own error, so a hotspot is never presented as a confirmed fire. A read-only
C++/SQLite API serves 57.3 million monthly cell rows; the pipeline, data contract and limitations
are public. What is usually a single-country viewer works here across the world, on one scale, with
the uncertainty visible.

## Project details

**What it does.** NinaCal turns six disagreeing satellite fire files into one comparable
calendar. Open it and you land on a globe of 153 countries; pick a country, an ADM1 region or draw
a box, and the console shows detected hotspot-days per 0.05° cell and month from 2003 to 2025. You
can scrub or play the timeline, read a year × month heatmap that keeps estimated months and
unavailable source coverage visible, see whether the latest month is unusual against the same
month in previous years (median, robust z, and how many previous years it exceeded), compare two
countries or regions on one absolute or indexed scale, add land cover, burned area and weather
context, and export the current selection as CSV. There is no account and no onboarding.

[IMAGE 1 — 01-home.png — "NinaCal: 23 years of Aqua/MODIS and Suomi-NPP/VIIRS fire detections on
one hotspot-day scale, for 153 countries, served by a read-only API."]

**How it works.** A Python pipeline downloads NASA FIRMS country files, aggregates daily
detections into monthly cell counts, assigns cells to ADM1 units, and fits a per-cell/per-block
calibration from Aqua/MODIS to the Suomi-NPP scale. A NOAA-20 bridge covers months where a sensor
really lacks most of its days; availability comes from the daily observation caches, not from a
static outage list, and model selection is bias-aware for low-activity countries. Validation is
out of sample: fit 2013–2017, development 2018–2020, held-out 2021–2022, drift check 2023–2025.
The chosen model and its error are stored per country and shown inside the app: Brazil 6.3%
cross-validated WAPE, Australia 4.7%, Peru 13%, while a low-activity country such as Germany
reaches 59% — and the console shows that number next to its bias and sample size instead of hiding
it. The bundle holds 57.3 million monthly cell rows over 2.79 million 0.05° cells. A C++20 API
reads a SQLite database and serves grids, region aggregates, series and CSV behind an Nginx cache;
the static Next.js frontend caches every response in IndexedDB, so a second timeline loop makes no
network requests. The country catalogue is read from the API at runtime, so adding a country does
not require a frontend release.

[IMAGE 2 — 02-world-153.png — "World view: 2.79 million 0.05° cells across 153 countries, each
national aggregate loaded from the API and coloured on the same scale."]

**Benefits and impact.** Researchers, journalists, agencies and students can compare places and
years without rebuilding a harmonization stack, and the same question works at any scale: Peru's
2024 was 25% above its 2003–2024 typical year, Bolivia's +32%, Australia's October 2025 +43% over
a typical October, Brazil's October 2025 −34%. Because every country is on one scale, a national
agency can put its own season beside a neighbour's without exporting anything. The app is a static frontend, works
with no account, is fast after the first load, and keeps the source and the uncertainty visible.

[IMAGE 3 — 03-peru.png — "Peru, September 2025: 7,203 hotspot-days, 41% below the 2003–2025
September median, lower than all 22 previous Septembers. Land cover, burned area and weather sit
beside the map; per-country calibration sits below."]

**Tools.** Next.js, React, TypeScript and MapLibre GL JS for the static frontend on Vercel; C++20,
SQLite, Docker and Nginx for the read-only API on a Linux VPS; Python, NumPy and Pandas for the
pipeline; Microsoft Planetary Computer (IO land cover, MCD64A1 burned area) and Meteomatics for
context; geoBoundaries ADM1 and Natural Earth for boundaries. AI coding assistance is disclosed in the project repository (docs/AI-USE.md): it was used for code, documentation and data-analysis review, never for
imagery, audio or video, and no NASA logos or branding are used.

[IMAGE 4 — 04-comparison.png — "Two countries, one scale: Peru (910k hotspot-days, 2003–2025)
against Bolivia (1.4M). The 2010 divergence and the shared seasonal shape are visible without
rebuilding either series."]

**Creativity.** The globe, the 0.05° country-masked cells, playback served from the browser cache,
any-country comparison with an indexed scale, and the land-cover/burned-area/weather context are
combined in one instrument rather than a dashboard of disconnected charts. The unusual part is
scope: a harmonization that usually stops at one country runs here for 153, with the same method,
the same validation and the same caveats in every one of them.

[IMAGE 5 — 05-calendar.png — "Year × month calendar for Peru: dotted cells mark months that use an
estimated satellite conversion, hatching marks unavailable source coverage, and the right column
sums only measured months."]

**Factors considered.** Sensor disagreement and the 2012 seam; sparse data versus true zero;
real outage months; low-activity countries where WAPE is unstable and a bias-corrected model is
preferable to a lower point error; the difference between a thermal hotspot, a fire and burned
area; accessibility and low-bandwidth use; attribution; and the cost of large payloads, which is
why the API caps grid and export sizes and the frontend caches instead of re-downloading.

[IMAGE 6 — 06-mobile.png — "The same console on a phone: 0.05° cells, 27 regions, timeline and CSV
export, with no account."]

**A closing note · Una nota final.** "We are a way for the cosmos to know itself." — Carl Sagan,
*Cosmos* (1980). "Somos una forma que tiene el cosmos de conocerse a sí mismo." — Carl Sagan,
*Cosmos* (1980). Twenty-three years of satellite detections are, in the end, the record of a planet
learning to watch its own fires; NinaCal exists so that record stays comparable, readable and
honest about what it cannot see. Veintitrés años de detecciones satelitales son, al final, el
registro de un planeta que aprende a mirar sus propios incendios; NinaCal existe para que ese
registro siga siendo comparable, legible y honesto sobre lo que no puede ver.

**Acknowledgments · Agradecimientos.** We thank the NASA FIRMS and EOSDIS teams, and the MODIS and
VIIRS instrument and science teams, for open data and for publishing the outage notices that make an
honest record possible. Thanks to the NASA Space Apps organizers, local leads and mentors; to
Microsoft Planetary Computer, Meteomatics, geoBoundaries and Natural Earth, OpenStreetMap
contributors and Esri for the context layers; and to the maintainers of Next.js, React, MapLibre GL
JS, SQLite, Nginx, Docker, NumPy and Pandas, whose work carries projects like this one. Thanks also
to the people who opened the console, broke it, and told us. Any remaining error is ours.
Agradecemos a los equipos de NASA FIRMS y EOSDIS, y a los equipos de instrumento y ciencia de MODIS y
VIIRS, por los datos abiertos y por publicar los avisos de interrupción que hacen posible un registro
honesto. Gracias a los organizadores, leads locales y mentores de NASA Space Apps; a Microsoft
Planetary Computer, Meteomatics, geoBoundaries y Natural Earth, a los colaboradores de
OpenStreetMap y a Esri por las capas de contexto; y a quienes mantienen Next.js, React, MapLibre GL
JS, SQLite, Nginx, Docker, NumPy y Pandas, cuyo trabajo sostiene proyectos como este. Gracias
también a quienes abrieron la consola, la rompieron y nos lo dijeron. Cualquier error que quede es
nuestro.

## Images for Project Details

Six screenshots of the live app, with captions, are in `docs/submission/` (see
`docs/submission/README.md` for the order). They are real API responses, not mockups.

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
