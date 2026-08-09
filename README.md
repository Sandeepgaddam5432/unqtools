# UnQTools

> **Proprietary and confidential.** All rights reserved. See [`LICENSE`](./LICENSE).

UnQTools is a 100% static, privacy-first, offline-capable PWA that delivers
a large catalog of browser-based tools (converters, calculators, generators,
editors, formatters, PDF utilities) — each ~10x better than existing
tool-collection sites.

## Status

**v17.71 — 1,704 tools live across all 13 categories** (2026-08-09).

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
| 1 | PDF & Document         |  330 |    100 |   0 ✅ |
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
| **Total** |                    | **1,704** | **1,700** | **0 ✅** |

All 13 categories active with **1,704 tools live** (exceeding the 1,700 catalog target).
Five categories complete or exceeded: PDF (330/100), Image (178/100), SEO (109/100),
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

## License

Copyright (c) 2026 Sandeep Gaddam. All rights reserved.

This software and documentation are proprietary and confidential.
No use, copying, modification, or distribution is permitted
without explicit written permission from the owner.
