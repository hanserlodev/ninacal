# Credits and submission notes

NinaCal is the project: the console, the read-only API, the data pipeline and the
documentation in this repository. The external services below are infrastructure or
data sources, not the deliverable.

## Data

- **NASA FIRMS / EOSDIS** — Aqua/MODIS, Suomi-NPP/VIIRS and NOAA-20 active-fire
  detections. Harmonized by the NinaCal pipeline.
- **Microsoft Planetary Computer** — `io-lulc-annual-v02` land cover and
  `modis-64A1-061` burned area, used as context; not as a hotspot count.
- **Meteomatics** — daily weather at the selection centre (offer valid while the
  hackathon credentials last).
- **geoBoundaries / Natural Earth** — ADM1 boundaries and country outlines.

## Tools and hosting

- Next.js, React, TypeScript, MapLibre GL JS, Vercel.
- C++20, SQLite, Docker, Nginx on the VPS.
- Cloudflare (optional edge cache/rate limit) and Google Cloud (batch compute)
  may be used through the NASA Space Apps Global Offers.

## Eligibility

Using NASA Space Apps Global Offers (Azure, Google Cloud, Planetary Computer,
Meteomatics, etc.) is optional and expressly allowed by the programme. Running the
pipeline on GCP does not change what is submitted.

Check the specific challenge page and the official Space Apps rules for the
project-creation dates. If a component, dataset or pipeline predates the event,
disclose it and present the work done during the hackathon separately. Do not
claim pre-existing code or data as new work. Keep the public URL, the repository
and the data provenance visible so judges can reproduce the result.

## Limits

A thermal hotspot is not a confirmed fire. NinaCal reports detected hotspot-days
on a harmonized Suomi-NPP-equivalent scale; it does not measure burned area,
fire size or fire intensity.

## Closing note and acknowledgments

"We are a way for the cosmos to know itself." — Carl Sagan, *Cosmos* (1980).
"Somos una forma que tiene el cosmos de conocerse a sí mismo." — Carl Sagan, *Cosmos* (1980).

Thanks to NASA FIRMS and EOSDIS, the MODIS and VIIRS instrument and science teams, the NASA Space
Apps organizers and local leads, Microsoft Planetary Computer, Meteomatics, geoBoundaries, Natural
Earth, OpenStreetMap contributors, Esri, and the maintainers of Next.js, React, MapLibre GL JS,
SQLite, Nginx, Docker, NumPy and Pandas. Any remaining error is ours.
To our families and to the people we love: thank you for the hours we borrowed, for the dinners
that went cold, and for the patience you gave without being asked. You kept the world running while
we stared at pixels; this belongs to you as much as to us.
