# Lighthouse Results — v18.7 perf pass (2026-09-05)

Runs against **production** `https://unqtools.pages.dev` (Cloudflare Pages).
Chrome for Testing 153 (headless, `--no-sandbox`), Lighthouse 13.x,
`--form-factor=mobile`. Simulated throttling numbers from a single run each;
observed (provided) run included where it adds signal.

## Deployed fixes (commits `cd8b1b8` → `72876d4`)

1. **Intent-based Command Palette loader** — the 179 KB catalog chunk used to
   load eagerly on *every* page (dynamic `ssr:false` mounted the palette right
   after hydration). It now loads on first ⌘K/Ctrl+K or `unq:open-command-bar`
   event, with an idle `requestIdleCallback` prefetch as backup.
2. **`/tools` render windowing** — the grid rendered all 1,679 cards at once
   (~7 s TBT: 4.0 s style/layout + 2.4 s script eval). Initial render is now
   96 cards + "Show more tools (N remaining)" button (+192/click), plus
   `content-visibility:auto` / `contain-intrinsic-size` on every card.
3. **`/tools` prerender restored** — `useSearchParams()` in a lazy `useState`
   initializer bailed the whole client subtree out of static prerendering
   (production HTML shipped a "Loading tools…" fallback; LCP waited for JS).
   Query/view deep links are now applied in a mount effect via
   `URLSearchParams`; the grid ships in static HTML.
4. **framer-motion removed from `/tools` + `/category/*`** — framer-motion SSRs
   `initial={{opacity:0}}` inline, so the hero H1 (the LCP element) stayed
   invisible until JS hydrated and animated it. Replaced with the existing
   `unq-animate-fade-in-up` CSS class (same look, paints with HTML, respects
   `prefers-reduced-motion`). Also drops the motion chunk from those bundles.
   (The home hero was converted earlier the same way.)

## Score table — Performance (mobile)

| Page | Before | After | Δ |
|------|-------:|------:|---|
| `/tools` | 43 | **71** | +28 |
| `/category/pdf` | 46 | **61** | +15 |
| `/` (home) | 84 | **89** | +5 |

## Core metrics — mobile, simulated

| Page | Metric | Before | After |
|------|--------|-------:|------:|
| `/tools` | TBT | 6,980 ms | **360 ms** |
| `/tools` | LCP (sim) | 6.4 s | 5.3 s |
| `/tools` | LCP (observed, no throttle) | ~6+ s | **0.4 s** |
| `/tools` | Speed Index | — | 2.6 s |
| `/category/pdf` | TBT | 2,330 ms | **680 ms** |
| `/category/pdf` | LCP (sim) | 7.1 s | 5.1 s |
| `/` (home) | TBT | 270 ms | **200 ms** |
| All | CLS | 0 | 0 |

Observed `/tools` run (provided throttling): LCP 0.4 s · FCP 0.4 s · TBT 0 ms ·
SI 0.6 s. All render-blocking resources (HTML 30 KB, 2 CSS, hero font) finish
by ≈160 ms; the filmstrip shows full content at ~1.5 s. The remaining gap in
the *simulated* LCP column is Lantern's conservative page-dependency model —
real-user LCP no longer waits on JS: the LCP content is in the initial HTML.

A11y / Best Practices / SEO were 96–100 before and unchanged by these commits.

## Remaining opportunities (not done)

- `/category/*` pages ship ~1.1 MB static HTML (305 tool links for PDF) —
  fine for SEO, but trimming per-page markup weight would help mobile parse.
- Individual tool pages (e.g. `/tools/json-formatter`, perf 64 baseline)
  have their own LCP quirks; audit individually when touched.
- `docs/lighthouse/*.json` raw reports from prior sessions removed; current
  raw JSON lives in CI artifacts / local `/tmp` only.

## Reproducing

```bash
CHROME_PATH=<path-to-chrome> npx lighthouse "https://unqtools.pages.dev/tools" \
  --form-factor=mobile --only-categories=performance --output=json \
  --chrome-flags="--headless=new --no-sandbox --disable-dev-shm-usage"
```
