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

### 1a. Conversation language — Telugu-English mix (MANDATORY, owner directive 2026-07-14)

The owner (Sandeep Gaddam) is a Telugu speaker. All conversational replies,
summaries, status updates, and explanations MUST use a **Telugu-English mix**:
- English text + Telugu words mixed in the same sentences.
- Format: "Next batch chestanu, 5 tools implement cheyali" (English grammar
  with Telugu action words / casual fillers).
- Code, identifiers, commit messages, file contents, technical terms (API
  names, library names, file paths, error messages) stay in English.
- This applies to ALL chat replies — including bug reports, fix summaries,
  status updates, next-step suggestions, and clarifying questions.
- File contents (STATE.md, source code, comments inside code) stay in
  standard English — only the conversational chat surface uses Telugu-English.

Example correct reply:
> "Repos ready! Bug fix aipoyindi. Lint + tests + build pass. Next
> cheppana — Batch 3 start cheyana?"

Example WRONG reply (pure English or pure Telugu):
> "Repositories are ready. The bug has been fixed. Lint, tests, and
> build all pass. Should I start Batch 3?"

### 1b. 100% blueprint feature compliance (MANDATORY, owner directive 2026-07-14)

Every tool built after 2026-07-14 MUST implement **100% of the blueprint's
feature set** — not 40%, not "the must-haves only". The blueprints in the
private `unqtools-docs` repo (`12 10x Tool Blueprints (Web-Researched)/`)
are the single source of truth for what a tool does.

**Pre-flight (before writing any code):**
1. Read the matching blueprint file from `unqtools-docs`.
2. List every feature from sections **5 (Feature set)**, **7 (UX details)**,
   and **10 (Acceptance criteria)**.
3. Implement each one. No skipping. No "I'll do that later".

**Allowed exceptions (must be documented in code comment + tool FAQ):**
- Features that violate the no-network rule (e.g., HIBP k-anonymity check
  needs network). Skip but document in FAQ as "intentionally omitted to
  preserve offline-first guarantee".
- Features that are technically impossible in a browser (e.g., opening raw
  TCP sockets). Skip but document with self-host recipe in FAQ.
- Features that need a WASM dependency >5MB (bundle bloat). Skip if a
  lighter alternative exists; otherwise ship the WASM and lazy-load it.

**NOT allowed:**
- Skipping "Advanced" features because they're hard (e.g., EFF passphrase
  mode, zxcvbn cross-check, per-class minimums, pronounceable mode).
- Skipping "Optional" features silently. Either implement or document.
- Marking a tool as `status: "done"` without checking every box in
  section 10 (Acceptance criteria).

**Post-build checklist (before commit):**
- [ ] Every feature in blueprint §5 (Feature set) is implemented
- [ ] Every UX detail in blueprint §7 is respected
- [ ] Every acceptance criterion in blueprint §10 passes
- [ ] Every honesty clause from the blueprint is reflected in the UI
      (privacy note, "honesty clause" disclaimers, network-feature flags)
- [ ] Test coverage includes the advanced features, not just happy path
- [ ] Commit message lists any deferred features with reasons

**Existing tools grandfathered but tracked:**
Tools built before 2026-07-14 (v6.0–v8.0 Batch 2) were shipped at ~40-50%
blueprint compliance. They are NOT being rebuilt today, but each tool's
missing features are tracked in `STATE.md` under "Blueprint compliance
backlog". When upgrading a tool, the backlog entry must be cleared.

### 1c. 10 extra useful features beyond blueprint (MANDATORY, owner directive 2026-07-14)

In addition to 100% blueprint compliance (§ 1b), every tool built or
upgraded after 2026-07-14 MUST ship with **at least 10 extra useful
features** that are NOT in the blueprint. The owner's standard is
"10x better than competitors" — and competitors don't stop at the
blueprint either.

### 1d. 5 tools per session (MANDATORY, owner directive 2026-07-14)

Every work session MUST complete **at least 5 tools** at 100% blueprint
compliance + 10 extras. This applies to both upgrades (existing tools)
and new builds. Do not stop at 1 or 2 — push through to 5.

If a session is running long, prioritize finishing the 5th tool over
adding more extras to the first 4. "5 done at 10 extras" beats
"4 done at 15 extras".

**How to brainstorm extras:**
1. Read the blueprint's §2 (Market leaders) and §3 (Their weaknesses).
2. For each weakness, ask: "What else could we do that no one else does?"
3. Look at adjacent tools — features from related categories that
   would be useful here (e.g., password generator → password history
   with localStorage, breach-check toggle, CSV export for password
   manager import).
4. Look at power-user workflows — what would a sysadmin, developer,
   or security researcher want that casual users don't?
5. Each extra feature must be genuinely useful, not padding. Skip
   "dark mode toggle" or "share to social" type fluff.

**Where to document the 10 extras:**
- `manifest.ts` `seo.faq` — add an FAQ entry: "What extra features does
  this tool have compared to others?" with a list.
- `STATE.md` — when clearing a backlog row, list the 10 extras shipped.
- Commit message — list every extra feature with a one-line description.

**NOT allowed:**
- Counting bug fixes or refactors as "extra features".
- Counting UI polish (animations, hover states) as "extra features".
- Counting basic accessibility (aria-labels, keyboard nav) as "extra
  features" — those are baseline expectations.
- Padding with low-value extras (e.g., "share to Twitter button").
- Skipping the 10-extras rule for "simple" tools — every tool ships 10.

**If you genuinely can't think of 10 useful extras:**
- Re-read the blueprint — you missed something.
- Look at 3 competitor tools — what do they do that the blueprint
  doesn't cover? Implement that.
- Ask: "What would make me switch from my current tool to this one?"
- Still stuck? Ship the tool with the extras you have, but add a
  `TODO: 10-extras-not-met` comment in `manifest.ts` so the next
  upgrade pass picks it up. Do NOT mark `status: "done"`.

**Example — password-generator extras (10):**
1. Password history (localStorage, last 10, with clear button)
2. Common pattern detection (sequential "1234", repeated "aaaa",
   keyboard "qwerty") — warn user with badge
3. Mobile PIN generator mode (4-8 digit numeric, optimized for phones)
4. WPA2/WPA3 WiFi password generator (63-char ASCII for max entropy)
5. Diceware mode with virtual dice (5 rolls → 1 EFF word)
6. Auto-clear clipboard after 30s with countdown timer
7. CSV/JSON export of batch generation (with metadata, never presets)
8. Visual entropy meter (animated bar + bit count + crack-time estimate)
9. Keyboard shortcuts (Space=regenerate, C=copy, 1-5=preset)
10. Pronounceable-but-strong mode (consonant-vowel-consonant patterns)

Example WRONG extras:
- "Nice gradient background" (UI polish, not a feature)
- "Copy button" (basic expectation, not an extra)
- "Dark mode" (baseline, not an extra)

---

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

## 4. Repository structure (actual — Next.js 16 App Router)

```
unqtools/
├─ public/                       # sw.js, manifest.json, logo.svg, _headers, _redirects, robots.txt
├─ src/
│  ├─ app/                       # Next.js App Router
│  │  ├─ layout.tsx              # root layout (theme, toaster, PWA, ⌘K)
│  │  ├─ page.tsx                # home (Hero + Bento + Testimonials + Footer)
│  │  ├─ globals.css             # Tailwind 4 entry + design tokens
│  │  ├─ tools/
│  │  │  ├─ page.tsx             # tools directory grid
│  │  │  └─ [id]/
│  │  │     ├─ page.tsx          # server entry
│  │  │     └─ tool-page-client.tsx  # client shell + lazy UI loader map
│  │  └─ category/
│  │     └─ [category]/
│  │        ├─ page.tsx
│  │        └─ category-page-client.tsx
│  ├─ components/
│  │  ├─ ui/                     # 23 active shadcn/ui + Magic UI components
│  │  ├─ navigation/             # sidebar.tsx + mobile-header.tsx
│  │  ├─ command-palette.tsx     # ⌘K fuzzy tool search
│  │  ├─ theme-provider.tsx
│  │  ├─ motion-provider.tsx
│  │  ├─ pwa-install.tsx
│  │  └─ tool-skeleton.tsx
│  ├─ lib/
│  │  ├─ tool.ts                 # ToolManifest contract + 13 ToolCategory union
│  │  ├─ registry.ts             # central explicit-import tool registry
│  │  ├─ search.ts
│  │  └─ utils.ts
│  └─ tools/                     # ONE folder per tool, grouped by category
│     ├─ _shared/index.tsx       # CopyButton, DownloadButton, RunButton, ErrorBanner
│     ├─ developer/   (5 tools)  # base64, hash-generator, json-formatter, url-encoder, uuid-generator
│     ├─ image/       (2 tools)  # color-picker, image-compressor
│     ├─ calculators/ (3 tools)  # emi, mortgage, sip
│     ├─ text/        (12 tools) # add-line-breaks, add-prefix-suffix, big-text, bold-text,
│     │                          # bubble-text, caesar-cipher, case-converter, csv-to-markdown,
│     │                          # csv-to-text-list, diff-checker, duplicate-lines-remover,
│     │                          # word-character-counter
│     └─ pdf/         (10 tools) # merge, split, rotate, delete, extract, reorder,
│                                # images-to-pdf, pdf-page-numbers, pdf-watermark,
│                                # pdf-metadata-editor (added in v7.0 batch-1)
│        └─ _shared/             # page-ranges.ts, page-ranges.test.ts, download.ts
├─ archive/                      # 67 unused UI components + showcase pages (history preserved, do NOT import)
├─ tests/                        # Playwright e2e + design-system + search + no-archive-imports tests
│  ├─ smoke.e2e.ts               # all routes serve 200, no React errors
│  ├─ tool.e2e.ts                # per-tool output assertions
│  ├─ axe.e2e.ts                 # a11y scan, light + dark (must pass)
│  ├─ cls.e2e.ts                 # CLS < 0.1 on all pages
│  ├─ overflow.e2e.ts            # 320 / 390 / 768 / 1440 (informational)
│  ├─ reduced-motion.e2e.ts      # informational
│  ├─ design-system.test.ts      # vitest
│  ├─ search.test.ts             # vitest
│  ├─ no-archive-imports.test.ts # vitest guard
│  ├─ routes.json                # generated by gen-routes.mjs (CI regenerates)
│  ├─ gen-routes.mjs             # route list generator
│  └─ static-server.mjs          # local static server for e2e
├─ docs/                         # CODEBASE.md, CLEANUP-INVENTORY.md, lighthouse JSONs, screenshots
├─ .github/workflows/
│  ├─ ci.yml                     # lint + tests + build + smoke + tool e2e + CLS + axe + deploy
│  └─ Update-lock-file.yml       # auto-regenerates package-lock.json on package.json push
├─ next.config.ts                # output: 'export', images.unoptimized, reactStrictMode: false
├─ eslint.config.mjs             # ESLint 9 flat config + eslint-config-next
├─ vitest.config.ts
├─ playwright.config.ts
├─ tsconfig.json
├─ postcss.config.mjs
├─ components.json               # shadcn/ui config
├─ wrangler.toml                 # Cloudflare Pages (pages_build_output_dir = "out")
├─ package.json
├─ package-lock.json
├─ AGENTS.md                     # ← this file
├─ STATE.md                      # live resume point
├─ README.md
└─ LICENSE
```

### Tool folder layout (every tool, unchanged contract)

```
src/tools/<category>/<id>/
├─ manifest.ts        # id, name, description, category, keywords, icon, SEO, status
├─ logic.ts           # pure functions → ToolResult<T> = { ok: true; output } | { ok: false; error }
├─ logic.test.ts      # vitest unit tests (valid / invalid / edge / large)
├─ ui.tsx             # "use client" React component, template components only
└─ worker.ts          # optional Web Worker (json-formatter, image-compressor, word-character-counter)
```

PDF tools (v7.0) additionally share `src/tools/pdf/_shared/` for the page-range
parser and download helper.

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

## 12. Phase map (v6.0 "UnQTemplate" → v7.0 PDF batch-1)

- **Phase 0 — Adopt template as base** ✅ DONE (2026-07-03): Cloned `UnQWebTemplate`, created `v6-template` branch, replaced app codebase with template's (preserved: 22 tool logic modules + 529 unit tests + lib + LICENSE + AGENTS.md + STATE.md + CI). Configured `output: 'export'`. Verified `next build` produces static `out/` (21 pages) + all routes serve 200 from plain static server. Lint 0 errors, 529/529 tests green.
- **Phase 1 — UnQTools IA on template design** ✅ DONE: Home, tools directory, category pages, ⌘K search, navigation — all rebuilt on template design.
- **Phase 2 — Port the 22 tools** ✅ DONE: All 22 tool UIs rebuilt as React client components using only template components. Lazy-loaded via `tool-page-client.tsx`.
- **Phase 3 — PWA + performance sanity** ✅ DONE: manifest + SW verified on static export. Heavy libs lazy/dynamic. Lighthouse medians captured (see `docs/lighthouse/RESULTS.md`).
- **Phase 4 — Gates + proof** ✅ DONE (v6.8): lint 0 · 528 tests green · 30-page build · all routes 200 · 404 works · zero-overflow · axe 0 serious (light + dark) · reduced-motion respected · CLS 0.0001. Owner merged v6.0 → v6.8 to `main`.
- **Phase 5 — v6.9 "All categories visible"** ✅ DONE (commit 320771d): All 13 categories visible in sidebar / tools dir / command palette. Empty categories render a "Coming soon" empty state instead of being hidden. Category list derived from registry, not hardcoded.
- **Phase 6 — v7.0 "PDF batch-1"** 🟡 IN PROGRESS on `v7.0-pdf-batch1`:
  - ✅ `pdf-lib ^1.17.1` added to `package.json` (commit 23953e4)
  - ✅ `package-lock.json` regenerated; `Update-lock-file.yml` workflow updated to auto-trigger on `package.json` pushes (commit 4cfb62c)
  - ✅ 10 PDF tools shipped: merge-pdf, split-pdf, rotate-pdf, delete-pdf-pages, extract-pdf-pages, reorder-pdf-pages, images-to-pdf, pdf-page-numbers, pdf-watermark, pdf-metadata-editor (commits 6bf7ff0 → a29c314)
  - ✅ All 10 PDF tools registered in `src/lib/registry.ts` + lazy UI loaders in `tool-page-client.tsx` (commits b3c53bd, 0ef206a)
  - ✅ tool-page-client.tsx refactored to use named motion constants (commit 2610cf6)
  - 🟡 CI gates not yet re-verified on this branch — that's the next step
  - 🟡 Not yet merged to `main` — owner review pending
- **Phase 7 — v7.0 PDF batch-2 (next)**: next 10 PDF tools per `unqtools-docs` Tool Catalog. Start after batch-1 is merged to `main`.

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
