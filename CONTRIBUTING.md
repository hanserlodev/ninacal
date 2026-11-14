# Contributing

Thanks for helping. NinaCal is a small, fast-moving project: clear issues and small pull
requests get merged quickly.

## Before you start

- Look through [issues](../../issues) and [discussions](../../discussions) first.
- Small fixes (typos, styles, an obvious bug): open a PR directly.
- New features or anything touching the **data contract**: open an issue or a discussion
  first. The contract is the one thing we do not change by surprise.
- Never commit secrets, personal data or unprocessed real coordinates tied to people.

## Setup

Requirements: Node.js ≥ 20.9 (for the web app) and Python 3.11+ (for the pipeline).

```bash
git clone https://github.com/hanserlodev/ninacal.git
cd ninacal

# Web
make install
make dev          # http://localhost:3000

# Checks (same as CI)
make check
```

The web app works against `data/samples/mock.json` until processed data exists. Pipelines
are documented in [`pipelines/README.md`](pipelines/README.md).

## Working with data

- Read [`docs/data-dictionary.md`](docs/data-dictionary.md) before touching a file in
  `data/`.
- Missing values are `null`, never `0`. Measured-zero is `0`.
- Every processed file must pass `make check`.
- If you regenerate a year, say so in the PR and include the row count. Do not silently
  change historical values.
- Never edit processed JSON by hand: fix the pipeline, re-run it, commit the output.

## Style

- **TypeScript**: strict mode, no `any` without a comment explaining why. Server components
  by default; add `"use client"` only where interactivity requires it.
- **CSS**: custom properties from `app/globals.css`; no magic colors or spacing.
- **Python**: type hints, `pathlib`, deterministic output (sorted keys and rows).
- **Docs**: short sentences, real numbers, no marketing claims the code cannot back.
- **Accessibility**: keyboard navigable, visible focus, sufficient contrast, honors
  `prefers-reduced-motion`. A feature is not done until it passes a keyboard pass.
- **Mobile**: check at ~390 px width before opening the PR.

## Commits and PRs

- Branch from `main`: `feat/...`, `fix/...`, `docs/...`, `data/...`.
- Conventional Commits: `feat:`, `fix:`, `docs:`, `data:`, `chore:`, `refactor:`, `test:`.
- One PR, one purpose. Describe **what** and **why**; attach a screenshot for UI changes.
- Fill in the PR checklist truthfully — especially the data-contract and `null` items.
- Reviewers may ask to split a PR; it is about merge speed, not distrust.

## Review and merge

- One approving review from a maintainer, CI green, checklist complete.
- Squash noisy branches. `main` must remain deployable at all times.
- During the hackathon, feature freeze is Sunday 11:00: after that, bug and copy fixes only.

## Recognition

Every contribution is credited in the Git history and in release notes. Add yourself to the
PR description if you want to be named in the project text.

By participating you accept the [Code of Conduct](CODE_OF_CONDUCT.md).
