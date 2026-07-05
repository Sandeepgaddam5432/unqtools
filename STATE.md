# UnQTools — Build State

_Last updated: 2026-07-05T01:30:00Z by GLM (z.ai sandbox) — v6.4 final_

## Current phase

**v6.4 "Polish" — COMPLETE** ✅ ON `v6.4-polish` (pending merge to main)

### Commits on v6.4-polish (5 total)

| Commit   | Description                                                              |
| -------- | ------------------------------------------------------------------------ |
| 772487f  | Task A: mobile top dead-space fix + regression guard                      |
| a5116be  | Task B: CLS fix — sidebar spacer initial width + tool skeleton           |
| 6471ab4  | CI: promote CLS to must-pass build job                                    |
| bfe74fe  | Task C: axe CI fix — light theme contrast (0 serious on ALL pages)        |
| (pending)| Task D+E: Lighthouse + STATE.md                                           |

## Task A — Mobile top dead-space ✅

**Root cause:** All 4 page files had `<main className="... pt-16 md:pt-0">` (64px) PLUS `<section className="... py-16 md:py-24">` (64px) = 128px before content on mobile.

**Fix:** `pt-16` → `pt-14` on `<main>`, first section `py-16` → `pt-4 pb-16` (mobile only, desktop unchanged).

**Before:** badge at y=133, gap from hamburger = 79px
**After:** badge at y=77, gap = 23px (normal)
**Regression guard:** 4 mobile top-space tests in smoke e2e (390×844, content < 200px from top)

## Task B — CLS fix ✅

**Root cause:** Sidebar spacer `motion.div` had `animate={{ width: 260 }}` but NO `initial` prop. SSG rendered width:0, then animated to 260 on hydration → 0.17 CLS on every page. Tool pages had additional shift from empty Suspense fallback.

**Fix:** Added `initial={{ width: 260 }}` to spacer + created `ToolSkeleton` with dimension-reserved placeholder.

| Page | Before | After |
|------|--------|-------|
| Home | 0.1726 | 0.0001 |
| Tools | 0.1720 | 0.0001 |
| JSON Formatter | 0.1748 | 0.0001 |
| Diff Checker | 0.4463 | 0.0001 |
| Color Picker | 0.5565 | 0.0001 |
| EMI Calculator | 0.2717 | 0.0002 |
| Category | 0.1708 | 0.0001 |

CLS e2e: 5/5 PASSED. CLS promoted to must-pass CI job.

## Task C — axe CI fix ✅

**Root cause:** CI runs axe in BOTH light + dark. v6.3 only tested dark locally. Light theme had 6 color-contrast violations (primary #c96442 at 3.7, muted-foreground at 3.65, etc.).

**Fix:** Darkened light theme `--primary` to #b5562d (4.60), `--muted-foreground` to #6e6c66 (4.98), removed /80 opacity, emerald-600→700, amber-600→800, added bg-transparent to hero CTA.

**Result:** 0 serious violations on ALL 7 pages × light + dark = 14 checks ✓

## Task D — Lighthouse ✅ (3-run medians)

| Page | Form | v6.4 Perf | v6.3 Perf | Delta |
|------|------|-----------|-----------|-------|
| Home | Desktop | 70 | 54 | +16 |
| Home | Mobile | 52 | 47 | +5 |
| Tools | Desktop | 76 | 68 | +8 |
| JSON Formatter | Desktop | 77 | 57 | +20 |
| EMI Calculator | Desktop | 79 | 65 | +14 |

Massive perf improvement from CLS fix (stable layout from first paint).

## Full gate table (v6.4)

| Gate | Result |
|------|--------|
| lint | ✅ 0 errors |
| unit tests | ✅ 528/528 |
| build | ✅ 39 pages |
| smoke e2e | ✅ 42/42 (38 routes + 4 top-space guards) |
| tool e2e | ✅ 22/22 (strict assertions) |
| axe (14 checks) | ✅ 0 serious (light + dark) |
| CLS | ✅ 0.0001-0.0002 (5/5 e2e pass) |
| overflow | ✅ 0 overflow |
| Lighthouse | ✅ 70-79 desktop (was 54-68) |
| 404 | ✅ Unknown routes return 404 |
| CI build job | ✅ GREEN (smoke + tool e2e + CLS) |
