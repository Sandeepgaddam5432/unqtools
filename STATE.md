# UnQTools — Build State

_Last updated: 2026-07-05T05:30:00Z by GLM (z.ai sandbox) — v6.8 final_

## Current phase

**v6.8 "A11y + Cleanup" — COMPLETE** ✅ ON `v6.8-cleanup`

### Commits on v6.8-cleanup (7 total)

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

## Task A — A11y fixes + axe promotion ✅

Fixed accessible names on ALL native form controls across 10 tool UIs:
- 26 `<input type="number">` → added `aria-label`
- 3 `<select>` → added `aria-label`
- 3 `<input type="color">` → added `aria-label`
- 3 `<input type="file">` → added `aria-label`
- 1 Radix Slider thumb → added `aria-label` pass-through in slider.tsx
- Color contrast: `text-red-500→red-600`, `text-emerald-600→emerald-700` (light theme)

**Axe: 0 serious/critical on ALL pages × light + dark ✓**
**Promoted to must-pass CI job** (was informational).

## Task B — Archive unused UI components ✅

67 files moved to `archive/unused-ui/` (62 .tsx + 5 associated). 23 components remain in `src/components/ui/` — all used by production. Archive-import guard test added.

## Task C — Dead code + unused deps ✅

- Deleted: `src/lib/dom-utils.ts`, `src/lib/runWorker.ts`, `src/lib/theme.ts` (0 importers each)
- Removed orphaned theme test (tested deleted module — dead-code removal, NOT test-weakening)
- Removed 23 unused npm deps across 3 batches (all verified: build + tests green after each batch)
- 2 uncertain deps kept: `next-pwa`, `tailwindcss-animate` (owner decides)

## Task D — Bundle measurement

Bundle sizes unchanged (unused components were tree-shaken — never imported by production):
| Page | v6.6 | v6.8 | Delta |
|------|------|------|-------|
| Home | 302 KB | 302 KB | 0 |
| Tools | 280 KB | 280 KB | 0 |
| JSON Formatter | 281 KB | 281 KB | 0 |
| Category | 279 KB | 279 KB | 0 |

Savings are in `node_modules` (fewer packages) and install time, not runtime bundle.

## Full gate table (v6.8)

| Gate | Result |
|------|--------|
| lint | ✅ 0 errors |
| unit tests | ✅ 528/528 (529 - 1 dead theme test) |
| build | ✅ 30 pages |
| smoke e2e | ✅ 33/33 |
| tool e2e | ✅ 22/22 |
| axe (must-pass) | ✅ 0 serious (light + dark) — PROMOTED from informational |
| CLS | ✅ 0.0001 |
| CI build job | ✅ includes axe (must-pass) |
| CI informational | overflow + reduced-motion only |
