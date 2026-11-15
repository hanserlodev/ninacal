# FAQ

## What is NinaCal?

A web app that shows a year × month calendar of detected hotspot-days for a region you choose,
built from the v2 Aqua/MODIS + Suomi-NPP/VIIRS series for 2003–2025. The frontend can run as a
static export or read the optional read-only API.

## Why do MODIS and VIIRS need "harmonizing"?

They are different instruments with different pixel sizes, overpass times and detection
thresholds. The current v2 bundle converts Aqua/MODIS hotspot-days onto the Suomi-NPP scale and
uses NOAA-20 as an explicitly estimated fallback for selected Suomi-NPP outages. See the
[v2 contract](data-v2/DATA_CONTRACT.md); the older v1 pipeline method remains in
[methodology](methodology.md).

## Where is the map?

The homepage (`/`) is the project overview. Open **Mission control** from the hero or header,
or visit `/console/` directly for the full-screen map, region tools and analysis panels.

## Is this a fire map or an alert system?

No. It is a historical activity calendar built from satellite thermal anomalies. It has no
live alerts, no incident confirmation and no risk score. See [limitations](limitations.md).

## Which regions are covered?

The committed dataset covers **78 countries** at 0.05° resolution. The globe always shows the
world; countries without a published bundle are dimmed.
The pipeline can register up to 158 FIRMS countries with `make add-world`.

## Why 0.05° cells and monthly counts?

Because shipping individual detections for 23 harmonized years would be enormous, and the questions the
calendar answers ("which months burn most", "is this month unusual") only need aggregated
counts. Individual hotspots remain available from NASA FIRMS.

## Where does the CSV come from?

It is generated for the current selection: from the browser bundle in static mode, or from
`GET/POST /api/region?format=csv` in API mode. No personal data is involved.

## Is there a backend?

Yes, optionally. `backend/` is a small read-only C++/SQLite server for the VPS. The Vercel
frontend ships code only and points at it with `NEXT_PUBLIC_API_BASE`; without that variable
the app stays a self-contained static export. See
[ADR 0001](decisions/0001-static-next-export.md) for the original static decision and the
[architecture](ARCHITECTURE.md) for the hybrid deployment.

## Can I reuse the code or the data?

Code: yes, MIT. Data: NASA FIRMS is openly available under NASA's data policy — cite FIRMS
and the product you use.

## How do I run it?

Static: `cd apps/web && npm install && npm run dev`. API mode: run
`backend/scripts/setup.sh && backend/scripts/run-dev.sh`, set
`NEXT_PUBLIC_API_BASE=http://127.0.0.1:8080`, then start the frontend. See the
[README](../README.md).

## How do I report a bug or a data problem?

Bugs and data issues have separate issue templates. A data issue should include the cell,
year, month and what looks wrong, so it can be traced in the pipeline.
