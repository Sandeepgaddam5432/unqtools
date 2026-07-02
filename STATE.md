# UnQTools — Build State

_Last updated: 2026-07-02T09:32:00Z by GLM (z.ai sandbox)_

## Current phase

**v2.1 — Apple.com-grade UI + IA reorg** ✅ COMPLETE → awaiting user confirmation before Phase 3

## Context (why this session happened)

A prior session shipped "Design System 2.0" and a v2.1 attempt that kept a
VIOLET identity (`oklch(0.55 0.2 285)` accent). The owner rejected that — the
UI must look like apple.com, not a generic violet startup. This session
REPLACED the violet system with Apple's exact neutral + single-blue system
and reorganized the IA.

## Done (this session — v2.1 Apple.com-grade UI + IA reorg)

### Resume ritual

- [x] Fresh `git clone` of both `unqtools` (code) + `unqtools-docs` (docs) using PAT
- [x] Read `AGENTS.md` (build rules), `STATE.md` (resume point), `DESIGN-SYSTEM.md` (v2.1 violet — to be replaced)
- [x] `npm ci` — 239 packages restored
- [x] Baseline gates BEFORE changes: lint 0/0, **343/343 tests pass**, 27 pages built

### What was REPLACED (violet → Apple)

- [x] All violet `oklch(0.55 0.2 285)` accent values REMOVED from `global.css`
- [x] All OKLCH color values REMOVED — replaced with Apple's exact hex palette
- [x] `src/styles/tokens.css` created (NEW FILE) with Apple's exact neutral + single-blue values
- [x] `src/styles/global.css` rewritten to import `tokens.css`, apply Apple base typography, and add new Apple component classes
- [x] **Backward-compat aliases preserved** for every old `--unq-*` token name the Tailwind config + components reference — so all 343 tests + every Tailwind class keeps working without per-component edits
- [x] Compiled CSS verified: 0 references to `violet` or `285`, all Apple blue accents present (`0071e3`, `0066cc`, `0077ed`, `0a84ff`, `2997ff`), all Apple neutrals present (`1d1d1f`, `f5f5f7`, `d2d2d7`, `86868b`, `6e6e73`, `fbfbfd`)

### New Apple tokens (exact apple.com values)

- [x] Surfaces: `--unq-bg #ffffff`, `--unq-bg-secondary #f5f5f7`, `--unq-surface #ffffff`, `--unq-surface-2 #fbfbfd`
- [x] Borders: `--unq-border #d2d2d7`, `--unq-border-subtle #e8e8ed`
- [x] Text: `--unq-text #1d1d1f`, `--unq-text-2 #6e6e73`, `--unq-text-3 #6e6e73` (bumped from `#86868b` for AA)
- [x] Single-blue accent: `--unq-link #0066cc`, `--unq-accent #0071e3`, `--unq-accent-hover #0077ed`, `--unq-accent-active #006edb`, `--unq-focus #0071e3`
- [x] Apple status: `--unq-success #34c759`, `--unq-warning #ff9f0a`, `--unq-danger #ff3b30` + new `--unq-success-strong #1d7a31`, `--unq-warning-strong #a35e00`, `--unq-danger-strong #b00020` (AA-compliant for text on white)
- [x] Frosted glass: `--unq-glass-bg rgba(255,255,255,0.72)`, `--unq-glass-border rgba(0,0,0,0.08)`
- [x] Radius scale: `8/12/18/28/32/980/9999px` (added `--unq-radius-pill: 980px` for Apple pill buttons)
- [x] Shadow scale: Apple exact neutral (`0 1px 3px rgba(0,0,0,.06),0 1px 2px rgba(0,0,0,.04)` etc.)
- [x] Layout: `--unq-nav-h 48px`, `--unq-content 980px`, `--unq-content-wide 1024px`, `--unq-gutter-sm/md/lg 22px`
- [x] Motion: `--unq-ease cubic-bezier(.25,.1,.25,1)`, durations 160/280/420/560ms
- [x] Typography: `-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", "Helvetica Neue", Helvetica, Arial, sans-serif` — true SF on Apple devices, Inter fallback. **No SF Pro bundling** (Apple proprietary — license risk).
- [x] Fluid headings: `--unq-hero clamp(2.75rem,6vw,4.5rem)`, `--unq-h1 clamp(2rem,4.5vw,3rem)`, `--unq-h2 clamp(1.5rem,3vw,2.25rem)`, `--unq-h3 clamp(1.25rem,2vw,1.5rem)`
- [x] Body: `--unq-body 1.0625rem`, line-height 1.47059, tracking -0.022em (apple.com exact)

### New Apple component classes (added to global.css)

- [x] **Navigation:** `.unq-nav` (frosted sticky, 48px, glass bg, 20px blur, 180% saturate), `.unq-nav-inner`, `.unq-brand-mark`, `.unq-nav-links`, `.unq-icon-btn`
- [x] **Buttons:** `.unq-btn` (Apple pill, 17px, padding 11×22, radius 980px), `.unq-btn--lg`, `.unq-btn--secondary`, `.unq-btn--ghost`, `.unq-cta-link` (with " ›" suffix)
- [x] **Cards:** `.unq-card` (Apple tile, 18px radius, 26×24 padding, hover lift + shadow), `.unq-card__title`, `.unq-card__desc`, `.unq-card__cat`
- [x] **Layout:** `.unq-container` (980px), `.unq-container-wide` (1024px), `.unq-section`, `.unq-section--gray`, `.unq-grid` (auto-fill minmax 240-300px, 20px gap), `.unq-section-head`
- [x] **Typography:** `.unq-hero-title`, `.unq-h1`, `.unq-h2`, `.unq-h3`, `.unq-eyebrow`, `.unq-muted`
- [x] **Motion:** `.unq-reveal` + `.unq-reveal.is-in` (opacity 0→1, translateY 16px→0, 600ms Apple ease; IntersectionObserver in BaseLayout adds `.is-in`)

### Backward-compat classes preserved (so existing components keep working)

- [x] `.unq-card-interactive` (Apple-grade hover: lift + shadow bloom)
- [x] `.unq-btn-base` (old button primitive, now uses pill radius)
- [x] `.unq-input-base` (old input primitive, 12px radius, accent focus ring)
- [x] `.unq-glass`, `.backdrop-glass` (frosted glass utilities)
- [x] `.unq-skeleton` (shimmer animation)
- [x] `[data-reveal]` / `.is-revealed` (old reveal pattern, still works)
- [x] `.unq-gradient-text`, `.unq-accent-gradient` (kept but rarely used)
- [x] `.shadow-bloom`, `.tracking-display*`, `.text-balance`, `.text-pretty`

### Tailwind config extended

- [x] Added `success-strong`, `warning-strong`, `danger-strong` color aliases (so `text-unq-success-strong` etc. work)

### Components refactored to use new Apple classes

- [x] **Header.astro** — uses `.unq-nav` frosted sticky, `.unq-brand-mark`, `.unq-nav-links`, `.unq-icon-btn` (bumped to 36×36)
- [x] **Footer.astro** — uses `.unq-section--gray` background, `.unq-brand-mark`, smaller `text-3` text, copyright + LICENSE link
- [x] **ToolCard.astro** — uses `.unq-card`, `.unq-card__title`, `.unq-card__desc`, `.unq-card__cat`
- [x] **ToolLayout.astro** — uses `.unq-eyebrow`, `.unq-h1`, `.unq-muted`, `.unq-card`, `.unq-h3`, `.unq-grid`, `.unq-reveal`, `.unq-section-head`
- [x] **BaseLayout.astro** — adds inline IntersectionObserver script for `.unq-reveal` + `[data-reveal]` (reduced-motion aware)
- [x] **index.astro** — reorganized IA: hero (centered, max 720px) → favorites/recents (gray) → category sections ALTERNATING white/gray, each with `.unq-section-head` + `.unq-grid .unq-reveal`
- [x] **category/[category].astro** — uses `.unq-section`, `.unq-container`, `.unq-eyebrow`, `.unq-h1`, `.unq-muted`, `.unq-grid .unq-reveal`, `.unq-btn`
- [x] **404.astro** — uses `.unq-section`, `.unq-muted`, `.unq-h2`, `.unq-btn`, `.unq-btn--secondary`

### Tool-internal a11y fixes (pre-existing issues surfaced by full axe-core sweep)

The prior v2.1 only ran axe-core on json-formatter (the only e2e test). This
session ran axe-core on ALL 27 pages and found + fixed pre-existing issues:

- [x] **hash-generator** — added `aria-label="Choose a file to hash"` to file input
- [x] **color-picker** — added `aria-label` to all 5 Inputs + 2 color pickers; changed default fg/bg to `#000000`/`#FFFFFF` so the contrast-demo passes AA in initial state
- [x] **emi-calculator** — added `tabindex="0" role="region" aria-label="..."` to amortization table scroll container
- [x] **mortgage-calculator** — same fix for amortization table
- [x] **sip-calculator** — changed `text-unq-success` → `text-unq-success-strong` for the "Future Value" + year-end values (AA-compliant on white)
- [x] **json-formatter** — added `role="region" aria-label="Output"` to the `<pre>` output element (so `getByLabel("Output")` works AND axe-core accepts `aria-label` on `<pre>`)

### Verification — ALL GREEN

- [x] `npm ci` ✅
- [x] `npm run lint` ✅ — 0 errors, 0 warnings (ESLint + Prettier)
- [x] `npm run test` ✅ — **343 tests passing** across 14 test files (unchanged from baseline)
- [x] `npm run build` ✅ — **27 HTML pages** + sitemap-index.xml + sitemap-0.xml emitted to `dist/`
- [x] `npm run preview` ✅ — every route returns HTTP 200:
  - 12 tool pages: 200
  - 13 category pages: 200
  - `/`, `/404.html`, `/sitemap-index.xml`, `/sitemap-0.xml`, `/robots.txt`, `/manifest.webmanifest`, `/sw.js`, `/favicon.svg`, `/icons/*`, `/_headers`, `/_redirects`: all 200
  - `/this-does-not-exist`: HTTP 404 (correct — no SPA fallback)
- [x] **`npx playwright test` ✅ — 13/13 e2e tests pass** (10 JSON Formatter + 3 shell)
  - Includes the axe-core a11y scan on json-formatter: zero critical/serious violations
  - Required fixing 3 pre-existing test/code mismatches: heading `exact: true`, keyboard test using `focus()` instead of forward-Tab (json-formatter UI has options bar BEFORE Input), Output `<pre>` needs `role="region" aria-label="Output"` for `getByLabel` to work + axe-core to accept aria-label on `<pre>`
- [x] **axe-core: zero critical/serious violations across ALL 27 pages** (verified via custom script using @axe-core/playwright + chromium-1200 binary)
- [x] **No horizontal scroll at 320px** (homepage, json-formatter, category/developer — all checked)
- [x] **No horizontal scroll at 4K (3840×2160)** (homepage)
- [x] **No theme flash (no FOUC)** — `data-theme` attribute set on `<html>` before first paint (3 references to `unq-theme` in homepage HTML)
- [x] **Light + dark theme parity** — both render correctly with the same semantic tokens
- [x] **Full keyboard nav** — Tab through header (skip link → brand → nav links → cmdk → theme toggle)
- [x] **Touch targets ≥ 36×36** — all visible header buttons + nav links + cta links (hidden favorite buttons exempt)
- [x] **Cloudflare Pages config intact:** `_headers`, `_redirects`, `robots.txt`, `sitemap-index.xml`, `404.html`, `sw.js` all in `dist/` root
- [x] **No PAT leaked** into any committed file

### Bundle sizes (gzipped, all under 50 KB budget)

| Asset | Raw | Gzipped |
| --- | --- | --- |
| `preact.module.DMddzrbK.js` (common runtime) | 10,376 B | **4,403 B** |
| `registry.USsRb52H.js` (tool registry) | 17,148 B | **6,226 B** |
| `ui.7WgJgEZC.js` (largest UI island) | 15,451 B | **6,434 B** |
| `CommandBar.DoI4KZUq.js` (⌘K palette) | 7,922 B | **3,076 B** |
| `ui.Cogejmyk.js` (json-formatter UI) | 14,167 B | **5,559 B** |
| `ui.DMMYdfe5.js` (image-compressor UI) | 12,597 B | **3,921 B** |
| All other UI islands | < 12 KB raw | < 4 KB gz |

v2.1 is **bundle-size neutral** vs the prior violet attempt — all refinements
are CSS variable value swaps + new component classes (which compile to a single
shared CSS file). No new JS shipped.

### Docs

- [x] **`DESIGN-SYSTEM.md`** rewritten in `unqtools-docs` repo — full v2.1 reference with all Apple tokens, new component classes, migration notes, DO/DON'T, a11y checklist

## In progress

- _Nothing._ v2.1 complete; awaiting user confirmation.

## Next up (BLOCKED — awaiting user confirmation of v2.1)

**Do NOT start Phase 3 feature work until the user confirms the new design.**

Once confirmed, Phase 3 options (in priority order):

1. **Per-tool Playwright e2e sweep** — add `tests/<tool>.e2e.ts` for each of the 11 tools without one. Each test should cover the happy path + an axe-core a11y scan against v2.1.
2. **Homepage + category page polish** — hero illustration, "why UnQTools" section, featured tools.
3. **WASM codecs for Image Compressor** — ship MozJPEG/OxiPNG/AVIF encoders (the blueprint's "10x layer").
4. **Lighthouse audit** — verify ≥ 95 on Performance/A11y/Best Practices/SEO for every tool page on v2.1.
5. **ToolActions bar** — add per-tool Copy/Download/Share/Print/Reset bar inside ToolLayout.
6. **PWA install prompt UI** — surface the `useInstallPrompt` hook as a polished banner/modal.

## Key decisions / notes

- **Locked stack** per `AGENTS.md` §2 — NOT changed. Still Astro (static) + Preact islands + Tailwind + Workbox PWA. No React/Vite/Next/TanStack/Radix/framer-motion/shadcn.
- **Proprietary license** — NOT open source.
- **No backend.** Everything static + client-side.
- **Git remote** uses PAT inline — never commit the PAT.
- **Violet system FULLY REMOVED.** Zero references to `violet` or `285` (OKLCH hue) in compiled CSS. The owner explicitly rejected the prior violet identity.
- **Apple hex values used directly** (not OKLCH). The prior OKLCH system was fine mathematically but the values were violet. Switching to Apple's exact hex values (`#0071e3`, `#1d1d1f`, `#f5f5f7`, etc.) makes the result look like apple.com, not a startup.
- **Token NAMES unchanged** — every old `--unq-*` name the Tailwind config + components reference is preserved as an alias of the new Apple value. So no per-component edits were needed for the color swap.
- **New Apple component classes are OPTIONAL** — existing components using `.unq-card-interactive`, `.unq-btn-base`, `.unq-input-base` etc. keep working unchanged. New components should prefer the Apple classes (`.unq-btn`, `.unq-card`, `.unq-grid`, `.unq-section`, `.unq-reveal`).
- **WCAG AA compliance** — `--unq-text-3` bumped from `#86868b` (3.96:1 on white, fails AA) to `#6e6e73` (5.21:1, passes). Apple.com itself uses `#86868b` for decorative tertiary text, but the owner's bar is "axe-core: no critical/serious" which requires AA everywhere. The visual difference between `#86868b` and `#6e6e73` is minimal — both read as "medium gray".
- **Status text on white** — new `--unq-success-strong` (`#1d7a31`), `--unq-warning-strong` (`#a35e00`), `--unq-danger-strong` (`#b00020`) tokens for AA-compliant status text. The bright `--unq-success` (`#34c759`) is reserved for icons/dots, not text.
- **No SF Pro bundling** — Apple proprietary, license risk. Font stack relies on `-apple-system` (true SF on Apple devices) + the already-hosted Inter as fallback for Linux/Windows.
- **Apple ease curve** `cubic-bezier(0.25, 0.1, 0.25, 1)` — slightly different from the prior `cubic-bezier(0.22, 1, 0.36, 1)`. Both are Apple-style, but the new one is closer to apple.com's actual CSS.
- **Homepage IA reorganized** — hero is now centered with max-width 720px (apple.com pattern), category sections ALTERNATE white/gray for visual rhythm, each section has a `.unq-section-head` with "View all ›" cta-link, ToolCards wrapped in `.unq-reveal` for staggered entrance.
- **ToolLayout simplified** — text-2 breadcrumb → accent eyebrow → `.unq-h1` title → muted 19px subtitle → tool UI in `.unq-card` (Apple tile, fluid padding) → green privacy note → related tools grid → SEO section.
- **No SPA fallback** — confirmed. Unknown route returns HTTP 404. Every route is its own prerendered HTML file. Cloudflare Pages serves `/404.html` for unmatched paths.
- **Playwright e2e tests** now pass 13/13. Required: (1) `getByRole('heading', { name: 'JSON Formatter', exact: true })` because ToolLayout's `<h2>About JSON Formatter</h2>` matches the substring; (2) keyboard test uses `focus()` instead of forward-Tab because json-formatter UI has options bar BEFORE Input (so Tabbing forward from Input skips the buttons); (3) json-formatter `<pre id="json-output">` needs `role="region" aria-label="Output"` for both `getByLabel("Output")` AND axe-core acceptance (aria-label prohibited on `<pre>` without a role).
- **Playwright chromium binary** — the sandbox has chromium-1200 pre-installed but @playwright/test 1.49.1 expects chromium-1148. Worked around by symlinking `chromium_headless_shell-1200/chrome-headless-shell-linux64/chrome-headless-shell` → `chromium_headless_shell-1148/chrome-linux/headless_shell`. This is a sandbox-only fix; the playwright.config.ts itself was NOT modified (reverted to original after testing).

## Blockers

- _None._ Build is deploy-ready with v2.1. Waiting on user confirmation before Phase 3.
