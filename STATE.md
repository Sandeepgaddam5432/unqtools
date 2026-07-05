# UnQTools — Build State

_Last updated: 2026-07-05 by GLM (z.ai sandbox) — v7.0 PDF batch-1 P0 + axe flake fix applied, ready for CI_

## Current phase

**v7.0 "PDF batch-1" — READY FOR CI** 🟢 ON `v7.0-pdf-batch1`

10 PDF tools shipped + 3 P0 investigation fixes + 1 axe flake fix applied.
Branch is ready for CI to run; once green, owner review + merge to `main`.

### Recent commits on `v7.0-pdf-batch1`

| Commit   | Description                                                                                |
| -------- | ------------------------------------------------------------------------------------------ |
| (pending)| fix: axe flake — bump waitForTimeout to 3000ms so /tools 32-card stagger animation completes before scan |
| 2ed6a1c  | fix: P0 batch — CI branch trigger + setKeywords split + images-to-pdf accept fix           |
| 9d04dc3  | docs: sync README + STATE + AGENTS with v7.0 PDF batch-1 reality                           |
| 2610cf6  | fix: tool-page-client.tsx — named motion constants, no double-brace (v7.0 batch-1h)        |
| 0ef206a  | feat(pdf): register 10 PDF UI loaders in tool-page-client.tsx (v7.0 batch-1g)              |
| b3c53bd  | feat(pdf): register 10 PDF tools in registry + e2e fixtures (v7.0 batch-1f)                |
| a29c314  | feat(pdf): pdf-watermark + pdf-metadata-editor (v7.0 batch-1e)                             |
| 828cf7d  | feat(pdf): images-to-pdf + pdf-page-numbers (v7.0 batch-1d)                                |
| 1a13ffb  | feat(pdf): extract-pdf-pages + reorder-pdf-pages (v7.0 batch-1c)                           |
| 7b3280a  | feat(pdf): rotate-pdf + delete-pdf-pages (v7.0 batch-1b)                                   |
| 6bf7ff0  | feat(pdf): merge-pdf + split-pdf — logic, tests, UI (v7.0 batch-1a)                        |
| 4cfb62c  | chore: regenerate lockfile for pdf-lib + auto-trigger lockfile workflow                    |
| e106501  | Add workflow to update package-lock.json automatically                                     |
| 23953e4  | feat(pdf): add pdf-lib dependency (v7.0 PDF batch-1 foundation)                            |

## v7.0 P0 fixes — applied this session ✅

A deep investigation of the v7.0 PDF batch-1 code surfaced 3 P0 issues
(real bugs that would ship to users on merge). All three fixed in one commit:

### P0-1 (C1): CI branch trigger ✅

**Problem:** `.github/workflows/ci.yml` line 5 did NOT include `v7.0-pdf-batch1`
in the `push.branches` list. Result: pushes to the v7.0 branch never triggered
CI — the 8 PDF tool commits (`6bf7ff0` → `2610cf6`) were never auto-verified.
**Fix:** added `v6.9-all-categories` (was also missing — current main is on
v6.9 and never had auto-CI) and `v7.0-pdf-batch1` to the branches list.

### P0-2 (C2): pdf-metadata-editor keywords never split ✅

**Problem:** `src/tools/pdf/pdf-metadata-editor/logic.ts` line 50 wrapped the
user's comma-separated keywords string as a single-element array:
`doc.setKeywords([metadata.keywords])`. pdf-lib's `setKeywords` expects a
`string[]` (one keyword per element), so typing `"kw1, kw2"` wrote ONE keyword
with the literal value `"kw1, kw2"` instead of two separate keywords. The
existing unit test passed only because it never asserted on the `keywords`
value after round-trip — a real blind spot.
**Fix:**
```ts
const keywords = metadata.keywords
  .split(",")
  .map((k) => k.trim())
  .filter(Boolean);
doc.setKeywords(keywords);
```
+ added 1 new test ("splits a comma-separated keywords string into individual
keywords") that asserts the round-trip with messy input
`"  one, two , , three  "` → `"one two three"` (pdf-lib joins with spaces
on read-back). Also hardened the existing "writes all fields and reads them
back" test with a keywords assertion.

### P0-3 (C3): images-to-pdf advertised WebP + GIF but couldn't process them ✅

**Problem:** the file input had `accept="image/jpeg,image/png,image/webp,image/gif"`
and the dropzone hint said "JPEG, PNG, WebP, GIF — one page per image". But
pdf-lib only supports PNG and JPEG. WebP/GIF uploads fell through to
`embedJpg` and failed with a misleading error ("ensure it is a valid JPEG or
PNG"). The manifest's SEO description and FAQ had the same wrong claim.
**Fix:**
- `ui.tsx`: `accept="image/jpeg,image/png"`, hint → "JPEG or PNG — one page per image"
- `manifest.ts`: description → "Convert JPG or PNG images…", SEO title → "JPG, PNG to PDF Converter", FAQ answer → "JPEG and PNG. For other formats like WebP or GIF, convert them to PNG first…"

### Verification

| Gate | Result |
|------|--------|
| lint | ✅ 0 errors |
| unit tests | ✅ 620/620 (was 619 — +1 new keyword-split test) |
| build | ✅ 49 pages, no errors |
| git diff stat | 6 files, +37 / -7 lines |

### What's NOT in this P0 batch (deferred to batch-2)

The investigation found 7+ more issues (H1–H3, M1–M5, L1–L9) — all deferred
per owner-approved plan to keep this branch focused. They will be tackled in
batch-2 (a11y radiogroup fixes + axe slice cap + privacy-clean dates) and
batch-3 (pdf-lib shared chunk + e2e depth). See investigation report in
session log for full details.

## v7.0 axe flake fix — applied after first CI run ✅

### Problem discovered by CI

After the P0 commit (`2ed6a1c`) pushed, CI ran on `v7.0-pdf-batch1` for the
first time (C1 fix enabled this). Two runs triggered on the same commit:

| Run    | Event         | Conclusion | Notes                                  |
| ------ | ------------- | ---------- | -------------------------------------- |
| 1      | push          | ✅ success | axe flaked on /tools, passed on retry  |
| 2      | pull_request  | ❌ failure | same flake, failed both attempts       |

### Root cause (verified locally)

The `/tools` page renders 32 tool cards (was 22 pre-v7.0) with Framer Motion
stagger entrance animations:

```tsx
<motion.div variants={staggerContainer} initial="hidden" whileInView="visible">
  {filteredTools.map((tool) => <motion.div variants={staggerItem}>...
```

Each card animates `opacity: 0 → 1` with ~50ms stagger + ~600ms duration.
With 32 cards, the last card finishes animating around **2.2s** after page
load. But `tests/axe.e2e.ts` only waited **1.3s** (1000ms + 300ms) before
running axe — so axe caught cards mid-animation.

When axe catches a card at ~86.6% opacity, the effective color computes to
`#7f7d77` (muted-foreground `#6e6c66` blended with cream bg `#faf9f5` at
86.6/13.4 ratio). This gives **3.91:1 contrast** instead of the full-opacity
4.98:1, failing the WCAG 4.5:1 threshold for small text. 58 such violations
were reported on `/tools` in both light and dark themes.

**This is a test infrastructure problem, not a code bug.** The v7.0 code is
a11y-clean at full opacity — every muted-foreground text passes 4.5:1.

### Fix (1-line change × 2)

`tests/axe.e2e.ts` — bumped `waitForTimeout(1000)` → `waitForTimeout(3000)`
in BOTH the light-theme and dark-theme test cases. 3000ms gives comfortable
headroom for the 2.2s stagger to complete, even on slow CI runners. Added
explanatory comments documenting the Framer Motion race and the color math.

### Verification

| Gate | Result |
|------|--------|
| lint | ✅ 0 errors |
| unit tests | ✅ 620/620 pass |
| build | ✅ 49 pages, no errors |

### Other pre-existing issue (NOT blocking, deferred)

The informational-gates job (`continue-on-error: true`) also failed at the
overflow step on `/` and `/tools` at 320/390px viewports. Root cause:
`tests/overflow.e2e.ts` line 38 `page.waitForSelector("main, nav, h1")`
resolves to 5 elements at narrow viewports and picks a hidden h1 in the
collapsed sidebar, then times out. Pre-existing — was failing before v7.0.
Deferred to batch-2.

## v7.0 — PDF batch-1 🟡 in progress (P0 + axe fix done, CI pending)

### Tool count

- **32 tools total** (was 22 at v6.8) — 10 new PDF tools added
- **5 categories live** (was 4): text, developer, calculators, image, **pdf** (new)
- 8 categories still show "Coming soon" empty states

### PDF tools shipped (10)

| Tool                  | Purpose                                                        |
| --------------------- | -------------------------------------------------------------- |
| merge-pdf             | Combine multiple PDFs with per-file page ranges + reordering   |
| split-pdf             | Split a PDF by page ranges into multiple files (zip download)  |
| rotate-pdf            | Rotate pages 90°/180°/270°, all or selected pages              |
| delete-pdf-pages      | Delete pages by range, download the trimmed PDF                |
| extract-pdf-pages     | Extract pages by range into a new PDF                          |
| reorder-pdf-pages     | Reorder pages via drag-style up/down arrows                    |
| images-to-pdf         | Convert JPEG/PNG images into a single PDF                      |
| pdf-page-numbers      | Add page numbers (position, format, starting number, margins)  |
| pdf-watermark         | Add text watermark (font, size, opacity, rotation, position)   |
| pdf-metadata-editor   | Edit PDF Title / Author / Subject / Keywords / Producer / etc. |

### PDF shared infrastructure

- `src/tools/pdf/_shared/page-ranges.ts` — page-range parser ("1-3, 5, 8-10") shared by merge/split/extract/delete/reorder
- `src/tools/pdf/_shared/page-ranges.test.ts` — unit tests for the parser
- `src/tools/pdf/_shared/download.ts` — browser-side download helper
- All PDF processing is 100% client-side via **pdf-lib ^1.17.1** — no server, no uploads, works offline

### New dep added

- `pdf-lib ^1.17.1` (with transitive deps: `@pdf-lib/standard-fonts`, `@pdf-lib/upng`, `pako`, `tslib@1.14.1` nested)
- `package-lock.json` regenerated and committed (commit `4cfb62c`)
- `Update-lock-file.yml` workflow updated to auto-trigger on `package.json` pushes

### What's NOT yet done for v7.0 (post-CI steps)

- [ ] CI run on `v7.0-pdf-batch1` after P0 commit (C1 fix enables this — first auto-run will be on this push)
- [ ] If CI green → owner review + merge to `main` → Cloudflare Pages auto-deploys
- [ ] After merge: start batch-2 (H2 a11y radiogroup + M2 axe slice cap + H1 privacy clean dates)
- [ ] After batch-2: batch-3 (M1 pdf-lib shared chunk + M3 e2e depth + L7 Web Workers)

## v6.9 — All 13 categories visible ✅ (commit 320771d)

- All 13 categories from `ALL_CATEGORIES` now visible in the sidebar, tools directory, and command palette
- Categories with 0 tools render a "Coming soon" empty state (was previously hidden)
- Category page client refactored to derive visible categories from registry (no hardcoded list)
- Sidebar refactored similarly — no longer hides empty categories

## v6.8 — A11y + Cleanup ✅ COMPLETE

### Commits on v6.8-cleanup (8 total)

| Commit   | Description                                                              |
| -------- | ------------------------------------------------------------------------ |
| 08f16cb  | Task A: a11y — accessible names on ALL native form controls               |
| 1916c8a  | Fix: remove duplicate aria-label props in color-picker                    |
| 6b4e7e4  | CI: promote axe to must-pass build job                                    |
| d420dd1  | Task B: archive 67 unused UI components + archive-import guard            |
| 120cd2d  | Task C: delete 3 dead lib files + orphaned test                           |
| b5fa343  | Task C: remove unused deps batch 1/3 (8 deps)                             |
| 02d85c2  | Task C: remove unused deps batch 2/3 (8 deps)                             |
| 57c48e6  | Task C: remove unused deps batch 3/3 (7 deps)                             |

### Task A — A11y fixes + axe promotion ✅

Fixed accessible names on ALL native form controls across 10 tool UIs:
- 26 `<input type="number">` → added `aria-label`
- 3 `<select>` → added `aria-label`
- 3 `<input type="color">` → added `aria-label`
- 3 `<input type="file">` → added `aria-label`
- 1 Radix Slider thumb → added `aria-label` pass-through in slider.tsx
- Color contrast: `text-red-500→red-600`, `text-emerald-600→emerald-700` (light theme)

**Axe: 0 serious/critical on ALL pages × light + dark ✓**
**Promoted to must-pass CI job** (was informational).

### Task B — Archive unused UI components ✅

67 files moved to `archive/unused-ui/` (62 .tsx + 5 associated). 23 components
remain in `src/components/ui/` — all used by production. Archive-import guard
test added (`tests/no-archive-imports.test.ts`).

### Task C — Dead code + unused deps ✅

- Deleted: `src/lib/dom-utils.ts`, `src/lib/runWorker.ts`, `src/lib/theme.ts` (0 importers each)
- Removed orphaned theme test
- Removed 23 unused npm deps across 3 batches (build + tests green after each batch)
- 2 uncertain deps kept: `next-pwa`, `tailwindcss-animate` (owner decides)

### Task D — Bundle measurement

Bundle sizes unchanged (unused components were tree-shaken — never imported by production):

| Page | v6.6 | v6.8 | Delta |
|------|------|------|-------|
| Home | 302 KB | 302 KB | 0 |
| Tools | 280 KB | 280 KB | 0 |
| JSON Formatter | 281 KB | 281 KB | 0 |
| Category | 279 KB | 279 KB | 0 |

Savings are in `node_modules` (fewer packages) and install time, not runtime bundle.

## Full gate table

| Gate                 | v6.8 result            | v7.0 status (post-P0)         |
| -------------------- | ---------------------- | ------------------------------ |
| lint                 | ✅ 0 errors            | ✅ 0 errors (verified)         |
| unit tests           | ✅ 528/528             | ✅ 620/620 (verified, +1 new)  |
| build                | ✅ 30 pages            | ✅ 49 pages (verified)         |
| smoke e2e            | ✅ 33/33               | ✅ 39/39 (CI verified on push run, was 29 routes in stale routes.json) |
| tool e2e             | ✅ 22/22               | ✅ 32/32 (CI verified on push run) |
| axe (must-pass)      | ✅ 0 serious           | 🟡 first CI run flaked on /tools — fixed via axe waitForTimeout bump (3000ms). Pending re-verify on next push. (slice cap = 15, 9 of 10 PDF tools not scanned — known issue, batch-2) |
| CLS                  | ✅ 0.0001              | ✅ verified (CI passed on push run) |
| CI build job         | ✅ includes axe        | ✅ branch trigger added (this commit) |
| CI informational     | overflow + motion only | unchanged                      |

## Resume point

**Next session — verify CI auto-run on the axe fix commit + owner review:**

1. CI auto-runs on the axe fix push (next commit after `2ed6a1c`)
2. Expect: lint + tests + build + smoke + tool e2e + CLS + axe all green (axe should now pass on /tools — 3000ms wait exceeds the 2.2s stagger)
3. Informational overflow will still fail (pre-existing, deferred to batch-2 — does NOT block)
4. If axe still flakes → bump waitForTimeout further (5000ms) or implement proper Fix B (`initial={false}` after hydration)
5. Owner reviews + merges `v7.0-pdf-batch1` → `main` → Cloudflare Pages auto-deploys
6. After merge: start batch-2 (H1 privacy clean dates + H2 a11y radiogroup + H3 routes.json commit + M2 axe slice cap + overflow test selector fix)
7. After batch-2: batch-3 (M1 pdf-lib shared chunk + M3 e2e depth + L7 Web Workers)

## Branch map (current)

| Branch                  | Status          | Notes                                                  |
| ----------------------- | --------------- | ------------------------------------------------------ |
| `main`                  | production      | at v6.9 (commit 6773d51)                               |
| `v7.0-pdf-batch1`       | ready for CI    | 10 PDF tools + pdf-lib + lockfile workflow + 3 P0 fixes — READY FOR REVIEW |
| `v6.9-all-categories`   | merged to main  | kept for history                                       |
| `v6.8-cleanup`          | merged earlier  | kept for history                                       |
| older v6.x branches     | history         | not active                                             |

