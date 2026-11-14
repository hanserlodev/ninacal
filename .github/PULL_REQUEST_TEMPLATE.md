## What and why

<!-- One or two sentences. Link the issue: Closes #12 -->

## How to test

<!-- Steps a reviewer can follow, or the command you ran. -->

## Checklist

- [ ] `make check` passes
- [ ] Screenshots attached if the UI changed
- [ ] No secrets, tokens or personal data in the diff
- [ ] Documentation updated if behavior or data changed
- [ ] Data contract untouched — or updated in `data/schemas/`, `docs/data-dictionary.md` and this PR
- [ ] Missing data written as `null`, never `0`
- [ ] Tested at a phone width (≈ 390 px)
