# UnQTools — Build State

_Last updated: 2026-07-14 by GLM (z.ai sandbox) — v8.0 Batch 1 (Network/Security) COMPLETE + 2 bug fixes_

## Current phase

**v8.0 "Network, Security & Privacy" — Batch 1 COMPLETE ✅ (5 tools shipped)**

First new-category batch outside PDF. 5 client-side security tools shipped, all
following the v6.0 Tool Module Contract. Plus 2 critical bug fixes that were
blocking real-world use of the site.

### Recent commits on `main`

| Commit   | Description                                                                                |
| -------- | ------------------------------------------------------------------------------------------ |
| (pending)| feat: v8.0 Batch 1 — 5 Network/Security tools + category page bug fix + PWA name fix |
| ff222c5  | docs: STATE.md sync — reflect v7.2 Batch B/C/D completion (52 tools live)                  |
| 827bfbb  | fix: sw.js — only cache GET requests, skip non-http, catch cache.put errors                |
| 2058661  | fix: pdf-stamp — also apply rotation conditional to drawRectangle                          |
| b516796  | fix: pdf-stamp — better error handling + remove opacity/rotate edge cases                  |
| e5f0616  | feat: v7.2 Batch D — 5 conversion tools (text/md/html/rtf/svg → PDF)                       |
| 29b49a0  | feat: v7.2 Batch B+C — 10 new PDF tools + parallel CI                                      |

## v8.0 Batch 1 — Network, Security & Privacy ✅ COMPLETE

### Bug fixes shipped alongside the batch

#### Bug 1: Category page bug — "Coming soon" for ALL categories (CRITICAL)

**Root cause:** `src/app/category/[category]/page.tsx` was using synchronous
`params` access, but Next.js 16 changed `params` to be a Promise that must be
awaited. Without `await params`, `params.category` was `undefined` at SSG time,
which caused `byCategory(undefined)` to return an empty array, which made the
client component render the "Coming soon" empty state — even for categories
with 30+ tools (PDF, Text, etc.).

**Fix:** Convert `CategoryPage` to `async function` and `await params`:

```tsx
export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  // ...
}
```

**Verified:** PDF category page now shows "30 tools" + the full tools grid.
Empty categories (audio-video, seo, etc.) still correctly show "Coming soon".
The sibling `tools/[id]/page.tsx` was already correct.

#### Bug 2: PWA install prompt showed "UnQWebTemplate" instead of "UnQTools"

**Root cause:** `src/components/pwa-install.tsx` was inherited from the v6.0
UnQWebTemplate adoption and never rebranded. Five strings still referenced the
template name in notification titles, install prompt headings, and the
landing-page install card.

**Fix:** Replaced all 5 occurrences of "UnQWebTemplate" with "UnQTools" in
`pwa-install.tsx`. The PWA manifest (`public/manifest.json`) was already
correct — the bug was only in the in-page UI text.

### v8.0 Batch 1 — Tools shipped (5)

| # | Tool ID | What it does | Tests | Status |
|---|---|---|---|---|
| 1 | `password-generator` | CSPRNG password gen with length/charset/ambiguous controls | 21 | ✅ |
| 2 | `jwt-decoder` | Decode JWT header/payload/signature, detect expired tokens | 25 | ✅ |
| 3 | `url-parser` | Decompose URLs into protocol/host/path/query/hash/components | 30 | ✅ |
| 4 | `ip-subnet-calculator` | IPv4 CIDR + mask notation → network/broadcast/range/hosts | 35 | ✅ |
| 5 | `bcrypt-hash-generator` | Bcrypt hash + verify with adjustable cost factor (bcryptjs dep) | 24 | ✅ |

### New dependency added

- **`bcryptjs@^3.0.3`** — pure-JavaScript bcrypt (no native bindings, browser-safe).
  Used by `bcrypt-hash-generator`. WebCrypto doesn't expose bcrypt natively.

### Verification

| Gate | Result |
|------|--------|
| lint | ✅ 0 errors |
| unit tests | ✅ 950/950 pass (was 821, +129 new tests across 5 tools) |
| build | ✅ 74 pages (was 69, +5 new tool pages) |
| tool count | ✅ 57 tools live (was 52, +5 Network/Security tools) |
| category count | ✅ 6 active categories (was 5, +Network/Security now has tools) |

### Infra changes

- `src/app/category/[category]/page.tsx` — async/await for Next.js 16 params
- `src/components/pwa-install.tsx` — 5× "UnQWebTemplate" → "UnQTools"
- `src/lib/registry.ts` — +5 imports + 5 TOOLS entries
- `src/app/tools/[id]/tool-page-client.tsx` — +5 lazy UI loaders
- `package.json` — +`bcryptjs@^3.0.3`

### What's deferred (post-Batch 1)

- **JWT signature verification** — currently decode-only (intentional; would
  require secret/key input and complicate the UX). May revisit in a future batch.
- **IPv6 support** in `ip-subnet-calculator` — IPv6 needs BigInt math (128-bit
  addresses). Tracked as a follow-up.
- **TOTP generator** — was originally in the planned Batch 2. Will be picked
  up in Batch 2 alongside `csp-evaluator`, `http-status-code-reference`,
  `mime-type-lookup`, `data-url-converter`.

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

| Gate                 | v6.8 result            | v8.0 Batch 1 status           |
| -------------------- | ---------------------- | ------------------------------ |
| lint                 | ✅ 0 errors            | ✅ 0 errors (verified locally) |
| unit tests           | ✅ 528/528             | ✅ 950/950 (verified locally, +129 new) |
| build                | ✅ 30 pages            | ✅ 74 pages (verified locally, +5 new) |
| smoke e2e            | ✅ 33/33               | 🟡 pending CI auto-run         |
| tool e2e             | ✅ 22/22               | 🟡 pending CI auto-run (57 tools) |
| axe (must-pass)      | ✅ 0 serious           | 🟡 pending CI auto-run (cap 30) |
| CLS                  | ✅ 0.0001              | 🟡 pending CI auto-run         |
| CI build job         | ✅ includes axe        | 🟡 pending CI auto-run         |
| CI informational     | overflow + motion only | ❌ overflow expected to still fail (pre-existing — does NOT block) |
| Cloudflare deploy    | n/a                   | 🟡 will auto-deploy once CI green |

## Docs repo sync (2026-07-14 — second sync)

The `unqtools-docs` repo tracks 1,700 tool blueprints. Per hybrid-sync policy,
blueprints whose tools are live in production get an "✅ IMPLEMENTED in
production" banner prepended (no Generated Code appended, to avoid drift).

**This sync:** Banner 5 Network/Security blueprints matching v8.0 Batch 1 tools.
Update PROGRESS.md counts.

| # | Blueprint | Live tool ID | Batch |
|---|---|---|---|
| 1 | Blueprint - Password Generator | password-generator | v8.0 B1 |
| 2 | Blueprint - JWT Decoder (or similar) | jwt-decoder | v8.0 B1 |
| 3 | Blueprint - URL Parser | url-parser | v8.0 B1 |
| 4 | Blueprint - IP Subnet Calculator | ip-subnet-calculator | v8.0 B1 |
| 5 | Blueprint - Bcrypt Hash Generator | bcrypt-hash-generator | v8.0 B1 |

After this sync: 34 tools bannered in docs repo (29 PDF + 5 Network/Security).

## Resume point

**Next session — start v8.0 Batch 2 or pick a new direction:**

1. **v8.0 Batch 2 — Network/Security (5 more tools):**
   `totp-generator`, `csp-evaluator`, `http-status-code-reference`,
   `mime-type-lookup`, `data-url-converter`
2. **v8.1 — start a new category** (File Management or Audio/Video are next
   in search-volume priority)
3. **v7.3 — PDF polish (deferred):** Web Worker support, thumbnail previews,
   visual page selection grid
4. **SEO boost** — sitemap.xml, per-tool OG images, FAQ structured data

## Branch map (current)

| Branch                  | Status          | Notes                                                  |
| ----------------------- | --------------- | ------------------------------------------------------ |
| `main`                  | production      | v8.0 Batch 1 ready (30 PDF + 22 non-PDF + 5 Network/Security = 57 tools live) |
| (all others deleted)    | —               | Per owner policy: only `main` branch exists. |
