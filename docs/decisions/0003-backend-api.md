# 0003 — Optional read-only API for the deployed frontend

- **Date:** 2026-11-14
- **Status:** accepted

## Context

The Vercel deployment should not carry the data bundle. The analyst shipped a small C++20
server over the v2 bundle (PE + US) with SQLite, region/grid/series endpoints, empirical
bands and CORS. The frontend already had an `ExplorerDataProvider` seam for a future API.

## Decision

Keep the static export as the default and fallback, and add a **read-only API mode**:

- `backend/` builds `ninacal-server`; `scripts/build_db.py` generates the SQLite database from
  the editable `data/v2/` bundle (only `PE` and `US`).
- The server runs on a VPS behind Caddy/Nginx. It owns the data and the database.
- The Vercel frontend ships code only (about 9 MB). `NEXT_PUBLIC_API_BASE` switches the
  frontend to `/api/region`, `/api/grid` and `/api/series`; `sync-data` skips the data copy
  and `.vercelignore` keeps `data/` and `backend/` out of the upload.
- Without the variable, the original self-contained static build still works.

## Alternatives considered

- **Bundle the 18 MB compressed data in Vercel.** Simple, but duplicates the data in two
  places and contradicts the requirement to keep the deployment data-free.
- **Rewrite the API in Next.js route handlers.** Vercel functions would still need the data
  inside the deployment and a database; the C++ server already exists and answers arbitrary
  boxes/polygons with bands.
- **Serve only the static JSON from the VPS (no API).** Possible, but the frontend would
  re-download year files and lose server-computed bands for custom areas.

## Consequences

- One more process to operate (VPS + TLS + backups), but no data in the Vercel artifact.
- The API is read-only and has no auth; it publishes aggregated open data. CORS is `*` and can
  be narrowed when a fixed frontend domain is known.
- Two data delivery paths must stay mirrored: `data/v2/` is the source, the static copy and
  the SQLite database are generated from it.
- Polygon sharing currently degrades to the polygon's bounding box in the URL.
