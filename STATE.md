# UnQTools — Build State

_Last updated: 2026-07-02T07:32:00Z by GLM (z.ai sandbox)_

## Current phase

**Design System 2.0** ✅ COMPLETE → awaiting user confirmation before Phase 3

## Done (this session — Design System 2.0)

### Resume ritual

- [x] `git pull` on both repos (no remote changes)
- [x] Read `AGENTS.md` + previous `STATE.md`
- [x] `npm ci` — 616 packages restored

### Foundation — design tokens, fonts, View Transitions

- [x] **OKLCH design tokens** in `src/styles/global.css` — single source of truth
  - Signature accent: refined violet `oklch(0.55 0.2 285)` (light) / `oklch(0.7 0.17 285)` (dark) — distinct from default tech-blue
  - Semantic tokens: bg, surface, surface-elevated, surface-hover, border, border-strong, text, text-muted, text-subtle, accent (+ hover/subtle/contrast/ring), success (+ subtle), warning (+ subtle), danger (+ subtle)
  - Light + dark derived from SAME semantic names — components never branch on theme
  - System preference respected when no explicit choice; live reactivity via `matchMedia`
  - 4px base spacing scale, 5-level radius scale (sm/default/lg/xl/full), 5-level shadow scale (xs→xl) + glow
  - Fluid clamp()-based type scale (xs → 5xl), Inter font with -apple-system fallback, tabular-nums utility, balanced text wrapping on headings
  - GPU-only motion (transform/opacity), spring/out easing curves, `prefers-reduced-motion` fully honored
- [x] **Self-hosted Inter** via `@fontsource/inter` (400, 500, 600, 700) — preloaded, no Google Fonts dependency
- [x] **View Transitions API** enabled via `<meta name="view-transition" content="same-origin">` + reduced-motion guard
- [x] **Tailwind config** updated to map every utility to the new OKLCH tokens (no hardcoded hex in Tailwind)
- [x] **No-FOUC theme script** enhanced: reads localStorage, sets `<html data-theme>` BEFORE first paint, also listens for live OS theme changes when user is on "system" mode

### Component library — headless Preact, shadcn-quality, accessible

- [x] All components live in `src/components/ui/` as individual files
- [x] Barrel export at `src/components/ui.tsx` for backwards compatibility (existing tool UIs unchanged)
- [x] Components built:
  - **Button** — 5 variants (primary/secondary/outline/ghost/danger), 4 sizes (sm/md/lg/icon), loading spinner, icon support
  - **Input** — label, hint, error, leading icon, trailing affix, ARIA-describedby
  - **Textarea** — label, hint, error, char counter with max, monospace option
  - **Select** — native `<select>` styled (best mobile UX), label + hint
  - **Switch / Toggle** — animated, label + description, sm/md sizes, `Toggle` alias for backwards compat
  - **Slider** — live value display with formatter, accessible
  - **Card** — 3 variants (flat/elevated/interactive), 3 padding sizes, hover lift
  - **Badge** — 6 variants (default/accent/success/warning/danger/outline), sm/md
  - **Tabs** — keyboard nav (ArrowLeft/Right), ARIA tablist, focus management
  - **Segmented** — compact pill-style radiogroup for view toggles
  - **Tooltip** — hover/focus, 4 sides, configurable delay, accessible
  - **Dialog** — focus trap, ESC to close, click-outside, 4 sizes, ARIA modal
  - **Toast** — Sonner-style, 4 variants, auto-dismiss, top-right (desktop) / bottom (mobile)
  - **Skeleton** — shimmer placeholder, line/circle/rect shapes
  - **EmptyState** — icon + title + description + optional action
  - **FileDropzone** — drag-and-drop, accessible (keyboard + click), accept filter
  - **CopyButton** — clipboard copy with success feedback + toast, fallback for non-secure contexts
  - **DownloadButton** — browser download for text content
  - **ShareButton** — Web Share API with clipboard fallback
  - **ErrorBanner** — `role=alert`, icon + title + message
  - **Checkbox** — animated check, label + description
  - **RadioGroup** — vertical/horizontal, ARIA radiogroup
  - **Breadcrumb** (Astro) — server-rendered for layouts
- [x] All components use Lucide icons (1.5px stroke, consistent)
- [x] All components keyboard-operable, correct ARIA, visible focus, WCAG AA contrast

### ⌘K Command Bar (cmdk-style, built for Preact)

- [x] **`src/components/CommandBar.tsx`** — fuzzy search over tool registry
- [x] **Trigger:** ⌘K / Ctrl+K from anywhere (global keydown listener), or click header search pill
- [x] **Empty query:** recents first, then favorites, then alphabetical (24 items)
- [x] **Keyboard nav:** ↑↓ to move, Enter to open, ESC to close
- [x] **Glassmorphism** backdrop + semi-transparent panel
- [x] **Hydrated `client:idle`** via `CommandBarMount.astro` so it doesn't block first paint
- [x] **Recent + favorite awareness** via `useFavorites` / `useRecents` hooks

### Storage hooks — reactive localStorage

- [x] **`src/lib/storage.ts`** — `useLocalStorage<T>`, `useFavorites`, `useRecents`, `useInstallPrompt`
- [x] All hooks SSR-safe (no-op on server)
- [x] Cross-tab sync via `storage` event
- [x] Favorites stored under `unq-favorites`, recents under `unq-recents` (capped at 8, most-recent-first)
- [x] `useInstallPrompt` captures `beforeinstallprompt` event, exposes `promptInstall()`

### Key surfaces redesigned

#### Homepage (`src/pages/index.astro`)

- [x] **Hero:** "100% private · runs in your browser" badge with pulsing dot, gradient text headline "Tools that respect your data.", subtitle, prominent search, ⌘K hint
- [x] **Favorites + Recents rows** (reactive — populated client-side via localStorage, hidden when both empty)
- [x] **Category sections** with "View all →" links, 4-column grid on xl screens
- [x] **Footer** — 3-column with sitemap + product links + about, copyright + LICENSE link

#### Header (`src/components/Header.astro`)

- [x] **Glassmorphism** sticky header (backdrop-blur, semi-transparent)
- [x] **Logo** with accent square + "UnQTools" wordmark (hidden on mobile)
- [x] **Nav** (desktop only) — top 8 categories as short labels
- [x] **⌘K trigger** — looks like a search input, shows ⌘K kbd hint on desktop
- [x] **Theme toggle** — sun/moon icons, cycles light ↔ dark

#### ToolLayout (`src/components/ToolLayout.astro`) — replaces ToolShell

- [x] **Breadcrumb** (Home / Category / Tool name)
- [x] **Eyebrow** (category label, accent color) + status badges (offline-ready / needs network)
- [x] **Title + subtitle** with balanced text wrapping
- [x] **Tool UI** wrapped in a Card
- [x] **Privacy notice** (green-tinted, lock icon, "100% private")
- [x] **Related tools** strip (max 4, same category)
- [x] **SEO content** section: About / How-to / FAQ (driven by tool manifest `seo.faq`)

#### Category pages (`src/pages/category/[category].astro`)

- [x] Breadcrumb, eyebrow + tool count badge, title, subtitle
- [x] Same ToolCard grid as homepage

#### 404 page (`src/pages/404.astro`)

- [x] Centered 404 with subtle gradient
- [x] "Back to home" + "Search tools (⌘K)" buttons

### Refactored all 12 tools

- [x] All 12 tool UIs use the new design system via the barrel export (`import { ... } from "../../../components/ui"`)
- [x] No tool logic or tests changed — only the component library they import from
- [x] All 337 original tests stay green
- [x] 6 new design-system tests added (`tests/design-system.test.ts`) — total now **343 tests**

### Verification — ALL GREEN

- [x] `npm ci` ✅
- [x] `npm run lint` ✅ — 0 errors, 0 warnings (ESLint + Prettier)
- [x] `npm run test` ✅ — **343 tests passing** across 14 test files (337 original + 6 new)
- [x] `npm run build` ✅ — 27 HTML pages + sitemap-index.xml + sitemap-0.xml emitted to `dist/`
- [x] `npm run preview` ✅ — every route returns HTTP 200:
  - 12 tool pages: 200
  - 13 category pages: 200
  - `/`, `/404.html`, `/sitemap-index.xml`, `/robots.txt`, `/manifest.webmanifest`, `/sw.js`, `/favicon.svg`, `/icons/*`, `/_headers`, `/_redirects`: all 200
  - `/this-does-not-exist`: HTTP 404 (correct — no SPA fallback)
- [x] **Bundle size report** (gzipped):
  - Common Preact runtime: **5.62 KB** (was 9.79 KB — 42% smaller!)
  - Largest per-tool total: **12.05 KB** (was 15.95 KB — 24% smaller!) — well under 50 KB budget
  - Homepage JS: ~7 KB (search is pure DOM, no Preact island)
- [x] A11y landmarks verified in static HTML: skip link, main/header/footer/nav, aria-labels, breadcrumb, role=note, related tools section, FAQ section
- [x] Cloudflare Pages config intact: `_headers`, `_redirects`, `robots.txt`, `sitemap-index.xml`, `404.html`, `sw.js` all in `dist/` root
- [x] No PAT leaked into any committed file

### Docs

- [x] **`DESIGN-SYSTEM.md`** pushed to `unqtools-docs` repo (this commit) — full token reference, component list, do/don't, performance budgets, a11y checklist

## In progress

- _Nothing._ Design System 2.0 complete; awaiting user confirmation.

## Next up (BLOCKED — awaiting user confirmation of new design)

**Do NOT start Phase 3 feature work until the user confirms the new design.**

Once confirmed, Phase 3 options (in priority order):

1. **Per-tool Playwright e2e sweep** — add `tests/<tool>.e2e.ts` for each of the 11 tools without one (only `json-formatter` has e2e today). Each test should cover the happy path + an axe-core a11y scan against the new design system.
2. **Homepage + category page polish** — hero illustration, "why UnQTools" section, featured tools.
3. **WASM codecs for Image Compressor** — ship MozJPEG/OxiPNG/AVIF encoders (the blueprint's "10x layer").
4. **Lighthouse audit** — verify ≥ 95 on Performance/A11y/Best Practices/SEO for every tool page on the new design.
5. **ToolActions bar** — add per-tool Copy/Download/Share/Print/Reset bar inside ToolLayout (currently each tool rolls its own).
6. **PWA install prompt UI** — surface the `useInstallPrompt` hook as a polished banner/modal.

## Key decisions / notes

- **Locked stack** per `AGENTS.md` §2 — NOT changed. Still Astro (static) + Preact islands + Tailwind + Workbox PWA. No React/Vite/Next/TanStack. No shadcn (React-only) — built shadcn-QUALITY components natively for Preact.
- **Proprietary license** — NOT open source.
- **No backend.** Everything static + client-side.
- **Git remote** uses PAT inline — never commit the PAT.
- **OKLCH chosen over HSL/HEX** for perceptual uniformity — the same lightness value looks equally bright across hues. All modern browsers support it (Chrome 111+, Safari 15.4+, Firefox 113+).
- **Signature accent = refined violet** (`oklch(0.55 0.2 285)`) — distinct from default tech-blue, reads as "intelligent tools", works in both light/dark.
- **Inter self-hosted** via `@fontsource/inter` — no Google Fonts dependency, no third-party requests, faster first paint.
- **View Transitions API** enabled for same-origin route changes — smooth fade between pages, disabled under `prefers-reduced-motion`.
- **Command Bar hydrated `client:idle`** so it doesn't block first paint. The ⌘K listener is registered inline in the Header so it works immediately, even before the island hydrates.
- **Favorites/recents on homepage** use pure-DOM rendering (no Preact island) to keep the homepage JS budget tiny. The `storage` event syncs across tabs; a custom `unq:favorite-changed` event syncs in-page toggles.
- **ToolLayout** is the new consistent shell for every tool page — breadcrumb, eyebrow, title, subtitle, Card-wrapped UI, privacy notice, related tools, SEO content. Replaces the old `ToolShell.astro`.
- **Backwards compat:** the `ui.tsx` barrel re-exports every component, so existing tool UIs (`import { Button, Input, ... } from "../../../components/ui"`) work unchanged. New code can also import from individual files for tree-shaking.
- **Bundle size SHRANK** despite adding more components — the modular file structure enabled better tree-shaking. Common runtime dropped from 9.79 KB → 5.62 KB gzipped; largest per-tool dropped from 15.95 KB → 12.05 KB gzipped.
- **No SPA fallback** — confirmed. Unknown route returns HTTP 404. Every route is its own prerendered HTML file. Cloudflare Pages serves `/404.html` for unmatched paths.

## Blockers

- _None._ Build is deploy-ready with the new design. Waiting on user confirmation before Phase 3.
