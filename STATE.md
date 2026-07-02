# UnQTools — Build State

_Last updated: 2026-07-02T05:35:00Z by GLM (z.ai sandbox)_

## Current phase

**Phase 1 — Reference tool (JSON Formatter)** ✅ COMPLETE → ready for Phase 2 (v1 core set)

## Done (this session — Phase 1)

### Resume ritual
- [x] `git pull` on both `unqtools` and `unqtools-docs` — no remote changes
- [x] Read `AGENTS.md` + this `STATE.md`
- [x] `npm ci` — 614 packages restored
- [x] Read JSON Formatter spec from `unqtools-docs` doc #10

### Phase 1 — JSON Formatter (Definition of Done MET)
- [x] `src/tools/developer/json-formatter/manifest.ts` — implements `ToolManifest`; id `json-formatter`; category `developer`; icon `braces`; SEO title + FAQ
- [x] `src/tools/developer/json-formatter/logic.ts` — pure functions: `formatJson`, `minifyJson`, `validateJson`, `sortDeep`; exports `WORKER_THRESHOLD_BYTES` (100 KB)
- [x] `src/tools/developer/json-formatter/logic.test.ts` — 31 Vitest tests covering valid/invalid/edge/large/nested/unicode/scientific-notation/empty/whitespace-only/primitives/recursive-sort
- [x] `src/tools/developer/json-formatter/worker.ts` — Web Worker wrapping the same logic for inputs ≥ 100 KB
- [x] `src/tools/developer/json-formatter/ui.tsx` — Preact island using shared primitives (Button, Textarea, Select, Toggle, CopyButton, DownloadButton, ErrorBanner, Card, ToastContainer)
  - Two-pane layout (input / output) responsive on mobile
  - Options bar: indent (2/4/tab), sort-keys toggle, format/minify/validate/load-sample/clear/share-link
  - Live byte counter on input + output
  - Friendly error banner with `line:column` from V8 SyntaxError (handles both V8 message formats)
  - Worker offload auto-triggered for large inputs (≥100 KB)
  - URL state share: `?i=base64(input)` round-trips input
- [x] `tests/json-formatter.e2e.ts` — 10 Playwright tests: load, load-sample, format, sort-keys, minify, invalid-error, empty-error, validate, keyboard-only, **axe-core a11y scan** (zero critical/serious violations)
- [x] `@axe-core/playwright` dependency added
- [x] Registry auto-collected the tool — it appears on the homepage grid and `/category/developer` with zero manual wiring
- [x] Verified locally:
  - `npm run lint` ✅ (ESLint + Prettier clean)
  - `npm run test` ✅ (38 tests passing: 7 search + 31 JSON formatter)
  - `npm run build` ✅ (16 static pages — 15 from Phase 0 + 1 for json-formatter)
  - Production preview: `/tools/json-formatter` returns 200 with correct title
- [x] Performance budget verified:
  - Per-tool island JS: **15.1 KB gzipped** total (budget: 50 KB) — 69% headroom
  - Lazy-loaded only when `/tools/json-formatter` opens

## In progress

- _Nothing._ Phase 1 complete; awaiting kickoff of Phase 2.

## Next up (Phase 2 — v1 core set)

Pick the next batch from `unqtools-docs` → `3 Tool Catalog`. Suggested first wave
(all simple, all 100% client-side, all follow the JSON Formatter shape):

1. **Base64 Encoder/Decoder** (`developer/base64`) — pure logic, no worker needed
2. **URL Encoder/Decoder** (`developer/url-encoder`) — pure logic
3. **Hash Generator** (`developer/hash-generator`) — SHA-1/256/512 via Web Crypto; worker for large files
4. **Color Picker / Converter** (`image/color-picker`) — HEX ↔ RGB ↔ HSL
5. **Text Case Converter** (`text/case-converter`) — upper/lower/title/sentence/kebab/snake/camel
6. **Markdown Preview** (`text/markdown-preview`) — minimal CommonMark renderer
7. **UUID Generator** (`developer/uuid-generator`) — `crypto.randomUUID` + bulk

Each tool ships as one folder under `src/tools/<category>/<id>/` with
`manifest.ts` + `logic.ts` + `logic.test.ts` + `ui.tsx` (optional `worker.ts`),
one Playwright e2e with axe-core, and the registry auto-wires it everywhere.

## Phase 1 — Definition of Done (verdict)

| Criterion (from doc #10 acceptance) | Status |
| --- | --- |
| Valid JSON formats with 2/4-space indent | ✅ |
| Keys sort toggle works (recursive) | ✅ |
| Minify produces compact output | ✅ |
| Invalid JSON shows friendly error (`role="alert"`) | ✅ |
| Empty input handled gracefully | ✅ |
| Copy and Download work | ✅ |
| Load sample populates input | ✅ |
| Fully keyboard operable | ✅ (Playwright keyboard test passes) |
| Passes axe-core a11y scan | ✅ (zero critical/serious) |
| Unit tests cover valid/invalid/edge/empty | ✅ (31 tests) |
| e2e happy path passes | ✅ (10 Playwright tests) |
| Works offline; no network calls | ✅ |
| Appears in search + developer category | ✅ |
| Meets 10x Framework (sample, presets, instant, accessible, privacy note) | ✅ |
| Per-tool JS ≤ 50 KB gzipped | ✅ (15.1 KB) |

## Key decisions / notes

- **Locked stack** per `AGENTS.md` §2 — do NOT change without owner approval.
- **Proprietary license** — NOT open source.
- **Docs repo** at `https://github.com/Sandeepgaddam5432/unqtools-docs` — clone locally for specs.
- **No backend.** Everything static + client-side.
- **Git remote** uses PAT inline — never commit the PAT.
- **V8 SyntaxError** has two message formats: `"at position N (line L column C)"` and
  `"Unexpected token 'X', \"...\" is not valid JSON"`. `extractPosition` in
  `logic.ts` handles both.
- **Worker threshold** is 100 KB. Below that, sync on main thread (instant). Above,
  routes through `worker.ts` via `new Worker(new URL("./worker.ts", import.meta.url))`.
- **Tool island bundle** = 15.1 KB gzipped (Preact + signals + hooks + ui + preload-helper).
  Well under the 50 KB budget. Watch this number as more shared primitives land.
- **URL share state** uses base64 of the raw input — fine for moderate inputs, will
  fail (gracefully) for very large inputs because URLs have practical length limits.
- **axe-core scan** uses `wcag2a` + `wcag2aa` tags; failures only on `critical`/`serious`.
  `moderate`/`minor` issues are tracked but don't block.
- **`src/env.d.ts`** is auto-generated by Astro on `build`. Added to ESLint ignores
  (triple-slash reference is the Astro convention, not a real lint issue).

## Blockers

- _None._ Ready for Phase 2.
