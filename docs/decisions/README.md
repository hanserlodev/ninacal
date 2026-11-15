# Decision log (ADR)

Each file records one architecture or product decision: context, decision, alternatives and
consequences. Fill it in the same PR that applies the change.

## Format

```text
docs/decisions/NNNN-short-title.md
```

- `NNNN`: sequential number, zero-padded.
- `short-title`: lowercase, hyphen-separated.
- Status: `proposed`, `accepted`, `superseded by NNNN`, `deprecated`.

Copy [`_template.md`](_template.md) and fill it in.

## Index

| Number | Title                                                     | Status   |
| ------ | --------------------------------------------------------- | -------- |
| 0001   | [Static Next.js export](0001-static-next-export.md)       | accepted |
| 0002   | [Coverage: United States and Peru](0002-coverage-usa-peru.md) | superseded by 0004 |
| 0003   | [Optional read-only API](0003-backend-api.md)             | accepted |
| 0004   | [Global coverage: 12 countries, world-ready](0004-global-coverage.md) | accepted |
