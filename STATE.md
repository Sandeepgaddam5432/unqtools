# UnQTools — Build State

_Last updated: 2026-07-23 by GLM (z.ai sandbox) — v17.38 (Phase 1 quick sync + Phase 2 image batch) + Option A cleanup batch (stale 280→610 metadata, README/STATE sync, CI timeout bump)_

## Current phase

**v17.38 — Developer waves 1-16 complete + Phase 1 quick sync (10 dangling tools) + Phase 2 (5 image tools shipped)**

> STATE.md was last touched at v8.0 Batch 2 (62 tools live) on 2026-07-14.
> Between then and the v17.37 catch-up sync (2026-07-23), waves v17.17 → v17.37
> added ~533 tools (mostly Developer category). v17.38 then shipped 5 image
> tools + registered 10 dangling tools, bringing the live count to 610.

### Recent commits on `main`

| Commit   | Description                                                                                       |
| -------- | ------------------------------------------------------------------------------------------------- |
| a693291  | feat: v17.38 — Phase 1 quick sync (10 dangling tools) + Phase 2 (5 image tools) + state sync      |
| 51ce64c  | feat: v17.37 — 148 Developer tools from blueprints (waves 1-16) — ZERO SKIPS                      |
| 9ccb035  | feat: v17.36 — 146 Developer tools from blueprints (waves 1-16 partial) — ZERO SKIPS              |
| 5ba9d73  | feat: v17.35 — 144 Developer tools from blueprints (waves 1-15) — ZERO SKIPS                      |
| 8cbad51  | feat: v17.34 — 142 Developer tools from blueprints (waves 1-15 partial) — ZERO SKIPS              |
| 26db531  | feat: v17.33 — 140 Developer tools from blueprints (waves 1-14) — ZERO SKIPS                      |
| fbdbef3  | feat: v17.32 — 130 Developer tools from blueprints (waves 1-13) — ZERO SKIPS                      |
| c26521d  | feat: v17.31 — 120 Developer tools from blueprints (waves 1-12) — ZERO SKIPS                      |
| 3019b9b  | feat: v17.30 — 110 Developer tools from blueprints (waves 1-11) — ZERO SKIPS                      |
| c92d662  | feat: v17.29 — 100 Developer tools from blueprints (waves 1-10) — ZERO SKIPS                      |
| a7b2008  | feat: v17.28 — 86 Developer tools from blueprints (waves 1-9) — ZERO SKIPS                        |
| f5b13ce  | feat: v17.27 — 76 Developer tools from blueprints (wave 8 complete) — ZERO SKIPS                  |
| 97b84e8  | feat: v17.26 — 72 Developer tools from blueprints (wave 8 + fixes) — ZERO SKIPS                   |
| 4405411  | feat: v17.25 — 70 Developer tools from blueprints (wave 8 partial) — ZERO SKIPS                   |
| 0d3cebd  | feat: v17.23 — 64 Developer tools from blueprints (waves 1-7 partial) — ZERO SKIPS                |

The v17.x wave series shipped ~533 new tools (predominantly Developer)
after STATE.md was last touched at v8.0 Batch 2 (62 tools, 2026-07-14).
v17.38 then added 5 image tools + registered 10 dangling tools, bringing
the total live count from 605 to 610.

## v17.38 sync (2026-07-23)

STATE.md had drifted badly out of date — last touched 2026-07-14 at
v8.0 Batch 2 (62 tools live). v17.37 catch-up sync brought it back to
605 tools. v17.38 then performed two phases:

### Phase 1-A — quick sync: register 10 dangling tools

10 tool folders existed on disk with `manifest.ts` + `logic.ts` +
`logic.test.ts` + `ui.tsx` but no entry in `registry.ts` and no UI
loader in `tool-page-client.tsx`. This phase registered them with a
2-line registry entry + 1-line UI loader each:

- **developer (2):** `avl-tree-visualizer`, `red-black-tree-visualizer`
- **seo (8):** `broken-backlink-finder`, `broken-link-checker`,
  `core-web-vitals-analyzer`, `gtm-datalayer-helper`,
  `meta-robots-tester`, `mobile-friendly-tester`,
  `referring-domains-explorer`, `ssl-https-checker`

**Result:** 605 tools live (595 previously registered + 10 newly
registered). Developer count: 142 → 144. SEO count: 90 → 98.

### Phase 1-D — SEO infrastructure fixes

- Regenerated `sitemap.xml` to include all 605 live tools (was stale,
  referencing ~62 tools).
- Fixed JSON-LD `numberOfItems` in `src/app/tools/page.tsx`: was `283`,
  updated to `605` then `610`.

### Phase 2 — 5 brand-new image tools shipped

Image category was the biggest visible gap (only 2/100 live). v17.38
shipped 5 brand-new image tools, each with 100% blueprint compliance +
10 extras per AGENTS.md § 1b and § 1c:

| # | Tool ID | Tests | Status |
|---|---|---:|---|
| 1 | `bulk-image-renamer-optimizer` | 108 | ✅ |
| 2 | `barcode-generator` | 81 | ✅ |
| 3 | `ascii-art-generator` | 88 | ✅ |
| 4 | `pixel-art-maker` | 90 | ✅ |
| 5 | `photo-mosaic-generator` | 70 | ✅ |

New deps added (all lazy-loaded): `bwip-js`, `jspdf`, `@zxing/browser`,
`@zxing/library`, `jszip`, `exifr`, `heic2any`, `idb`, `figlet`.

**Result:** 610 tools live (605 + 5 new image). Image count: 2 → 7.
Unit test count: 38,869 → 39,306 (per commit message).

## Option A cleanup batch (2026-07-23)

After v17.38, a cleanup batch fixed stale user-facing copy and quality
risks identified during the post-clone analysis:

- Updated `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/tools/page.tsx`:
  all `280+` references → `610+` (titles, descriptions, OG, Twitter).
- Updated `src/app/home-page-client.tsx` stats strip: `14.3K` tests → `39.3K`.
- Regenerated `README.md` Status section to reflect v17.38 reality (was
  stuck at v7.0 PDF batch-1 / 32 tools).
- Updated `STATE.md` per-category table: image 2 → 7, total 605 → 610.
- Bumped `build` job `timeout-minutes` from 10 → 25 in `.github/workflows/ci.yml`
  (was tuned for 22-tool build, now 610-tool build needs more headroom).
- Deleted orphan remote branch `v0/videosmail5432-4983-1d7b581d`.

Verified locally: lint ✅, unit tests ✅, build ✅.

### Owner directive: Telugu-English conversation language (MANDATORY)

The owner is a Telugu speaker. Per their directive (2026-07-14), ALL
conversational chat replies MUST use a Telugu-English mix — English text
with Telugu words mixed in (e.g. "Bug fix aipoyindi, next cheppu").

This rule is documented in:
- `AGENTS.md` § 1a (build rules — read first every session)
- This file (STATE.md) for visibility in the resume point

Code, file contents, identifiers, commit messages, and technical terms
stay in standard English. Only the conversational chat surface uses
Telugu-English.

### Owner directive: 100% blueprint feature compliance + 10 extras (MANDATORY)

Per owner directive 2026-07-14 (see `AGENTS.md` § 1b and § 1c), every
tool built or upgraded after this date MUST:
1. Implement 100% of its blueprint's feature set (sections 5, 7, 10 from
   `unqtools-docs` repo).
2. Ship with at least **10 extra useful features** beyond the blueprint.
3. Be added at **≥ 5 tools per session** (AGENTS.md § 1d).

### Owner directive: 5 tools per session minimum (MANDATORY)

Per `AGENTS.md` § 1d, each session must register / ship at least 5 new
tools. Sessions that ship fewer must be continued immediately rather
than committed as "done."

## Blueprint compliance backlog (existing v8.0 tools, upgraded to 100% + 10+ extras)

All 10 Network/Security tools shipped in v8.0 Batches 1-2 have been
upgraded to 100% blueprint compliance + 10+ extras (2026-07-14).
Backlog table preserved below for traceability.

| Tool | Status |
|------|--------|
| ✅ `password-generator` | UPGRADED to 100% + 12 extras (2026-07-14) |
| ✅ `jwt-decoder` | UPGRADED to 100% + 10 extras (2026-07-14) |
| ✅ `url-parser` | UPGRADED to 100% + 10 extras (2026-07-14) |
| ✅ `ip-subnet-calculator` | UPGRADED to 100% + 10 extras (2026-07-14) |
| ✅ `bcrypt-hash-generator` | UPGRADED to 100% + 10 extras (2026-07-14) |
| ✅ `totp-generator` | UPGRADED to 100% + 10 extras (2026-07-14) |
| ✅ `csp-evaluator` | UPGRADED to 100% + 10 extras (2026-07-14) |
| ✅ `http-status-code-reference` | UPGRADED to 100% + 10 extras (2026-07-14) |
| ✅ `mime-type-lookup` | UPGRADED to 100% + 10 extras (2026-07-14) |
| ✅ `data-url-converter` | UPGRADED to 100% + 10 extras (2026-07-14) |

**Upgrade path (for any newly-discovered sub-100% tools):** read the
matching blueprint from `unqtools-docs`, implement every missing
feature + brainstorm/implement 10 extras, then update this table with
a one-line "✅ upgraded to 100% + 10 extras" note for traceability.

## v8.0 Batch 2 — Network, Security & Privacy ✅ COMPLETE

### Tools shipped (5)

| # | Tool ID | What it does | Tests | Status |
|---|---|---|---|---|
| 1 | `totp-generator` | RFC 6238 TOTP/2FA codes with base32 secret, period/digits/algo controls, otpauth:// URI builder | 17 | ✅ |
| 2 | `csp-evaluator` | Analyze CSP headers — flags unsafe-inline, wildcards, http: schemes, missing base-uri/form-action | 25 | ✅ |
| 3 | `http-status-code-reference` | Searchable reference for ~70 HTTP status codes (RFC 9110 + Cloudflare/nginx extensions) | 24 | ✅ |
| 4 | `mime-type-lookup` | Searchable MIME type ↔ extension lookup, ~70 entries, detect from filename | 25 | ✅ |
| 5 | `data-url-converter` | Convert files to/from data: URLs (RFC 2397), base64 + plain encoding | 33 | ✅ |

### Verification (at time of v8.0 Batch 2 ship — preserved for history)

| Gate | Result |
|------|--------|
| lint | ✅ 0 errors |
| unit tests | ✅ 1104/1104 pass (was 950, +154 new tests across 5 tools) |
| build | ✅ 79 pages (was 74, +5 new tool pages) |
| tool count | ✅ 62 tools live (was 57, +5 Network/Security) |
| category 8 count | ✅ 10 tools live (was 5, +5 Batch 2) |

### Follow-up bug fixes (2026-07-14, preserved for history)

**Bug 3:** Tools page category filtering showed blank screen on tab
click — root cause was `motion.div` parent using `whileInView` with
`viewport={{ once: true }}` so newly-mounted cards stayed at opacity 0
forever. Fix (commit `7d514b2`): added `key={\`${activeCategory}-${query}\`}`
to force remount on filter change, replaced `whileInView` with
`animate`. Bonus fix: stripped trailing punctuation from category short
labels in 4 files.

**Bug 4:** `pdf-stamp` threw `degreeAngle must be of type number` because
the UI's `run()` never passed `rotation` to `addStamp()`. Fix: made
`rotation` optional in `StampOptions`, added defensive default
`opts.rotation ?? 0`, added a Rotation dropdown to the UI (0° / -45° /
45°), updated `run()` to pass `rotation: Number(rotation) as 0 | -45 | 45`,
changed grid layout to fit the new 4th control.

## v8.0 Batch 1 — Network, Security & Privacy ✅ COMPLETE

[History preserved — see v8.0 Batch 1 section in git history for details
on password-generator, jwt-decoder, url-parser, ip-subnet-calculator,
bcrypt-hash-generator, category page bug fix, PWA name fix]

## v7.2 — 20-tool production-ready PDF batch ✅ COMPLETE (A + B + C + D)

[History preserved — see prior STATE.md commits for full v7.2 details]
4 batches × 5 tools shipped. 821 tests, 69 pages, 52 tools.

## v7.1 — advanced merge-pdf + split-pdf ✅ COMPLETE

[History preserved]

## v7.0 — PDF batch-1 ✅ COMPLETE (merged to main, deployed)

[History preserved]

## v6.9 — All 13 categories visible ✅

[History preserved]

## v6.8 — A11y + Cleanup ✅ COMPLETE

[History preserved]

## Full gate table

> ⚠️ The unit test count has grown massively (610 `logic.test.ts` files
> now exist, one per tool). Last verified count at v8.0 Batch 2 was
> 1104/1104. As of v17.38: 39,306/39,306 pass (per commit message +
> verified locally post-cleanup).

| Gate                 | v6.8 result            | v17.38 + Option A cleanup status                |
| -------------------- | ---------------------- | ---------------------------------------------- |
| lint                 | ✅ 0 errors            | ✅ 0 errors (verified locally)                 |
| unit tests           | ✅ 528/528             | ✅ 39,306/39,306 pass (verified locally post-cleanup) |
| build                | ✅ 30 pages            | ✅ 625 pages (610 tools + 13 categories + 2 static) |
| smoke e2e            | ✅ 33/33               | 🟡 pending CI auto-run                         |
| tool e2e             | ✅ 22/22               | 🟡 pending CI auto-run (32 tools asserted, 578 untested) |
| axe (must-pass)      | ✅ 0 serious           | 🟡 pending CI auto-run (cap 30)                |
| CLS                  | ✅ 0.0001              | 🟡 pending CI auto-run                         |
| CI build job         | ✅ includes axe        | ✅ timeout bumped 10 → 25 min (Option A)        |
| CI informational     | overflow + motion only | ❌ overflow expected to still fail (pre-existing — does NOT block) |
| Cloudflare deploy    | n/a                   | 🟡 will auto-deploy once CI green              |
| sitemap.xml          | n/a                   | ✅ regenerated to include all 610 tools (v17.38) |
| JSON-LD numberOfItems | n/a                  | ✅ updated to 610 in `src/app/tools/page.tsx` (v17.38) |

## Docs repo sync

The `unqtools-docs` repo tracks 1,700 tool blueprints. Per hybrid-sync
policy, blueprints whose tools are live in production get an
"✅ IMPLEMENTED in production" banner prepended.

**Status (2026-07-23, post-v17.38):** Docs repo `PROGRESS.md` was
synced on 2026-07-23 to acknowledge the 605-tool state, but production
has since grown to 610 tools (v17.38 image batch). ~575 banners are
still pending in the docs repo. A docs-repo bulk-sync to banner the
~575 newly-live tools is queued as a follow-up task.

## Resume point

**Next session — pick direction:**

1. **Continue adding tools from blueprints.** Image category still has
   the biggest visible gap: only 7/100 live (93 to go). Other large
   gaps: calculators (97), network-security (90), text (88),
   audio-video (80), education (80), social (75), business (75).
2. **Close SEO category** — only 2 more tools needed to hit 100/100
   (trivial quick win, marks category as complete).
3. **Apply 100% blueprint + 10 extras rule** per `AGENTS.md` § 1b and § 1c
   on every new tool. No sub-100% ships allowed.
4. **Ship at least 5 tools per session** per `AGENTS.md` § 1d.
5. **Developer category** still has the biggest absolute gap (356 to go
   to hit the 500 target) — viable to keep momentum there if blueprints
   are ready.
6. **Docs repo sync** — banner the ~575 newly-live blueprints in
   `unqtools-docs` and refresh `PROGRESS.md`.
7. **Expand `tests/tool.e2e.ts`** — currently only asserts 32 of 610
   tools. Either expand the TOOLS array or replace with a generic
   "load every tool page, assert no console errors" sweep.

## Branch map (current)

| Branch                  | Status          | Notes                                                  |
| ----------------------- | --------------- | ------------------------------------------------------ |
| `main`                  | production      | 610 tools live (was 62 at v8.0 Batch 2 STATE.md update) — v17.x waves + v17.38 image batch |
| (all others deleted)    | —               | Per owner policy: only `main` branch exists. |

## Historical batches (summary)

### v8.0 Batch 1 — Network/Security (5 tools + 2 bug fixes)
- 5 tools: password-generator, jwt-decoder, url-parser, ip-subnet-calculator, bcrypt-hash-generator
- Bug 1: Next.js 16 async params fix in /category/[category]/page.tsx (root cause of "Coming soon" bug on all category pages)
- Bug 2: PWA install prompt rebrand UnQWebTemplate → UnQTools (5 occurrences in pwa-install.tsx)
- New dep: bcryptjs@^3.0.3
- 950 tests, 74 pages, 57 tools

### v7.2 — PDF batch (20 tools, A/B/C/D)
- A: compress, reverse, duplicate, insert, interleave (commit e9a8fc0)
- B: crop, resize, scale, n-up, remove-blank (commit 29b49a0)
- C: bookmarks, flatten, stamp, sign-draw, contact-sheet (commit 29b49a0)
- D: text/html/md/rtf/svg → PDF (commit e5f0616)
- 821 tests, 69 pages, 52 tools

### v7.1 — Advanced merge-pdf + split-pdf (commit 23ba653)
- Drag-drop reorder, live preview, custom filename templates, optional metadata

### v7.0 — PDF batch-1 (merge commit 6f0de52)
- 10 PDF tools: merge, split, rotate, delete, extract, reorder, images-to-pdf, pdf-page-numbers, pdf-watermark, pdf-metadata-editor

### v6.9 — All 13 categories visible (commit 320771d)
### v6.8 — A11y + cleanup (8 commits, archived 67 unused UI components, removed 23 unused deps)

## Per-category live count (2026-07-23 sync, post-v17.38)

Counts reflect post-v17.38 state (610 tools live). Includes the 10
newly-registered dangling tools (2 dev + 8 SEO) and 5 new image tools
shipped in Phase 2.

| # | Category | Live | On disk | Target | Gap |
|---|---|---:|---:|---:|---:|
| 1 | pdf | 60 | 60 | 100 | 40 |
| 2 | image | 7 | 7 | 100 | 93 |
| 3 | audio-video | 20 | 20 | 100 | 80 |
| 4 | developer | 144 | 144 | 500 | 356 |
| 5 | seo | 98 | 98 | 100 | 2 |
| 6 | calculators | 3 | 3 | 100 | 97 |
| 7 | text | 12 | 12 | 100 | 88 |
| 8 | network-security | 10 | 10 | 100 | 90 |
| 9 | file | 86 | 86 | 100 | 14 |
| 10 | business | 25 | 25 | 100 | 75 |
| 11 | education | 20 | 20 | 100 | 80 |
| 12 | social | 25 | 25 | 100 | 75 |
| 13 | ai | 100 | 100 | 100 | 0 ✅ |
| **TOTAL** | | **610** | **610** | **1,700** | **1,090** |

Only the AI category is COMPLETE. SEO and File are nearly done (2 and 14
to go respectively). Image is still the biggest visible gap (7/100, 93
to go), while developer is the biggest absolute gap (356 more needed
to hit 500).
