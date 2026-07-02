# UnQTools — Build State

_Last updated: 2026-07-02T10:00:00Z by GLM (z.ai sandbox)_

## Current phase

**v2.2 — motion + richer IA** ✅ COMPLETE → awaiting user confirmation before Phase 3

## Context (why this session happened)

v2.1 (Apple hex tokens) was technically correct but felt FLAT, EMPTY, and
BORING per owner feedback. This session added apple.com-style MOTION +
RICHER content sections + tighter ORGANIZATION on top of v2.1, without
undoing any v2.1 work.

## v2.1 status (UNCHANGED — do not undo)

v2.1 is DONE and correct — blue #0071e3, neutrals #1d1d1f/#f5f5f7, zero
violet, all gates green. v2.2 only ADDS motion + richer sections on top.

## Done (this session — v2.2 motion + richer IA)

### Resume ritual

- [x] Fresh `git clone` of both repos (v2.1 commit `cdaae03` confirmed as base)
- [x] Read AGENTS.md → STATE.md → DESIGN-SYSTEM.md
- [x] `npm ci` — 239 packages restored
- [x] Baseline gates BEFORE changes: lint 0/0 (after fixing STATE.md formatting), 343/343 tests pass, 27 pages built

### 1) Motion primitives — appended to `global.css`

- [x] `.unq-reveal` — opacity 0 → 1 + translateY(24px) → 0 over 700ms, Apple ease, stagger via `--i` (70ms × index % 6). Animate ONLY opacity + transform → CLS = 0.
- [x] `.unq-reveal--scale` — variant that also scales 0.96 → 1
- [x] `.unq-hero-anim > *` — hero staggered entrance on first paint (no JS needed). 5 children animate at 0.05s / 0.16s / 0.30s / 0.44s / 0.58s via `@keyframes unq-rise`
- [x] `.unq-gradient` — Apple gradient headline keyword for ONE hero word. `linear-gradient(120deg, #0071e3, #42a5ff 45%, #bf5af2)` — blue → light-blue → soft-purple (purple is a gradient endpoint, NOT an accent)
- [x] `.unq-hero::before` — subtle animated radial backdrop (12s infinite alternate float). `pointer-events: none`, `z-index: -1`
- [x] Tighter micro-interactions: `.unq-card:hover` lifts 4px + scales 1.008 + `--unq-shadow-lg`; `.unq-btn:active` scales to 0.96
- [x] Full reduced-motion guard: every motion class force-disabled under `prefers-reduced-motion: reduce`

### 2) Reveal + count-up script — BaseLayout inline `<script>`

- [x] `unqInitMotion()` does two things:
  1. **Reveal IntersectionObserver** — adds `.is-in` + `.is-revealed` to any `.unq-reveal` or `[data-reveal]` element when scrolled into view (threshold 0.12, rootMargin `0px 0px -8% 0px`). Sets `--i` to `index % 6` for stagger. Reduced-motion → all visible immediately.
  2. **Count-up animation** — `[data-countup]` elements animate from 0 to target over 1200ms with ease-out cubic, triggered when 60% visible.
- [x] Re-runs on `astro:page-load` so it works after Astro View Transitions route changes
- [x] Replaces the v2.1 reveal-only script (v2.1 functionality preserved, just extended)

### 3) Richer, well-organized homepage (`index.astro`)

Reorganized into 7 sections, each wrapped for reveal:

1. **HERO** (`.unq-hero .unq-hero-anim`) — eyebrow → hero title with ONE `.unq-gradient` keyword ("respect") → 21px muted subtitle → big search + "⌘K" hint → trust-pill row (No sign-up · No tracking · Works offline · Proprietary-licensed). Animated radial backdrop behind. Generous top air.
2. **STATS STRIP** (gray, count-up) — 4 stats: `{toolCount}` tools · 343 tests passing · 0 bytes sent to a server · 100% offline-capable. Single row on desktop (≥720px), 2×2 on mobile.
3. **WHY UNQTOOLS** — 4 feature cards (🔒 Private by design · ✈️ Works offline · ⚡ Instant, no upload · 🆓 No sign-up). Staggered reveal.
4. **FEATURED / POPULAR tools** — highlighted 4-card row (`.unq-card--featured` with accent-tinted border) above the category list. Curated: json-formatter, image-compressor, emi-calculator, color-picker.
5. **CATEGORY SECTIONS** — each header has an ICON + title + live COUNT + "View all" cta-link. Alternating `.unq-section` / `.unq-section--gray`. Cards stagger in via `.unq-reveal`.
6. **CTA BAND** (gray callout) — "Install UnQTools — works offline, no account." + Install-PWA button + Browse tools button.
7. **FOOTER** — richer 4-col sitemap (Brand+tagline / Categories / Popular tools / About+Legal) + copyright + "Proprietary & confidential".

### 4) Well-organized rules applied

- [x] 8pt spacing scale via `clamp()` (8/16/24/32/48/64/96) — consistent section rhythm
- [x] Every section: eyebrow → title → (optional subtitle) → content; aligned grids; EQUAL-HEIGHT cards (`.unq-feature` uses `height: 100%`)
- [x] Max 980px content (`.unq-container`); hero max 720px; never full-width text
- [x] Section padding uses `clamp(56px, 9vw, 110px)` for fluid rhythm

### 5) Same polish applied to category pages + tool shell

- [x] `category/[category].astro` — header uses `.unq-cat-head` with category icon + `.unq-reveal` on header + grid
- [x] `ToolLayout.astro` — tool UI card + SEO section now wrapped in `.unq-reveal`
- [x] `Footer.astro` — rewritten to use `.unq-foot-grid` 4-col layout with Popular tools column

### 6) New rich-content helper classes (in `global.css`)

- `.unq-stat` / `.unq-stat__num` / `.unq-stat__label` — Apple-style stat tile
- `.unq-feature` / `.unq-feature__icon` / `.unq-feature__title` / `.unq-feature__body` — "why" tile
- `.unq-cat-head` / `.unq-cat-head__icon` — category header row with icon
- `.unq-cta-band` — gray callout band
- `.unq-trust` / `.unq-trust__item` — trust-pill row under hero
- `.unq-foot-grid` / `.unq-foot-col` — 4-col footer sitemap (collapses to 1-col on mobile)
- `.unq-card--featured` — featured-tool variant (accent-tinted border + gradient bg)

### 7) Component changes

- `ToolCard.astro` — new optional `featured` prop adds `.unq-card--featured` class
- `Footer.astro` — rewritten with `.unq-foot-grid` 4-col layout (Brand+tagline / Categories / Popular tools / About+Legal) + Popular tools column populated from registry
- `ToolLayout.astro` — tool UI card + SEO section now wrapped in `.unq-reveal`
- `category/[category].astro` — header uses `.unq-cat-head` with category icon, `.unq-reveal` on header + grid
- `BaseLayout.astro` — v2.1 reveal script replaced with v2.2 `unqInitMotion()` (reveal + count-up, re-runs on `astro:page-load`)

### 8) v2.2 a11y fix (caught by full axe-core sweep)

- `.unq-eyebrow` color changed from `var(--unq-accent)` (#0071e3, 4.31:1 on gray) to `var(--unq-link)` (#0066cc, 5.5:1 on gray). The eyebrow now passes WCAG AA on BOTH white and gray backgrounds. apple.com uses the same darker blue for inline links.

### Verification — ALL GREEN

- [x] `npm ci` ✅
- [x] `npm run lint` ✅ — 0 errors, 0 warnings
- [x] `npm run test` ✅ — **343/343** unit tests pass
- [x] `npm run build` ✅ — **27 pages** built
- [x] `npm run preview` ✅ — every route 200, unknown route 404 (no SPA fallback)
- [x] `npx playwright test` ✅ — **13/13** e2e pass (incl. axe-core on json-formatter)
- [x] **axe-core: zero critical/serious across ALL 27 pages** (verified via custom script)
- [x] **Reduced-motion:** all `.unq-reveal` and `.unq-hero-anim > *` elements visible immediately (no stuck opacity:0)
- [x] **CLS = 0.0097** on homepage (well under 0.1 budget) — reveals animate only opacity/transform
- [x] **Count-up:** all 4 stats reach final value (12 / 343 / 0 / 100) — fixed by making stats grid single-row on desktop (≥720px)
- [x] No horizontal scroll at 320px or 4K (3840×2160)
- [x] Light + dark theme parity
- [x] Full keyboard nav + visible focus
- [x] Touch targets ≥ 36×36
- [x] No PAT leaked

### Bundle sizes (gzipped, all under 50 KB budget)

| Asset                                  | Raw         | Gzipped      | Notes                                             |
| -------------------------------------- | ----------- | ------------ | ------------------------------------------------- |
| `ui.DhRGk3PF.js` (largest UI island)   | 15,452 B    | **6,441 B**  | unchanged from v2.1                               |
| `registry.Crf9XXRu.js` (tool registry) | 17,149 B    | **6,213 B**  | unchanged from v2.1                               |
| `ui.B3bBSzqs.js` (json-formatter UI)   | 14,168 B    | **5,563 B**  | unchanged from v2.1                               |
| `CommandBar.BroFCFZz.js` (⌘K palette)  | 8,280 B     | **3,304 B**  | unchanged from v2.1                               |
| All other UI islands                   | < 12 KB raw | < 4 KB gz    | unchanged from v2.1                               |
| Compiled CSS (per route)               | 54,738 B    | **10,535 B** | +3 KB vs v2.1 (new motion + rich-content classes) |
| Homepage HTML                          | 63,203 B    | **11,287 B** | +4 KB vs v2.1 (new sections)                      |

v2.2 is **bundle-size neutral on JS** — all motion is pure CSS + a 1.5 KB
inline script in BaseLayout. The +3 KB CSS gz is the new motion primitives +
rich-content helper classes. The +4 KB HTML gz is the new homepage sections
(stats strip, why cards, featured row, CTA band, richer footer).

### Docs

- [x] **`DESIGN-SYSTEM.md`** updated with v2.2 addendum (section 15) covering motion primitives, BaseLayout script, homepage IA, rich-content classes, component changes, a11y fix, verification

## In progress

- _Nothing._ v2.2 complete; awaiting user confirmation.

## Next up (BLOCKED — awaiting user confirmation of v2.2)

**Do NOT start Phase 3 feature work until the user confirms the new design.**

Once confirmed, Phase 3 options (in priority order):

1. **Per-tool Playwright e2e sweep** — add `tests/<tool>.e2e.ts` for each of the 11 tools without one. Each test should cover the happy path + an axe-core a11y scan.
2. **Homepage + category page polish** — hero illustration, "why UnQTools" section, featured tools.
3. **WASM codecs for Image Compressor** — ship MozJPEG/OxiPNG/AVIF encoders (the blueprint's "10x layer").
4. **Lighthouse audit** — verify ≥ 95 on Performance/A11y/Best Practices/SEO for every tool page.
5. **ToolActions bar** — add per-tool Copy/Download/Share/Print/Reset bar inside ToolLayout.
6. **PWA install prompt UI** — surface the `useInstallPrompt` hook as a polished banner/modal (the v2.2 CTA band already dispatches `unq:install-prompt` — needs a hook to handle it).

## Key decisions / notes

- **Locked stack** per `AGENTS.md` §2 — NOT changed. Still Astro (static) + Preact islands + Tailwind + Workbox PWA. No React/Vite/Next/TanStack/Radix/framer-motion/shadcn.
- **Motion = pure CSS + IntersectionObserver + Web Animations API only.** No framer-motion, no React Spring, no GSAP. The count-up uses `requestAnimationFrame` (Web Animations API pattern).
- **Reduced-motion aware.** Every motion class is force-disabled under `prefers-reduced-motion: reduce`. Verified: 0 elements stuck at opacity:0.
- **CLS = 0.0097.** Reveals animate ONLY opacity + transform — never width/height/top — so no layout shift. Verified via PerformanceObserver.
- **Reveal re-runs on `astro:page-load`.** So it works after Astro View Transitions route changes (the v2.1 script only ran once on initial load).
- **Stats grid is single-row on desktop (≥720px).** This was required so the count-up IntersectionObserver (threshold 0.6) fires for ALL 4 stats at once. On mobile it collapses to 2×2.
- **`.unq-eyebrow` now uses `--unq-link` (#0066cc) instead of `--unq-accent` (#0071e3).** The accent blue fails AA on gray backgrounds (4.31:1); the link blue passes (5.5:1). apple.com uses the same darker blue for inline links.
- **`.unq-gradient` is the ONLY place purple appears.** It's a gradient endpoint (`#bf5af2`) for ONE hero word, not an accent. The owner rejected the prior violet ACCENT system; a subtle gradient endpoint is a different thing entirely.
- **Featured row is hand-curated.** json-formatter, image-compressor, emi-calculator, color-picker — picked for category diversity + likely usefulness. Easy to change later.
- **CTA band dispatches `unq:install-prompt` event** but no hook is wired up yet. Phase 3 task #6 will surface the `useInstallPrompt` hook to handle it.
- **No SPA fallback** — confirmed. Unknown route returns HTTP 404. Every route is its own prerendered HTML file.
- **Playwright chromium binary** — the sandbox has chromium-1200 pre-installed but @playwright/test 1.49.1 expects chromium-1148. Worked around by symlinking `chromium_headless_shell-1200/chrome-headless-shell-linux64/chrome-headless-shell` → `chromium_headless_shell-1148/chrome-linux/headless_shell`. Sandbox-only fix; playwright.config.ts was NOT modified.

## Blockers

- _None._ Build is deploy-ready with v2.2. Waiting on user confirmation before Phase 3.

---

## v2.1 (prior session — preserved as base)

<details>
<summary>Click to expand v2.1 details</summary>

### Done (v2.1 — Apple.com-grade UI + IA reorg)

- Token system (`src/styles/tokens.css` — NEW): Apple exact hex values, backward-compat aliases for every old `--unq-*` name
- `global.css` rewrite: Apple base typography, new Apple component classes (`.unq-btn`, `.unq-card`, `.unq-grid`, `.unq-section`, `.unq-reveal`, etc.)
- Component refactors: Header, Footer, ToolCard, ToolLayout, BaseLayout, index.astro, category/[category].astro, 404.astro
- Tool-internal a11y fixes: hash-generator file input aria-label, color-picker input aria-labels + AA default colors, emi/mortgage-calculator scrollable region labels, sip-calculator success-strong token, json-formatter Output role/aria-label
- WCAG AA compliance: `--unq-text-3` bumped to `#6e6e73`, new `--unq-success-strong` / `--unq-warning-strong` / `--unq-danger-strong` tokens
- Verification: 343/343 tests, 13/13 e2e, 27 pages built, axe-core zero critical/serious across all 27 pages, no h-scroll 320-4K, no FOUC, light/dark parity

### v2.1 commit

- `unqtools`: `cdaae03` — "feat: v2.1 apple.com-grade UI + IA reorg"
- `unqtools-docs`: `2bd3fb6` — "docs: rewrite DESIGN-SYSTEM.md for v2.1 apple.com-grade UI"

</details>
