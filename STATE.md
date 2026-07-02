# UnQTools — Build State

_Last updated: 2026-07-02T04:30:00Z by GLM (z.ai sandbox)_

## Current phase

**Phase 0 — Scaffold** ✅ COMPLETE → ready for Phase 1 (JSON Formatter)

## Done (this session)

### Setup
- [x] Created private GitHub repo `Sandeepgaddam5432/unqtools` (code)
- [x] Created private GitHub repo `Sandeepgaddam5432/unqtools-docs` (documentation)
- [x] Added proprietary `LICENSE` (all rights reserved) to both repos
- [x] Pushed 1,794 Notion-export markdown files to `unqtools-docs` (initial commit)
- [x] Wrote `AGENTS.md` (build rules) at root of `unqtools`
- [x] Wrote initial `STATE.md` at root of `unqtools`
- [x] Initial commit + push of `unqtools` (auth verified)

### Phase 0 — Scaffold (Definition of Done MET)
- [x] Astro + Preact + Tailwind + TypeScript strict project scaffolded
- [x] `tsconfig.json` with `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `verbatimModuleSyntax`
- [x] Pinned all deps in `package.json` + committed `package-lock.json` (reproducible `npm ci`)
- [x] ESLint flat config + Prettier (with astro + tailwind plugins); `npm run lint` GREEN
- [x] Vitest configured with passing unit tests (`tests/search.test.ts`, 7 tests); `npm run test` GREEN
- [x] Playwright configured with Phase 0 smoke e2e (`tests/shell.e2e.ts`)
- [x] `npm run build` GREEN — 15 static pages prerendered (home, 404, 13 category pages)
- [x] GitHub Actions CI (`.github/workflows/ci.yml`) — install → lint → test → build → deploy to Pages
- [x] App shell: `BaseLayout` with header (logo + nav + theme toggle), footer, skip-link, PWA registration
- [x] Theme toggle (light/dark/system) with no-FOUC inline script; respects `prefers-color-scheme`
- [x] Routing: `/`, `/tools/[id]`, `/category/[category]` (getStaticPaths from registry), `/404`
- [x] Global client-side fuzzy search (`src/lib/search.ts` + `ClientSearch.ts`) on the homepage
- [x] Shared component library (`src/components/ui.tsx`): Button, Input, Textarea, Select, Toggle,
      Slider, Card, Tabs, Accordion, Tooltip, Toast, CopyButton, DownloadButton, ShareButton,
      ErrorBanner — all keyboard-first, WCAG 2.1 AA, `--unq-*` tokens
- [x] Design tokens (`src/styles/global.css`) — light/dark themes, `--unq-*` namespace, focus rings,
      reduced-motion, no horizontal scroll
- [x] Tool Module Contract interface (`src/lib/tool.ts`) — `ToolManifest`, `ToolCategory`,
      `ToolResult<T>`, `ALL_CATEGORIES`, `CATEGORY_LABELS`
- [x] Tool registry (`src/lib/registry.ts`) — Vite glob auto-collects `src/tools/**/manifest.ts`,
      exports `TOOLS`, `byCategory`, `byId`, `countByCategory`
- [x] Web Worker harness (`src/lib/runWorker.ts`) — generic `runInWorker<I,O>` with timeout
- [x] URL/query shareable state helper (`src/lib/utils.ts` → `buildShareableUrl`)
- [x] PWA: `public/manifest.webmanifest`, `public/sw.js` (precache shell + stale-while-revalidate),
      PNG icons (192/512) generated via `scripts/gen_icons.py`
- [x] `ToolShell.astro` wrapper — privacy banner, breadcrumb, title
- [x] `ToolCard.astro` for the homepage / category grids
- [x] Production preview server verified: home/manifest/sw/favicon/icons all serve 200; 404 returns 404

## In progress

- _Nothing._ Phase 0 complete; awaiting kickoff of Phase 1.

## Next up (Phase 1 — Reference tool)

1. Read `unqtools-docs` doc **"10 Reference Tool Spec — JSON Formatter"** end-to-end.
2. Create `src/tools/developer/json-formatter/`:
   - `manifest.ts` — implements `ToolManifest` (id=`json-formatter`, category=`developer`)
   - `logic.ts` — pure `formatJson(input, opts)` returning `ToolResult<string>`, with `sortKeys`, `indent`, validation
   - `logic.test.ts` — Vitest covering valid, invalid, edge cases, large input
   - `ui.tsx` — Preact island using shared primitives (Textarea, Select, Toggle, CopyButton, DownloadButton, ErrorBanner)
   - `worker.ts` — wrap `formatJson` for large inputs via `runInWorker`
3. Add Playwright e2e: load `/tools/json-formatter` → enter sample → see output → copy → a11y scan.
4. Verify perf budgets (per-tool island JS ≤ 50KB gzipped; Lighthouse ≥ 95).
5. Update STATE.md + push.

## Key decisions / notes

- **Locked stack** per `AGENTS.md` §2 — do NOT change without owner approval.
- **Proprietary license** — NOT open source. Do not add an OSS license file.
- **Docs repo** lives at `https://github.com/Sandeepgaddam5432/unqtools-docs` —
  clone it locally when you need a spec (e.g. doc #10 for the JSON Formatter,
  doc #8 for the Tool Module Contract, doc #5 for the design system).
- **No backend.** Everything is static + client-side. User data never leaves the browser.
- **Git remote** uses the PAT inline: `https://<PAT>@github.com/Sandeepgaddam5432/unqtools.git`.
  The PAT is supplied by the owner at session start; never commit it to the repo.
- **File names** from the Notion export contained mangled emoji bytes — they were
  cleaned (replaced with `-`) before pushing to `unqtools-docs`. Do not "restore" them.
- **Astro static output** with Preact islands; only `tools/[id].astro` lazy-imports
  a tool's component — keeps the homepage bundle tiny.
- **Search** is implemented as plain DOM (no Preact island on the homepage) to keep
  the homepage JS well under the 60KB gzipped budget.
- **GitHub Pages** is the deployment target (`pages: write` permission in CI).
  The `site` field in `astro.config.mjs` is a placeholder (`unqtools.example.com`)
  — update it once the real domain is known.
- **axe-core a11y assertions** in Playwright are deferred to Phase 1 (the dependency
  is installed; the wire-up lands alongside the first real tool e2e).

## Phase 0 — Definition of Done (verdict)

| Criterion | Status |
| --- | --- |
| `npm ci` reproducible | ✅ (lockfile committed) |
| `npm run lint` green | ✅ |
| `npm run test` green | ✅ (7 tests) |
| `npm run build` green | ✅ (15 pages) |
| Empty shell deployed | ⏳ (CI will deploy on push to `main`) |
| PWA installable + works offline | ✅ (manifest + SW + icons; offline cache strategy implemented) |
| Tool Module Contract ready | ✅ (`src/lib/tool.ts` + registry + worker harness) |

## Blockers

- _None._ Ready for Phase 1.
