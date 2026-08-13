# Ponytail-Audit — unqtools (full repo)

> Run: 2026-08-13 against `main` HEAD `add39ca` (post v18.7 PDF-100x merge).
> Scope: entire repo excluding the 565 "stub" tools (tracked separately in
> STATE.md as blueprint-compliance backlog, NOT ponytail debt).
> Rules: `delete` / `stdlib` / `native` / `yagni` / `shrink`. One line per finding.

## Findings (ranked biggest cut first)

### Easy wins — deletions

```
delete: public/sandeep.png (1.6 MB). rg "sandeep\.png" → 0 hits in src/. Replacement: nothing. [public/sandeep.png]
delete: src/hooks/use-mobile.ts (useIsMobile). 0 callers. Replacement: nothing. [src/hooks/use-mobile.ts:1-19]
delete: src/hooks/use-toast.ts (194 LOC) + src/components/ui/toast.tsx (129 LOC). Sonner is the only toaster (layout.tsx + 250 tool UIs). Replacement: rm + drop @radix-ui/react-toast dep. [src/hooks/use-toast.ts, src/components/ui/toast.tsx]
delete: src/components/ui/sheet.tsx (139 LOC). 0 imports. Replacement: nothing + drop @radix-ui/react-dialog (sheet uses Radix Dialog; only sheet.tsx imports it). [src/components/ui/sheet.tsx]
delete: src/components/ui/avatar.tsx (53 LOC). 0 imports. Replacement: nothing + drop @radix-ui/react-avatar. [src/components/ui/avatar.tsx]
delete: src/components/ui/separator.tsx (24 LOC). 0 imports. Replacement: nothing + drop @radix-ui/react-separator. [src/components/ui/separator.tsx]
delete: PWAInstallSection in pwa-install.tsx (lines 162-280, ~119 LOC). Only PWAInstallPrompt used by layout.tsx. Replacement: nothing. [src/components/pwa-install.tsx:162-280]
delete: dead exports in src/tools/file/_shared-ebook-converter.ts (~108 LOC). formatLog, summarizeResult, paginateText, generateXpsXml, ConverterType, ConvertOptions, ConvertResult never imported — each consuming tool rolls its own local copy. Replacement: nothing. [src/tools/file/_shared-ebook-converter.ts]
delete: extractTextFromAzw3 wrapper (4 LOC). 3-line wrapper that just returns extractTextFromMobi(file). Called once. Replacement: azw3-to-pdf-converter/ui.tsx imports extractTextFromMobi directly. [src/tools/file/_shared-ebook-converter.ts:108-111]
delete: groupCatalog() in tool-groups.ts (6 LOC). 0 callers — category-page-client uses groupTools directly. Replacement: nothing. [src/lib/tool-groups.ts:171-176]
delete: registry helpers byCategory, byId, countByCategory (~15 LOC). 0 external importers; tools-page-client uses countByCategory from catalog.ts not registry.ts. Replacement: nothing. [src/lib/registry.ts:3357-3371]
delete: tests/no-archive-imports.test.ts (35 LOC). Guards against archive/ imports, but archive/ was deleted in v17.68. Testing an impossible path. Replacement: nothing. [tests/no-archive-imports.test.ts]
delete: tests/capture-screenshots.mjs (96 LOC). Zero callers; hardcoded dev path /home/z/.cache/ms-playwright/... only works on one machine. Replacement: npx playwright screenshot if needed. [tests/capture-screenshots.mjs]
delete: tests/design-system.test.ts "Design system search integration" block (~19 LOC). Duplicate of search.test.ts. Keep only the unique "Category labels completeness" describe block. Replacement: nothing. [tests/design-system.test.ts:23-41]
delete: dead imports in tests/overflow.e2e.ts. readFileSync + routes parsed from routes.json but never used. Replacement: nothing. [tests/overflow.e2e.ts:2,4]
delete: docs/CODEBASE.md (372 LOC, frozen at v6.6 with "22 tools" — real: 1,679). References deleted files (dom-utils.ts, runWorker.ts, theme.ts, tailwind.config.ts). Misleads new readers. Replacement: regenerate from current tree, or remove. [docs/CODEBASE.md]
delete: docs/CLEANUP-INVENTORY.md (165 LOC, v6.7). Every item was executed in v17.68. Historical-only. Replacement: nothing. [docs/CLEANUP-INVENTORY.md]
delete: vitest coverage block in vitest.config.ts (5 LOC) + @vitest/coverage-v8 devDep. No script runs vitest --coverage; CI doesn't pass --coverage. Replacement: nothing. [vitest.config.ts:13-17, package.json:93]
delete: X-UA-Compatible: IE=edge header in public/_headers:7. browserslist says "not ie <= 99". Replacement: nothing. [public/_headers:7]
delete: stale title in docs/TOOLS-INDEX.md "All 1,704 Tools" (actual: 1,679). Hardcoded in generator. Replacement: scripts/generate-tools-index.mjs:133 → `# UnQTools — Complete Tool Catalog (${tools.length} Tools)`. [scripts/generate-tools-index.mjs:133]
```

### Unused npm dependencies (verified 0 src imports via `rg -l "from ['\"]<dep>['\"]" src/ tests/ scripts/`)

```
delete: 11 unused Radix subpackages (@radix-ui/react-{accordion,alert-dialog,checkbox,dropdown-menu,navigation-menu,popover,progress,radio-group,scroll-area,tooltip,toast}). ui/*.tsx components were never created or were archived. [package.json:21-39]
delete: radix-ui (umbrella package). Never imported — codebase uses individual @radix-ui/react-* subpackages. [package.json:71]
delete: next-pwa. Not wired in next.config.ts; PWA uses hand-rolled manifest.json + sw.js registered via navigator.serviceWorker.register. [package.json:68]
delete: motion (umbrella package). Codebase uses framer-motion (4 files), motion has 0 imports. [package.json:66]
delete: framer-motion (after migrating 3 files to .unq-animate-fade-in-up CSS — see "shrink" section). [package.json:56]
delete: marked. 0 imports. [package.json:65]
delete: react-icons. 0 imports (codebase uses lucide-react exclusively). [package.json:76]
delete: recharts. 0 imports. [package.json:78]
delete: cobe. 0 imports. [package.json:51]
delete: embla-carousel-react. 0 imports. [package.json:53]
delete: input-otp. 0 imports. [package.json:57]
delete: react-day-picker. 0 imports. [package.json:73]
delete: react-resizable-panels. 0 imports. [package.json:77]
delete: react-hook-form. 0 imports. [package.json:75]
delete: vaul. 0 imports (was for archived Drawer). [package.json:84]
delete: tailwindcss-animate. Replaced by tw-animate-css (which IS used in globals.css). [package.json:82]
delete: figlet. 0 imports (only appears as substring in comment text; ascii-art tools hand-roll glyphs). [package.json:55]
delete: sharp. Node image lib — static site, never imported. [package.json:79]
delete: lighthouse devDep. 0 imports. [package.json:97]
delete: @types/figlet devDep (cascade of figlet). [package.json:90]
delete: bun-types devDep. Project uses Node, not Bun. [package.json:94]
delete: eslint + eslint-config-next devDeps (conditional — see "shrink" section). lint script runs in CI but catches nothing (30+ rules disabled). Either delete lint script + CI step + these deps, OR re-enable rules. [package.json:95-96, .github/workflows/ci.yml:41-42]
```

### Shrink (same logic, fewer lines)

```
native: framer-motion in 3 files (tool-page-client.tsx, tools-page-client.tsx, category-page-client.tsx) does nothing but opacity 0→1 + y 20→0 fade-in-up. globals.css:152-179 already ships .unq-animate-fade-in-up (with prefers-reduced-motion guard), explicitly documented as "replaces framer-motion". Footer + home-page already migrated. Replacement: <div className="unq-animate-fade-in-up">. Drops framer-motion + motion deps + ~30 LOC of MO_* variant constants. [src/app/tools/[id]/tool-page-client.tsx:4, src/app/tools/tools-page-client.tsx:5, src/app/category/[category]/category-page-client.tsx:3]
yagni: CATEGORY_ICONS map duplicated in 6 files (sidebar, command-palette, tool-page-client, tools-page-client, home-page-client, category-page-client). Each ~13-15 LOC of identical content. Replacement: single export from lib/tool.ts (which already exports CATEGORY_LABELS). [src/components/navigation/sidebar.tsx:40, src/components/command-palette.tsx:45, + 4 more] — ~65 LOC
shrink: tests/tool.e2e.ts — 22 PDF tools repeat the same `assert: async (page) => { await expect(page.getByText(/Drop a PDF/i).first()).toBeVisible(...) }`. Replacement: `const assertDropPdf = (page) => expect(page.getByText(/Drop a PDF/i).first()).toBeVisible({ timeout: 5000 });` then `{ id: "split-pdf", assert: assertDropPdf }`. ~80 LOC saved. [tests/tool.e2e.ts:209-356]
shrink: sampleTool factory duplicated in tests/design-system.test.ts + tests/search.test.ts. Replacement: extract to tests/_helpers.ts. [tests/design-system.test.ts:11-21, tests/search.test.ts:9-19]
shrink: findManifests + loadManifest duplicated in scripts/regenerate-catalog.mjs and scripts/generate-tools-index.mjs (~50 LOC, identical). Replacement: extract to scripts/_manifests.mjs. [scripts/regenerate-catalog.mjs:23-47, scripts/generate-tools-index.mjs:54-78]
shrink: base64/logic.ts duplicates byte→binary loop in encodeBase64 (L13-15) and encodeBytes (L50-52). Replacement: `const bin = Array.from(bytes, b => String.fromCharCode(b)).join("");` 1-line helper. [src/tools/developer/base64/logic.ts:13-15, 50-52] — ~6 LOC
shrink: use-tool-history.ts — useFavorites and useRecentTools are 40 LOC each of near-identical structure. Replacement: generic useStoredIds({ key, load, mutate, clear }) helper (~50 LOC total vs 88). Borderline. [src/hooks/use-tool-history.ts:31-88]
```

### Native-replacement opportunities

```
native: <dialog> element is well-supported in all browserslist targets. Could replace Radix Dialog-based dialog.tsx and sheet.tsx (sheet.tsx is unused — see above). Replacement: native <dialog> + ::backdrop. Borderline — Radix gives focus trap + a11y for free, keep if a11y strict. [src/components/ui/dialog.tsx]
native: Intl.NumberFormat({ notation: "compact" }) can replace any hand-rolled formatBytes-like helpers in non-PDF tool logic.ts files (PDF _shared/download.ts is correct, others may not be). Run: rg "function formatBytes" src/tools/ — out of scope to verify each. [various]
native: Intl.DateTimeFormat replaces date-fns for one-off format calls. Run: rg "from ['\"]date-fns['\"]" src/ to verify if any tool uses date-fns for a single format() call. [various]
```

### ESLint config (conditional)

```
shrink: eslint.config.mjs disables 30+ rules including @typescript-eslint/no-explicit-any, no-unused-vars, no-console, no-debugger, react-hooks/exhaustive-deps, prefer-const, no-unreachable. lint script runs in CI but catches nothing. Borderline — owner may consider this intentional ship-fast (matches typescript.ignoreBuildErrors), but unlike that one, this isn't called out in AGENTS.md. Replacement: either delete lint script + CI step + eslint deps, or re-enable rules. [eslint.config.mjs:9-48]
```

## Checked but found clean

- `src/lib/search.ts` — subsequence scorer + INTENT_SYNONYMS table; no stdlib replacement (no `String.fuzzyMatch`).
- `src/lib/tool-history.ts` — `readIds`/`writeIds`/`recordRecent` dedupe-and-cap; no Array.prototype equivalent; memoryStorage fallback is mildly defensive but tested.
- `src/lib/tool-groups.ts` regex matchers — content-driven, no stdlib equivalent.
- `src/lib/counts.ts` — precomputed constants actually consumed by footer/sidebar/home-page-client.
- `next.config.ts`, `tsconfig.json`, `postcss.config.mjs`, `wrangler.toml`, `components.json`, `playwright.config.ts` — minimal, no fat.
- `.github/workflows/ci.yml` parallel-job split is justified (smoke/cls/axe/overflow/motion/tool-e2e are independent).
- `Update-lock-file.yml` is necessary (repo is API-maintained).
- `scripts/audit-tools.mjs` and `scripts/auto-verify-tools.mjs` — referenced from README/STATE, runnable.
- `tests/static-server.mjs` — dependency-free, intentional.
- `src/tools/_shared/index.tsx` (CopyButton/DownloadButton/ShareButton/ClearButton/RunButton/ErrorBanner/EmptyState/ActionBar) — 250-560 callers each, no yagni.
- `src/tools/pdf/_shared/{page-ranges,download,text-extract}.ts` — parsePageRanges used across PDF tools, downloadBytes used by 79 files, text-extract is a real PDF parser (not stdlib-replaceable).
- `tool-skeleton.tsx`, `theme-provider.tsx` (documented hydration fix), `command-palette-lazy.tsx` (Next.js dynamic ssr:false wrapper), `mobile-header.tsx`, `footer-section.tsx`, `command-palette.tsx` — all single-caller but justified.
- `public/_redirects` (25 PDF-tool redirects) — required for SEO after the v18 PDF Page Manager merge.
- `public/robots.txt`, `public/sitemap.xml`, `public/manifest.json`, `public/sw.js`, `public/google89114e8366980582.html`, `public/logo.svg` — all live and referenced.
- `pdf-page-manager/logic.ts` — dense, well-factored, 7 operations sharing parsePageRanges.
- `json-formatter/logic.ts` — uses native JSON.parse/stringify; the V8 SyntaxError position extraction is necessary (no stdlib equivalent).

## Needs deeper look (couldn't fully verify without `npm ci`)

- `next.config.ts:20` `experimental.optimisticClientCache: true` — may be a no-op or unsupported key in Next.js 16. Worth a `next.config` typecheck after `npm ci`.
- `tests/tool-loader-imports.test.ts:23` asserts `imports.length > 1000` — arbitrary threshold; works today (1,679 tools) but couples test to a magic number. Brittle, not dead.
- `home-page-client.tsx` `allCategoryCards` (13 entries × ~7 lines) duplicates title/icon that could come from centralized CATEGORY_LABELS/CATEGORY_ICONS maps. Only description is unique. Could save ~40 LOC but the inlining is intentional (per the comment "Home page intentionally does NOT import the 1700-item tool catalog"). Borderline.
- `src/tools/developer/css-gradient-generator/logic.ts` is misnamed — it's actually a box-shadow generator. `generateCSS` outputs `background-image:` with box-shadow syntax (broken CSS). Not ponytail debt — separate bug ticket.
- Non-PDF tools may have hand-rolled `formatBytes` equivalents. Out of scope to verify each. Run: `rg "function formatBytes" src/tools/`.

## Final tally

```
net: -2023 lines, -34 deps possible.
```

Breakdown:
- Deletions (files/code): ~1,200 LOC
- Unused deps: 34 (27 runtime + 7 dev — including 11 Radix, framer-motion + motion, next-pwa, marked, react-icons, recharts, cobe, embla, input-otp, day-picker, resizable-panels, hook-form, vaul, tailwindcss-animate, figlet, sharp, lighthouse, @types/figlet, bun-types, @vitest/coverage-v8, eslint+config if rules stay off)
- Shrinks (duplicates → helpers): ~640 LOC
- Native replacements: 2 deps (framer-motion + motion) counted above; rest are tool-internal

## Recommended execution order

1. **First batch — pure deletes (no risk):** `sandeep.png`, `use-mobile.ts`, `use-toast.ts` + `toast.tsx`, `sheet.tsx`, `avatar.tsx`, `separator.tsx`, `tests/no-archive-imports.test.ts`, `tests/capture-screenshots.mjs`, `docs/CODEBASE.md`, `docs/CLEANUP-INVENTORY.md`, `vitest.config.ts` coverage block, `public/_headers` X-UA-Compatible line. Commit: `chore(v18.8): ponytail batch 1 — pure deletes (-1.7 MB, -824 LOC)`.
2. **Second batch — dep cleanup:** edit `package.json` to drop 27 unused runtime deps + 7 unused devDeps. Run `npm ci` (CI auto-regenerates lock). Commit: `chore(v18.8): ponytail batch 2 — drop 34 unused deps`.
3. **Third batch — framer-motion migration:** migrate 3 files to `.unq-animate-fade-in-up`. Drop `framer-motion` + `motion` deps. Commit: `perf(v18.8): ponytail batch 3 — drop framer-motion, use CSS animations`.
4. **Fourth batch — dedup helpers:** hoist `CATEGORY_ICONS` to `lib/tool.ts`, extract `tests/_helpers.ts` + `scripts/_manifests.mjs`, refactor `tests/tool.e2e.ts` PDF asserts, dedup `base64/logic.ts` byte→binary loop. Commit: `refactor(v18.8): ponytail batch 4 — dedup helpers (-200 LOC)`.
5. **Fifth batch — dead ebook exports:** remove unused exports from `src/tools/file/_shared-ebook-converter.ts`, inline `extractTextFromAzw3` caller. Commit: `chore(v18.8): ponytail batch 5 — dead ebook exports`.

Each batch is independently shippable. Run `npm ci` + `npm test` + `npm run build` (CI) after each batch.

---

`Lean already. Ship.` — said no one about this repo. But after these 5 batches: yes.
