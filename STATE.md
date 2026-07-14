# UnQTools — Build State

_Last updated: 2026-07-14 by GLM (z.ai sandbox) — v8.0 Batch 2 (Network/Security) COMPLETE — 10 tools live in category_

## Current phase

**v8.0 "Network, Security & Privacy" — Batch 2 COMPLETE ✅ (5 more tools shipped; 10 total in category)**

Second batch of Network/Security tools. Category 8 now has 10 live tools.
Following the v6.0 Tool Module Contract, all client-side, all 100% private.

### Recent commits on `main`

| Commit   | Description                                                                                |
| -------- | ------------------------------------------------------------------------------------------ |
| (pending)| feat: v8.0 Batch 2 — 5 more Network/Security tools (totp, csp, http-status, mime, data-url) |
| a5ebf13  | feat: v8.0 Batch 1 — 5 Network/Security tools + category page bug fix + PWA name fix       |
| ff222c5  | docs: STATE.md sync — reflect v7.2 Batch B/C/D completion (52 tools live)                  |
| 827bfbb  | fix: sw.js — only cache GET requests, skip non-http, catch cache.put errors                |
| 2058661  | fix: pdf-stamp — also apply rotation conditional to drawRectangle                          |
| b516796  | fix: pdf-stamp — better error handling + remove opacity/rotate edge cases                  |
| e5f0616  | feat: v7.2 Batch D — 5 conversion tools (text/md/html/rtf/svg → PDF)                       |
| 29b49a0  | feat: v7.2 Batch B+C — 10 new PDF tools + parallel CI                                      |

## v8.0 Batch 2 — Network, Security & Privacy ✅ COMPLETE

### Tools shipped (5)

| # | Tool ID | What it does | Tests | Status |
|---|---|---|---|---|
| 1 | `totp-generator` | RFC 6238 TOTP/2FA codes with base32 secret, period/digits/algo controls, otpauth:// URI builder | 17 | ✅ |
| 2 | `csp-evaluator` | Analyze CSP headers — flags unsafe-inline, wildcards, http: schemes, missing base-uri/form-action | 25 | ✅ |
| 3 | `http-status-code-reference` | Searchable reference for ~70 HTTP status codes (RFC 9110 + Cloudflare/nginx extensions) | 24 | ✅ |
| 4 | `mime-type-lookup` | Searchable MIME type ↔ extension lookup, ~70 entries, detect from filename | 25 | ✅ |
| 5 | `data-url-converter` | Convert files to/from data: URLs (RFC 2397), base64 + plain encoding | 33 | ✅ |

### Verification

| Gate | Result |
|------|--------|
| lint | ✅ 0 errors |
| unit tests | ✅ 1104/1104 pass (was 950, +154 new tests across 5 tools) |
| build | ✅ 79 pages (was 74, +5 new tool pages) |
| tool count | ✅ 62 tools live (was 57, +5 Network/Security) |
| category 8 count | ✅ 10 tools live (was 5, +5 Batch 2) |

### Infra changes

- `src/lib/registry.ts` — +5 imports + 5 entries (alphabetical order maintained)
- `src/app/tools/[id]/tool-page-client.tsx` — +5 lazy UI loaders
- No new npm dependencies (TOTP uses Web Crypto HMAC; CSP/MIME/HTTP are pure data; data-URL uses FileReader)

### Highlights

- **TOTP**: passes RFC 6238 known-answer test vector (T=59s → "94287082" for SHA-1, 8 digits). Live countdown with progress bar, otpauth:// URI builder for QR scanning.
- **CSP Evaluator**: 0-100 score with severity-weighted deductions (high=-25, medium=-10, low=-3). Detects unsafe-inline/eval, http: schemes, wildcards, deprecated directives, missing base-uri/form-action/frame-ancestors/report-uri/upgrade-insecure-requests.
- **HTTP Status Code Reference**: ~70 codes including official RFC 9110 codes (1xx-5xx), unofficial but widely-used (418 teapot, 429, 451, 5xx from Cloudflare). Filterable by category, searchable by code/name/description/use-case.
- **MIME Type Lookup**: ~70 entries across 8 categories (text/image/audio/video/application/font/multipart/model). Detects from filename, handles aliases (application/javascript ↔ text/javascript), and parameters (text/html; charset=utf-8).
- **Data URL Converter**: bidirectional file↔data URL encoding. Handles UTF-8 correctly via TextEncoder/TextDecoder. Binary data note: bytes that aren't valid UTF-8 get replacement chars when decoded as text (documented in code).

## v8.0 Batch 1 — Network, Security & Privacy ✅ COMPLETE

[History preserved — see v8.0 Batch 1 section below for details on password-generator, jwt-decoder, url-parser, ip-subnet-calculator, bcrypt-hash-generator, category page bug fix, PWA name fix]

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

| Gate                 | v6.8 result            | v8.0 Batch 2 status           |
| -------------------- | ---------------------- | ------------------------------ |
| lint                 | ✅ 0 errors            | ✅ 0 errors (verified locally) |
| unit tests           | ✅ 528/528             | ✅ 1104/1104 (verified locally, +154 new from Batch 2) |
| build                | ✅ 30 pages            | ✅ 79 pages (verified locally, +5 new) |
| smoke e2e            | ✅ 33/33               | 🟡 pending CI auto-run         |
| tool e2e             | ✅ 22/22               | 🟡 pending CI auto-run (62 tools) |
| axe (must-pass)      | ✅ 0 serious           | 🟡 pending CI auto-run (cap 30) |
| CLS                  | ✅ 0.0001              | 🟡 pending CI auto-run         |
| CI build job         | ✅ includes axe        | 🟡 pending CI auto-run         |
| CI informational     | overflow + motion only | ❌ overflow expected to still fail (pre-existing — does NOT block) |
| Cloudflare deploy    | n/a                   | 🟡 will auto-deploy once CI green |

## Docs repo sync (2026-07-14 — third sync)

The `unqtools-docs` repo tracks 1,700 tool blueprints. Per hybrid-sync policy,
blueprints whose tools are live in production get an "✅ IMPLEMENTED in
production" banner prepended.

**This sync:** Banner matching Network/Security blueprints for v8.0 Batch 2
tools. Update PROGRESS.md counts.

After this sync: 38 tools bannered in docs repo (29 PDF + 4 Batch 1 + 5 Batch 2,
assuming all 5 Batch 2 have matching blueprints).

## Resume point

**Next session — pick direction:**

1. **v8.0 Batch 3 — Network/Security (5 more tools):** `http-headers-reference`, `user-agent-parser`, `qr-code-generator` (security-flavored), `ssl-cert-decoder`, `mac-address-lookup`
2. **v8.1 — start a new category** (File Management or Audio/Video are next in search-volume priority)
3. **v7.3 — PDF polish (deferred):** Web Worker support, thumbnail previews, visual page selection grid
4. **SEO boost** — sitemap.xml, per-tool OG images, FAQ structured data

## Branch map (current)

| Branch                  | Status          | Notes                                                  |
| ----------------------- | --------------- | ------------------------------------------------------ |
| `main`                  | production      | v8.0 Batch 2 ready (30 PDF + 22 non-PDF + 10 Network/Security = 62 tools live) |
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
