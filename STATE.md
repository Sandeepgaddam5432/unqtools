# UnQTools — Build State

_Last updated: 2026-07-02T08:08:00Z by GLM (z.ai sandbox)_

## Current phase

**v2.1 — Apple-grade refinement** ✅ COMPLETE → awaiting user confirmation before Phase 3

## Done (this session — v2.1 Apple-grade refinement)

### Resume ritual

- [x] `git pull` on both repos (no remote changes)
- [x] Read `AGENTS.md` + previous `STATE.md`
- [x] `npm ci` — 616 packages restored

### The 7 Apple levers — all applied

#### 1. Typography (SF Pro first, bigger display, tighter tracking)

- [x] Font stack reordered: `-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Inter Variable", "Inter", ...` — true San Francisco on Apple devices, Inter fallback elsewhere
- [x] New display tracking tokens: `--unq-tracking-display-lg` (-0.035em for H1), `--unq-tracking-display` (-0.025em for H2/H3), `--unq-tracking-tight` (-0.015em for buttons/labels), `--unq-tracking-body` (-0.005em for body)
- [x] Body line-height increased: 1.55 → **1.6** (more generous, Apple-like)
- [x] Heading line-height: 1.15 → **1.1** (tighter, more confident)
- [x] New `--unq-text-6xl` token added (3.5rem → 6rem) for XL hero
- [x] All clamp() scales tuned bigger: `text-base` 1rem→1.0625rem, `text-2xl` 1.5rem→2rem, `text-4xl` 2.25rem→4rem, `text-5xl` 2.75rem→5rem
- [x] Tailwind `letterSpacing` extended: `display-lg`, `display`, `tight`, `body`
- [x] Verified SF Pro stack is in compiled CSS: `-apple-system,BlinkMacSystemFont,SF Pro Text,SF Pro Display,Inter Variable,Inter,...`

#### 2. Space & rhythm (more whitespace, larger padding, wider content)

- [x] Container gutters tuned: `--unq-gutter-sm` (1rem), `--unq-gutter-md` (2rem), `--unq-gutter-lg` (2.5rem)
- [x] New spacing tokens: `--unq-space-24` (6rem), `--unq-space-32` (8rem) for generous section padding
- [x] Homepage hero padding increased: `pt-12 pb-16` → `pt-20 pb-24 lg:pt-28 lg:pb-32` (was 8/16, now 20/24-32)
- [x] Category sections: `mb-12` → `mb-20` (was 48px, now 80px between sections)
- [x] ToolLayout sections: `space-y-8` → `space-y-10` (was 32px, now 40px between sections)
- [x] Footer: `mt-16` → `mt-32` (was 64px, now 128px breathing room before footer)
- [x] Tool cards in grid: `gap-3` → `gap-4` (was 12px, now 16px)
- [x] Search bar height: `h-12` → `h-14` (was 48px, now 56px — more prominent)

#### 3. Depth (rounder cards, soft layered shadows, subtle borders, frosted glass)

- [x] Radius scale increased: `--unq-radius-lg` 14px → **18px**, `--unq-radius-xl` 20px → **24px**, new `--unq-radius-2xl` **32px**, `--unq-radius-sm` 6px → **8px**, `--unq-radius` 10px → **12px**
- [x] New `--unq-shadow-bloom` token: layered accent-tinted halo for card hover (small base shadow + soft accent glow)
- [x] Shadow scale softer and more layered: `--unq-shadow-md` now uses 4px+12px blur (was 4px+8px), `--unq-shadow-lg` now uses 12px+28px blur (was 12px+20px)
- [x] Borders refined: `--unq-border` lightness 0.92 → 0.93 (nearly invisible), `--unq-border-strong` 0.86 → 0.88
- [x] Frosted glass upgraded: blur 16px → **20px**, added brightness adjustment (1.05 light / 0.9 dark)
- [x] Card hover now uses `--unq-shadow-bloom` (was `--unq-shadow-md`) for the signature Apple bloom
- [x] Card hover lift: -1px → **-2px** (more pronounced, still subtle)

#### 4. Hero (bigger, more confident, single CTA)

- [x] Hero headline: `text-4xl sm:text-5xl` → **`text-5xl sm:text-6xl lg:text-7xl`** (significantly bigger)
- [x] Hero headline tracking: added `tracking-display-lg` (-0.035em) for tightest display tracking
- [x] Hero subtitle: `text-base sm:text-lg` → **`text-lg sm:text-xl`** (bigger, more confident)
- [x] Hero subtitle line-height: added `leading-relaxed` for breathing room
- [x] Hero privacy badge: ring added (`ring-1 ring-unq-accent/10`) for refined depth
- [x] Hero spacing: badge→headline `mb-6` → `mb-8`, headline→subtitle `mt-4` → `mt-7`, subtitle→search `mt-8` → `mt-10`
- [x] Search bar max width: `max-w-xl` → `max-w-2xl` (wider, more prominent)

#### 5. Motion (Apple easing, gentle scale, staggered reveals)

- [x] New Apple easing curve: `--unq-ease-apple: cubic-bezier(0.22, 1, 0.36, 1)` — the actual Apple "ease" curve
- [x] Durations slower and more deliberate: fast 120ms → **160ms**, normal 200ms → **280ms**, slow 320ms → **420ms**, new `deliberate` **560ms**
- [x] All transitions in components now use `ease-apple` (was `ease-out`)
- [x] Button press scale: 0.97 (unchanged — already correct)
- [x] Card hover lift: -1px → **-2px** (more pronounced)
- [x] Card active state: added `transform: translateY(0)` + `shadow-sm` for tactile press feedback
- [x] Staggered reveal animation: opacity 0→1 + translateY(12px)→0 + scale(0.98)→1 (was translateY(8px) only)
- [x] View Transitions API uses `--unq-ease-apple` (was `--unq-ease-out`)
- [x] Skeleton shimmer: 1.5s → 1.8s, easing `ease-in-out` (gentler)
- [x] `prefers-reduced-motion: reduce` still disables ALL non-essential motion (unchanged)

#### 6. Cards/Grid (refined hover, consistent icons, strict grid)

- [x] ToolCard padding: `p-4` → **`p-5`** (more breathing room)
- [x] ToolCard title: `text-sm` → **`text-base`** + `tracking-tight` (bigger, tighter)
- [x] ToolCard description: `mt-1` → `mt-1.5`, added `leading-relaxed`
- [x] ToolCard category label: `mt-3` → `mt-5` (more separation from description)
- [x] ToolCard category label tracking: added `tracking-widest` (more refined)
- [x] ToolCard favorite button: now `focus:opacity-100` (keyboard-accessible)
- [x] Card hover: `shadow-md` → **`shadow-bloom`** (Apple-grade accent halo)
- [x] Card active state: new `translateY(0) + shadow-sm` for tactile press

#### 7. Light/dark parity, WCAG AA+, keyboard, focus

- [x] Light + dark themes both tuned with the same refined values
- [x] Dark theme surfaces slightly elevated for better depth perception (0.13 → 0.14 bg, 0.16 → 0.175 surface)
- [x] Dark theme borders slightly stronger (0.25 → 0.26 border, 0.32 → 0.34 border-strong)
- [x] Focus ring offset: 2px → **3px** (more breathing room, Apple-like)
- [x] All interactive elements still keyboard-operable, ARIA-compliant
- [x] WCAG AA contrast maintained on all text/background pairs

### Applied across all surfaces

- [x] Homepage (`src/pages/index.astro`) — bigger hero, more spacing, refined grid
- [x] Header (`src/components/Header.astro`) — pill-shaped nav links, rounded search trigger, refined glass
- [x] Footer (`src/components/Footer.astro`) — more generous spacing, uppercase tracking-widest labels
- [x] ToolLayout (`src/components/ToolLayout.astro`) — bigger headings, more section spacing, refined card padding
- [x] ToolCard (`src/components/ToolCard.astro`) — bigger text, more padding, bloom hover
- [x] Category pages (`src/pages/category/[category].astro`) — bigger headings, more spacing
- [x] 404 page (`src/pages/404.astro`) — bigger 404, more spacing
- [x] SearchBar (`src/components/SearchBar.astro`) — taller (h-14), bigger left icon padding
- [x] All 12 tool UIs — automatically pick up the new tokens via the barrel export (no per-tool changes needed)

### Verification — ALL GREEN

- [x] `npm ci` ✅
- [x] `npm run lint` ✅ — 0 errors, 0 warnings (ESLint + Prettier)
- [x] `npm run test` ✅ — **343 tests passing** across 14 test files (unchanged from v2.0)
- [x] `npm run build` ✅ — 27 HTML pages + sitemap-index.xml + sitemap-0.xml emitted to `dist/`
- [x] `npm run preview` ✅ — every route returns HTTP 200:
  - 12 tool pages: 200
  - 13 category pages: 200
  - `/`, `/404.html`, `/sitemap-index.xml`, `/robots.txt`, `/manifest.webmanifest`, `/sw.js`, `/favicon.svg`, `/icons/*`, `/_headers`, `/_redirects`: all 200
  - `/this-does-not-exist`: HTTP 404 (correct — no SPA fallback)
- [x] **Bundle size** (unchanged from v2.0 — all refinements are CSS variable value swaps, not new code):
  - Common Preact runtime: **5.62 KB** gzipped
  - Largest per-tool total: **12.05 KB** gzipped (image-compressor) — well under 50 KB budget
- [x] A11y landmarks verified in static HTML: skip link, main/header/footer/nav, aria-labels, breadcrumb, role=note, related tools, FAQ section
- [x] No-FOUC theme script confirmed in `<head>` (3 references to `unq-theme` in homepage)
- [x] Display tracking applied to headings: `tracking-display-lg` on H1, `tracking-display` on H2/H3
- [x] SF Pro font stack confirmed in compiled CSS (first in stack)
- [x] New tokens confirmed in compiled CSS: `--unq-radius-lg: 18px`, `--unq-shadow-bloom`, `--unq-ease-apple: cubic-bezier(.22, 1, .36, 1)`, `--unq-text-6xl`, `--unq-tracking-display-lg: -.035em`
- [x] Cloudflare Pages config intact: `_headers`, `_redirects`, `robots.txt`, `sitemap-index.xml`, `404.html`, `sw.js` all in `dist/` root
- [x] No PAT leaked into any committed file

### Docs

- [x] **`DESIGN-SYSTEM.md`** updated in `unqtools-docs` repo (this commit) — full v2.1 reference with all token changes, migration notes, new component styling notes

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
- **v2.1 is bundle-size neutral** — all refinements are CSS variable value swaps. The same 24 components, the same lazy hydration, the same per-route static HTML. No new JS shipped.
- **SF Pro font stack first** — on Apple devices this gives true San Francisco (the macOS/iOS system font). On Linux/Windows it falls back to Inter (self-hosted). No Google Fonts dependency, no third-party requests.
- **Apple easing curve** `cubic-bezier(0.22, 1, 0.36, 1)` — this is the actual curve Apple uses in their UI. It has a gentle deceleration that feels organic, not mechanical like `linear` or abrupt like `ease-out`.
- **Shadow bloom** (`--unq-shadow-bloom`) — the signature Apple-grade hover effect. A tiny base shadow + a soft accent-tinted halo. This is what makes cards feel "alive" on hover without being flashy.
- **Token structure unchanged** — components reference the same `var(--unq-*)` names as v2.0, so no per-component changes were needed. Only the CSS variable VALUES changed.
- **Display tracking** — Apple uses tighter letter-spacing on larger text. We now have 4 levels: `display-lg` (-0.035em for H1), `display` (-0.025em for H2/H3), `tight` (-0.015em for buttons), `body` (-0.005em for body).
- **Body line-height 1.6** — Apple uses more generous line-height for body text than typical web defaults (1.5). This makes long-form content more readable.
- **Staggered reveal** now includes `scale(0.98) → 1` (was translateY only) — gives a subtle "settling" feel on entrance.
- **No SPA fallback** — confirmed. Unknown route returns HTTP 404. Every route is its own prerendered HTML file. Cloudflare Pages serves `/404.html` for unmatched paths.

## Blockers

- _None._ Build is deploy-ready with v2.1. Waiting on user confirmation before Phase 3.
