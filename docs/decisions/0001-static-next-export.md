# 0001 — Static Next.js export instead of a backend

- **Date:** 2026-11-14
- **Status:** accepted; amended 2026-11-14 to allow an optional read-only API

## Context

NinaCal displays aggregated fire detections (0.1° cells, monthly) for 2000 → today. The
dataset is produced offline by a Python pipeline and changes only when the team commits new
JSON. The app must survive a hackathon deadline, load on a phone, and be demoed without
operational risk. There are no user accounts, no writes and no personal data.

## Decision

Ship the frontend as a **static export** of Next.js (`output: "export"`), reading one JSON
file per year from the same origin. No API, no database, no server-side runtime.

## Alternatives considered

- **Server API (e.g. Next.js route handlers + Postgres/Supabase).** Adds secrets, uptime and
  a second data path, for queries that are cheap to do in the browser.
- **DuckDB-WASM / Parquet in the browser.** Attractive for large data, but more moving parts
  than JSON + `Array.prototype` for the expected payload sizes, and harder to explain.
- **No web app, CSV only.** Fails the "calendar and comparison at a glance" goal.

## Amendment (2026-11-14)

The static export remains the default and the fallback. A second deployment mode adds a
read-only C++/SQLite API (`backend/`) for a VPS: the Vercel frontend sets
`NEXT_PUBLIC_API_BASE`, ships no data, and queries region/grid/series endpoints. This keeps
the original benefits for the demo while letting the data bundle live outside the frontend
upload. No writes, accounts or personal data are introduced.

## Consequences

- Deployment is a folder upload; no cold starts, no 3 a.m. incidents.
- The whole dataset is public by design, which is fine: it is aggregated, derived from open
  data, and contains no personal information.
- Payload size is the main constraint. Mitigation: one file per year, fetched on demand, and
  a coarser grid if a year exceeds the budget — without changing the schema.
- Any future write feature (accounts, saved regions) requires revisiting this decision.
