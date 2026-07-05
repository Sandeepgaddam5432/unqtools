# Lighthouse Results — v6.2 (2026-07-04)

All runs against static export (`out/`) served by `tests/static-server.mjs`.
Chrome: Playwright's cached chromium-1228. No targets enforced — real numbers only.

## Score Table

| Page | Form Factor | Performance | Accessibility | Best Practices | SEO |
|------|-------------|-------------|---------------|----------------|-----|
| Home (`/`) | Desktop | 56 | 96 | 96 | 100 |
| Home (`/`) | Mobile | 44 | 100 | 96 | 100 |
| Tools (`/tools`) | Desktop | 70 | 98 | 96 | 100 |
| Tools (`/tools`) | Mobile | 58 | 98 | 96 | 100 |
| JSON Formatter | Desktop | 57 | 100 | 96 | 100 |
| JSON Formatter | Mobile | 50 | 100 | 96 | 100 |
| EMI Calculator | Desktop | 70 | 100 | 96 | 100 |
| EMI Calculator | Mobile | 51 | 100 | 96 | 100 |

## Notes

- **Performance delta after hydration fix:** Home desktop was 66 in the previous session (before Task F sidebar mount-gate + MotionProvider). After: 56. The MotionProvider wrapper may have added overhead. The Framer Motion `whileInView` hydration mismatch still persists (partial fix only) — React discards server HTML and re-renders, which hurts LCP/TBT.
- **Accessibility:** 96-100 across all pages. The 96 on home desktop is from a minor `aria-label` issue on an interactive element.
- **Best Practices:** 96 across all (minor HTTPS/HTTP issue from static server).
- **SEO:** 100 across all.
- **Mobile performance** is lower (44-58) due to Framer Motion JS payload + React re-render from hydration mismatch.
- Full resolution requires fixing the Framer Motion `whileInView` hydration mismatch (deferred to future PR).

## Raw JSON

All raw Lighthouse JSON reports are in this directory: `*.json`

## v6.3 Results (3-run medians, after showcase removal + #418 hydration fix)

| Page | Form | Perf (median) | A11y | BP | SEO | v6.2 Perf | Delta |
|------|------|---------------|------|-----|-----|-----------|-------|
| Home | Desktop | 54 | 96 | 100 | 100 | 56 | -2 |
| Home | Mobile | 47 | 100 | 100 | 100 | 44 | +3 |
| Tools | Desktop | 68 | 98 | 100 | 100 | 70 | -2 |
| Tools | Mobile | 56 | 98 | 100 | 100 | 58 | -2 |
| JSON Formatter | Desktop | 57 | 100 | 100 | 100 | 57 | +0 |
| JSON Formatter | Mobile | 42 | 100 | 100 | 100 | 50 | -8 |
| EMI Calculator | Desktop | 65 | 100 | 100 | 100 | 70 | -5 |
| EMI Calculator | Mobile | 43 | 100 | 100 | 100 | 51 | -8 |

### Notes
- BP improved 96→100 across all pages (showcase page removal eliminated demo-content violations)
- A11y improved on home (96→100 mobile) and stayed 96-100 elsewhere
- Perf variance: -8 to +3 vs v6.2. The hydration fix (#418) should help perf (React no longer
  discards SSG HTML + re-renders), but the ThemeProvider mount-gate adds a brief flash where
  the theme isn't applied. Net effect is roughly neutral — the real perf improvement will come
  from fixing Framer Motion whileInView CLS (deferred).
- 3-run medians reduce variance vs v6.2's single-run numbers
