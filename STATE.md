# UnQTools — Build State

_Last updated: 2026-07-02T06:25:00Z by GLM (z.ai sandbox)_

## Current phase

**Phase 2 — v1 core set, Batch 1 (5 ported tools)** ✅ COMPLETE → Batch 2 in progress

## Done (this session — Batch 1: 5 ported tools)

### Resume ritual
- [x] `git pull` on both repos (no remote changes)
- [x] Read `AGENTS.md` + previous `STATE.md`
- [x] `npm ci` — 614 packages restored
- [x] Read blueprints from `unqtools-docs` for all 5 tools

### Batch 1 — 5 tools ported into the tool-module shape

#### 1. Word & Character Counter (`src/tools/text/word-character-counter/`)
- Reference: doc `Word & Character Counter — live, Unicode-correct` (Category 7 - Text & Writing)
- `manifest.ts` — ToolManifest; category `text`; SEO FAQ
- `logic.ts` — pure `countText`, `segmentWords`, `segmentSentences`, `countSmsSegments`, `computeReadingTime`, `computeSpeakingTime`, `getPlatformLimits`, `keywordDensity`; uses `Intl.Segmenter` for true graphemes; GSM-7/UCS-2 SMS per 3GPP TS 23.038; regex fallback when `Intl.Segmenter` unavailable
- `logic.test.ts` — 35 Vitest tests (graphemes/emoji ZWJ families/flag emoji/skin-tone/CJK/UTF-8 bytes/code points/SMS GSM-7 + UCS-2 + extended chars/reading+speaking time/platform limits/keyword density/stopwords)
- `worker.ts` — Web Worker wrapping countText for inputs ≥ 100 KB
- `ui.tsx` — Preact island: two-pane layout, live stats grid, reading/speaking time, SMS info, platform-limit meters, advanced dev counts, keyword density table with stopword toggle, localStorage autosave, sample/clear/copy

#### 2. Loan / EMI Calculator (`src/tools/calculators/emi-calculator/`)
- Reference: doc `5. Loan / EMI Calculator` (Category 6 - Calculators & Converters)
- `manifest.ts` — ToolManifest; category `calculators`; SEO FAQ
- `logic.ts` — pure `calculateEmi`, `computeEmi`, `formatCurrency`, `scheduleToCsv`; standard EMI formula `P·r·(1+r)^n / ((1+r)^n − 1)`; zero-interest handling; one-time + recurring prepayments; interest-saved + months-saved vs baseline; monthly + yearly CSV; final-row rounding so schedule sums to total exactly
- `logic.test.ts` — 16 Vitest tests (zero-interest/standard-formula/rounding/prepayment/recurring extra/schedule-sums/baseline/CSV)
- `ui.tsx` — Preact island: principal/rate/tenure/currency inputs, prepayment modeling (one-time + recurring), summary cards (EMI/total interest/total payment/months saved/interest saved), amortization table with monthly/yearly toggle, CSV download

#### 3. SIP Calculator (`src/tools/calculators/sip-calculator/`)
- No dedicated blueprint in `unqtools-docs`; built using standard SIP formula `FV = P × [((1+r)^n − 1) / r] × (1+r)` (annuity-due convention)
- `manifest.ts` — ToolManifest; category `calculators`; SEO FAQ explaining SIP + step-up
- `logic.ts` — pure `calculateSip`, `sipClosedForm` (sanity check), `formatCurrency`, `formatCompact`; supports annual step-up (P_k = P_{k-1} × (1+stepUpPct/100)); inflation-adjusted real value
- `logic.test.ts` — 17 Vitest tests (validation/closed-form match/total-invested/wealth-ratio/yearly breakdown/step-up > flat/step-up invests more each year/inflation-adjusted < nominal)
- `ui.tsx` — Preact island: monthly/return%/years/currency inputs, advanced toggle for step-up + inflation, summary cards (total invested/future value/total returns/wealth ratio), inflation-adjusted value, year-by-year breakdown table

#### 4. Mortgage Calculator (`src/tools/calculators/mortgage-calculator/`)
- Reference: doc `10. Mortgage Calculator` (Category 6 - Calculators & Converters)
- `manifest.ts` — ToolManifest; category `calculators`; SEO FAQ (PITI, PMI drop-off, extra payments)
- `logic.ts` — pure `calculateMortgage`, `formatCurrency`, `mortgageScheduleToCsv`; full PITI + PMI + HOA; PMI auto-cancel at 78% LTV per Homeowners Protection Act; extra-monthly + one-time-extra modeling; interest-saved + months-saved vs baseline; monthly + yearly CSV
- `logic.test.ts` — 17 Vitest tests (validation/loan amount/P&I formula/schedule sums to 0/360-month term/PMI required < 20% down/PMI drop-off/extra payments reduce interest + term/PITI breakdown sums/CSV)
- `ui.tsx` — Preact island: home price/down %/rate/term/tax/insurance/HOA/extra-monthly inputs, advanced toggle for PMI rate + one-time extra, summary cards, PITI breakdown table, PMI drop-off indicator + extra-payment savings card, amortization table with monthly/yearly toggle, CSV download

#### 5. Image Compressor (`src/tools/image/image-compressor/`)
- Reference: doc `Blueprint — Image Compressor` (root of `12 10x Tool Blueprints`)
- Implementation note: uses Canvas API in this Phase 2 build; WASM codecs (MozJPEG/OxiPNG/AVIF) deferred to a later phase per blueprint's "10x layer"
- `manifest.ts` — ToolManifest; category `image`; SEO FAQ (privacy/formats/file limit/EXIF)
- `logic.ts` — pure `detectFormat`, `formatBytes`, `computeResizedDimensions`, `tuneForTargetSize` (binary search), `buildStoredZip` (hand-rolled PKWARE spec, no zip dep), `buildOutputFilename`; CRC32 + local-file-header + central-directory + EOCD records implemented from spec
- `logic.test.ts` — 26 Vitest tests (format detection/byte formatting/resize math/aspect-ratio preservation/filename building/ZIP signature/EOCD signature/multi-entry ZIP/target-size tuning)
- `worker.ts` — Web Worker using OffscreenCanvas for off-main-thread compression; transfers Blob back via postMessage ownership
- `ui.tsx` — Preact island: drag-drop zone (single or bulk), global preset bar (format/quality/max-dimension/strip-EXIF/target-size), per-file override (quality + format), sequential worker processing, total savings summary, per-file + bulk ZIP download, main-thread fallback when OffscreenCanvas unavailable

### Verification (Batch 1)
- [x] `npm run lint` GREEN — 0 errors, 0 warnings (ESLint + Prettier)
- [x] `npm run test` GREEN — **149 tests passing** (7 search + 31 JSON formatter + 35 word/char counter + 16 EMI + 17 SIP + 17 mortgage + 26 image compressor)
- [x] `npm run build` GREEN — **21 static pages prerendered** (was 16; +5 new tool pages + home now lists all 6 tools + each tool appears in its category page)
- [x] Production preview: all 6 tool pages serve HTTP 200 with correct titles
- [x] Homepage lists all 6 tools via auto-registry
- [x] Per-tool island JS budget verified:
  - Smallest: 11.6 KB gzipped (json-formatter)
  - Largest: 15.95 KB gzipped (image-compressor)
  - Budget: 50 KB → 68–77% headroom on every tool page

## In progress

- _Nothing._ Batch 1 complete; Batch 2 starting next.

## Next up (Batch 2 — 6 proposed tools)

1. **Base64 Encoder/Decoder** (`developer/base64`) — pure logic, UTF-8 safe, URL-safe variant
2. **URL Encoder/Decoder** (`developer/url-encoder`) — `encodeURIComponent` + component mode
3. **Hash Generator** (`developer/hash-generator`) — SHA-1/256/384/512 via Web Crypto, worker for large files
4. **Color Picker / Converter** (`image/color-picker`) — HEX ↔ RGB ↔ HSL ↔ HSV with contrast checker
5. **Text Case Converter** (`text/case-converter`) — upper/lower/title/sentence/kebab/snake/camel/Pascal
6. **UUID Generator** (`developer/uuid-generator`) — `crypto.randomUUID` + bulk + v4 fallback

Same shape, same gates: manifest + logic + logic.test + ui + worker if needed + Playwright e2e with axe-core (deferred to a single batch e2e sweep at the end).

## Key decisions / notes

- **Locked stack** per `AGENTS.md` §2.
- **Proprietary license** — NOT open source.
- **No backend.** Everything static + client-side.
- **Git remote** uses PAT inline — never commit the PAT.
- **`Intl.Segmenter`** is the canonical way to count graphemes/words/sentences; falls back to regex (`Array.from` + `\p{L}\p{N}`) on older browsers and flags the result as `approximate: true`.
- **SMS segment counting** follows 3GPP TS 23.038 exactly: GSM-7 (160/153 chars, extended chars cost 2 septets), UCS-2 (70/67 chars, surrogate pairs count as 2 code units).
- **EMI formula** = `P·r·(1+r)^n / ((1+r)^n − 1)`; zero-interest loans fall back to linear `P/n`.
- **SIP formula** = `FV = P × [((1+r)^n − 1) / r] × (1+r)` (annuity-due, since contributions are made at the start of each month).
- **PMI auto-cancel** at 78% LTV per the Homeowners Protection Act (US). 80% LTV is the request-early threshold but the lender isn't obligated until 78%.
- **Image Compressor ZIP** is hand-rolled using the PKWARE "stored" (no compression) ZIP spec. This is fine because images are already compressed; DEFLATE would add no benefit and would require bundling a zip library.
- **Image Compressor Canvas vs WASM**: this Batch 1 build uses Canvas API (available in all modern browsers). WASM codecs (MozJPEG, OxiPNG, WebP, AVIF) are the blueprint's "10x layer" and ship in a later phase. The current Canvas path already meets the blueprint's must-have bar.
- **Tool bundle size growing slowly** — the shared `ui.tsx` component library is bundled once and shared across tool pages, so each new tool adds ~2–6 KB gzipped on top of the ~10 KB Preact runtime. Plenty of headroom against the 50 KB per-tool budget.

## Blockers

- _None._ Ready for Batch 2.
