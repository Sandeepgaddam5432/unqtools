# UnQTools

> **Proprietary and confidential.** All rights reserved. See [`LICENSE`](./LICENSE).

UnQTools is a 100% static, privacy-first, offline-capable PWA that delivers
a large catalog of browser-based tools (converters, calculators, generators,
editors, formatters, PDF utilities) — each ~10x better than existing
tool-collection sites.

## Status

**v18.7 — PDF 100x wave 6: 60 PDF tools now beat iLovePDF / SmallPDF / Sejda** (2026-08-09).

Waves 1–6 rebuilt/added 60 PDF tools to the 100x bar — PDF↔HTML/EPUB/JSON/Markdown,
find & replace, PII auto-redaction, bookmark-aware merging, form data import/export,
repair, read-aloud and on-device summarization. Full comparison:
[`docs/PDF-100x-TOOLS.md`](./docs/PDF-100x-TOOLS.md).

**v18.6 — PDF 100x wave 5: 50 PDF tools now beat iLovePDF / SmallPDF / Sejda** (2026-08-09).

Waves 1–5 rebuilt/added 50 PDF tools to the 100x bar — including a real shared text-
extraction engine powering TXT/JSON/Markdown/word-count converters, image extraction,
dark-mode inversion, grayscale, bookmark-based splitting, form-data export, and poster
tiling. Full comparison: [`docs/PDF-100x-TOOLS.md`](./docs/PDF-100x-TOOLS.md).

**v18.5 — PDF 100x wave 4: 40 PDF tools now beat iLovePDF / SmallPDF / Sejda** (2026-08-09).

Waves 1–4 rebuilt 40 PDF tools to the 100x bar — including 18 fake template stubs turned
into real engines, plus 10 brand-new capabilities (annotations, outline bookmarks, batch
processing, exact target-size compression, permissions, unlock, size-split, form builder,
metadata cleaning, margins). Full comparison:
[`docs/PDF-100x-TOOLS.md`](./docs/PDF-100x-TOOLS.md).

**v18.4 — PDF 100x wave 3: 30 PDF tools now beat iLovePDF / SmallPDF / Sejda** (2026-08-09).

Waves 1–3 rebuilt 30 PDF tools to the 100x bar and turned 8 fake "planned" template
shells into real engines (Add Background/Border/Header-Footer/Attachment, 2-up Join,
B&W Scan Optimizer, EPUB→PDF, Office→PDF). Full comparison:
[`docs/PDF-100x-TOOLS.md`](./docs/PDF-100x-TOOLS.md).

**v18.3 — PDF 100x wave 2: 20 PDF tools now beat iLovePDF / SmallPDF / Sejda** (2026-08-09).

Waves 1+2 rebuilt 20 PDF tools to 100x bar: exact target-size compression with batch+ZIP,
image/text watermarking with 9 anchors, N-up imposition with 1–16 pages/sheet, GFM-table
Markdown→PDF, real RTF parsing (unicode/hex), resize with mm/in/pt + fit-content, SVG fit
modes + DPI, and more. Full comparison: [`docs/PDF-100x-TOOLS.md`](./docs/PDF-100x-TOOLS.md).

**v18.2 — PDF 100x wave: 10 selected PDF tools now beat iLovePDF / SmallPDF / Sejda** (2026-08-09).

Compress PDF now has **exact target size (KB/MB auto-fit), 5 presets + custom quality,
batch 20 files + ZIP, grayscale, and real in-browser image re-encoding** — iLovePDF offers
only 3 presets and uploads to servers. Crop, HTML→PDF, Page Numbers, Watermark and Merge
were rebuilt with 10-25 features each. Full comparison: [`docs/PDF-100x-TOOLS.md`](./docs/PDF-100x-TOOLS.md).

**v18.1 — Anti-confusion UX: 1,679 tools, but never a confusing wall** (2026-08-09).

Users no longer have to guess which tool does what:
- **"What do you want to do?"** — task cards on the home page and plain-language
  search ("make my PDF smaller" → Compress PDF, "join two pdfs" → Merge PDF).
- **Category pages are task-grouped** ("Page editing", "Merge & split", "Compress &
  optimize"…) with jump-to chips, instead of one flat grid.
- **`/tools` defaults to "Ready now (1,133)"** — the 546 "Coming Soon" stubs are hidden
  by default (an "All" toggle shows everything).
- v18.0 started the **merge-to-mega-tool** program: 26 overlapping PDF page tools became
  **PDF Page Manager** (7 page operations in one tabbed tool — old URLs 301-redirect).

See [`docs/MERGE-PLAN.md`](./docs/MERGE-PLAN.md) for the consolidation roadmap and
[`docs/ROADMAP-v18.md`](./docs/ROADMAP-v18.md) for the growth/monetization plan.

Recent waves: v17.0 → v17.37 shipped 144 Developer tools from blueprints
(waves 1-16, zero skips). v17.50 → v17.61 shipped 580+ new blueprint-sourced
tools across Developer, PDF, Network, Image, and SEO categories. v17.62 added
AI Chat with PDF. v17.63 rebuilt 30 tools with full blueprint compliance.
v17.64–v17.71 delivered core performance optimizations (logo 589KB→12KB,
source-maps off, catalog split, counts, lazy command palette, hero/LCP fix,
framer-motion removed from landing route), added 4 high-demand offline tools
(Timezone Converter, XML Formatter, Email Validator, Currency Converter),
completed codebase cleanup (`archive/` removal), and updated all 13 category displays.

| # | Category               | Live | Target | Gap |
|---|------------------------|-----:|-------:|----:|
| 1 | PDF & Document         |  305 |    100 |   0 ✅ |
| 2 | Image & Graphics       |  178 |    100 |   0 ✅ |
| 3 | Audio & Video          |   45 |    100 |  55 |
| 4 | Developer & Code       |  466 |    500 |  34 |
| 5 | SEO & Marketing        |  109 |    100 |   0 ✅ |
| 6 | Calculators            |   57 |    100 |  43 |
| 7 | Text & Writing         |   83 |    100 |  17 |
| 8 | Network, Security      |   96 |    100 |   4 |
| 9 | File Management        |  100 |    100 |   0 ✅ |
| 10 | Business & Productivity |   55 |    100 |  45 |
| 11 | Education & Learning   |   45 |    100 |  55 |
| 12 | Social Media           |   40 |    100 |  60 |
| 13 | AI & Smart Tools       |  100 |    100 |   0 ✅ |
| **Total** |                    | **1,679** |     —    |    —    |

All 13 categories active with **1,679 tools live** after v18.0 consolidation (26 overlapping PDF page tools merged into one PDF Page Manager).
Five categories complete or exceeded: PDF (305/100), Image (178/100), SEO (109/100),
File (100/100), and AI (100/100). Remaining category targets are tracked for god-level enhancement.

See [`STATE.md`](./STATE.md) for the live resume point and
[`AGENTS.md`](./AGENTS.md) for the build rules.

## Tech stack (locked at v6.0 "UnQTemplate")

| Layer         | Choice                                                                              |
| ------------- | ----------------------------------------------------------------------------------- |
| Framework     | **Next.js 16** (App Router, `output: 'export'` — 100% static) + **React 19**        |
| Language      | **TypeScript 5** (strict)                                                           |
| Styling       | **Tailwind CSS 4** + shadcn/ui design tokens                                        |
| Components    | **shadcn/ui** (Radix primitives) + **Magic UI / 21st.dev** effects                  |
| Motion        | **Framer Motion 12** (with `useReducedMotion` / `MotionConfig` for a11y)            |
| Icons         | **Lucide React**                                                                     |
| Theming       | **next-themes** (dark default, terracotta/copper palette)                           |
| Toasts        | **Sonner**                                                                          |
| PWA           | **next-pwa** + custom service worker (`public/sw.js`) + `manifest.json`             |
| PDF processing| **pdf-lib** ^1.17.1 + **jspdf** (client-side only)                                  |
| Image / heavy lifting | **bwip-js**, **@zxing/browser**, **jszip**, **exifr**, **heic2any**, **idb**, **figlet**, **sharp** (all lazy-loaded) |
| Unit tests    | **Vitest**                                                                          |
| e2e tests     | **Playwright** (+ `@axe-core/playwright` a11y assertions)                           |
| Lint          | **ESLint 9** (`eslint-config-next`)                                                 |
| CI            | **GitHub Actions**                                                                  |
| Deploy        | **Cloudflare Pages** (`wrangler.toml`, build output `out/`)                         |

## Quick start

```bash
npm ci
npm run dev      # http://localhost:3000
```

## Scripts

| Script               | Purpose                                                       |
| -------------------- | ------------------------------------------------------------- |
| `npm run dev`        | Local dev server (port 3000)                                  |
| `npm run build`      | Production static build → `out/`                              |
| `npm run start`      | Serve the production build                                    |
| `npm run lint`       | ESLint check                                                  |
| `npm run test`       | Vitest unit tests (single run)                                |
| `npm run test:watch` | Vitest watch mode                                             |
| `npm run e2e`        | All Playwright e2e tests                                      |
| `npm run e2e:smoke`  | Smoke e2e (all routes serve 200, no React errors)             |
| `npm run e2e:tools`  | Tool e2e (per-tool output assertions)                         |
| `npm run e2e:axe`    | axe-core a11y scan (light + dark, must pass)                  |
| `npm run e2e:overflow` | Overflow check (320 / 390 / 768 / 1440)                     |
| `npm run e2e:motion` | Reduced-motion check                                           |
| `npm run e2e:cls`    | CLS check (< 0.1 on all pages)                                |

## CI gates (must pass on `ci.yml`)

1. **Lint** — 0 ESLint errors
2. **Unit tests** — Vitest (41,270 tests, includes per-tool logic tests)
3. **Build** — `next build` static export
4. **Smoke E2E** — every route serves 200, no React errors
5. **Tool E2E** — every registered tool works end-to-end
6. **CLS** — < 0.1 on all pages
7. **axe** — 0 serious/critical findings, light + dark themes

Informational (continue-on-error): overflow at 320/390/768/1440, reduced-motion.

Deploy job runs only on `main` push; Cloudflare Pages auto-picks the `out/` directory.

## Tool Module Contract

Every tool lives at `src/tools/<category>/<id>/` and contains:

- `manifest.ts` — id, name, description, category, keywords, icon, SEO, status
- `logic.ts` — pure functions returning `ToolResult<T> = { ok: true; output } | { ok: false; error }`
- `logic.test.ts` — Vitest unit tests (valid / invalid / edge / large input)
- `ui.tsx` — React client component built only from template components
- `worker.ts` — optional Web Worker for heavy lifting

Tools are registered in [`src/lib/registry.ts`](./src/lib/registry.ts). Routing,
the homepage grid, search, and the ⌘K command palette all derive from the
registry automatically.

## Documentation

Detailed design docs (original Notion export, frozen reference) live in the
**private** `unqtools-docs` repo: `https://github.com/Sandeepgaddam5432/unqtools-docs`

Living docs (always current) live in this repo:

- [`AGENTS.md`](./AGENTS.md) — build rules, read first every session
- [`STATE.md`](./STATE.md) — live resume point
- [`docs/CODEBASE.md`](./docs/CODEBASE.md) — full codebase walkthrough
- [`docs/CLEANUP-INVENTORY.md`](./docs/CLEANUP-INVENTORY.md) — v6.8 cleanup log
- [`docs/TOOLS-INDEX.md`](./docs/TOOLS-INDEX.md) — complete catalog of all 1,679 tools (auto-generated by `scripts/generate-tools-index.mjs`)
- [`docs/MERGE-PLAN.md`](./docs/MERGE-PLAN.md) — tool consolidation roadmap (mega tools)
- [`docs/TOOL-TESTING-LOG.md`](./docs/TOOL-TESTING-LOG.md) — 60 rebuilt tools with full feature checklists for manual testing (mark ✅/❌/⚠️)
- [`docs/ROADMAP-v18.md`](./docs/ROADMAP-v18.md) — growth & monetization plan (₹1L/day path)

## License

Copyright (c) 2026 Sandeep Gaddam. All rights reserved.

This software and documentation are proprietary and confidential.
No use, copying, modification, or distribution is permitted
without explicit written permission from the owner.
