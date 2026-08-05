# UnQTools — Live Progress Tracker

> Single source of truth for the current working session's progress.
> Updated with **every** meaningful step so nothing is ever lost.
> Last updated: **2026-08-05 (arena/019fd1ad-unqtools)**

---

## Session goal

Keep UnQTools at **1700 tools** (owner directive: do NOT remove tools) while keeping the
v17.64 performance improvements. Explore **AI-agent-first** value-add instead of removals.

---

## Current phase

**v17.64 perf work intact; catalog restored to 1700 tools.**

### Progress log

| Date | Commit / phase | What changed |
|------|----------------|--------------|
| 2026-08-05 | **v17.64 → 6e15539** | UI polish + perf: logo 589KB→12KB, source-maps off, catalog split, counts, lazy palette, hero/LCP fix, framer-motion out of landing route. |
| 2026-08-05 | **17ad352** | Revert juggling settled; STATE.md OOM rule removed. |
| 2026-08-05 | **v17.65 (explored)** | Dedupe + dead-tool removal explored (SHA cluster, dead formats). |
| 2026-08-05 | **revert removals** | **Owner directive:** no tool removals. All removal commits reverted. **1700 tools restored.** Catalog + sitemap regenerated. Lint + tests pass. |

---

## Known constraints

- Local sandbox is **3.8 GB RAM / 2 cores**; `next build` does not complete here
  (OOM/timeout). Build verification must happen on Cloudflare's runner or a larger box.

## Next actions (owner-directed, no removals)

1. **AI-agent-first layer** — make tools usable by both humans and LLM agents:
   - natural-language → tool routing (better search)
   - JSON export on tool outputs (machine-readable for agents)
   - surface regex-explainer / code-review / structured-data helpers
2. Keep documenting every step in `STATE.md` + `docs/PROGRESS.md`.
