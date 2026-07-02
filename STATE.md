# UnQTools — Build State

_Last updated: 2026-07-02T11:05:00Z by GLM (z.ai sandbox)_

## Current phase

**v3.1 — modern premium polish** ✅ COMPLETE → awaiting user confirmation before Phase 3

## Context (why this session happened)

v3.0 (density + sidebar + Apple craft) looked good, but the owner wanted it to
be the MOST MODERN, best-in-class site out there — competitive with the top web
apps of 2026 (Linear, Vercel, Raycast, Arc, Stripe). v3.1 layers premium
signals on top of the existing density. RESTRAINT > flash — subtle, fast,
premium, never busy.

## v3.0 + earlier status (UNCHANGED — do not undo)

v3.0 (product-grade density) + v2.2 (motion + richer IA) + v2.1 (Apple tokens)
are all DONE and correct. v3.1 only ADDS premium effects and OVERRIDES a few
transition/gradient values. All tokens, motion primitives, density classes,
and component structure from prior versions are preserved.

## Done (this session — v3.1 modern premium polish)

### Resume ritual

- [x] Fresh `git clone` of both repos (v3.0 commit `eb72297` confirmed as base)
- [x] Read AGENTS.md → STATE.md → DESIGN-SYSTEM.md
- [x] `npm ci` — 239 packages restored
- [x] Baseline gates BEFORE changes: lint 0/0, 343/343 tests pass, 27 pages built

### A) Easing + gradient tokens (`tokens.css`)

- [x] `--unq-ease-out`: upgraded to `cubic-bezier(0.16, 1, 0.3, 1)` (Linear/Vercel ease-out)
- [x] NEW `--unq-spring`: `linear(0, 0.009, 0.035 2.1%, ...)` — real spring curve with overshoot
- [x] NEW `--unq-grad-1: #0071e3` (Apple blue)
- [x] NEW `--unq-grad-2: #42a5ff` (light blue)
- [x] NEW `--unq-grad-3: #bf5af2` (soft purple — gradient endpoint only, not an accent)

### B) Card spotlight + gradient-border glow (`global.css` + BaseLayout script)

- [x] `.unq-card` — `position: relative; isolation: isolate` + 0.35s ease-out transitions
- [x] `.unq-card::after` — 1px gradient border (blue → purple), `mask-composite: exclude`, opacity 0 → 0.9 on hover
- [x] `.unq-card::before` — radial spotlight following pointer (`--mx`/`--my`), 240px circle, 14% accent tint, opacity 0 → 1 on hover
- [x] `.unq-card:hover` — `translateY(-4px)` + `--unq-shadow-lg` + `border-color: transparent` (gradient border takes over)
- [x] `unqInitSpotlight()` inline script in BaseLayout — deduped via `data-spot` attribute, skipped under `prefers-reduced-motion`, re-runs on `astro:page-load`. ~1 KB inline.

### C) Aurora / mesh hero backdrop + faint grain

- [x] `.unq-hero::before` — 3-stop mesh gradient (blue + purple + light-blue), 60px blur, 50% opacity, 18s infinite alternate drift (`unq-aurora` keyframes)
- [x] `.unq-grain::after` — fixed full-viewport overlay, 2.5% opacity, inline SVG fractal noise. Applied to `<body class="unq-grain">`.
- [x] Both fully disabled under `prefers-reduced-motion: reduce`

### D) Bento featured-tools row

- [x] `.unq-bento` — 4-col grid, `grid-auto-rows: minmax(128px, auto)`, 16px gap
- [x] First child spans 2 cols × 2 rows (big tile: 48px icon, 1.375rem title, 3-line desc)
- [x] Collapses to single column on ≤768px
- [x] `index.astro` featured row changed from `.unq-grid` → `.unq-bento`

### E) Per-category accent colors

- [x] 13 categories mapped to hues (developer #0071e3, image #ff375f, calculators #30d158, text #bf5af2, pdf #ff453a, audio-video #ff9f0a, seo #64d2ff, network-security #5e5ce6, file #ac8e68, business #30b0c7, education #ffd60a, social #ff2d55, ai #5e5ce6)
- [x] Icon tile bg = `color-mix(hue 12-14%, surface)`, glyph = darker shade (light) / brighter shade (dark) for AA
- [x] `ToolCard.astro` icon tile gets `.unq-card__icon--{category}` class
- [x] All 13 light + 13 dark glyph colors verified for WCAG AA contrast

### F) Sidebar active pill + 3px left bar + hover slide

- [x] `.unq-sidebar a` — 0.15s ease-out transition on background/color/transform
- [x] `.unq-sidebar a:hover` — `transform: translateX(2px)` (subtle slide)
- [x] `.unq-sidebar a[aria-current="page"]::before` — 3px white left bar, 60% height, centered, opacity 0.9
- [x] `.unq-sidebar__title` — 11px group label, 0.08em tracking, uppercase, text-3
- [x] `.unq-sidebar__icon` — 14px font size

### G) Refined fluid type

- [x] `.unq-hero-title` / `.unq-h1` / `.unq-h2` — `letter-spacing: -0.02em`
- [x] `.unq-h3` — `letter-spacing: -0.015em`
- [x] `.unq-card__desc` — `line-height: 1.35` (reinforced)

### Component changes

- `BaseLayout.astro` — `<body class="unq-grain">` + `unqInitSpotlight()` added to inline script
- `ToolCard.astro` — icon tile gets per-category color class
- `index.astro` — featured row uses `.unq-bento`

### Verification — ALL GREEN (56 checks)

- [x] `npm ci` / `npm run lint` (0/0) / `npm run test` (343/343) / `npm run build` (27 pages)
- [x] `npm run preview` — every route 200, unknown route 404 (no SPA fallback)
- [x] `npx playwright test` — 13/13 e2e pass (incl. axe-core on json-formatter)
- [x] **axe-core: zero critical/serious across ALL 27 pages**
- [x] **No horizontal scroll at 320px / 1440px / 4K**
- [x] **Bento:** 4 cols at 1440px, first child spans 2 cols ✅
- [x] **Card gradient border:** present (::after has gradient background) ✅
- [x] **Card spotlight:** present (::before has radial-gradient), pointer tracking works (--mx=51px --my=51px after hover at 50,50) ✅
- [x] **Grain:** opacity 0.025 (≤3% requirement met) ✅
- [x] **Sidebar active:** 3px left bar present ✅
- [x] **Reduced-motion:** spotlight skipped, all reveals visible, grain off ✅
- [x] **CLS = 0.0001** (well under 0.02 budget)
- [x] **Count-up:** all 4 stats reach final value
- [x] Light + dark theme parity

### VLM-confirmed (4 screenshots analyzed)

- **Home desktop light:** "premium and modern, competing well with top-tier tools sites. Subtle, not busy. All premium features visible (spotlight, aurora, bento, per-category color). Contrast is strong."
- **Home desktop dark:** "premium parity. Subtle gradients and aurora visible against dark. Contrast well-balanced."
- **Tool desktop:** "premium, clean structured design. Per-category icon colors visible and distinct. Spotlight/gradient border subtle."
- **Home mobile:** "bento collapses cleanly, no overflow. Aurora visible as subtle gradient. Content readable, fills width."

### Screenshots (captured via headless Chromium, VLM-confirmed)

Located in `/home/z/my-project/download/screenshots/`:

| File                         | Size    | Notes                                                                       |
| ---------------------------- | ------- | --------------------------------------------------------------------------- |
| `home-desktop-light.png`     | ~165 KB | Homepage 1440×900 light — VLM: "premium and modern, subtle not busy"        |
| `home-desktop-dark.png`      | ~172 KB | Homepage 1440×900 dark — VLM: "premium parity, aurora visible against dark" |
| `home-mobile-light.png`      | ~71 KB  | Homepage 390×844 light — VLM: "bento collapses cleanly, no overflow"        |
| `tool-desktop-light.png`     | ~77 KB  | JSON Formatter 1440×900 light — VLM: "premium, per-category colors visible" |
| `tool-mobile-light.png`      | ~46 KB  | JSON Formatter 390×844 light — single column, readable                      |
| `category-desktop-light.png` | ~131 KB | Developer category 1440×900 light — sidebar active + dense grid             |

### Bundle sizes (gzipped, all under 50 KB budget)

| Asset                                | Raw      | Gzipped      | Notes                                                          |
| ------------------------------------ | -------- | ------------ | -------------------------------------------------------------- |
| Largest UI island (`ui.DhRGk3PF.js`) | 15,452 B | **6,441 B**  | unchanged from v3.0                                            |
| Registry (`registry.Crf9XXRu.js`)    | 17,149 B | **6,213 B**  | unchanged from v3.0                                            |
| Compiled CSS (per route)             | 61,011 B | **11,959 B** | +1.0 KB vs v3.0 (new premium classes)                          |
| Homepage HTML                        | 78,194 B | **10,868 B** | +0.3 KB vs v3.0 (bento markup + ~1 KB spotlight script inline) |

v3.1 is **bundle-size neutral on JS islands** — all premium effects are CSS
pseudo-elements + a ~1 KB inline spotlight script. The +1 KB CSS is the
gradient border, spotlight, aurora, grain, bento, and per-category color
classes.

### Docs

- [x] **`DESIGN-SYSTEM.md`** updated with v3.1 addendum (section 17) covering tokens, card spotlight, aurora, grain, bento, per-category colors, sidebar polish, refined type, verification, screenshots, bundle sizes

## In progress

- _Nothing._ v3.1 complete; awaiting user confirmation.

## Next up (BLOCKED — awaiting user confirmation of v3.1)

**Do NOT start Phase 3 feature work until the user confirms the new design.**

Once confirmed, Phase 3 options (in priority order):

1. **Per-tool Playwright e2e sweep** — add `tests/<tool>.e2e.ts` for each of the 11 tools without one
2. **WASM codecs for Image Compressor** — ship MozJPEG/OxiPNG/AVIF encoders
3. **Lighthouse audit** — verify ≥ 95 on Performance/A11y/Best Practices/SEO for every tool page
4. **ToolActions bar** — add per-tool Copy/Download/Share/Print/Reset bar inside ToolLayout
5. **PWA install prompt UI** — surface the `useInstallPrompt` hook as a polished banner/modal
6. **Sidebar enhancements** — favorites/recents section in sidebar, search filter, collapse/expand

## Key decisions / notes

- **Locked stack** per `AGENTS.md` §2 — NOT changed. Still Astro (static) + Preact islands + Tailwind + Workbox PWA. No React/Vite/Next/TanStack/Radix/framer-motion/shadcn.
- **Effects = pure CSS + IntersectionObserver + WAAPI + a tiny vanilla pointer handler.** The spotlight is a `pointermove` listener that sets `--mx`/`--my` CSS custom properties — no library, ~1 KB inline. Deduped via `data-spot` attribute so re-running on `astro:page-load` doesn't double-bind.
- **RESTRAINT > flash.** Every premium effect is subtle: gradient border at 0.9 opacity (not 1), spotlight at 14% accent tint (not full color), aurora at 50% opacity with 60px blur (barely visible texture), grain at 2.5% opacity (imperceptible but adds depth). The goal is "you notice it's premium without being able to point at anything flashy."
- **`mask-composite: exclude`** for the gradient border — the standard cross-browser pattern: two `linear-gradient(#000 0 0)` masks (one for content-box, one for padding-box) composited with `xor`/`exclude` to only show the 1px border ring. Works in all modern browsers.
- **`color-mix(in srgb, ...)`** for per-category icon tile backgrounds — mixes the category hue at 12-14% with the surface color. Native CSS, no preprocessing. Falls back gracefully.
- **`linear()` easing** for `--unq-spring` — the new CSS `linear()` function allows real spring curves with overshoot. Browsers that don't support it ignore it and use the previous transition (graceful degradation). Not currently used in any component — available for future entrances.
- **Per-category AA verification.** Each of the 13 light glyph colors + 13 dark glyph colors was chosen to pass WCAG AA (≥4.5:1) on its respective tinted tile background. The darker shades (e.g., #004999 on 12% blue tint) ensure readability.
- **Grain is `pointer-events: none` + `z-index: 9999`** — it overlays everything but never blocks clicks. Fixed position so it doesn't scroll. Disabled (opacity 0) under `prefers-reduced-motion`.
- **Bento collapses to single column on ≤768px** — the first child (big tile) becomes normal size (36px icon, 1.0625rem title) so it doesn't dominate mobile.
- **Spotlight pointer handler is deduped.** The `data-spot` attribute ensures `unqInitSpotlight()` doesn't re-bind to cards already bound (which would happen on `astro:page-load` after View Transitions).
- **No SPA fallback** — confirmed. Unknown route returns HTTP 404.
- **Playwright chromium binary** — sandbox has chromium-1200 pre-installed but @playwright/test 1.49.1 expects chromium-1148. Worked around by symlinking. Sandbox-only fix; playwright.config.ts was NOT modified.

## Blockers

- _None._ Build is deploy-ready with v3.1. Waiting on user confirmation before Phase 3.

---

## v3.0 + v2.2 + v2.1 (prior sessions — preserved as base)

<details>
<summary>Click to expand prior version details</summary>

### v3.0 (product-grade density) — commit `eb72297`

- Token changes: content 980→1280px, new --unq-content-prose 720px, gutter 24px
- App shell: .unq-shell (236px sidebar + 1fr main), .unq-sidebar (sticky), .unq-cat-chips (mobile)
- Compact hero, denser grid (4 cols at 1440px), compact cards (18px padding, 14px radius, icon tile)
- Slim inline stats, tighter section padding (64px max)
- New components: Sidebar.astro, CategoryChips.astro
- Homepage + category + tool pages rebuilt with shell

### v2.2 (motion + richer IA) — commit `e1da6df`

- Motion primitives: .unq-reveal (staggered scroll reveal), .unq-hero-anim (first-paint entrance), .unq-gradient (headline keyword), .unq-hero::before (animated radial backdrop)
- BaseLayout inline script: reveal IntersectionObserver + count-up, re-runs on `astro:page-load`
- Rich-content classes: .unq-stat, .unq-feature, .unq-cat-head, .unq-cta-band, .unq-trust, .unq-foot-grid, .unq-card--featured

### v2.1 (Apple.com-grade UI + IA reorg) — commit `cdaae03`

- Token system (`src/styles/tokens.css`): Apple exact hex values, backward-compat aliases
- `global.css` rewrite: Apple base typography, new Apple component classes
- WCAG AA: --unq-text-3 bumped to #6e6e73, new --unq-success-strong / warning-strong / danger-strong tokens

</details>
