# Governance

A deliberately small model for a small project that wants to grow without bureaucracy.

## Roles

**Contributors.** Anyone who contributes code, data, documentation, design or ideas. Credited
in the Git history and in release notes.

**Maintainers.** Review and merge PRs, triage issues, own releases and the security process.
Today the project is maintained by the people who started it; sustained contributors are
invited publicly as the project grows.

**Release lead (optional).** Coordinates a specific delivery — deployment, submission, video
— when one is needed.

## How decisions are made

1. **Consensus first.** Decisions are discussed in public issues or discussions.
2. **Large changes need agreement before code.** A 300-line PR that changes direction will be
   asked to slow down.
3. **No consensus?** A maintainer records the decision and the reasoning in
   `docs/decisions/`. It can be revisited with evidence.
4. **The data contract is special.** Changing fields, null rules or grid alignment requires
   both the frontend and data owners to agree, plus updates to schema, dictionary and mock in
   the same PR.

## Merging

- At least one approving maintainer review.
- CI green and `make check` passing.
- Clear description, no secrets.
- Clean history (squash when a branch is noisy).

## Conduct

The [Code of Conduct](CODE_OF_CONDUCT.md) applies. Disciplinary decisions are made by
maintainers confidentially.

## Changing this document

Propose a PR explaining why. When more than one maintainer exists, someone other than the
author must approve it.
