# UnQTools

> **Proprietary and confidential.** All rights reserved. See [`LICENSE`](./LICENSE).

UnQTools is a 100% static, privacy-first, offline-capable PWA that delivers
a large catalog of browser-based tools (converters, calculators, generators,
editors, formatters) — each ~10x better than existing tool-collection sites.

## Status

**Phase 0 — Scaffold** (in progress). See [`STATE.md`](./STATE.md) for the live
resume point and [`AGENTS.md`](./AGENTS.md) for the build rules.

## Tech stack (locked)

- **Astro** (static output) + **Preact islands**
- **TypeScript strict**
- **Tailwind CSS** + design tokens
- **Web Workers** + **WASM** (lazy-loaded)
- **Workbox** PWA
- **Vitest** + **Playwright**
- **ESLint** + **Prettier**
- **GitHub Actions** CI

## Quick start

```bash
npm ci
npm run dev
```

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Local dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview the production build |
| `npm run lint` | ESLint + Prettier check |
| `npm run format` | Prettier write |
| `npm run test` | Vitest unit tests |
| `npm run test:watch` | Vitest watch mode |
| `npm run e2e` | Playwright e2e tests |

## Documentation

Detailed design docs live in the **private** `unqtools-docs` repo:
`https://github.com/Sandeepgaddam5432/unqtools-docs`

## License

Copyright (c) 2026 Sandeep Gaddam. All rights reserved.

This software and documentation are proprietary and confidential.
No use, copying, modification, or distribution is permitted
without explicit written permission from the owner.
