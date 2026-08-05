# UnQTools — Live Progress Tracker

> Single source of truth for the current working session's progress.
> Updated with **every** meaningful step so nothing is ever lost.
> Last updated: **2026-08-05 (arena/019fd1ad-unqtools)**

---

## Session goal (owner directive)

Make UnQTools useful to **every user and every AI agent** in the modern era by:

1. **Consolidating duplicate tools** (same job, many near-identical entries) so the
   catalog is clean and searchable.
2. **Retiring genuinely dead tools** (legacy/dead file formats + fading fads) to free
   up catalog slots and reduce confusion.
3. **Adding an AI-agent-first layer** so humans and LLM agents can both use the tools
   naturally (natural-language routing, structured/JSON output, regex explainer, etc.).
4. **Keeping every progress step documented** in `STATE.md` + `docs/PROGRESS.md`.

**Style:** conversational replies are English-with-Telugu-words (owner directive).
**Docs, code, commit messages:** standard English.

---

## Current phase: analysis complete → build starts

### Step 0 — Investigation findings (2026-08-05, verified)

**Tool inventory:** 1,700 tools / 13 categories.
| Category | Total | `done` | `planned` |
|----------|------:|------:|----------:|
| developer | 463 | 187 | 276 |
| pdf | 330 | 66 | 264 |
| image | 178 | 178 | 0 |
| seo | 109 | 109 | 0 |
| file | 100 | 100 | 0 |
| network-security | 96 | 71 | 25 |
| text | 83 | 83 | 0 |
| calculators | 56 | 56 | 0 |
| business | 55 | 55 | 0 |
| audio-video | 45 | 45 | 0 |
| education | 45 | 45 | 0 |
| social | 40 | 40 | 0 |
| ai | 100 | 100 | 0 |

### Step 0b — Duplicate clusters identified (consolidation candidates)

| Job | Near-identical tools | Action |
|-----|---------------------|--------|
| SHA hash | `sha1-hash-generator` + `sha1-hash-tool`, `sha256-…`, `sha3-…`, `sha512-…` (each x2) + `hash-generator` + `hashing-tool` + `hashing-tool-md5-sha1-sha256` | Merge into 1-2 canonical hash tools |
| JWT | `jwt-decoder`, `jwt-debugger`, `jwt-claim-extractor`, `jwt-verifier`, `jwt-generator`, `jwt-generator-signer`, `jwt-signer` | Consolidate |
| MAC address | `mac-address-generator`, `-vendor-lookup`, `-vendor-oui`, `-oui-lookup-formatter`, `mac-address-vendor-oui` | Consolidate |
| Password | `password-generator`, `strong-password-generator`, `wifi-password-gen`, `passphrase-generator` | Consolidate |
| CSP | `csp-generator`, `csp-evaluator`, `csp-content-security-policy` | Consolidate |
| CIDR/subnet | `cidr-ip-calculator`, `ip-subnet-calculator`, `ipv4-subnet-…`, `ipv6-subnet-…`, `cidr-ip-range-netmask-…` | Consolidate |

### Step 0c — Dead/legacy tools identified (retire candidates)

- **Dead file formats:** LIT (`lit-to-epub/pdf`), LRF (`lrf-to-epub/pdf`),
  PRC (`prc-to-epub`), XPS (`xps-to-pdf`, `pdf-to-xps`), XAR/LZH/WIM/ARJ extractors.
- **Fading CSS fads:** `css-neumorphism-generator`, `css-triangle-generator`.
- **Academic-only (low everyday value):** Gray Code, Hamming Code, Checksum/Parity,
  Fixed-Point Q-Format, Julian Date.

### Step 0d — AI-agent-first opportunity (build candidates)

- Natural-language → tool router (see `src/app/tools/tools-page-client.tsx` search).
- JSON export on every tool output (machine-readable for agents).
- Regex explainer already exists (`developer/regex-explainer`) — surface it better.
- Code review / commit-message-from-diff / structured-data helpers.

---

## Progress log

| Date | Commit / phase | What changed |
|------|----------------|--------------|
| 2026-08-05 | **v17.64 → 6e15539** | UI polish + perf: logo 589KB→12KB, source-maps off, catalog split, counts, lazy palette, hero/LCP fix, framer-motion out of landing route. |
| 2026-08-05 | **17ad352** | Revert juggling settled back to `6e15539` state; STATE.md OOM rule removed. |
| 2026-08-05 | **analysis** | Full duplicate/dead/AI-agent audit (see Step 0). |
| 2026-08-05 | **v17.65 step 1: SHA dedupe** | Consolidated the SHA hash duplicate cluster: removed `sha256-hash-tool`, `sha1-hash-tool`, `sha3-hash-tool`, `sha512-hash-tool` (each an exact dup of the `-generator`). Kept canonical `sha*-hash-generator`. Tool count 1700 → **1696**. Updated registry.ts, tool-page-client.tsx, regenerated catalog + sitemap. Lint + tests pass. |

## Dedupe progress

| Cluster | Status |
|---------|--------|
| SHA hash (4 pairs) | ✅ **consolidated** — 4 tools removed |
| JWT (7) | ⏳ not started |
| MAC address (5) | ⏳ not started |
| Password (4) | ⏳ not started |
| CSP (3) | ⏳ not started |
| CIDR/subnet (4+) | ⏳ not started |

## Known constraints

- Local sandbox is **3.8 GB RAM / 2 cores**; `next build` does not complete here
  (OOM/timeout). Build verification must happen on Cloudflare's runner or a larger box.

## Next actions (ordered)

1. Consolidate **SHA hash** duplicate cluster (highest user-confusion value).
2. Retire **dead-format** tools (status → `planned`, or merge into one legacy tool).
3. Add **AI-agent-first**: natural-language search + JSON export everywhere.
4. Update `STATE.md` phase header + this log after each commit.
