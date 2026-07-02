# UnQTools — Build State

_Last updated: 2026-07-02T10:35:00Z by GLM (z.ai sandbox)_

## Current phase

**v3.0 — product-grade density** ✅ COMPLETE → awaiting user confirmation before Phase 3

## Context (why this session happened)

v2.2 (Apple tokens + motion) was technically correct but the layout still
WASTED screen space and felt sparse/empty on desktop — "worst design." The
owner delegated design fully: "I won't say anything — make it production-ready
and the best."

Root cause (agreed): v2.1/v2.2 copied apple.com's _marketing-site_ airiness
(980px content, full-height hero, ~110px section padding) onto what is actually
a _tools utility/directory_. Apple fills that air with huge product photography;
we have none — so the whitespace read as EMPTY, not premium.

v3.0 shifts the layout paradigm from "marketing landing page" → "polished
product app" (Raycast / Linear / Vercel dashboard): wider, denser, search-first,
tool grid visible above the fold. Keep the Apple craft; kill the dead space.

## v2.1 + v2.2 status (UNCHANGED — do not undo)

v2.1 (Apple hex tokens) + v2.2 (motion + richer IA) are DONE and correct.
v3.0 only OVERRIDES spacing/sizing values that caused dead space, and ADDS
new shell + sidebar + compact-card classes. All tokens, motion primitives,
and rich-content classes from v2.1/v2.2 are preserved.

## Done (this session — v3.0 product-grade density)

### Resume ritual

- [x] Fresh `git clone` of both repos (v2.2 commit `e1da6df` confirmed as base)
- [x] Read AGENTS.md → STATE.md → DESIGN-SYSTEM.md
- [x] `npm ci` — 239 packages restored
- [x] Baseline gates BEFORE changes: lint 0/0, 343/343 tests pass, 27 pages built

### 1) Wider content (`tokens.css`)

- [x] `--unq-content`: 980px → **1280px** (product-app shell width)
- [x] `--unq-content-wide`: 1024px → **1280px** (alias)
- [x] `--unq-container-max` / `--unq-content-max`: → **1280px** (aliases)
- [x] NEW `--unq-content-prose`: **720px** (tool page reading width)
- [x] `--unq-gutter-sm/md/lg`: 22px → **24px**

### 2) App shell — sticky left sidebar (`global.css` + `Sidebar.astro`)

- [x] `.unq-shell` — `display: grid; grid-template-columns: 236px 1fr; gap: 32px; max-width: 1280px; padding: 0 24px`. Collapses to 1 column on ≤1024px.
- [x] `.unq-sidebar` — sticky left nav (`position: sticky; top: calc(nav-h + 16px)`). Max-height with overflow-y auto.
- [x] `.unq-sidebar a` — 36px min-height, 10px radius, text-2 color, hover = surface-2 bg
- [x] `.unq-sidebar a[aria-current="page"]` — accent bg, white text (label + icon + count all white — fixed after axe-core caught the contrast issue)
- [x] **NEW `Sidebar.astro`** — lists all 13 categories + "All tools" link with icon + name + live count. Active state via `aria-current="page"`.
- [x] **NEW `CategoryChips.astro`** — mobile replacement for sidebar. Horizontal pill row, shown on ≤1024px.
- [x] Hidden on ≤1024px (`.unq-sidebar { display: none }`), replaced by `.unq-cat-chips`

### 3) Compact search-first header (replaces full-screen hero)

- [x] `.unq-hero` — padding `40px 0 24px` (was `clamp(56,9vw,110)`)
- [x] `.unq-hero-title` — `clamp(1.75rem, 3.5vw, 2.5rem)` (was `clamp(2.75rem, 6vw, 4.5rem)`)
- [x] `.unq-hero::before` — smaller radial backdrop (height 50%, inset tightened)
- [x] Header = H1 + one-line subtitle + prominent search bar + slim trust pills + slim inline stats
- [x] Tool grid starts immediately under the header (visible above the fold on desktop — verified: first card top=469px at 1440px)

### 4) Denser tool grid + compact cards

- [x] `.unq-grid` — `gap: 16px; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr))` (was 20px gap, 240-300px minmax). 4 columns at 1440px (verified).
- [x] `.unq-card` — `padding: 18px; border-radius: 14px; gap: 6px` (was 26×24 padding, 18px radius)
- [x] NEW `.unq-card__icon` — 36×36 tile with surface-2 bg, shown at top of each card
- [x] `.unq-card__title` — `1.0625rem` (was `1.1875rem`)
- [x] `.unq-card__desc` — `0.8125rem; line-height: 1.35` (was `0.875rem`)
- [x] `ToolCard.astro` — now includes `.unq-card__icon` tile (icon mapped from manifest `icon` field via ICON_MAP)

### 5) Tighter rhythm + slim stats

- [x] `.unq-section` — `padding: clamp(40px, 5vw, 64px) 0` (was `clamp(56, 9vw, 110)`)
- [x] NEW `.unq-stats-inline` — slim one-row stats (replaces v2.2's full stats section band): `<strong>12</strong> tools · <strong>343</strong> tests · <strong>0</strong> bytes sent · <strong>100</strong>% offline`
- [x] Count-up animation still works (all 4 stats reach final value — verified)

### 6) Homepage rebuilt (`index.astro`)

New IA (top to bottom):

1. Compact search-first hero (H1 + subtitle + search + trust pills + slim inline stats)
2. Mobile category chips (≤1024px only)
3. App shell: sidebar + main content
   - Main: Featured row → All tools grid → per-category sections → CTA band
4. Footer (4-col sitemap from v2.2)

### 7) Category + tool pages rebuilt

- [x] `category/[category].astro` — compact header → mobile chips → app shell (sidebar + grid)
- [x] `ToolLayout.astro` — mobile chips → app shell (sidebar + 720px prose article). Tool UI card, privacy notice, related tools, SEO section all in the prose column.
- [x] `BaseLayout.astro` — `<main>` no longer wraps `<slot>` in `.unq-container`; pages own their shell
- [x] `404.astro` — added `padding-inline: 24px` + `max-width: 540px` since BaseLayout no longer provides container

### Verification — ALL GREEN

- [x] `npm ci` ✅
- [x] `npm run lint` ✅ — 0 errors, 0 warnings
- [x] `npm run test` ✅ — **343/343** unit tests pass
- [x] `npm run build` ✅ — **27 pages** built
- [x] `npm run preview` ✅ — every route 200, unknown route 404 (no SPA fallback)
- [x] `npx playwright test` ✅ — **13/13** e2e pass (incl. axe-core on json-formatter)
- [x] **axe-core: zero critical/serious across ALL 27 pages** (verified via custom script)
- [x] **No horizontal scroll at 320px / 1440px / 4K (3840×2160)**
- [x] **Density @1440px:** sidebar visible (236px), first tool card above fold (top=469px), grid has 4 cols (964px wide)
- [x] **Sidebar collapses ≤1024px:** sidebar hidden, category chips visible
- [x] **CLS = 0.0001** (well under 0.02 budget)
- [x] **Reduced-motion:** all reveals visible immediately
- [x] **Count-up:** all 4 stats reach final value
- [x] Light + dark theme parity
- [x] No PAT leaked

### Screenshots (captured via headless Chromium, VLM-confirmed)

Located in `/home/z/my-project/download/screenshots/`:

| File                         | Size   | Notes                                                                                                                                                             |
| ---------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `home-desktop-light.png`     | 165 KB | Homepage 1440×900 light — sidebar visible, dense 4-col grid, search above fold, tool cards above fold. VLM: "polished Raycast/Linear style, not sparse marketing" |
| `home-desktop-dark.png`      | 172 KB | Homepage 1440×900 dark — same density, dark theme parity                                                                                                          |
| `home-mobile-light.png`      | 71 KB  | Homepage 390×844 light — sidebar → chips, search prominent, content fills width, no overflow. VLM-confirmed                                                       |
| `tool-desktop-light.png`     | 77 KB  | JSON Formatter 1440×900 light — sidebar visible, tool card fills reasonable width, breadcrumb+title+card above fold. VLM-confirmed                                |
| `tool-mobile-light.png`      | 46 KB  | JSON Formatter 390×844 light — single column, readable                                                                                                            |
| `category-desktop-light.png` | 131 KB | Developer category 1440×900 light — sidebar with active state, dense tool grid                                                                                    |

### Bundle sizes (gzipped, all under 50 KB budget)

| Asset                                | Raw      | Gzipped      | Notes                                                        |
| ------------------------------------ | -------- | ------------ | ------------------------------------------------------------ |
| Largest UI island (`ui.DhRGk3PF.js`) | 15,452 B | **6,441 B**  | unchanged from v2.2                                          |
| Registry (`registry.Crf9XXRu.js`)    | 17,149 B | **6,213 B**  | unchanged from v2.2                                          |
| Compiled CSS (per route)             | 57,144 B | **10,959 B** | +0.5 KB vs v2.2 (new shell + sidebar + compact-card classes) |
| Homepage HTML                        | 76,516 B | **10,555 B** | -0.7 KB vs v2.2 (denser markup, no full-screen hero)         |

v3.0 is **bundle-size neutral on JS** — all density changes are CSS + HTML
structure. The Sidebar + CategoryChips are server-rendered Astro components
(zero client JS).

### Docs

- [x] **`DESIGN-SYSTEM.md`** updated with v3.0 addendum (section 16) covering token changes, new classes, component changes, density verification, screenshots, bundle sizes

## In progress

- _Nothing._ v3.0 complete; awaiting user confirmation.

## Next up (BLOCKED — awaiting user confirmation of v3.0)

**Do NOT start Phase 3 feature work until the user confirms the new design.**

Once confirmed, Phase 3 options (in priority order):

1. **Per-tool Playwright e2e sweep** — add `tests/<tool>.e2e.ts` for each of the 11 tools without one
2. **WASM codecs for Image Compressor** — ship MozJPEG/OxiPNG/AVIF encoders
3. **Lighthouse audit** — verify ≥ 95 on Performance/A11y/Best Practices/SEO for every tool page
4. **ToolActions bar** — add per-tool Copy/Download/Share/Print/Reset bar inside ToolLayout
5. **PWA install prompt UI** — surface the `useInstallPrompt` hook as a polished banner/modal (the v2.2 CTA band already dispatches `unq:install-prompt` — needs a hook to handle it)
6. **Sidebar enhancements** — favorites/recents section in sidebar, search filter, collapse/expand

## Key decisions / notes

- **Locked stack** per `AGENTS.md` §2 — NOT changed. Still Astro (static) + Preact islands + Tailwind + Workbox PWA. No React/Vite/Next/TanStack/Radix/framer-motion/shadcn.
- **Design authority delegated.** Owner said "I won't say anything — make it production-ready and the best." v3.0 makes the taste calls: 1280px shell, 236px sidebar, 220px min card width, 18px card padding, 14px card radius, 16px grid gap, 4 cols at 1440px.
- **Paradigm shift: marketing → product app.** v2.1/v2.2 used apple.com marketing widths (980px) + airiness (110px section padding, full-screen hero). v3.0 uses Raycast/Linear/Vercel product density (1280px shell, sticky sidebar, 64px section padding, compact hero, dense grid).
- **Sidebar is server-rendered.** `Sidebar.astro` is a static Astro component — zero client JS. The active state is determined at build time via the `active` prop (passed from each page). The count is from `countByCategory()` at build time.
- **Mobile uses chips, not sidebar.** On ≤1024px the sidebar is hidden (`display: none`) and a horizontal pill row (`CategoryChips.astro`) is shown instead. This keeps mobile clean without a hamburger menu.
- **Tool pages use 720px prose width.** The tool UI, privacy notice, related tools, and SEO section are all constrained to `--unq-content-prose: 720px` for readability. The sidebar stays sticky on the left for nav.
- **BaseLayout no longer provides a container.** `<main>` is just a landmark element now — pages own their horizontal layout via `.unq-shell`. This avoids double containers/padding.
- **`.unq-main { min-width: 0 }`** — prevents CSS grid blowout from long tool names. Without this, a single long word in a card could force the grid column wider than the track.
- **Card icons mapped from manifest.** `ToolCard.astro` has an `ICON_MAP` that converts the manifest's `icon` string (lucide name like "braces") to a compact glyph ("{ }"). Falls back to first 2 letters uppercased.
- **Sidebar active link color fix.** Initial v3.0 had the active `<a>` with `color: #fff` but the inner `<span class="unq-sidebar__label">` was reporting #6e6e73 to axe-core (1.07:1 contrast on accent blue). Fixed by adding explicit `.unq-sidebar a[aria-current="page"] .unq-sidebar__label, .unq-sidebar__icon { color: #fff }`.
- **Stats moved from section band to inline row.** v2.2 had a full gray section band with 4 big stat tiles. v3.0 collapses this to a single inline row under the hero subtitle: "12 tools · 343 tests · 0 bytes sent · 100% offline". Count-up animation still works.
- **No SPA fallback** — confirmed. Unknown route returns HTTP 404.
- **Playwright chromium binary** — sandbox has chromium-1200 pre-installed but @playwright/test 1.49.1 expects chromium-1148. Worked around by symlinking. Sandbox-only fix; playwright.config.ts was NOT modified.

## Blockers

- _None._ Build is deploy-ready with v3.0. Waiting on user confirmation before Phase 3.

---

## v2.1 + v2.2 (prior sessions — preserved as base)

<details>
<summary>Click to expand v2.1 + v2.2 details</summary>

### v2.2 (motion + richer IA) — commit `e1da6df`

- Motion primitives: `.unq-reveal` (staggered scroll reveal), `.unq-hero-anim` (first-paint entrance), `.unq-gradient` (headline keyword), `.unq-hero::before` (animated radial backdrop)
- BaseLayout inline script: reveal IntersectionObserver + count-up, re-runs on `astro:page-load`
- Homepage: 7 sections (hero/stats/why/featured/categories/CTA/footer)
- Rich-content classes: `.unq-stat`, `.unq-feature`, `.unq-cat-head`, `.unq-cta-band`, `.unq-trust`, `.unq-foot-grid`, `.unq-card--featured`
- a11y fix: `.unq-eyebrow` color → `--unq-link` (#0066cc) for AA on gray

### v2.1 (Apple.com-grade UI + IA reorg) — commit `cdaae03`

- Token system (`src/styles/tokens.css`): Apple exact hex values, backward-compat aliases
- `global.css` rewrite: Apple base typography, new Apple component classes
- Component refactors: Header, Footer, ToolCard, ToolLayout, BaseLayout, index.astro, category/[category].astro, 404.astro
- Tool-internal a11y fixes: hash-generator, color-picker, emi/mortgage-calculator, sip-calculator, json-formatter
- WCAG AA: `--unq-text-3` bumped to #6e6e73, new `--unq-success-strong` / `--unq-warning-strong` / `--unq-danger-strong` tokens

</details>
