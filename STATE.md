# UnQTools — Build State

_Last updated: 2026-07-02T06:45:00Z by GLM (z.ai sandbox)_

## Current phase

**Phase 2 — v1 core set, Batches 1 + 2** ✅ COMPLETE (12 tools shipped) → ready for Phase 3 (v1 launch polish + tool-specific Playwright e2e sweep)

## Done (this session — Phase 2)

### Resume ritual
- [x] `git pull` on both repos (no remote changes)
- [x] Read `AGENTS.md` + previous `STATE.md`
- [x] `npm ci` — 614 packages restored

### Batch 1 — 5 ported tools (commit `446440b`)
- Word & Character Counter (`text/word-character-counter/`) — 35 tests, Unicode-correct via `Intl.Segmenter`, GSM-7/UCS-2 SMS per 3GPP TS 23.038, platform-limit meters, Web Worker for ≥100KB
- Loan / EMI Calculator (`calculators/emi-calculator/`) — 16 tests, EMI formula `P·r·(1+r)^n / ((1+r)^n − 1)`, one-time + recurring prepayments, monthly/yearly CSV amortization
- SIP Calculator (`calculators/sip-calculator/`) — 17 tests, standard SIP formula `FV = P × [((1+r)^n − 1) / r] × (1+r)` (annuity-due), annual step-up, inflation-adjusted real value
- Mortgage Calculator (`calculators/mortgage-calculator/`) — 17 tests, full PITI + PMI + HOA, PMI auto-cancel at 78% LTV per HPA, extra-payment payoff modeling, CSV amortization
- Image Compressor (`image/image-compressor/`) — 26 tests, Canvas API (WASM codecs deferred per blueprint), Web Worker + OffscreenCanvas, hand-rolled ZIP builder, target-size mode, bulk processing

### Batch 2 — 6 new tools (this commit)
- Base64 Encoder / Decoder (`developer/base64/`) — 28 tests, UTF-8 safe via TextEncoder/TextDecoder, standard + URL-safe variants per RFC 4648 §5, swap mode, live update
- URL Encoder / Decoder (`developer/url-encoder/`) — 28 tests, `encodeURIComponent` + `encodeURI` modes, URL breakdown (protocol/host/path/search/params), query parameter table
- Hash Generator (`developer/hash-generator/`) — 21 tests, SHA-1/SHA-256/SHA-384/SHA-512 via Web Crypto, hex + Base64 output, file hashing, known-answer tests against NIST vectors
- Color Picker / Converter (`image/color-picker/`) — 42 tests, HEX ↔ RGB ↔ HSL ↔ HSV mathematically-exact conversions, WCAG 2.1 contrast checker (AA/AAA), 11-step shade ramp, complementary color
- Text Case Converter (`text/case-converter/`) — 43 tests, 11 case types (upper/lower/title/sentence/camel/pascal/snake/kebab/constant/dot/alternating), title case respects small-word rules
- UUID Generator (`developer/uuid-generator/`) — 26 tests, RFC 4122 v4 via `crypto.randomUUID` (with manual fallback), bulk up to 10,000, hyphens/uppercase/braces/prefix/suffix options, UUID validator

### Verification (Batches 1 + 2 combined)
- [x] `npm run lint` GREEN — 0 errors, 0 warnings (ESLint + Prettier)
- [x] `npm run test` GREEN — **337 tests passing** across 13 test files
  - 7 search + 31 JSON formatter + 35 word/char counter + 16 EMI + 17 SIP + 17 mortgage + 26 image compressor + 28 base64 + 28 URL encoder + 21 hash generator + 42 color picker + 43 case converter + 26 UUID generator
- [x] `npm run build` GREEN — **27 static pages prerendered** (was 21 after Batch 1; +6 new tool pages + home now lists 12 tools + each tool appears in its category)
- [x] Production preview: all 12 tool pages serve HTTP 200 with correct titles
- [x] Homepage lists all 12 tools via auto-registry
- [x] Per-tool island JS budget verified:
  - Common Preact runtime: 9.79 KB gzipped
  - Largest per-tool total: **15.95 KB gzipped** (image-compressor)
  - Budget: 50 KB → 68% headroom on every tool page

## In progress

- _Nothing._ Batches 1 + 2 complete.

## Next up (Phase 3 — v1 launch polish)

1. **Per-tool Playwright e2e sweep**: add `tests/<tool>.e2e.ts` for each of the 11 new tools (only json-formatter has one so far). Each test should cover the happy path + an axe-core a11y scan.
2. **Homepage polish**: hero illustration, "why UnQTools" section, popular-tools carousel, footer links.
3. **Category pages polish**: top-of-page description + tool count + featured tool card.
4. **SEO**: per-tool meta tags (og:image, og:description, canonical), `sitemap-index.xml`, structured data (SoftwareApplication + FAQPage schema).
5. **Performance**: Lighthouse audit on each tool page; verify LCP < 1.5s, CLS < 0.1, Lighthouse ≥ 95.
6. **WASM codecs for Image Compressor**: ship MozJPEG, OxiPNG, WebP, AVIF encoders via WASM (the blueprint's "10x layer"). Canvas API already meets must-have bar.
7. **Phase 4+ (catalog expansion)**: pick next wave from `unqtools-docs` → `3 Tool Catalog`. Hundreds of blueprints available across 13 categories.

## Key decisions / notes

- **Locked stack** per `AGENTS.md` §2.
- **Proprietary license** — NOT open source.
- **No backend.** Everything static + client-side.
- **Git remote** uses PAT inline — never commit the PAT.
- **`Intl.Segmenter`** is the canonical way to count graphemes/words/sentences.
- **SMS segment counting** follows 3GPP TS 23.038 exactly.
- **EMI/SIP/Mortgage formulas** are standard and verified against closed-form / known-answer tests.
- **PMI auto-cancel** at 78% LTV per the Homeowners Protection Act (US).
- **Image Compressor ZIP** is hand-rolled (PKWARE "stored" spec) — no zip dep needed.
- **Image Compressor Canvas vs WASM**: Canvas API in this build (meets blueprint's must-have). WASM codecs (MozJPEG/OxiPNG/AVIF) ship in Phase 3 as the "10x layer".
- **Base64** uses TextEncoder/TextDecoder for UTF-8 safety — the built-in btoa/atob only handle Latin1.
- **URL-safe Base64** follows RFC 4648 §5 (`+`→`-`, `/`→`_`, padding stripped).
- **Hash Generator** uses Web Crypto `SubtleCrypto.digest` — same API the browser uses for TLS.
- **Color Picker** contrast uses the official WCAG 2.1 relative-luminance formula (no approximations).
- **Case Converter** title case follows standard small-word rules (articles, conjunctions, short prepositions).
- **UUID Generator** prefers `crypto.randomUUID()` (cryptographically secure); manual fallback using `crypto.getRandomValues` for older environments.
- **Test discipline**: every tool ships with 16–43 Vitest tests covering valid/invalid/edge/large cases. Known-answer tests for hashes (NIST vectors) and Base64 (verified via Node Buffer).
- **Tool bundle size** stays well under the 50 KB budget — the largest is image-compressor at 15.95 KB gzipped. Each new tool adds ~2–6 KB on top of the ~10 KB shared Preact runtime.

## Blockers

- _None._ Ready for Phase 3.
