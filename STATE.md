# UnQTools — Build State

_Last updated: 2026-07-05T04:30:00Z by GLM (z.ai sandbox) — v6.7 audit_

## Current phase

**v6.7 "Audit" — COMPLETE** ✅ ON `v6.7-audit` (docs + test-infra only, no product code changes)

### Commits on v6.7-audit

| Commit   | Description                                                              |
| -------- | ------------------------------------------------------------------------ |
| b47dd47  | docs: CODEBASE.md + CLEANUP-INVENTORY.md                                 |

## Task A — Codebase walkthrough ✅

`docs/CODEBASE.md` (372 lines): complete end-to-end explanation covering architecture, repo tree, tool system, category system, layout + navigation, design system, PWA, test infrastructure, CI/CD, how-to recipes, and known debt.

## Task B — Cleanup inventory ✅

`docs/CLEANUP-INVENTORY.md` (165 lines): 110 items inventoried:
- 17 archived showcase pages (confirmed no imports — keep in archive/)
- 62 unused UI components (archive for future reuse)
- 3 unused lib files (delete)
- 25 unused npm dependencies (delete, 2 uncertain)
- 3 unused public assets (delete sandeep.png)
- Estimated: ~68 files, ~250 KB savings

## Task C — CI informational job diagnosis ✅

**Root cause:** REAL product issue, NOT test-infra.

The axe step fails on `/tools/add-line-breaks` with 2 critical violations:
1. `label` — native `<input type="number">` has no label/aria-label
2. `select-name` — native `<select>` has no accessible name

Same issue on `/tools/image-compressor` and `/tools/csv-to-markdown` (both use native `<select>`).

**Fix needed (v6.8 task):** Add `aria-label` to native `<select>` and `<input>` elements in these 3 tool UIs. ~6 lines of code per tool.

This is NOT a stale route list issue — the routes.json is correctly regenerated in CI. The axe.e2e.ts route fix from v6.5 IS on this branch.

## Full gate table (v6.7)

| Gate | Result |
|------|--------|
| lint | ✅ 0 errors |
| unit tests | ✅ 528/528 |
| build | ✅ 30 pages |
| smoke e2e | ✅ 33/33 |
| tool e2e | ✅ 22/22 |
| CLS | ✅ 0.0001 |
| CI build job | ✅ success |
| CI informational axe | ⚠️ fails on 3 tool pages (real a11y bugs, documented) |

## Next steps

1. Owner reviews `docs/CLEANUP-INVENTORY.md` → approves archive list
2. v6.8: execute archive (62 unused components + 3 lib files + 25 deps + sandeep.png)
3. v6.8: fix a11y bugs in add-line-breaks, image-compressor, csv-to-markdown (add aria-labels)
