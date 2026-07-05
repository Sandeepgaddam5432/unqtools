# UnQTools — Codebase Walkthrough (v6.6, July 2025)

> Read top to bottom. Every file path and code excerpt is from the actual repo at `main@70a7100`.

## 1. Big Picture

UnQTools is a **100% static, privacy-first PWA** of 22 browser-based tools (converters, calculators, generators, formatters). No backend, no accounts, no tracking. Every tool runs entirely client-side.

### Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                    Cloudflare Pages                  │
│            (auto-deploys from main branch)           │
│                                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │          Next.js 16 Static Export            │    │
│  │          (output: 'export' → out/)            │    │
│  │                                               │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐   │    │
│  │  │ Home (/)  │  │ /tools   │  │/tools/[id]│   │    │
│  │  │ Hero+Bento│  │ Directory│  │ 22 pages  │   │    │
│  │  └──────────┘  └──────────┘  └──────────┘   │    │
│  │  ┌────────────────┐  ┌──────────────────┐   │    │
│  │  │/category/[cat]  │  │  404 / _not-found │   │    │
│  │  │ 4 active pages  │  │                  │   │    │
│  │  └────────────────┘  └──────────────────┘   │    │
│  └─────────────────────────────────────────────┘    │
│                                                      │
│  Service Worker (sw.js) + manifest.json → offline    │
└─────────────────────────────────────────────────────┘
```

### Deploy Pipeline
- Push to `main` → GitHub Actions CI runs (lint + test + build + e2e gates)
- Cloudflare Pages watches `main`, builds `out/`, serves via `wrangler.toml` (`pages_build_output_dir = "out"`)
- `wrangler.toml` at repo root tells CF Pages where to find the static export

## 2. Repo Tree

```
unqtools/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── layout.tsx          # Root layout (providers, fonts, PWA)
│   │   ├── page.tsx            # Home page (hero + bento + categories + tools)
│   │   ├── globals.css         # Design tokens (light/dark CSS variables)
│   │   ├── tools/
│   │   │   ├── page.tsx        # Tools directory (grid + search + filters)
│   │   │   └── [id]/
│   │   │       ├── page.tsx           # Server: generateStaticParams + metadata
│   │   │       └── tool-page-client.tsx  # Client: breadcrumb + tool UI + related + FAQ
│   │   └── category/
│   │       └── [category]/
│   │           ├── page.tsx           # Server: generateStaticParams (active cats only)
│   │           └── category-page-client.tsx  # Client: category grid
│   ├── components/
│   │   ├── ui/                 # 90 shadcn/ui + Magic UI components (28 used)
│   │   ├── navigation/
│   │   │   ├── sidebar.tsx     # Desktop sidebar + mobile drawer + MobileHeader
│   │   │   └── mobile-header.tsx  # v6.6 fixed top bar (mobile only)
│   │   ├── command-palette.tsx # ⌘K palette (cmdk + Dialog)
│   │   ├── theme-provider.tsx  # Mount-gated next-themes (fixes #418)
│   │   ├── motion-provider.tsx # MotionConfig wrapper (reduced-motion)
│   │   ├── tool-skeleton.tsx   # Dimension-reserved Suspense fallback (CLS fix)
│   │   ├── pwa-install.tsx     # SW registration + install prompt
│   │   └── ui/shape-landing-hero.tsx  # HeroGeometric (subtitle prop added v6.5)
│   ├── hooks/                  # use-mobile, use-toast
│   ├── lib/
│   │   ├── registry.ts         # Central tool registry (explicit imports)
│   │   ├── tool.ts             # ToolManifest type + ALL_CATEGORIES + CATEGORY_LABELS
│   │   ├── search.ts           # Fuzzy search (subsequence scoring, no deps)
│   │   ├── utils.ts            # cn() — clsx + tailwind-merge (shadcn standard)
│   │   ├── dom-utils.ts        # copyToClipboard, downloadFile (UNUSED — dead code)
│   │   ├── runWorker.ts        # Generic Web Worker harness (UNUSED — dead code)
│   │   └── theme.ts            # Theme helpers (UNUSED — dead code)
│   └── tools/                  # 22 tools, grouped by category
│       ├── developer/          # 5 tools: json-formatter, base64, hash, url-encoder, uuid
│       ├── calculators/        # 3 tools: emi, mortgage, sip
│       ├── image/              # 2 tools: color-picker, image-compressor
│       └── text/               # 12 tools: add-line-breaks, caesar-cipher, etc.
│           └── <tool-id>/
│               ├── manifest.ts     # Tool declaration (id, name, category, keywords, seo)
│               ├── logic.ts        # Pure TS logic (framework-agnostic, unit-tested)
│               ├── logic.test.ts   # Vitest unit tests
│               ├── ui.tsx          # React client component (lazy-loaded)
│               └── worker.ts       # Optional: Web Worker for heavy compute
├── tests/
│   ├── routes.json             # Generated route list (single source of truth)
│   ├── gen-routes.mjs          # Route list generator (scans out/)
│   ├── static-server.mjs       # Node static file server (serves out/ with 404)
│   ├── smoke.e2e.ts            # 33 tests: routes 200, H1, console errors, React errors, leftovers, top-space
│   ├── tool.e2e.ts             # 22 tests: load + input + strict output assertions
│   ├── axe.e2e.ts              # a11y: 15 routes × light + dark
│   ├── overflow.e2e.ts         # 12 pages × 4 viewports
│   ├── cls.e2e.ts              # 5 pages CLS < 0.1
│   └── reduced-motion.e2e.ts   # 6 pages animation duration check
├── archive/
│   └── showcase-pages/         # 17 archived template demo pages (preserved, not built)
├── public/
│   ├── sw.js                   # Service worker (cache-first assets, network-first nav)
│   ├── manifest.json           # PWA manifest
│   ├── logo.svg                # App icon
│   ├── sandeep.png             # Owner photo (UNUSED on production pages)
│   ├── _headers, _redirects    # Cloudflare Pages config
│   └── robots.txt
├── .github/workflows/ci.yml    # CI: build (must-pass) + informational-gates (continue-on-error)
├── next.config.ts              # output: 'export', images: { unoptimized: true }
├── wrangler.toml               # pages_build_output_dir = "out"
├── tailwind.config.ts          # Semantic color mapping to --unq-* → --primary etc.
├── playwright.config.ts        # 1 worker, static-server webServer, conditional chromium path
├── vitest.config.ts            # @/* alias, node environment
└── package.json                # name: "unqtools", version: "6.0.0"
```

## 3. Tool System (the heart)

### Tool Registry (`src/lib/registry.ts`)

Explicit imports of all 22 manifests. The `TOOLS` array is the single source of truth for what tools exist.

```typescript
import { manifest as jsonFormatter } from "@/tools/developer/json-formatter/manifest";
// ... 21 more imports
export const TOOLS: readonly ToolManifest[] = [jsonFormatter, /* ... */]
  .filter(Boolean)
  .sort((a, b) => a.name.localeCompare(b.name));
```

### ToolManifest Type (`src/lib/tool.ts`)

```typescript
export interface ToolManifest {
  id: string;              // kebab-case, used in URL: /tools/<id>
  name: string;            // Display name
  description: string;     // One-line description
  category: ToolCategory;  // One of 13 categories
  keywords: string[];      // Search keywords
  icon: string;            // Lucide icon name
  requiresNetwork?: boolean;
  component?: () => Promise<{ default: ComponentType }>;  // Lazy-loaded UI
  seo?: { title?: string; faq?: { q: string; a: string }[] };
  status?: "planned" | "in-progress" | "done";
}
```

### Pure Logic Layer

Each tool has `logic.ts` — pure TypeScript, no DOM access, no React. Safe to unit-test and run in a Web Worker. Example from `json-formatter/logic.ts`:

```typescript
export function formatJson(input: string, opts: FormatOptions): FormatResult {
  // Parse → sort (optional) → JSON.stringify with indent
  // Returns { ok: true, output } or { ok: false, error, line?, column? }
}
```

### Unit Tests

Each tool has `logic.test.ts` with 15-43 tests covering valid, invalid, edge, and large inputs. 528 total tests across 24 files.

### Tool UI Layer

Each tool has `ui.tsx` — a React client component (`"use client"`) using shadcn/ui components. Lazy-loaded via `React.lazy` + `Suspense` in `tool-page-client.tsx`:

```tsx
<Suspense fallback={<ToolSkeleton />}>
  <ToolUI />
</Suspense>
```

`ToolSkeleton` (src/components/tool-skeleton.tsx) reserves dimensions (min-h-[80px] + min-h-[320px] + min-h-[40px]) to prevent CLS.

### How `/tools/[id]` Works

1. `page.tsx` (server): `generateStaticParams()` returns all 22 tool IDs from `TOOLS`. `generateMetadata()` sets SEO title/description.
2. `tool-page-client.tsx` (client): breadcrumb → tool header (icon + badge + privacy badge) → trust badges → lazy-loaded `<ToolUI />` → About/How-to/FAQ → related tools.
3. `TOOL_UI_LOADERS` map in `tool-page-client.tsx` maps tool IDs to lazy import functions.

### Walk-through: JSON Formatter end-to-end

1. **Registry**: `src/lib/registry.ts` imports `manifest as jsonFormatter` from `@/tools/developer/json-formatter/manifest`
2. **Manifest**: `src/tools/developer/json-formatter/manifest.ts` declares id="json-formatter", category="developer", keywords, SEO FAQ
3. **Logic**: `src/tools/developer/json-formatter/logic.ts` exports `formatJson()`, `minifyJson()`, `validateJson()` — pure functions
4. **Tests**: `src/tools/developer/json-formatter/logic.test.ts` — 28 tests (valid, invalid, edge, large input)
5. **UI**: `src/tools/developer/json-formatter/ui.tsx` — React component with Textarea input, Select indent, Switch sort-keys, Button format/minify/validate, CopyButton + DownloadButton output
6. **Built page**: `out/tools/json-formatter/index.html` — static HTML with SEO content, lazy-loads UI chunk on hydration

## 4. Category System

### Active Categories (v6.6)

Only categories with ≥1 tool get a route. Derived from the registry:

```typescript
// In category/[category]/page.tsx:
export function generateStaticParams() {
  return ALL_CATEGORIES.filter((c) => TOOLS.some((t) => t.category === c)).map(...)
}
```

4 active categories: developer (5), text (12), calculators (3), image (2). 9 empty categories (pdf, audio-video, seo, etc.) have NO routes — real 404.

This feeds: sidebar nav, command palette, /tools filter chips, home category grid, sitemap.

Self-healing: adding a tool with category "pdf" automatically creates `/category/pdf`.

## 5. Layout + Navigation

### Root Layout (`src/app/layout.tsx`)

Provider stack (inside → out):
```
<html className="dark" suppressHydrationWarning>
  <body>
    <MotionProvider>          ← MotionConfig reducedMotion="user"
      <ThemeProvider>         ← Mount-gated next-themes (fixes #418)
        {children}
        <Toaster />           ← Sonner toast notifications
        <PWAInstallPrompt />  ← SW registration + install prompt
        <CommandPaletteMount /> ← ⌘K palette
      </ThemeProvider>
    </MotionProvider>
```

**Why ThemeProvider is mount-gated** (v6.3 fix): next-themes 0.4.6's `useState` initializer reads `localStorage` on the client but returns `undefined` on the server. This causes the `<script>` element's content to differ between SSG and client → React #418 hydration error. Fix: render children without the provider on SSG + first client render, then mount after `useEffect`. The next-themes inline script still sets `dark` class before hydration (no FOUC).

**Why `className="dark"` on `<html>`**: SSG HTML must match the client's post-script state. The next-themes script adds `class="dark"` + `style="color-scheme:dark"` before React hydrates — having it in SSG too prevents mismatch.

### Sidebar (`src/components/navigation/sidebar.tsx`)

- **Desktop**: Fixed left rail (260px, collapsible to 68px). `motion.aside` with `animate={{ width }}`. The spacer `motion.div` has `initial={{ width: 260 }}` — this is the CLS fix (v6.4: without `initial`, SSG rendered width:0, then animated to 260 → 0.17 CLS).
- **Mobile**: MobileHeader bar (48px fixed top) + drawer (AnimatePresence slide-in from left, `top-12` to sit below header bar).
- **Nav items**: Derived from registry — only active categories shown.

### MobileHeader (`src/components/navigation/mobile-header.tsx`)

v6.6 compact fixed top bar (h-12, md:hidden). Replaces the old floating hamburger. Fills the dead strip that padding-tweaks couldn't eliminate. Content starts at `pt-12` on mobile.

## 6. Design System

### CSS Tokens (`src/app/globals.css`)

Light theme (`:root`):
- `--primary: #b5562d` (darkened from template's #c96442 for AA contrast — v6.4)
- `--muted-foreground: #6e6c66` (darkened from #83827d for AA — v6.4)
- `--background: #faf9f5` (warm cream)
- `--ring: #b5562d`

Dark theme (`.dark`):
- `--primary: #d97757` (copper accent)
- `--background: #262624` (near-black indigo)
- `--muted-foreground: #b7b5a9`

### A11y Overrides (vs template)

- Button default variant: `dark:!bg-[#bb5435]` — dark theme primary #d97757 has only 3.12 contrast with white text; #bb5435 gives 4.85 (AA pass).
- Sidebar active state: `bg-primary/15 text-foreground` (not `text-primary` — contrast too low).
- Badges: `text-emerald-700` / `text-amber-800` in light (not 600 — contrast fails on pastel backgrounds).

### HeroGeometric (`src/components/ui/shape-landing-hero.tsx`)

v6.5: Added `subtitle` prop to replace hardcoded template placeholder. Home page passes real UnQTools copy.

## 7. PWA / Offline

- **Manifest** (`public/manifest.json`): name="UnQTools", theme_color=#d97757, standalone display
- **Service Worker** (`public/sw.js`): cache-first for assets, network-first for navigation with offline fallback to `/`. Push notification support (title="UnQTools").
- **Registration**: `src/components/pwa-install.tsx` registers `/sw.js` on load + shows install prompt.

## 8. Test Infrastructure

### Unit Tests (Vitest)
- 528 tests across 24 files (22 tool logic + 2 lib)
- Pure functions, no DOM, fast (4s total)
- Coverage target: core logic ≥ 90%

### Routes Generator (`tests/gen-routes.mjs`)
Scans `out/` directory for HTML files → `tests/routes.json`. Single source of truth for all e2e suites. Run after `npm run build`.

### Smoke E2E (`tests/smoke.e2e.ts`) — MUST-PASS
33 tests covering:
1. Every route returns 200 + has H1 + no console errors
2. No React hydration errors (#418/#423/#425) — strict, NOT filtered
3. No template placeholder copy (16 phrases: "Crafting exceptional...", "UnQWebTemplate", fake names, etc.)
4. Mobile top-space guard (4 routes × 390px, content < 90px from top, home exception 350px)
5. Unknown route returns 404

### Tool E2E (`tests/tool.e2e.ts`) — MUST-PASS
22 tests: load page → input sample → run → assert output. Strict fixtures:
- EMI: asserts `₹10,500` visible in result card
- Mortgage: asserts `$2,237` visible

### CLS E2E (`tests/cls.e2e.ts`) — MUST-PASS (promoted v6.4)
5 pages: home, /tools, json-formatter, diff-checker, color-picker. Asserts CLS < 0.1.

### Axe E2E (`tests/axe.e2e.ts`) — INFORMATIONAL (continue-on-error)
15 routes × light + dark. Zero critical/serious required. Routes derived from routes.json.

### Overflow + Reduced-Motion — INFORMATIONAL

### CI Job Split (`.github/workflows/ci.yml`)
- **`build` job (must-pass)**: lint → unit → build → gen-routes → Playwright install → smoke → tool e2e → CLS. Blocks deploy.
- **`informational-gates` job (continue-on-error)**: axe → overflow → reduced-motion. Reports but doesn't block.

## 9. CI/CD

### Workflow (`.github/workflows/ci.yml`)

Triggers: push to main, v6.x branches, PRs to main.

```
build job (ubuntu-latest, 20min timeout):
  checkout → setup Node 24 → npm ci → lint → test → build → gen-routes
  → playwright install → smoke → tool e2e → CLS → upload artifacts

informational-gates job (continue-on-error):
  checkout → setup Node → npm ci → build → gen-routes → playwright install
  → axe → overflow → reduced-motion

deploy job (main only):
  Cloudflare Pages auto-deploys (no explicit step — wrangler.toml config)
```

### Reading CI Results via API
```bash
curl -s -H "Authorization: Bearer $PAT" \
  "https://api.github.com/repos/Sandeepgaddam5432/unqtools/actions/runs?per_page=1"
# Take run_id → /jobs endpoint for per-job conclusions
```

## 10. How-To Recipes

### Add a New Tool
1. Create `src/tools/<category>/<tool-id>/` with 4 files:
   - `manifest.ts`: export `manifest: ToolManifest` with id, name, category, keywords
   - `logic.ts`: pure TS functions (no DOM, no React)
   - `logic.test.ts`: Vitest tests for valid/invalid/edge cases
   - `ui.tsx`: React client component using shadcn/ui
2. Add import + entry in `src/lib/registry.ts`
3. Add lazy loader in `src/app/tools/[id]/tool-page-client.tsx` `TOOL_UI_LOADERS`
4. Done — routing, search, homepage, category page all pick it up automatically

### Add a New Category
1. Add to `ToolCategory` type + `ALL_CATEGORIES` + `CATEGORY_LABELS` in `src/lib/tool.ts`
2. Add a tool with that category — the category page auto-appears

### Run All Gates Locally
```bash
npm run build && node tests/gen-routes.mjs
npx playwright test tests/smoke.e2e.ts    # must-pass
npx playwright test tests/tool.e2e.ts      # must-pass
npx playwright test tests/cls.e2e.ts       # must-pass
npx playwright test tests/axe.e2e.ts       # informational
```

### Debug a Hydration Error
1. Run `npx next dev` (readable errors, not minified #418)
2. Open the failing route in a browser with DevTools console
3. The error will name the component + the mismatching attribute
4. Common causes: `localStorage`/`window` in render, `Date.now()`, `Math.random()`, next-themes `useState` initializer
5. Fix: move browser-only reads into `useEffect`, or mount-gate the component

## 11. Known Debt

- **JS bundle**: ~280-302 KB gz per route (target was 250 KB). Dominated by Framer Motion + React 19 + Radix. Not actionable without removing template effects.
- **Dead code**: `src/lib/dom-utils.ts`, `src/lib/runWorker.ts`, `src/lib/theme.ts` — 0 importers. Safe to delete.
- **62 unused UI components**: Of 90 in `src/components/ui/`, only 28 are imported by production code. See `docs/CLEANUP-INVENTORY.md` for the full list.
- **25 unused npm dependencies**: @dnd-kit, @mdxeditor, three, tweakpane, etc. See inventory.
- **A11y bugs in 3 tool UIs**: `add-line-breaks`, `image-compressor`, `csv-to-markdown` use native `<select>` and `<input>` without aria-labels. CI axe catches these.
- **`sandeep.png`** in public/ — unused on production pages (was a template About page asset).
- **`_headers` file** — empty/unused Cloudflare Pages headers config.
