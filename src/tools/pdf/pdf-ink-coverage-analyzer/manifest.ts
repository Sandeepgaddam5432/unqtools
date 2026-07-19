import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pdf-ink-coverage-analyzer",
  name: "PDF Ink Coverage Analyzer",
  description:
    "Analyze ink coverage per page — calculate CMYK channel usage, estimate ink volume and print cost, " +
    "flag heavy-ink pages, generate ink-saving recommendations. 4 analysis modes, multi-format reports (text/CSV/HTML), " +
    "history, shareable URL, and 100% client-side processing.",
  category: "pdf",
  keywords: [
    "ink coverage",
    "pdf ink usage",
    "cmyk analyzer",
    "print cost estimator",
    "ink volume",
    "pdf preflight",
    "print cost calculator",
    "ink coverage analyzer",
  ],
  icon: "droplet",
  requiresNetwork: false,
  seo: {
    title: "PDF Ink Coverage Analyzer — CMYK Usage & Print Cost | UnQTools",
    faq: [
      {
        q: "How does the ink coverage analyzer estimate per-page ink usage?",
        a: "It parses each page's content stream looking for text-showing operators (Tj, TJ, ', \"), rectangle paths (re), image references (Do), and fill-color operators (rg, k, g). Each ink emission is attributed to its current fill color, converted to CMYK, and summed per channel. Coverage is reported as a percentage of page area, and ink volume is estimated from coverage × page area × ink thickness (0.01 mm default).",
      },
      {
        q: "What analysis modes are supported?",
        a: "Four modes: per-page (one summary row per page), per-channel-cmyk (C/M/Y/K breakdown for each page), per-color (distinct colors used on each page), and total-document (whole-document aggregates). All four modes can be rendered as text, CSV, or a visual HTML report with bar charts.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Page-range parser. (2) 4 analysis modes (per-page, per-channel, per-color, total). (3) Ink coverage calculator. (4) CMYK channel separator. (5) Color usage analyzer. (6) Image coverage calculator (separate from text/graphics). (7) Ink volume estimator (coverage × area × thickness). (8) Cost calculator (per-ml CMYK pricing). (9) Heavy-usage detector (threshold-based). (10) Multi-format renderers (text/CSV/HTML). (11) Copy + Download. (12) History (localStorage, last 20). (13) Shareable URL. (14) Summary stats. (15) Heavy ink page list. (16) Cost by page ranking. (17) Coverage distribution histogram (10 buckets). (18) Ink-saving recommendations.",
      },
      {
        q: "How accurate are the ink volume and cost estimates?",
        a: "Estimates are heuristic — they approximate ink coverage from vector operators in the content stream, not by rasterizing the page. Real ink usage depends on printer dot gain, paper absorption, halftone screening, and ink density. Use the numbers as a relative guide (which pages cost more, which channel dominates) rather than an absolute billable amount.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All analysis runs 100% in your browser using JavaScript and pdf-lib. Your PDF never leaves your device, and the tool works offline. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
