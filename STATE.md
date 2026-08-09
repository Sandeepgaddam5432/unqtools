# UnQTools — Build State

_Last updated: 2026-08-09 — branch arena/019fe5f1-unqtools. Tool count: 1704. Perf work (v17.71) intact._

## Current phase

**v17.71 — 1704 tools live, perf + high-demand tools + cleanup intact (owner directive: no removals).**

Live progress is tracked in [`docs/PROGRESS.md`](./docs/PROGRESS.md).

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
