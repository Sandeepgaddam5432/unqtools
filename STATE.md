# UnQTools — Build State

_Last updated: 2026-08-09 — branch arena/019fe601-unqtools. Tool count: 1679. Perf work (v17.71) intact. Owner directive (v18): consolidate tools into fewer, powerful mega tools + kill the "which tool do I need?" confusion._

## Current phase

**v18.3 — PDF 100x wave 2: next 10 alphabetical PDF tools rebuilt (flatten, interleave, n-up, markdown, blank-removal, resize, rtf, scale, svg, text). 1,679 tools live.**

- **v18.3 (PDF 100x wave 2):** Continued the 100x program with the next 10 PDF tools:
  **Flatten PDF** (choose fields/annotations/JS/metadata + removal report), **Interleave PDF**
  (cycles + start-with), **N-Up PDF** (1–16/sheet + grids + row/column + borders + sheet
  numbers), **Markdown to PDF** (GFM tables + page numbers + selectable text), **Remove Blank
  Pages** (sensitivity levels + scan-range + preview), **Resize PDF Pages** (7 presets + pt/mm/in
  + fit content), **RTF to PDF** (real unicode/hex/tab/par parser), **Scale PDF Content**
  (10–1000% + anchors), **SVG to PDF** (fit modes + transparent + DPI), **Text to PDF**
  (3 fonts + alignment + header/footer + page numbers). Backward-compatible; 7,486 PDF tests
  pass (+50 new); ESLint clean; no removals. Full table: [`docs/PDF-100x-TOOLS.md`](./PDF-100x-TOOLS.md).

**v18.2 — PDF 100x wave: 10 selected PDF tools rebuilt to beat the competition. 1,679 tools live.**

- **v18.2 (PDF 100x):** Web-researched competitor features (iLovePDF = 3 presets + server upload,
  SmallPDF = 2/day, Sejda = some page-level options) then rebuilt the 10 selected PDF tools to be
  100x: **Compress PDF** (5 presets + custom quality + downscale + grayscale + **exact target size**
  + batch 20 files + ZIP + real in-browser JPEG re-encoding), **Crop PDF** (presets + units + per-page
  + live preview + reset), **HTML to PDF** (page setup + page numbers + multi-page), **Page Numbers**
  (7 formats + positions + start/skip + bold/color + prefix/suffix), **Watermark** (text/image + 4
  placements + 9 anchors + rotation + extras), **Merge interleave**. Full breakdown:
  [`docs/PDF-100x-TOOLS.md`](./PDF-100x-TOOLS.md). 7,436 PDF tests pass; no removals.

**v18.1 — Anti-confusion UX: task-based groups, "Ready now" default, intent search, task cards. 1679 tools live.**

- **v18.1 (anti-confusion):** Users land on a wall of 1,679 tools and don't know which
  one fits their task. Fixed with best-practice UX:
  1. **Task-based grouping** (`src/lib/tool-groups.ts`, 11 unit tests) — the 7 biggest
     categories (pdf, developer, image, file, text, seo, network-security) split into
     job buckets ("Page editing", "Merge & split", "Compress & optimize", "Protect &
     sign", "Convert from/to PDF"…). Category pages now render grouped sections with
     jump-to chips + "N ready · M coming soon" counts instead of one flat grid.
  2. **"Ready now (1133)" is the default tools filter** — the 546 "Coming Soon" stubs
     are hidden by default (All (1679) toggle still available). No more users clicking
     a promising tool only to hit "UI coming soon".
  3. **Intent search** (`src/lib/search.ts`) — everyday phrasing now finds tools:
     "make my PDF smaller" → Compress PDF, "join two pdfs" → Merge PDF, "lock my file"
     → encrypt/password tools. 13 search tests.
  4. **Home page "What do you want to do?" task cards** — 6 common tasks with plain
     descriptions link straight to the right tools/search.
  5. **Task-based search placeholder** — "What do you want to do? e.g. 'make my PDF smaller'".
  Verified: /tools + /category/pdf + / SSR render all new sections; 46 unit tests pass;
  ESLint clean; scoped tsc clean.

**v18.0 — Consolidation wave 1: PDF Page Manager (26 tools → 1). 1679 tools live.**

Live progress is tracked in [`docs/PROGRESS.md`](./docs/PROGRESS.md).
Consolidation roadmap: [`docs/MERGE-PLAN.md`](./docs/MERGE-PLAN.md).
Growth & monetization: [`docs/ROADMAP-v18.md`](./docs/ROADMAP-v18.md).

- **v18.0:** **Merged 26 PDF page tools → `pdf-page-manager`** (delete, extract,
  duplicate, insert, reorder, rotate, reverse in one tabbed mega tool; self-contained
  `logic.ts` with 12 unit tests; old URLs 301-redirect via `public/_redirects`).
  **Tool-page UX reorg:** tool UI is now the hero — About / FAQ / Related live behind
  compact tabs instead of full-page sections. Tool count 1704 → **1679** (26 merged − 1 new).
  Catalog/sitemap/TOOLS-INDEX/counts regenerated (1694 URLs). Docs added:
  `docs/MERGE-PLAN.md` (125 remaining duplicate clusters → future mega tools),
  `docs/ROADMAP-v18.md` (domain, top-50 traffic-first, UnQ AI, B2B API, ₹1L/day path).
  Removed tool dirs deleted; registry cleaned; tests 38 pass; ESLint clean on touched files.
- **v17.72:** Added **Favorites + Recently viewed tools** (site-wide, localStorage-only, privacy-first):
  `src/lib/tool-history.ts` (pure, 14 unit tests) + `src/hooks/use-tool-history.ts` (cross-tab sync).
  ★ button on every tool card and tool page; Favorites/Recent quick-filter chips on `/tools`
  (`?view=favorites|recent` linkable); Favorites + Recent groups in the ⌘K palette (unified recent
  storage, was `unq-cmdk-recents`). Also added **`docs/TOOLS-INDEX.md`** — auto-generated catalog of
  all **1,704 tools** (via `scripts/generate-tools-index.mjs`), linked from README. Fixed pre-existing
  framer-motion `Variants` type widening in the tools page (now explicitly typed). All 1,704 tools intact.
- **v17.66:** Added **Timezone Converter** (developer) — offline, DST-aware. 1700 → **1701**.
- **v17.67:** Added **XML Formatter** (developer), **Email Validator** (developer),
  **Currency Converter** (calculators, offline reference rates). Tool count → **1704**.
  All 100% offline. Lint + tests pass; catalog/sitemap regenerated (1719 URLs).
- **v17.68:** **Codebase cleanup (ponytail)** — deleted dead code: `archive/` (1.1MB,
  84 files) + 6 unused UI components. **All 1704 tools intact.** no-archive-imports +
  51 tests pass; lint clean.
- **v17.69:** **CSS perf (ponytail)** — removed 5 unused Tailwind animation tokens
  (marquee/meteor/orbit/ripple). globals.css 12.3KB→10.9KB. Perf work confirmed intact.
- **v17.70:** Fixed stale `counts.ts` (1700→**1704**, matching actual tools — the 4 new tools weren't counted). Added 3 missing category cards (`education`, `social`, `ai`) to home page so all **13 categories** show (was 10).
- **v17.71:** Removed last `framer-motion` from landing route (`pwa-install.tsx` converted to pure CSS `.unq-animate-fade-in-up` + hover translate). Entire landing route is now 100% framer-motion-free (~62KB gz savings on landing JS).

- **v17.64 perf work (intact):** logo 589KB→12KB, source-maps off, catalog split,
  counts, lazy command palette, hero/LCP fix, framer-motion out of landing route.
- **Tool removals reverted:** the dedupe/dead-tool removal commits were reverted —
  **1704 tools live** (no tools removed), as the owner directed.
- **State:** working tree clean; lint + tests pass; catalog + sitemap regenerated (1719 URLs).

### Tool count: 1704 tools live

| Category | Count |
|----------|-------|
| developer | 466 |
| pdf | 330 |
| image | 178 |
| seo | 109 |
| file | 100 |
| ai | 100 |
| network-security | 96 |
| text | 83 |
| calculators | 57 |
| business | 55 |
| education | 45 |
| audio-video | 45 |
| social | 40 |
| **Total** | **1704** |

### Recent commits on `main`

| Commit | Description |
|--------|-------------|
| 3e7bf75 | feat: v17.71 — perf + high-demand tools + cleanup (remove framer-motion from landing route) |
| (v17.70) | fix: v17.70 — fix tool counts in counts.ts (1704) and add 3 missing category cards |
| (v17.69) | perf: v17.69 — CSS perf, remove unused Tailwind animation tokens |
| (v17.68) | refactor: v17.68 — codebase cleanup, remove archive/ and unused UI components |
| (v17.67) | feat: v17.67 — 3 new offline tools (XML Formatter, Email Validator, Currency Converter) |
| (v17.66) | feat: v17.66 — Timezone Converter tool |
| 6e15539 | perf: v17.64 — logo 589KB→12KB, source-maps off, catalog split, counts, lazy palette, hero/LCP fix, framer-motion out of landing route |
| c4c82d0 | feat: v17.63 — Rebuild 30 tools with 100% blueprint compliance + audit report |
| 57f10c5 | feat: v17.62 — AI Chat with PDF (1 tool, full blueprint compliance) |
| c2dd8e4 | fix: v17.61.1 — fix duplicate import variable names in registry.ts |
| fcebfeb | feat: v17.61 — 17 new blueprint-sourced tools (8 Network + 9 Image) |
| 39949f1 | feat: v17.60 — 136 new blueprint-sourced tools (80 Developer + 56 PDF) |
| 286d1c1 | feat: v17.59 — 95 new blueprint-sourced tools (45 Developer + 50 PDF) |
| 4ce8fc6 | fix: v17.59.1 — fix invalid \uXXXX escape sequence in unicode-escape manifest |
| 2e39b0c | feat: v17.56 — 100 new blueprint-sourced tools (14 SEO + 33 Network + 53 Image) |
| b4a7275 | fix: v17.55.3 — fix setState-in-useMemo infinite re-render bug (45 files) |
| 3d48090 | fix: v17.55.2 — remove duplicate pad2/pad3 declarations in iso-8601 UI |
| eae842c | fix: v17.55.1 — 4 missing/broken imports that caused build failures |
| f704c2b | feat: v17.55 — 59 new blueprint-sourced tools — ZERO SKIPS |

### Production quality checks (all pass)

1. **Babel parse**: 0 failures / 6812 files (all .ts/.tsx)
2. **Escape sequences**: 0 invalid escape sequences
3. **Manifest preflight**: 0 duplicate IDs, 0 invalid icons, 0 imports inside TOOLS array
4. **setState in useMemo**: 0 infinite re-render bugs
5. **Blueprint compliance audit**: See `BLUEPRINT-COMPLIANCE-AUDIT.md`

### Known issues

- **555 tools** built in v17.56–v17.61 used generic template logic instead of implementing actual blueprint features. 30 have been rebuilt in v17.63. The remaining 565 generic template/mock tools across developer, pdf, and network-security categories are now explicitly marked with `status: "planned"` (Coming Soon) in their manifest.ts and display "Coming Soon" badges and alert notices in the UI until they are rebuilt. See `BLUEPRINT-COMPLIANCE-AUDIT.md` for the full list.
