# UnQTools — Build State

_Last updated: 2026-07-05 by GLM (z.ai sandbox) — v7.1 advanced merge+split PDF, deploying to production_

## Current phase

**v7.1 "Advanced merge+split PDF" — IN PROGRESS 🟡 ON `main`**

Owner picked 2 tools (merge-pdf + split-pdf) to make "the most advanced + most
useful + much better". v7.1 ships major UX + capability upgrades for both:

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

### Recent commits on `main`

| Commit   | Description                                                                                |
| -------- | ------------------------------------------------------------------------------------------ |
| (pending)| feat: v7.1 — advanced merge-pdf + split-pdf (drag-drop, preview, templates, metadata)      |
| 86cd3ec  | docs: STATE.md — v7.0 PDF batch-1 MERGED to main, deployed to production                   |
| 6f0de52  | Merge v7.0 PDF batch-1 into main (merge commit — 17 commits from v7.0-pdf-batch1)          |
| e96355a  | docs: STATE.md — v7.0 PDF batch-1 CI GREEN, ready for owner review                         |
| 37c9836  | fix: axe flake — bump waitForTimeout to 3000ms so /tools 32-card stagger completes         |
| 2ed6a1c  | fix: P0 batch — CI branch trigger + setKeywords split + images-to-pdf accept fix           |

## v7.1 — advanced merge-pdf + split-pdf 🟡 in progress

### merge-pdf new features

| Feature | What it does |
|---|---|
| **Drag-and-drop reordering** | Native HTML5 drag handle on each file card. Drag to reorder. Up/down arrow buttons still work for keyboard / accessibility. |
| **Custom output filename** | Optional text field (defaults to "merged"). Live preview of final filename with `.pdf` extension shown. |
| **Title/Author/Subject metadata** | Optional fields in collapsible "Output settings" panel. Embedded into the merged PDF and show up in document properties. |
| **Live total-page-count preview** | As files are added / page ranges edited / files reordered, the UI shows "N files • M pages in output" in real time via `previewMerge()`. |
| **Producer/Creator + dates set** | Merged PDF always gets `Creator: "UnQTools — Merge PDF"` + current creation/modification dates. (Producer is overridden by pdf-lib on save — known pdf-lib limitation.) |
| **Better Run button label** | "Merge 3 PDFs · 12 pages" instead of just "Merge 3 PDFs" — user sees what they'll get before clicking. |
| **Better result card** | Shows file size + page count on the result card. |

### split-pdf new features

| Feature | What it does |
|---|---|
| **Live preview** | As user types ranges or changes mode/every/reverse, a preview list updates in real time showing exactly which files will be created (filename + page range + page count). Up to 50 rows visible, "… and N more" beyond. |
| **`previewSplit()` API** | New pure-logic function that returns the split plan WITHOUT doing the actual split. UI calls this for live preview; `splitPdf()` now also uses it internally. |
| **Custom filename template** | Text field with 6 placeholders: `{base}`, `{n}`, `{start}`, `{end}`, `{count}`, `{spec}`. Default per mode: `{base}-page-{n}` (single), `{base}-pages-{spec}` (ranges), `{base}-part-{n}` (every). Backward compatible. |
| **Filename template help** | Collapsible `<details>` block in the UI shows all 6 placeholders with examples. |
| **Reverse output order** | Checkbox toggle. Reverses the order of output files (last pages first). Useful for "newest first" workflows. |
| **Per-file startPage + endPage** | Each `SplitOutputFile` now includes `startPage` and `endPage` (1-indexed, source PDF). UI shows "Pages 2-3 • 2 pages • 12.4 KB". |
| **"Download all" with progress** | Sequential downloads with 400ms gap (avoids browser multi-download prompt). Button shows "Downloading…" state. |
| **Total size in results** | Shows "3 files ready • 47.2 KB total" so user knows what they're getting. |
| **Better mode descriptions** | Each split mode (ranges/every/single) has a hint explaining what it does. |
| **Path-separator stripping** | Template sanitization prevents directory traversal — `/` and `\` in user input are replaced with `-`. |
| **Producer/Creator + dates on each split file** | Each output PDF gets `Creator: "UnQTools — Split PDF"` + current dates. (Producer overridden by pdf-lib — known limitation.) |

### Verification

| Gate | Result |
|------|--------|
| lint | ✅ 0 errors |
| unit tests | ✅ 649/649 pass (was 620, +29 new tests covering: merge metadata, previewMerge, getMergeOutputName, splitPdf v7.1 features, previewSplit, formatSplitName with 6 placeholders) |
| build | ✅ 49 pages, no errors |

### Files touched (5)

- `src/tools/pdf/merge-pdf/logic.ts` — added MergeOptions, MergePreview types; new `previewMerge()` + `getMergeOutputName()` functions; mergePdfs now accepts options + sets metadata + dates
- `src/tools/pdf/merge-pdf/ui.tsx` — full rewrite: drag-drop, output settings panel, live preview, better labels
- `src/tools/pdf/split-pdf/logic.ts` — added SplitPreview types; new `previewSplit()` function; `formatSplitName()` now supports `{spec}` placeholder; per-mode default templates preserved for backward compat
- `src/tools/pdf/split-pdf/ui.tsx` — full rewrite: live preview, filename template, reverse toggle, download-all with progress
- `src/tools/pdf/merge-pdf/logic.test.ts` + `src/tools/pdf/split-pdf/logic.test.ts` — +29 new tests across 4 new describe blocks (mergePdfs v7.1, previewMerge, getMergeOutputName, splitPdf v7.1, previewSplit, formatSplitName)

### What's NOT in v7.1 (deferred)

- **Web Worker support** — pdf-lib still runs on main thread; large PDFs (100MB+) will block UI. Deferred to v7.2 batch.
- **PDF thumbnail previews** — showing the first page of each PDF as a thumbnail. Would need pdf-lib + canvas rendering. Deferred.
- **Bookmark/outline preservation** — pdf-lib's `copyPages` doesn't copy bookmarks. Deferred.
- **Other PDF tools** (rotate, delete, extract, reorder, images-to-pdf, page-numbers, watermark, metadata-editor) — owner said only these 2 tools for now.

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

| Gate                 | v6.8 result            | v7.1 status (post-v7.1 push) |
| -------------------- | ---------------------- | ------------------------------ |
| lint                 | ✅ 0 errors            | ✅ 0 errors (verified locally) |
| unit tests           | ✅ 528/528             | ✅ 649/649 (verified locally, +29 new for v7.1) |
| build                | ✅ 30 pages            | ✅ 49 pages (verified locally) |
| smoke e2e            | ✅ 33/33               | 🟡 pending CI auto-run on main push |
| tool e2e             | ✅ 22/22               | 🟡 pending CI auto-run (32 tools now) |
| axe (must-pass)      | ✅ 0 serious           | 🟡 pending CI auto-run (waitForTimeout=3000ms flake fix from v7.0 should hold) |
| CLS                  | ✅ 0.0001              | 🟡 pending CI auto-run |
| CI build job         | ✅ includes axe        | 🟡 pending CI auto-run |
| CI informational     | overflow + motion only | ❌ overflow expected to still fail (pre-existing, deferred — `continue-on-error: true`, does NOT block) |
| Cloudflare deploy    | n/a                   | 🟡 will auto-deploy once CI green |

## Resume point

**Next session — verify CI auto-run on v7.1 push + production deploy:**

1. CI auto-runs on the v7.1 commit push to `main` (work directly on main per owner policy)
2. Expect: lint + tests + build + smoke + tool e2e + CLS + axe all green (649 unit tests verified locally)
3. Informational overflow will still fail (pre-existing — does NOT block)
4. Cloudflare Pages auto-deploys once CI green
5. Verify production at https://unqtools.pages.dev/tools/merge-pdf + /tools/split-pdf:
   - merge-pdf: drag-drop reorder files, set custom filename + title metadata, see live page count
   - split-pdf: type ranges → see live preview of filenames, set custom template, toggle reverse, download all
6. If owner approves → continue to v7.2 (apply same advanced treatment to other 8 PDF tools, or add Web Workers for large PDF support)

## Branch map (current)

| Branch                  | Status          | Notes                                                  |
| ----------------------- | --------------- | ------------------------------------------------------ |
| `main`                  | production      | v7.1 in progress on main (10 PDF tools live from v7.0 + 2 advanced in v7.1) |
| (all others deleted)    | —               | Per owner policy: only `main` branch exists. |

