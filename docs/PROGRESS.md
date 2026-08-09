# UnQTools — Live Progress Tracker

> Single source of truth for the current working session's progress.
> Updated with **every** meaningful step so nothing is ever lost.
> Last updated: **2026-08-05 (arena/019fd1ad-unqtools)**

---

## Session goal

Keep UnQTools at **1700 tools** (owner directive: do NOT remove tools) while keeping the
v17.64 performance improvements. Take every tool to **god level** — see
[`GOD-LEVEL-PLAN.md`](./GOD-LEVEL-PLAN.md).

---

## Current phase

**P0 — Measure.** v17.64 perf work intact; catalog at 1700 tools.

### Progress log

| Date | Commit / phase | What changed |
|------|----------------|--------------|
| 2026-08-05 | **v17.64 → 6e15539** | UI polish + perf: logo 589KB→12KB, source-maps off, catalog split, counts, lazy palette, hero/LCP fix, framer-motion out of landing route. |
| 2026-08-05 | **17ad352** | Revert juggling settled; STATE.md OOM rule removed. |
| 2026-08-05 | **v17.65 (explored)** | Dedupe + dead-tool removal explored (SHA cluster, dead formats). |
| 2026-08-05 | **revert removals** | **Owner directive:** no tool removals. All removal commits reverted. **1700 tools restored.** Catalog + sitemap regenerated. Lint + tests pass. |
| 2026-08-05 | **P0 audit tooling** | Added `scripts/audit-tools.mjs` (dependency-free, read-only) + `docs/GOD-LEVEL-PLAN.md`. Scores every tool 0–100 on 11 god-level gates and clusters duplicate ids for **canonicalisation, not deletion**. |

---

## Known constraints

- Local sandbox is **3.8 GB RAM / 2 cores**; `next build` does not complete here
  (OOM/timeout). Build verification must happen on Cloudflare's runner or a larger box.
- **No tool removals.** 1700 tools stay; every route keeps ranking.

## Next actions

1. **Run the auditor** — `node scripts/audit-tools.mjs`, then commit
   `docs/TOOL-AUDIT.json` + `docs/TOOL-AUDIT.md`. This replaces every estimate
   with a real number (how many stubs, how many duplicate clusters, worst category).
2. **P1 kernel** — build `src/lib/god/` so history, presets, batch, exports,
   validation report, receipt, references, SEO, a11y shell, worker offload and
   agent-JSON output are written once and shared by all 1700 tools.
3. **P2 canonicalise** — one real engine per duplicate cluster; siblings become
   thin wrappers with their own presets and SEO angle. Zero tools removed.
4. **AI-agent-first layer** — natural-language → tool routing, JSON output on
   every tool (folded into the kernel as `src/lib/god/agent.ts`).
5. Keep documenting every step in `STATE.md` + `docs/PROGRESS.md`.
| 2026-08-05 | **v17.66: Timezone Converter** | **Added high-demand tool `timezone-converter`** (developer). Fully offline via browser Intl/IANA DB — convert between any two zones, all-zones view, DST-aware, UTC offset, 12/24h toggle, Now/Swap/Copy. Tool count 1700 → **1701**. 4 files + 11 unit tests. Registered in registry + loader; catalog/sitemap regenerated (1716 URLs); lint + tests pass. |
