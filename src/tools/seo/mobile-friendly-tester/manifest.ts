import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "mobile-friendly-tester",
  name: "Mobile-Friendly Tester",
  description:
    "Test mobile-friendliness from HTML. Check viewport meta, font-size readability, tap target spacing, content width, responsive images. Score 0-100, pass/warn/fail per check, recommendations. Mobile preview dimensions, history (localStorage), shareable URL. 100% client-side.",
  category: "seo",
  keywords: [
    "mobile friendly", "mobile test", "responsive", "viewport",
    "tap targets", "mobile seo", "font size",
  ],
  icon: "smartphone",
  requiresNetwork: false,
  seo: {
    title: "Mobile-Friendly Tester — HTML Mobile UX Audit | UnQTools",
    faq: [
      {
        q: "What does the Mobile-Friendly Tester check?",
        a: "Five things: (1) viewport meta tag presence and correctness, (2) inline font-size readability (≥16px for body text), (3) tap target density and sizing (≥48×48px), (4) responsive images (srcset/sizes/<picture>), (5) content width (no fixed-width containers >980px).",
      },
      {
        q: "How is the score calculated?",
        a: "Each check contributes up to 15-25 points. Maximum possible is 90 (viewport 25 + fonts 20 + tap 15 + images 15 + width 15), scaled to 100. Fail on any check drops the overall rating to warn or fail depending on score.",
      },
      {
        q: "What does the tool look at in my HTML?",
        a: "It scans for: <meta name='viewport'>, inline font-size CSS declarations, <a>/<button> elements with width/height attributes, <img> elements with srcset/sizes, <picture> elements, and fixed pixel widths in inline styles. It does NOT execute JavaScript or follow external CSS — so inline styles are the most reliable signal.",
      },
      {
        q: "What are the recommended thresholds?",
        a: "Viewport: width=device-width, initial-scale=1. Font size: ≥16px body text. Tap targets: ≥48×48px (Apple HIG) with ≥8px spacing. Images: srcset + sizes for responsive delivery. Content: max-width 980px or use relative units (%/vw).",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Viewport meta check. (2) Font size analysis. (3) Tap target detection. (4) Image responsive check (srcset/sizes/picture). (5) Content width check (fixed widths >980px). (6) Overall 0-100 score. (7) Pass/warn/fail per check. (8) Recommendations. (9) Mobile preview device dimensions reference. (10) History (localStorage, last 20). (11) Shareable URL.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All HTML parsing runs locally. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
