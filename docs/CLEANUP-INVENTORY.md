# UnQTools — Cleanup Inventory (v6.7 Audit, July 2025)

> NO deletions this session. Owner approves the list; v6.8 executes.

## Summary

| Category | Items | Est. Files Removed | Est. KB Saved (gz) |
|----------|-------|-------------------|-------------------|
| Archived showcase pages | 17 | 0 (already in archive/) | 0 |
| Unused UI components | 62 | 62 | ~50 KB (tree-shaken, minimal) |
| Unused lib files | 3 | 3 | <1 KB |
| Unused npm dependencies | 25 | 0 (package.json only) | ~200 KB install |
| Unused public assets | 3 | 2-3 | ~500 KB (sandeep.png) |
| **TOTAL** | **110** | **~68** | **~250 KB** |

## 1. Archived Showcase Pages (already moved, confirm no imports)

| Path | Class | Reachable? | Size | Recommendation | Evidence |
|------|-------|-----------|------|----------------|----------|
| archive/showcase-pages/about/ | Archived page | No | ~20 KB | KEEP (already archived) | grep -rl "archive/showcase" src/ = 0 hits |
| archive/showcase-pages/animations/ | Archived page | No | ~15 KB | KEEP | 0 imports |
| archive/showcase-pages/blocks/ | Archived page | No | ~12 KB | KEEP | 0 imports |
| archive/showcase-pages/calendar-clock/ | Archived page | No | ~18 KB | KEEP | 0 imports |
| archive/showcase-pages/cards/ | Archived page | No | ~15 KB | KEEP | 0 imports |
| archive/showcase-pages/components/ | Archived page | No | ~25 KB | KEEP | 0 imports |
| archive/showcase-pages/dashboard/ | Archived page | No | ~15 KB | KEEP | 0 imports |
| archive/showcase-pages/data-display/ | Archived page | No | ~18 KB | KEEP | 0 imports |
| archive/showcase-pages/effects/ | Archived page | No | ~15 KB | KEEP | 0 imports |
| archive/showcase-pages/explorer/ | Archived page | No | ~30 KB | KEEP | 0 imports |
| archive/showcase-pages/feedback/ | Archived page | No | ~15 KB | KEEP | 0 imports |
| archive/showcase-pages/forms/ | Archived page | No | ~15 KB | KEEP | 0 imports |
| archive/showcase-pages/loaders/ | Archived page | No | ~12 KB | KEEP | 0 imports |
| archive/showcase-pages/marketing/ | Archived page | No | ~20 KB | KEEP | 0 imports |
| archive/showcase-pages/navigation/ | Archived page | No | ~18 KB | KEEP | 0 imports |
| archive/showcase-pages/saas/ | Archived page | No | ~20 KB | KEEP | 0 imports |
| archive/showcase-pages/search/ | Archived page | No | ~15 KB | KEEP | 0 imports |

**Total**: 17 pages, ~298 KB. No production code imports from archive/. Safe.

## 2. Unused UI Components (62 of 90)

Evidence method: `grep -rl "from.*@/components/ui/<name>" src/app/ src/components/ src/tools/` = 0 hits AND no indirect imports via other ui components.

| Component | Used By | Recommendation | Notes |
|-----------|---------|----------------|-------|
| accordion | 0 | ARCHIVE | Template showcase component |
| action-search-bar | 0 | ARCHIVE | Template demo (we use cmdk Command instead) |
| ai-gen | 0 | ARCHIVE | Template AI demo (UI-only, no server) |
| alert-banner | 0 | ARCHIVE | Template demo |
| alert-dialog | 0 | ARCHIVE | Template showcase |
| alert | 0 | ARCHIVE | Template showcase |
| animated-beam | 0 | ARCHIVE | Magic UI effect (showcase only) |
| animated-grid-pattern | 0 | ARCHIVE | Magic UI effect |
| animated-list | 0 | ARCHIVE | Magic UI effect |
| api-playground | 0 | ARCHIVE | Template demo |
| aspect-ratio | 0 | ARCHIVE | Radix wrapper (unused) |
| basic-data-table | 0 | ARCHIVE | Template demo |
| blur-fade | 0 | ARCHIVE | Magic UI effect |
| border-beam | 0 | ARCHIVE | Magic UI effect |
| breadcrumb | 0 | ARCHIVE | Template nav (we use inline breadcrumb) |
| calendar | 0 | ARCHIVE | Template demo |
| carousel | 0 | ARCHIVE | Template demo |
| chart | 0 | ARCHIVE | Recharts wrapper (unused) |
| checkbox | 0 | ARCHIVE | shadcn component (unused) |
| collapsible | 0 | ARCHIVE | Radix wrapper |
| context-menu | 0 | ARCHIVE | Radix wrapper |
| cool-mode | 0 | ARCHIVE | Magic UI effect |
| cube-loader | 0 | ARCHIVE | Template loader |
| custom-toast | 0 | ARCHIVE | Template demo |
| dot-pattern | 0 | ARCHIVE | Magic UI effect |
| drawer | 0 | ARCHIVE | vaul wrapper |
| expandable-tabs | 0 | ARCHIVE | Template nav |
| flickering-grid | 0 | ARCHIVE | Magic UI effect |
| form | 0 | ARCHIVE | react-hook-form wrapper |
| glass-calendar | 0 | ARCHIVE | Template demo |
| glass-clock | 0 | ARCHIVE | Template demo |
| globe | 0 | ARCHIVE | Three.js globe (heavy dep) |
| grid-pattern | 0 | ARCHIVE | Magic UI effect |
| hover-card | 0 | ARCHIVE | Radix wrapper |
| hyper-text | 0 | ARCHIVE | Magic UI effect |
| input-otp | 0 | ARCHIVE | Template demo |
| mac-os-dock | 0 | ARCHIVE | Template demo |
| magic-card | 0 | ARCHIVE | Magic UI effect |
| marquee | 0 | ARCHIVE | Magic UI effect |
| menubar | 0 | ARCHIVE | Radix wrapper |
| meteors | 0 | ARCHIVE | Magic UI effect |
| navigation-menu | 0 | ARCHIVE | Radix wrapper |
| number-ticker | 0 | ARCHIVE | Magic UI effect |
| orbiting-circles | 0 | ARCHIVE | Magic UI effect |
| pagination | 0 | ARCHIVE | shadcn component |
| particles | 0 | ARCHIVE | Magic UI effect |
| popover | 0 | ARCHIVE | Radix wrapper |
| progress | 0 | ARCHIVE | Radix wrapper |
| radial-orbital-timeline | 0 | ARCHIVE | Template demo |
| radio-group | 0 | ARCHIVE | Radix wrapper |
| resizable | 0 | ARCHIVE | react-resizable-panels |
| ripple | 0 | ARCHIVE | Magic UI effect |
| scroll-area | 0 | ARCHIVE | Radix wrapper |
| scroll-based-velocity | 0 | ARCHIVE | Magic UI effect |
| shamayim-toggle-switch | 0 | ARCHIVE | Template demo |
| sidebar | 0 | ARCHIVE | shadcn sidebar (we use custom SidebarNav) |
| table | 0 | ARCHIVE | shadcn table |
| terminal | 0 | ARCHIVE | Template demo |
| timeline | 0 | ARCHIVE | Template demo |
| toaster | 0 | ARCHIVE | Template toast (we use Sonner) |
| toggle-group | 0 | ARCHIVE | Radix wrapper |
| word-rotate | 0 | ARCHIVE | Magic UI effect |

**Used components (28)**: animated-testimonials, avatar, badge, bento-grid, button, card, command, dialog, dropdown-menu, footer-section, glass-testimonial-swiper, input, label, particle-text-effect, select, separator, shape-landing-hero, sheet, skeleton, slider, sonner, stack-feature-section, switch, tabs, textarea, toast, toggle, tooltip.

## 3. Unused Lib Files

| Path | Importers | Recommendation | Evidence |
|------|-----------|----------------|----------|
| src/lib/dom-utils.ts | 0 | DELETE | `grep -rl "dom-utils" src/ tests/` = 0 |
| src/lib/runWorker.ts | 0 | DELETE | `grep -rl "runWorker" src/ tests/` = 0 |
| src/lib/theme.ts | 0 | DELETE | `grep -rl "theme" src/lib/` finds it but `grep -rl "@/lib/theme" src/ tests/` = 0 |

## 4. Unused npm Dependencies (depcheck)

| Dependency | Confidence | Recommendation | Notes |
|------------|-----------|----------------|-------|
| @dnd-kit/core | High | DELETE | Drag-and-drop, 0 imports |
| @dnd-kit/sortable | High | DELETE | 0 imports |
| @dnd-kit/utilities | High | DELETE | 0 imports |
| @hookform/resolvers | High | DELETE | 0 imports (form.tsx archived) |
| @mdxeditor/editor | High | DELETE | MDX editor, 0 imports |
| @radix-ui/react-aspect-ratio | High | DELETE | 0 imports |
| @radix-ui/react-collapsible | High | DELETE | 0 imports |
| @radix-ui/react-context-menu | High | DELETE | 0 imports |
| @radix-ui/react-hover-card | High | DELETE | 0 imports |
| @radix-ui/react-menubar | High | DELETE | 0 imports |
| @radix-ui/react-toggle | High | DELETE | 0 imports |
| @radix-ui/react-toggle-group | High | DELETE | 0 imports |
| @reactuses/core | High | DELETE | 0 imports |
| next-intl | High | DELETE | i18n, 0 imports |
| next-pwa | Medium | UNCERTAIN | May configure PWA via next.config — verify |
| react-markdown | High | DELETE | 0 imports |
| react-syntax-highlighter | High | DELETE | 0 imports |
| react-tooltip | High | DELETE | 0 imports (we use Radix tooltip) |
| tailwindcss-animate | Medium | UNCERTAIN | May be used via Tailwind config — verify |
| three | High | DELETE | Three.js, only used by archived globe component |
| tweakpane | High | DELETE | 0 imports |
| usehooks-ts | High | DELETE | 0 imports |
| uuid | High | DELETE | 0 imports |
| zod | High | DELETE | 0 imports |
| zustand | High | DELETE | 0 imports |

**Note**: `@tailwindcss/postcss` and `bun-types` are devDeps flagged by depcheck but are used implicitly (PostCSS pipeline + type defs). KEEP those.

## 5. Unused Public Assets

| Path | Referenced? | Recommendation | Evidence |
|------|------------|----------------|----------|
| public/sandeep.png | No | DELETE | `grep -rl "sandeep.png" src/ out/` = 0 hits |
| public/_headers | No (empty) | KEEP | Cloudflare Pages convention, harmless |
| public/robots.txt | No (in src/) | KEEP | Served at /robots.txt, referenced by crawlers |

## 6. Template Config Leftovers

| Item | Status | Recommendation |
|------|--------|----------------|
| `bun-types` in devDeps | Not used (we use Node) | DELETE |
| `.claude/skills/` directory | Template's UI skill | KEEP (harmless, gitignored from build) |
| `components.json` | shadcn/ui config | KEEP (needed if adding new shadcn components) |
