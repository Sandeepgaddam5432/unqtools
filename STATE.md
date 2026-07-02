# UnQTools — Build State

_Last updated: 2026-07-02T04:15:00Z by GLM (z.ai sandbox)_

## Current phase

**Phase 0 — Scaffold** (in progress)

## Done (this session)

- [x] Created private GitHub repo `Sandeepgaddam5432/unqtools` (code)
- [x] Created private GitHub repo `Sandeepgaddam5432/unqtools-docs` (documentation)
- [x] Added proprietary `LICENSE` (all rights reserved) to both repos
- [x] Pushed 1,794 Notion-export markdown files to `unqtools-docs` (initial commit)
- [x] Wrote `AGENTS.md` (build rules) at root of `unqtools`
- [x] Wrote this `STATE.md` (resume point) at root of `unqtools`
- [x] Initial commit + push of `unqtools` repo (verified auth works)

## In progress

- [ ] **Phase 0 — Scaffold** (see "Next up")

## Next up (do these next, in order)

1. Scaffold Astro + Preact + Tailwind + TypeScript strict project; add ESLint + Prettier; pin all deps in `package.json` (use `npm ci` reproducible lockfile).
2. Add `package.json` scripts: `dev`, `build`, `preview`, `lint`, `format`, `test`, `test:watch`, `e2e`.
3. Add `tsconfig.json` with strict flags (`strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `verbatimModuleSyntax`, `target: ES2022`, `module: ESNext`, `moduleResolution: Bundler`).
4. Add `.github/workflows/ci.yml` — install → lint → test → build → deploy. Get a green pipeline on the empty scaffold.
5. Build app shell: header, footer, theme toggle (light/dark/system), routing, global client-side fuzzy search.
6. Build shared component library + design tokens: `Button`, `Input`, `Textarea`, `Select`, `Toggle`, `Slider`, `Card`/`ToolCard`, `Tabs`, `Accordion`, `Tooltip`, `Toast`, `CopyButton`, `DownloadButton`, `ShareButton`, `SearchBar`.
7. Implement **Tool Module Contract** interface + tool registry (`name`, `category`, `route`, `keywords`, `icon`). Add Web Worker + WASM loading harness. URL/query shareable state.
8. Add **PWA**: Workbox service worker + web app manifest. Verify it loads offline.

**Phase 0 Definition of Done:**
`npm ci && npm run lint && npm run test && npm run build` all green; empty shell
deployed to the static host; PWA installable + works offline; Tool Module Contract ready.

## Key decisions / notes

- **Locked stack** per `AGENTS.md` §2 — do NOT change without owner approval.
- **Proprietary license** — NOT open source. Do not add an OSS license file.
- **Docs repo** lives at `https://github.com/Sandeepgaddam5432/unqtools-docs` —
  clone it locally when you need a spec (e.g. doc #10 for the JSON Formatter,
  doc #8 for the Tool Module Contract, doc #5 for the design system).
- **No backend.** Everything is static + client-side. User data never leaves the browser.
- **Git remote** uses the PAT inline: `https://<PAT>@github.com/Sandeepgaddam5432/unqtools.git`.
  The PAT is supplied by the owner at session start; never commit it to the repo.
- File names from the Notion export contained mangled emoji bytes — they were
  cleaned (replaced with `-`) before pushing to `unqtools-docs`. Do not "restore"
  them.

## Blockers

- _None._ PAT works, both repos created and pushed, ready to scaffold.
