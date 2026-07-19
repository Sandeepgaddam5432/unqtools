import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pdf-imposition",
  name: "PDF Imposition",
  description:
    "Impose PDF pages for print — 2-up, 4-up, 8-up, 16-up, or custom grid. Sequential, snake-fold, or booklet page order. 5 paper size presets, cut marks, and 18+ extra features including cost + print-time estimators. 100% client-side, no uploads.",
  category: "pdf",
  keywords: [
    "pdf imposition",
    "2-up pdf",
    "4-up pdf",
    "8-up pdf",
    "16-up pdf",
    "impose pdf",
    "pdf layout",
    "print imposition",
    "n-up pdf",
    "pdf grid",
    "snake fold",
    "pdf cut marks",
  ],
  icon: "layout-grid",
  requiresNetwork: false,
  seo: {
    title: "PDF Imposition — 2-up, 4-up, 8-up, 16-up Grid Layout Free | UnQTools",
    faq: [
      {
        q: "Are my PDFs uploaded to a server?",
        a: "No. Imposition runs entirely in your browser using JavaScript and pdf-lib. Your files never leave your device, and the tool works offline.",
      },
      {
        q: "What imposition types are supported?",
        a: "Five: 2-up (2 pages side by side), 4-up (2×2 grid), 8-up (4×2 grid), 16-up (4×4 grid), and custom (any rows × cols). Higher values fit more pages per sheet but each page becomes smaller, saving paper.",
      },
      {
        q: "What page orders are available?",
        a: "Three: (1) Sequential — pages laid out left-to-right, top-to-bottom. (2) Snake-fold — alternating row direction for accordion-fold binding. (3) Booklet — saddle-stitch-style alternating order (page N, 1, 2, N-1, …) per sheet for fold-and-staple booklets.",
      },
      {
        q: "What extra features does this tool have?",
        a: "(1) 5 imposition types (2/4/8/16-up, custom). (2) 3 page orders (sequential, snake-fold, booklet). (3) 5 paper size presets (A4, A3, Letter, Legal, Tabloid). (4) Imposition grid calculator. (5) Page order generator (3 algorithms). (6) Cut marks generator. (7) Margin calculator. (8) Page scaler. (9) Blank page padder. (10) Multi-format renderers (text/CSV/HTML). (11) Copy + Download. (12) History (localStorage, last 20). (13) Shareable URL. (14) Summary stats. (15) Paper waste calculator. (16) Print time estimator. (17) Cost estimator. (18) Bleed area calculator.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All imposition calculation and PDF assembly runs 100% locally in your browser. History is stored in localStorage on this device only — nothing is uploaded to any server.",
      },
    ],
  },
  status: "done",
};
