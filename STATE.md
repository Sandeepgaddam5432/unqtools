# UnQTools — Build State

_Last updated: 2026-07-05T02:30:00Z by GLM (z.ai sandbox) — v6.5 final_

## Current phase

**v6.5 "Hero Cleanup" — COMPLETE** ✅ ON `v6.5-hero-cleanup` (pending merge to main)

### Commits on v6.5-hero-cleanup (4 total)

| Commit   | Description                                                              |
| -------- | ------------------------------------------------------------------------ |
| caf41f8  | Task A: hero fix — remove template placeholder copy + duplicate CTA       |
| 45b9674  | Task B: template-leftover sweep — fake testimonials + company logos       |
| bf569e3  | Task C: axe.e2e.ts route list — derive from routes.json                   |
| (pending)| Task D+E: mobile Lighthouse + STATE.md                                    |

## Task A — Home hero fix ✅

**BUG 1 (overlapping text):** HeroGeometric had hardcoded "Crafting exceptional digital
experiences through innovative design and cutting-edge technology." + home page rendered
a second overlay paragraph. Both in same visual area → overlap.

**BUG 2 (duplicate CTAs):** Two buttons both linked to /tools: "Browse 22 Tools →" (primary)
+ "Browse Tools" (outline). Same action twice.

**Fix:** Added `subtitle` prop to HeroGeometric (replaces hardcoded text). Home page passes
real UnQTools copy. Removed duplicate overlay `<p>`. Replaced outline "Browse Tools" with
"Browse Categories" linking to /category/developer.

**Template-leftover guard:** 16 phrases checked in smoke e2e on every route. 42/42 pass.

## Task B — Template-leftover sweep ✅

Found on home page: 6 fake testimonials (Alex Rivera, Priya Sharma, Marcus Chen, Elena
Vasquez, Dev Patel, Sarah Kim) with randomuser.me avatars + fake company names. Fake
company endorsements (Vercel, Stripe, Figma, Linear, Notion). "production-ready" phrase.

**Fix:** Replaced with 4 honest feature cards (Privacy First, Works Offline, Developer
Friendly, Accessible) + 2 feature-focused glass testimonials. Removed fake company logos.
Changed "Loved by Developers" → "Why UnQTools". All other routes: clean (0 leftovers).

## Task C — axe route list fix ✅

**Root cause:** axe.e2e.ts had hardcoded routes including /about + /components (archived
in v6.3). CI axe step failed on 404s.

**Fix:** Derive AXE_ROUTES from generated tests/routes.json (single source of truth).
Filter to home + /tools + tool pages + category pages.

## Task D — Mobile Lighthouse ✅

| Page | Form | v6.5 Perf | v6.3 Perf | Delta |
|------|------|-----------|-----------|-------|
| Tools | Mobile | 58 | 56 | +2 |
| JSON Formatter | Mobile | 56 | 42 | +14 |
| EMI Calculator | Mobile | 53 | 43 | +10 |

## Full gate table (v6.5)

| Gate | Result |
|------|--------|
| lint | ✅ 0 errors |
| unit tests | ✅ 528/528 |
| build | ✅ 39 pages |
| smoke e2e | ✅ 42/42 (38 routes + 4 top-space + leftover guard) |
| tool e2e | ✅ 22/22 (strict assertions) |
| axe (local) | ✅ 0 serious (light + dark) |
| CLS | ✅ 0.0001-0.0002 |
| Lighthouse | ✅ 70-79 desktop, 52-58 mobile |
| 404 | ✅ Unknown routes return 404 |
