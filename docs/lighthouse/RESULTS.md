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
