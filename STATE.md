# UnQTools — Build State

_Last updated: 2026-07-08 by GLM (z.ai sandbox) — v7.2 Batch A complete, pushing to main_

## Current phase

**v7.2 "20-tool production-ready PDF batch" — Batch A COMPLETE ✅, pushing to `main`**

Owner approved 20-tool production-ready batch plan. 4 batches × 5 tools.
Batch A (5 page-manipulation tools) implemented, tested, verified locally.
All work directly on `main` (no feature branches, per owner policy).

### Recent commits on `main`

| Commit   | Description                                                                                |
| -------- | ------------------------------------------------------------------------------------------ |
| (pending)| feat: v7.2 Batch A — 5 PDF page-manipulation tools + axe cap bump (compress, reverse, duplicate, insert, interleave) |
| 23ba653  | feat: v7.1 — advanced merge-pdf + split-pdf (drag-drop, preview, templates, metadata)      |
| 86cd3ec  | docs: STATE.md — v7.0 PDF batch-1 MERGED to main, deployed to production                   |

## v7.2 — 20-tool production-ready PDF batch 🟡 in progress

### Batch plan (4 batches × 5 tools)

| Batch | Theme | Tools | New deps | Est. time | Status |
|-------|-------|-------|----------|-----------|--------|
| **A** | Page manipulation | compress-pdf, reverse-pdf, duplicate-pdf-pages, insert-pdf-pages, interleave-pdf | none | ~10h | ✅ DONE |
| **B** | Page geometry | crop-pdf, resize-pdf-pages, scale-pdf, n-up-pdf, remove-blank-pages | none | ~10h | ⏳ NEXT |
| **C** | Structure & annotations | pdf-bookmarks-editor, pdf-page-labels, flatten-pdf, pdf-stamp, pdf-sign-draw | none | ~15h | ⏳ |
| **D** | Simple conversions | text-to-pdf, html-to-pdf, markdown-to-pdf, rtf-to-pdf, svg-to-pdf | jspdf + marked | ~15h | ⏳ |

### Batch A — Page manipulation ✅ COMPLETE

5 tools shipped. All pure pdf-lib, all build on existing `_shared/page-ranges.ts`.

| # | Tool ID | What it does | Tests | Status |
|---|---|---|---|---|
| 1 | `compress-pdf` | useObjectStreams:true + optional metadata strip | 9 | ✅ |
| 2 | `reverse-pdf` | Reverse page order — errors on <2 pages | 8 | ✅ |
| 3 | `duplicate-pdf-pages` | Clone selected pages N times (1–100) | 10 | ✅ |
| 4 | `insert-pdf-pages` | Insert pages from 2nd PDF at position N | 11 | ✅ |
| 5 | `interleave-pdf` | Merge 2 PDFs alternating pages (A1,B1,A2,B2…) | 8 | ✅ |

### Verification

| Gate | Result |
|------|--------|
| lint | ✅ 0 errors |
| unit tests | ✅ 695/695 pass (was 649, +46 new tests) |
| build | ✅ 54 pages (was 49, +5 new tool pages) |
| tool count | ✅ 37 tools (was 32, +5 new PDF tools) |

### Infra changes

- `tests/axe.e2e.ts` — bumped `slice(0, 15)` → `slice(0, 30)` so all 15 PDF tools get scanned
- `tests/tool.e2e.ts` — +5 e2e entries (dropzone-render assertions)
- `src/lib/registry.ts` — +5 imports + 5 TOOLS entries
- `src/app/tools/[id]/tool-page-client.tsx` — +5 lazy UI loaders

### Files touched (24)

- 5 × `manifest.ts` (one per tool)
- 5 × `logic.ts`
- 5 × `logic.test.ts`
- 5 × `ui.tsx`
- `src/lib/registry.ts` (5 imports + 5 entries)
- `src/app/tools/[id]/tool-page-client.tsx` (5 loaders)
- `tests/tool.e2e.ts` (5 entries)
- `tests/axe.e2e.ts` (cap bump)
- `STATE.md` (this update)

### What's NOT in Batch A (deferred)

- **Web Worker support** — pdf-lib still runs on main thread. Deferred to v7.3.
- **PDF thumbnail previews** — showing first page as thumbnail. Deferred.
- **Visual page selection** — clicking pages on a visual grid instead of typing ranges. Deferred to a future UX batch.

### Per-tool deliverables (production-ready definition)

Each tool ships with:
- `manifest.ts` — id, name, description, category="pdf", keywords[7+], icon, requiresNetwork:false, seo{title, faq[3-4]}, status:"done"
- `logic.ts` — pure functions returning `ToolResult<T>`, try/catch around pdf-lib, user-friendly errors
- `logic.test.ts` — Vitest 8-15 tests (valid, invalid, edge, large)
- `ui.tsx` — React client component, dropzone, ActionBar, ErrorBanner, privacy footer, proper a11y
- `registry.ts` — +1 import + 1 entry
- `tool-page-client.tsx` — +1 lazy loader
- `tests/tool.e2e.ts` — +1 entry with at minimum "page renders dropzone" assertion

### Infra changes in Batch A

- `tests/axe.e2e.ts` — bump `slice(0, 15)` → `slice(0, 30)` so all PDF tools get scanned
- `src/tools/pdf/_shared/download.ts` — already has `downloadBytes` + `formatBytes` (reused)

### After Batch A

- 32 → 37 tools live
- 49 → 54 build pages
- 649 → ~690+ unit tests (5 tools × ~8-10 tests each)

### Risk callouts

1. **Bundle bloat** — pdf-lib already duplicated across 2 chunks (172 KB gz each). After 20 more PDF tools, may need Turbopack chunking strategy review in Batch C/D.
2. **`remove-blank-pages` detection** (Batch B) — pdf-lib doesn't expose content streams directly. Will need content-stream inspection workaround.
3. **`html-to-pdf`** (Batch D) — html2canvas is heavy (~200 KB) and produces raster output. Will document quality limitation in FAQ.
4. **axe slice cap** — bumping to 30 in Batch A. May need to remove cap entirely by Batch D (40+ tools).

## v7.1 — advanced merge-pdf + split-pdf ✅ COMPLETE

Owner picked 2 tools (merge-pdf + split-pdf) to make "the most advanced + most
useful + much better". v7.1 shipped major UX + capability upgrades for both:

- merge-pdf: drag-and-drop reorder, custom output filename, optional title/
  author/subject metadata on merged PDF, live total-page-count preview,
  collapsible "Output settings" panel, better Run button label with page count
- split-pdf: live preview of split plan (no actual split until user clicks),
  custom filename template with 6 placeholders ({base}{n}{start}{end}{count}{spec}),
  reverse output order toggle, per-output startPage/endPage tracking, "Download
  all" with progress, better preview list (50-row scrollable, "and N more")

29 new unit tests added (620 → 649 total). Backward compat preserved —
existing per-mode default filename templates (`{base}-page-{n}` for single,
`{base}-pages-{spec}` for ranges, `{base}-part-{n}` for every) still apply
unless user provides a custom template.

v7.1 deployed to production on commit `23ba653`. Both tools verified live at
https://unqtools.pages.dev/tools/merge-pdf + /tools/split-pdf.

## v7.0 — PDF batch-1 ✅ COMPLETE (merged to main, deployed)

10 PDF tools shipped. Merged via merge commit `6f0de52`. Production verified
at https://unqtools.pages.dev — all 10 PDF tool routes return HTTP 200.

For full v7.0 history see git log: `23953e4` (pdf-lib added) through `86cd3ec`
(final STATE.md update before merge).

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

| Gate                 | v6.8 result            | v7.2 Batch A status            |
| -------------------- | ---------------------- | ------------------------------ |
| lint                 | ✅ 0 errors            | ✅ 0 errors (verified locally) |
| unit tests           | ✅ 528/528             | ✅ 695/695 (verified locally, +46 new) |
| build                | ✅ 30 pages            | ✅ 54 pages (verified locally, +5 new) |
| smoke e2e            | ✅ 33/33               | 🟡 pending CI auto-run         |
| tool e2e             | ✅ 22/22               | 🟡 pending CI auto-run (37 tools) |
| axe (must-pass)      | ✅ 0 serious           | 🟡 pending CI auto-run (cap 15→30) |
| CLS                  | ✅ 0.0001              | 🟡 pending CI auto-run         |
| CI build job         | ✅ includes axe        | 🟡 pending CI auto-run         |
| CI informational     | overflow + motion only | ❌ overflow expected to still fail (pre-existing — does NOT block) |
| Cloudflare deploy    | n/a                   | 🟡 will auto-deploy once CI green |

## Resume point

**Next session — verify CI auto-run on v7.2 Batch A push + production deploy:**

1. CI auto-runs on the Batch A commit push to `main`
2. Expect: lint + tests + build + smoke + tool e2e + CLS + axe all green (695 unit tests, 54 pages, 37 tools)
3. axe slice cap bumped 15→30 so all 15 PDF tools get scanned
4. Informational overflow will still fail (pre-existing — does NOT block)
5. Cloudflare Pages auto-deploys once CI green
6. Verify production at https://unqtools.pages.dev/tools/{compress-pdf,reverse-pdf,duplicate-pdf-pages,insert-pdf-pages,interleave-pdf}
7. After Batch A verified → start Batch B (page geometry: crop-pdf, resize-pdf-pages, scale-pdf, n-up-pdf, remove-blank-pages)

## Branch map (current)

| Branch                  | Status          | Notes                                                  |
| ----------------------- | --------------- | ------------------------------------------------------ |
| `main`                  | production      | v7.2 Batch A pushing (10 PDF from v7.0 + 2 advanced from v7.1 + 5 new from Batch A = 37 total tools) |
| (all others deleted)    | —               | Per owner policy: only `main` branch exists. |

