# UnQTools — Build State

_Last updated: 2026-07-05 by GLM (z.ai sandbox) — v7.0 PDF batch-1 in progress_

## Current phase

**v7.0 "PDF batch-1" — IN PROGRESS** 🟡 ON `v7.0-pdf-batch1`

10 PDF tools shipped (logic + tests + UI + registry + lazy loaders). Branch is
not yet merged to `main`. Gates not re-verified end-to-end on CI yet — that's
the next step.

### Recent commits on `v7.0-pdf-batch1`

| Commit   | Description                                                                                |
| -------- | ------------------------------------------------------------------------------------------ |
| 2610cf6  | fix: tool-page-client.tsx — named motion constants, no double-brace (v7.0 batch-1h)        |
| 0ef206a  | feat(pdf): register 10 PDF UI loaders in tool-page-client.tsx (v7.0 batch-1g)              |
| b3c53bd  | feat(pdf): register 10 PDF tools in registry + e2e fixtures (v7.0 batch-1f)                |
| a29c314  | feat(pdf): pdf-watermark + pdf-metadata-editor (v7.0 batch-1e)                             |
| 828cf7d  | feat(pdf): images-to-pdf + pdf-page-numbers (v7.0 batch-1d)                                |
| 1a13ffb  | feat(pdf): extract-pdf-pages + reorder-pdf-pages (v7.0 batch-1c)                           |
| 7b3280a  | feat(pdf): rotate-pdf + delete-pdf-pages (v7.0 batch-1b)                                   |
| 6bf7ff0  | feat(pdf): merge-pdf + split-pdf — logic, tests, UI (v7.0 batch-1a)                        |
| 4cfb62c  | chore: regenerate lockfile for pdf-lib + auto-trigger lockfile workflow                    |
| e106501  | Add workflow to update package-lock.json automatically                                     |
| 23953e4  | feat(pdf): add pdf-lib dependency (v7.0 PDF batch-1 foundation)                            |

## v7.0 — PDF batch-1 🟡 in progress

### Tool count

- **32 tools total** (was 22 at v6.8) — 10 new PDF tools added
- **5 categories live** (was 4): text, developer, calculators, image, **pdf** (new)
- 8 categories still show "Coming soon" empty states

### PDF tools shipped (10)

| Tool                  | Purpose                                                        |
| --------------------- | -------------------------------------------------------------- |
| merge-pdf             | Combine multiple PDFs with per-file page ranges + reordering   |
| split-pdf             | Split a PDF by page ranges into multiple files (zip download)  |
| rotate-pdf            | Rotate pages 90°/180°/270°, all or selected pages              |
| delete-pdf-pages      | Delete pages by range, download the trimmed PDF                |
| extract-pdf-pages     | Extract pages by range into a new PDF                          |
| reorder-pdf-pages     | Reorder pages via drag-style up/down arrows                    |
| images-to-pdf         | Convert PNG/JPEG images into a single PDF                      |
| pdf-page-numbers      | Add page numbers (position, format, starting number, margins)  |
| pdf-watermark         | Add text watermark (font, size, opacity, rotation, position)   |
| pdf-metadata-editor   | Edit PDF Title / Author / Subject / Keywords / Producer / etc. |

### PDF shared infrastructure

- `src/tools/pdf/_shared/page-ranges.ts` — page-range parser ("1-3, 5, 8-10") shared by merge/split/extract/delete/reorder
- `src/tools/pdf/_shared/page-ranges.test.ts` — unit tests for the parser
- `src/tools/pdf/_shared/download.ts` — browser-side download helper (single PDF or zip via `JSZip`-style blob)
- All PDF processing is 100% client-side via **pdf-lib ^1.17.1** — no server, no uploads, works offline

### New dep added

- `pdf-lib ^1.17.1` (with transitive deps: `@pdf-lib/standard-fonts`, `@pdf-lib/upng`, `pako`, `tslib@1.14.1` nested)
- `package-lock.json` regenerated and committed (commit `4cfb62c`)
- `Update-lock-file.yml` workflow updated to auto-trigger on `package.json` pushes — future API-side dep additions will regenerate the lockfile automatically

### What's NOT yet done for v7.0

- [ ] CI gates re-verified on `v7.0-pdf-batch1` (lint, full unit suite, full e2e suite, axe on PDF tool pages, CLS on PDF tool pages)
- [ ] `tests/routes.json` regenerated (currently stale — missing 10 PDF tool routes + pdf category page; CI regenerates it automatically via `tests/gen-routes.mjs`)
- [ ] Lighthouse perf check on PDF tool pages (pdf-lib is ~350 KB minified — verify lazy-loading keeps first-load budget under control)
- [ ] Owner review + merge to `main`

## v6.9 — All 13 categories visible ✅ (commit 320771d)

- All 13 categories from `ALL_CATEGORIES` now visible in the sidebar, tools directory, and command palette
- Categories with 0 tools render a "Coming soon" empty state (was previously hidden)
- Category page client refactored to derive visible categories from registry (no hardcoded list)
- Sidebar refactored similarly — no longer hides empty categories

## v6.8 — A11y + Cleanup ✅ COMPLETE

### Commits on v6.8-cleanup (8 total)

| Commit   | Description                                                              |
| -------- | ------------------------------------------------------------------------ |
| 08f16cb  | Task A: a11y — accessible names on ALL native form controls               |
| 1916c8a  | Fix: remove duplicate aria-label props in color-picker                    |
| 6b4e7e4  | CI: promote axe to must-pass build job                                    |
| d420dd1  | Task B: archive 67 unused UI components + archive-import guard            |
| 120cd2d  | Task C: delete 3 dead lib files + orphaned test                           |
| b5fa343  | Task C: remove unused deps batch 1/3 (8 deps)                             |
| 02d85c2  | Task C: remove unused deps batch 2/3 (8 deps)                             |
| 57c48e6  | Task C: remove unused deps batch 3/3 (7 deps)                             |

### Task A — A11y fixes + axe promotion ✅

Fixed accessible names on ALL native form controls across 10 tool UIs:
- 26 `<input type="number">` → added `aria-label`
- 3 `<select>` → added `aria-label`
- 3 `<input type="color">` → added `aria-label`
- 3 `<input type="file">` → added `aria-label`
- 1 Radix Slider thumb → added `aria-label` pass-through in slider.tsx
- Color contrast: `text-red-500→red-600`, `text-emerald-600→emerald-700` (light theme)

**Axe: 0 serious/critical on ALL pages × light + dark ✓**
**Promoted to must-pass CI job** (was informational).

### Task B — Archive unused UI components ✅

67 files moved to `archive/unused-ui/` (62 .tsx + 5 associated). 23 components
remain in `src/components/ui/` — all used by production. Archive-import guard
test added (`tests/no-archive-imports.test.ts`).

### Task C — Dead code + unused deps ✅

- Deleted: `src/lib/dom-utils.ts`, `src/lib/runWorker.ts`, `src/lib/theme.ts` (0 importers each)
- Removed orphaned theme test
- Removed 23 unused npm deps across 3 batches (build + tests green after each batch)
- 2 uncertain deps kept: `next-pwa`, `tailwindcss-animate` (owner decides)

### Task D — Bundle measurement

Bundle sizes unchanged (unused components were tree-shaken — never imported by production):

| Page | v6.6 | v6.8 | Delta |
|------|------|------|-------|
| Home | 302 KB | 302 KB | 0 |
| Tools | 280 KB | 280 KB | 0 |
| JSON Formatter | 281 KB | 281 KB | 0 |
| Category | 279 KB | 279 KB | 0 |

Savings are in `node_modules` (fewer packages) and install time, not runtime bundle.

## Full gate table

| Gate                 | v6.8 result            | v7.0 status                    |
| -------------------- | ---------------------- | ------------------------------ |
| lint                 | ✅ 0 errors            | not yet re-verified            |
| unit tests           | ✅ 528/528             | 33 unit test files now (was 32) — not yet re-verified |
| build                | ✅ 30 pages            | should be 40 pages now (29 routes + 10 PDF tools + pdf category page) — not yet re-verified |
| smoke e2e            | ✅ 33/33               | not yet re-verified            |
| tool e2e             | ✅ 22/22               | 32 tools now (10 PDF added with fixtures) — not yet re-verified |
| axe (must-pass)      | ✅ 0 serious           | not yet re-verified on PDF pages |
| CLS                  | ✅ 0.0001              | not yet re-verified on PDF pages |
| CI build job         | ✅ includes axe        | unchanged                      |
| CI informational     | overflow + motion only | unchanged                      |

## Resume point

**Next session — verify v7.0 PDF batch-1 on CI:**

1. Check CI run on `v7.0-pdf-batch1` after the last push (commit `2610cf6`)
2. If lint/unit/build/smoke/tool-e2e/axe/CLS all green → ready for owner review
3. If any red → fix per-tool, re-push, re-verify
4. Owner merges `v7.0-pdf-batch1` → `main` → Cloudflare Pages auto-deploys
5. After merge: start v7.0 PDF batch-2 (next 10 PDF tools per `unqtools-docs` Tool Catalog)

## Branch map (current)

| Branch                  | Status          | Notes                                                  |
| ----------------------- | --------------- | ------------------------------------------------------ |
| `main`                  | production      | at v6.9 (commit 6773d51)                               |
| `v7.0-pdf-batch1`       | active work     | 10 PDF tools + pdf-lib + lockfile workflow — IN PROGRESS |
| `v6.9-all-categories`   | merged to main  | kept for history                                       |
| `v6.8-cleanup`          | merged earlier  | kept for history                                       |
| older v6.x branches     | history         | not active                                             |
