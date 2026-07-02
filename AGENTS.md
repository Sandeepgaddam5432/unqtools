# AGENTS.md — UnQTools Build Rules

> **Read this FIRST at the start of every session.**
> Then read `STATE.md` (the live resume point).
> This file is the single source of truth for how to build UnQTools.
> The sandbox is **ephemeral** — nothing permanent lives only inside it.

---

## 0. Source of truth & docs

- **Detailed design docs** live in the **private `unqtools-docs` repo**
  (`https://github.com/Sandeepgaddam5432/unqtools-docs`) — a Notion export.
  Clone it locally and read the relevant spec whenever you start a tool:
  - `0 START HERE — AI Agent Build Guide`
  - `1 Project Overview & Vision`
  - `2 Product Requirements (PRD)`
  - `3 Tool Catalog`
  - `4 Technical Architecture`
  - `5 Design System & UX Guidelines`
  - `6 Roadmap & Milestones`
  - `8 Tool Module Contract & Architecture`
  - `9 Coding Standards & Repo Structure`
  - `10 Reference Tool Spec — JSON Formatter` (the canonical end-to-end example)
  - `11 Production Readiness & QA Checklist`
  - `12 10x Tool Blueprints (Web-Researched)/` — 13 category folders
  - `Agent Continuity & Handoff Protocol`
  - `GLM Master Prompt — Build Kickoff`
- **Continuity source of truth** = this repo: `AGENTS.md` (rules) + `STATE.md` (resume point).
  Read both at the start of every session.
- When in doubt, the **`GLM Master Prompt`** doc in `unqtools-docs` is the
  canonical description of the master prompt that created this project.

---

## 1. Non-negotiable rules

- **100% static** — no backend, no servers, no accounts. Static hosting only.
- **Privacy-first** — user data never leaves the browser.
- **Offline-capable** — installable PWA, works without network.
- **One architecture for all tools** — the Tool Module Contract (see doc #8).
- **Accessible** — WCAG 2.1 AA, keyboard-first.
- **Deterministic builds** — pinned dependency versions, `npm ci` reproducible.
- **Proprietary** — all rights reserved. See `LICENSE`. Not open source.

---

## 2. Locked tech stack (do NOT change without owner approval)

| Layer | Choice |
| --- | --- |
| Framework | **Astro** (static output) + **Preact islands** |
| Language | **TypeScript strict** (`strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `verbatimModuleSyntax`) |
| Styling | **Tailwind CSS** + design tokens (`--unq-*`) |
| Heavy compute | **Web Workers** + **WASM** (`ffmpeg.wasm`, `pdf-lib`, `libarchive`, …) — lazy-loaded |
| PWA | **Workbox** service worker + web app manifest |
| Unit tests | **Vitest** |
| e2e tests | **Playwright** (+ axe-core a11y assertions) |
| Lint / format | **ESLint** + **Prettier** |
| CI | **GitHub Actions** |

---

## 3. Design bar (critical)

- **Apple.com-grade premium feel and better.** Natural, effortless, generous
  whitespace, restrained color, subtle depth (soft shadows + frosted glass),
  60fps intentional motion, pixel-perfect detail. **Calm > flashy.**
- **100% responsive on EVERY screen size** — 320px phone → 4K ultra-wide.
  Mobile-first; fluid `clamp()` / `rem` / `vw`; CSS Grid/Flexbox reflow;
  44×44px touch targets; safe-area/notch support.
- A broken/clipped layout or any horizontal scroll at any breakpoint is a
  **RELEASE BLOCKER**.

---

## 4. Repository structure (target)

```
unqtools/
├─ public/                 # static assets, icons, manifest.webmanifest, robots.txt
├─ src/
│  ├─ components/          # shared UI primitives (ToolShell, CopyButton, ...)
│  ├─ layouts/            # Astro layouts (BaseLayout, ToolLayout)
│  ├─ lib/                # registry.ts, tool.ts, runWorker.ts, search.ts, utils
│  ├─ pages/              # index.astro, tools/[id].astro, category/[category].astro
│  ├─ styles/             # tailwind.css, tokens.css
│  └─ tools/              # ONE folder per tool, grouped by category
│     └─ developer/
│        └─ json-formatter/
│           ├─ manifest.ts
│           ├─ logic.ts
│           ├─ logic.test.ts
│           ├─ ui.tsx
│           └─ worker.ts        # optional
├─ tests/                  # playwright e2e + a11y
├─ .github/workflows/ci.yml
├─ astro.config.mjs
├─ tailwind.config.ts
├─ tsconfig.json
├─ .eslintrc.cjs
├─ .prettierrc
├─ package.json
├─ AGENTS.md
├─ STATE.md
└─ README.md
```

---

## 5. Naming conventions

| Thing | Convention | Example |
| --- | --- | --- |
| Tool id / folder | kebab-case | `json-formatter` |
| Component files | PascalCase | `CopyButton.tsx` |
| Logic / util files | camelCase | `runWorker.ts` |
| Types / interfaces | PascalCase | `ToolManifest` |
| Constants | UPPER_SNAKE | `MAX_FILE_SIZE` |
| CSS tokens | `--unq-*` | `--unq-color-bg` |
| Routes | kebab-case | `/tools/json-formatter` |

---

## 6. Performance budgets (hard limits)

- Initial route JS (homepage): **≤ 60 KB gzipped**.
- Per-tool island JS: **≤ 50 KB gzipped** (excluding lazy WASM).
- Largest Contentful Paint: **< 1.5s** on mid-tier mobile.
- Lighthouse Performance / A11y / Best Practices / SEO: **≥ 95**.
- WASM and heavy libs are **lazy-loaded only when the tool is opened**.
- No layout shift (**CLS < 0.1**). All interactive work > 16ms goes off the main thread.

---

## 7. Accessibility (WCAG 2.1 AA)

- Full keyboard operability; visible focus rings; logical tab order.
- Proper labels, `aria-*`, roles; live regions for async results.
- Color contrast ≥ 4.5:1 (text). Respect `prefers-reduced-motion` and `prefers-color-scheme`.
- Every Playwright e2e includes an **axe-core** a11y assertion.

---

## 8. Testing strategy

- **Unit (Vitest):** all `logic.ts` pure functions — valid, invalid, edge, large input.
- **e2e (Playwright):** load tool → enter sample → see output → copy/download → a11y scan.
- **Coverage target:** core logic ≥ 90%.
- A tool is **not "done"** without passing unit + e2e.

---

## 9. Git & commit conventions

- **Conventional Commits:** `feat(json-formatter): add sort keys option`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`.
- One tool (or one concern) per PR. PR description links the tool in the catalog.
- `main` is always deployable; CI must be green to merge.
- **Commit early and often.** Never leave permanent work only in the sandbox.

---

## 10. Error handling & UX safety

- Never throw to the user. Catch, show a friendly `ErrorBanner` with the reason.
- Validate input size; warn before processing very large files.
- All processing client-side; show a clear privacy note:
  *"Your files never leave your browser."*

---

## 11. Session rituals (the sandbox is EPHEMERAL)

### 🟢 Session START (fresh sandbox)

1. `git clone` (or `git pull`) — pull the full codebase.
2. Read **`AGENTS.md`** (this file).
3. Read **`STATE.md`** — this is the resume point.
4. (Optional) clone `unqtools-docs` for spec details on the current tool.
5. Run `npm ci` to restore exact pinned dependencies.

### 🔴 Session END (before the sandbox dies — every time)

1. `git add` + `git commit` + **`git push`** — never leave uncommitted work.
2. Update **`STATE.md`**: what was done, what's next, decisions, blockers.
3. Commit + push `STATE.md` too.
4. Report progress after each phase.

**Golden rule:** Nothing permanent ever lives only in the sandbox.
If it matters, it is committed to GitHub before the session ends.

---

## 12. Phase map

- **Phase 0 — Scaffold** (no tools yet): Astro + Preact + Tailwind + TS strict;
  ESLint + Prettier; pinned deps; GitHub Actions CI green; app shell
  (header/footer/theme toggle/routing/global fuzzy search); shared component
  library; Tool Module Contract interface + tool registry; Workbox PWA.
  **Definition of done:** `npm ci && npm run lint && npm run test && npm run build`
  all green; empty shell deployed; PWA installable + works offline;
  Tool Module Contract ready.
- **Phase 1 — Reference tool:** implement the **JSON Formatter** exactly per
  doc #10 spec, end-to-end (UI + worker + tests + a11y + SEO).
- **Phase 2+ — v1 core set:** ship the catalog from doc #3, one tool per PR,
  following the contract.

---

## 13. Owner & licensing

- Owner: **Sandeep Gaddam** (`Sandeepgaddam5432` on GitHub).
- Licensing: **Proprietary — all rights reserved.** See `LICENSE`.
- This is **NOT open source**. Do not add any open-source license file.
