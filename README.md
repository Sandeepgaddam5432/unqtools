# UnQTools

> **Proprietary and confidential.** All rights reserved. See [`LICENSE`](./LICENSE).

UnQTools is a 100% static, privacy-first, offline-capable PWA that delivers
a large catalog of browser-based tools (converters, calculators, generators,
editors, formatters, PDF utilities) — each ~10x better than existing
tool-collection sites.

## Status

**v7.0 — PDF batch-1** (in progress on `v7.0-pdf-batch1`).

32 tools live across 5 categories:

| Category              | Tools | Status            |
| --------------------- | ----- | ----------------- |
| Text & Writing        | 12    | live              |
| Developer & Code      | 5     | live              |
| Calculators           | 3     | live              |
| Image & Graphics      | 2     | live              |
| PDF & Document        | 10    | live (v7.0 batch-1) |
| 8 other categories    | 0     | "Coming soon" UI  |

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
| PDF processing| **pdf-lib** ^1.17.1 (added in v7.0 for PDF tools — client-side only)                |
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
2. **Unit tests** — Vitest (528+ tests, includes per-tool logic tests)
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
