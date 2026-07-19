import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "multiplication-tables-generator",
  name: "Multiplication Tables Generator",
  description:
    "Generate printable multiplication tables in three modes — single number (7×1 to 7×10), range (1-12 × 1-10), and complete NxN grid. Highlight multiples, choose from 4 color schemes (rainbow, mono, blue-scale, green-scale), render as text/HTML/CSV/Markdown, copy and download every format, save history (localStorage, last 20), share via URL, with 4 size presets (10×10, 12×12, 15×15, 20×20), summary stats, print-optimized layout, and negative-number support. 100% client-side — no network.",
  category: "education",
  keywords: [
    "multiplication", "times table", "math",
    "multiplication table", "math facts", "arithmetic",
    "printable", "grid", "education", "learning",
  ],
  icon: "grid-3x3",
  requiresNetwork: false,
  seo: {
    title: "Multiplication Tables Generator — Single, Range, Grid + Printable | UnQTools",
    faq: [
      {
        q: "How does the multiplication tables generator work?",
        a: "Pick a mode: (1) single-table — one number × 1 to N (e.g. 7 × 1 to 7 × 10); (2) range-table — multiple tables side by side (e.g. 1 through 12 each × 1-10); (3) complete-grid — an NxN matrix where cell(i, j) = i × j. Set start/end numbers and table size, choose a color scheme, and the generator builds the table instantly.",
      },
      {
        q: "Can I print the tables?",
        a: "Yes. The HTML render is print-optimized — every table in range mode starts on a new page. Use your browser's print dialog (Ctrl/Cmd+P) to print or save as PDF. The downloadable HTML file also includes print CSS.",
      },
      {
        q: "What color schemes are available?",
        a: "Four: rainbow (each multiplier gets a distinct hue), mono (grayscale by value), blue-scale (light-to-dark blue), and green-scale (light-to-dark green). All schemes respect the multiples-highlight toggle.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 3 mode generators — single, range, complete-grid. (2) Range validator (start ≤ end, positive numbers, with negative-number support). (3) Table size customizer (1-25). (4) Multiples highlighter (highlights every multiple of the chosen number). (5) 4 color scheme presets (rainbow/mono/blue-scale/green-scale). (6) ASCII text renderer (aligned columns). (7) HTML renderer (printable, colored, page-break per table in range mode). (8) CSV renderer (i, j, product). (9) Markdown table renderer. (10) Copy + Download .txt + .html + .csv + .md. (11) History (localStorage, last 20). (12) Shareable URL (inputs encoded in hash). (13) Summary stats (total cells, range, max product). (14) Print-optimized layout. (15) 4 size presets (10×10, 12×12, 15×15, 20×20). (16) Negative-number support for advanced math.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All generation, rendering, and downloads happen locally. History is stored in localStorage on this device only. Nothing is uploaded.",
      },
    ],
  },
  status: "done",
};
