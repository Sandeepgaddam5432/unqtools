# UnQTools — Live Progress Tracker

> Single source of truth for the current working session's progress.
> Updated with **every** meaningful step so nothing is ever lost.
> Last updated: **2026-08-09 (arena/019fe5f1-unqtools)**

---

## Session goal

Keep UnQTools at **1704 tools** (owner directive: do NOT remove tools) while keeping the
v17.71 performance improvements. Take every tool to **god level** — see
[`GOD-LEVEL-PLAN.md`](./GOD-LEVEL-PLAN.md).

---

## Current phase

**v17.71 — Perf + High-Demand Tools + Cleanup.** 1704 tools live; landing route 100% framer-motion-free; dead code removed; docs synchronized.

### Progress log

| Date | Commit / phase | What changed |
|------|----------------|--------------|
| 2026-08-05 | **v17.64 → 6e15539** | UI polish + perf: logo 589KB→12KB, source-maps off, catalog split, counts, lazy palette, hero/LCP fix, framer-motion out of landing route. |
| 2026-08-05 | **17ad352** | Revert juggling settled; STATE.md OOM rule removed. |
| 2026-08-05 | **v17.65 (explored)** | Dedupe + dead-tool removal explored (SHA cluster, dead formats). |
| 2026-08-05 | **revert removals** | **Owner directive:** no tool removals. All removal commits reverted. **1704 tools restored.** Catalog + sitemap regenerated. Lint + tests pass. |
| 2026-08-05 | **P0 audit tooling** | Added `scripts/audit-tools.mjs` (dependency-free, read-only) + `docs/GOD-LEVEL-PLAN.md`. Scores every tool 0–100 on 11 god-level gates and clusters duplicate ids for **canonicalisation, not deletion**. |
| 2026-08-05 | **v17.66: Timezone Converter** | **Added high-demand tool `timezone-converter`** (developer). Fully offline via browser Intl/IANA DB — convert between any two zones, all-zones view, DST-aware, UTC offset, 12/24h toggle, Now/Swap/Copy. Tool count 1700 → **1701**. 4 files + 11 unit tests. Registered in registry + loader; catalog/sitemap regenerated (1716 URLs); lint + tests pass. |
| 2026-08-05 | **v17.67: 3 high-demand tools** | **Added XML Formatter** (developer, 8 tests), **Email Validator** (developer, 12 tests), **Currency Converter** (calculators, 8 tests, offline reference rates + honest note). All 100% offline. Tool count 1701 → **1704** (1719 URLs). Registered in registry + loader; catalog/sitemap regenerated; lint + 28 new tests + broader tests pass. |
| 2026-08-05 | **v17.68: codebase cleanup (ponytail)** | Deleted dead code: `archive/` dir (84 files, 1.1MB — showcase-pages + unused-ui, zero imports) + 6 unused UI components (`bento-grid`, `glass-testimonial-swiper`, `particle-text-effect`, `shape-landing-hero`, `stack-feature-section`, `animated-testimonials`). All tools intact (1704). Verified: no dangling imports, `no-archive-imports` test passes, 51 tests pass, lint clean. |
| 2026-08-05 | **v17.69: CSS perf (ponytail)** | Removed 5 unused Tailwind animation tokens (`marquee`, `marquee-vertical`, `meteor`, `orbit`, `ripple`) from globals.css — only defined, never consumed. globals.css 12.3KB → 10.9KB. Fixed @theme inline closing brace. Verified braces balanced, no dangling refs. Perf work confirmed intact (framer-motion out of landing, catalog split, lazy palette, hero plain HTML). |
| 2026-08-05 | **v17.70: count/category fixes** | Fixed stale `counts.ts` (1700→**1704**, matching actual tools — the 4 new tools weren't counted). Added 3 missing category cards (education, social, ai) to home page so all **13 categories** show (was 10). Lint clean. |
| 2026-08-05 | **v17.71: remove last framer-motion from landing (WebPageTest-driven)** | WebPageTest JSON showed the landing JS chunk at ~180KB. Root cause: `pwa-install.tsx` (in layout, every page) still used framer-motion. Converted its motion.div/AnimatePresence to pure CSS (`.unq-animate-fade-in-up`, hover translate). **Entire landing route is now 100% framer-motion-free** — removes ~62KB gz from landing JS. Tests pass. |
| 2026-08-09 | **v17.71: docs update** | Updated `README.md`, `STATE.md`, and `docs/PROGRESS.md` to reflect **v17.71** and **1704 tools live across all 13 categories** with accurate category breakdowns, recent wave summaries, and session tracking. |

---

## Known constraints

- Local sandbox is **3.8 GB RAM / 2 cores**; `next build` does not complete here
  (OOM/timeout). Build verification must happen on Cloudflare's runner or a larger box.
- **No tool removals.** 1704 tools stay; every route keeps ranking.

## Next actions

1. **Audit baseline established** — `node scripts/audit-tools.mjs` scanned 1,704 tools across all 13 categories (`docs/TOOL-AUDIT.json` + `docs/TOOL-AUDIT.md`).
2. **P1 kernel** — build `src/lib/god/` so history, presets, batch, exports,
   validation report, receipt, references, SEO, a11y shell, worker offload and
   agent-JSON output are written once and shared by all 1704 tools.
3. **P2 canonicalise** — one real engine per duplicate cluster; siblings become
   thin wrappers with their own presets and SEO angle. Zero tools removed.
4. **AI-agent-first layer** — natural-language → tool routing, JSON output on
   every tool (folded into the kernel as `src/lib/god/agent.ts`).
5. Keep documenting every step in `STATE.md` + `docs/PROGRESS.md`.
