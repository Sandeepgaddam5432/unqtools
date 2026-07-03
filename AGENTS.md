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

## 2. Tech stack (v6.0 "UnQTemplate" — owner-authorized stack unlock)

> **v6.0 stack unlock (2026-07-03):** The Astro + Preact + Workbox stack rule is REVOKED.
> The new stack is the owner's personal template (`UnQWebTemplate`) stack, adopted verbatim.
> Design source of truth = `UnQWebTemplate` repo. ZERO creative reinterpretation.

| Layer         | Choice                                                                                                     |
| ------------- | ---------------------------------------------------------------------------------------------------------- |
| Framework     | **Next.js 16** (App Router, `output: 'export'` — 100% static) + **React 19**                               |
| Language      | **TypeScript 5** (strict)                                                                                  |
| Styling       | **Tailwind CSS 4** + shadcn/ui design tokens                                                               |
| Components    | **shadcn/ui** (Radix primitives) + **Magic UI / 21st.dev** effects                                         |
| Motion        | **Framer Motion 12** (with `useReducedMotion` / `MotionConfig` for a11y)                                   |
| Icons         | **Lucide React**                                                                                            |
| Theming       | **next-themes** (dark default, terracotta/copper palette)                                                  |
| Toasts        | **Sonner**                                                                                                 |
| Heavy effects | **Three.js** + **cobe** (globe) — lazy/dynamic imports only                                                |
| PWA           | **next-pwa** + custom service worker (`public/sw.js`) + manifest (`public/manifest.json`)                  |
| Unit tests    | **Vitest**                                                                                                 |
| e2e tests     | **Playwright** (+ axe-core a11y assertions)                                                                |
| Lint / format | **ESLint** (eslint-config-next) + **Prettier**                                                             |
| CI            | **GitHub Actions**                                                                                         |

### Non-negotiable product principles (still apply)

1. **100% static** — `output: 'export'`. No server runtime, no API routes, no SSR.
2. **No Prisma/SQLite/DB** — UnQTools has no backend.
3. **Privacy-first** — no tracking, no accounts, no external calls at runtime.
4. **Offline PWA** — installable, works without network after first load.
5. **Accessible** — WCAG 2.1 AA, keyboard-first, `prefers-reduced-motion` respected.
6. **Deterministic builds** — `npm ci` reproducible.
7. **Proprietary** — all rights reserved. See `LICENSE`. Not open source.

### Design fidelity rule (the whole point)

- The design must be EXACTLY the template's. Same colors, fonts, spacing, components,
  effects, nav, sidebar, dark/light behavior, animations. ZERO creative reinterpretation.
- Never restyle a template component. Never swap its palette. Never "simplify" an effect.
- When building any UnQTools page, FIRST find the closest template page/section/block and
  copy it as-is, then swap only the content.
- If something is genuinely missing, compose from existing template components — do not invent new styles.

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

| Thing              | Convention  | Example                 |
| ------------------ | ----------- | ----------------------- |
| Tool id / folder   | kebab-case  | `json-formatter`        |
| Component files    | PascalCase  | `CopyButton.tsx`        |
| Logic / util files | camelCase   | `runWorker.ts`          |
| Types / interfaces | PascalCase  | `ToolManifest`          |
| Constants          | UPPER_SNAKE | `MAX_FILE_SIZE`         |
| CSS tokens         | `--unq-*`   | `--unq-color-bg`        |
| Routes             | kebab-case  | `/tools/json-formatter` |

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
  _"Your files never leave your browser."_

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

## 12. Phase map (v6.0 "UnQTemplate")

- **Phase 0 — Adopt template as base** ✅ DONE (2026-07-03): Cloned `UnQWebTemplate`, created `v6-template` branch, replaced app codebase with template's (preserved: 22 tool logic modules + 529 unit tests + lib + LICENSE + AGENTS.md + STATE.md + CI). Configured `output: 'export'`. Verified `next build` produces static `out/` (21 pages) + all routes serve 200 from plain static server. Lint 0 errors, 529/529 tests green.
- **Phase 1 — UnQTools IA on template design**: Rebuild home (template Landing structure + UnQTools content), tools directory (template grid/card patterns + 22 tools), category pages, ⌘K search (template's ActionSearchBar/command.tsx wired to fuzzy tool search), navigation (template sidebar patterns + UnQTools IA). Commit + PUSH per page.
- **Phase 2 — Port the 22 tools**: Rebuild each tool's UI as React client components using ONLY template components (shadcn inputs, buttons, cards, tabs, toasts). Layout: tool header → inputs → action bar (Run/Copy/Download/Reset) → output → collapsible advanced options. Batches of 3–5 tools; commit + PUSH per batch. Re-add `component` field to manifests.
- **Phase 3 — PWA + performance sanity**: Verify manifest + SW on static export. Heavy libs (Three.js, particles) as lazy/dynamic imports. New budgets: tool pages ≤ 250 KB gz first-load; Lighthouse perf ≥ 85 mobile on tools, ≥ 75 on home.
- **Phase 4 — Gates + proof**: lint 0 · tests green · build green · every route 200 · 404 works · zero-overflow (320/390/768/1440) · axe-core light+dark clean · reduced-motion respected · screenshots (home + tools dir + 2 tools × desktop + mobile × light + dark) · VLM verdict "looks EXACTLY like UnQWebTemplate — terracotta cinematic premium" · mirror v6.0 design note into `unqtools-docs/DESIGN-SYSTEM.md`. Do NOT merge to `main` — owner reviews first.

---

## 13. Owner & licensing

- Owner: **Sandeep Gaddam** (`Sandeepgaddam5432` on GitHub).
- Licensing: **Proprietary — all rights reserved.** See `LICENSE`.
- This is **NOT open source.** Do not add any open-source license file.

---

## 14. MANDATORY — UI/UX skill (permanent rule)

**All UI/UX work must use the ui-ux-pro-max skill installed in this repo
(`.claude/skills/ui-ux-pro-max/`).** This rule stays active until the project
is complete.

On a fresh sandbox:

1. `git pull` — the skill files live in `.claude/skills/ui-ux-pro-max/`.
2. Verify the skill exists: `ls .claude/skills/ui-ux-pro-max/SKILL.md`.
3. If missing, reinstall: `npm install -g ui-ux-pro-max-cli && uipro init --ai claude`.
4. Generate the design system BEFORE writing any UI code:
   ```bash
   python3 .claude/skills/ui-ux-pro-max/scripts/design_system.py \
     "your product description" --project-name "UnQTools" --format markdown
   ```
5. Follow the skill's output (pattern, style, palette, typography, effects,
   anti-patterns, pre-delivery checklist) as the design contract.
6. Record deviations in `DESIGN-SYSTEM-V5.md` with reasons — no silent cherry-picking.
7. Enforce the pre-delivery checklist everywhere:
   - SVG icons (Lucide/Heroicons) — NO emojis as icons
   - `cursor-pointer` on every clickable element
   - 150–300ms hover transitions
   - Text contrast ≥ 4.5:1 (WCAG AA)
   - Visible focus states for keyboard nav
   - `prefers-reduced-motion` respected
   - Responsive at 375/768/1024/1440px
