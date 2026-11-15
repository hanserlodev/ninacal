# 0002 — Limit shipped coverage to the United States and Peru

- **Date:** 2026-11-14
- **Status:** superseded by 0004

## Context

The hackathon gives us roughly 36 hours, a small team and a laptop-sized compute budget.
NASA FIRMS is global, but aggregating 25+ years of 1 km detections into a 0.1° grid for the
whole planet would make the static payload large, slow to validate and slow to demo on a
phone. We need a study area that is big enough to show real fire regimes and small enough to
finish and verify.

## Decision

Ship processed grids for the **United States and Peru** only. The schema, the calibration
method and the frontend stay global: coverage is a data/payload decision, not a contract
change. The explorer masks the two covered countries and says so when a selection falls
outside them.

## Alternatives considered

- **Global grid.** The honest long-term goal, but out of budget for the event: many more
  cells, larger files and a longer validation loop.
- **Peru only.** The original study area, but a single country hides the northern/southern
  season contrast that makes the calendar legible.
- **Query FIRMS at runtime.** Needs a backend, API keys and uptime; it would also reopen
  ADR 0001.

## Consequences

- Smaller JSON, faster aggregation, a demo that fits on a phone.
- Coverage becomes a stated product limit: README, FAQ, limitations, the interface and the
  map mask all say "USA + Peru".
- Map outlines and demo masks use geoBoundaries ADM0 public-domain polygons for CONUS, Alaska,
  Hawaii (represented year 2018) and Peru (represented year 2008). U.S. territories outside
  those three regions are not part of the shipping coverage.
- Adding another country later means running the pipeline and committing its years. No
  frontend rewrite is required.
