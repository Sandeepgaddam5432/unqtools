import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pdf-bleed-adder",
  name: "PDF Bleed Adder",
  description:
    "Add bleed area to a PDF for print production — enlarge each page by a configurable bleed margin (3/5 mm or 0.125\"), optionally extend the background, and add crop + bleed marks. 100% client-side — your PDF never leaves your browser.",
  category: "pdf",
  keywords: [
    "pdf bleed",
    "bleed adder",
    "print bleed",
    "crop marks",
    "trim marks",
    "print ready pdf",
    "bleed area",
    "pdf for print",
    "pdf prepress",
    "extend pdf page",
  ],
  icon: "frame",
  requiresNetwork: false,
  seo: {
    title: "Add Bleed to PDF — Print-Ready Bleed & Crop Marks | UnQTools",
    faq: [
      {
        q: "What is PDF bleed and why do I need it?",
        a: "Bleed is the extra margin added around a printed page so that when the paper is trimmed to the final size, any background color or image extending to the edge doesn't leave a thin white border from cutting misalignment. Printers typically require 3 mm (Europe) or 0.125 inch (≈3.2 mm, US) of bleed on each side.",
      },
      {
        q: "How does this tool add bleed to a PDF?",
        a: "Each page is enlarged by the bleed amount on the selected sides (all sides, top/bottom, left/right, or a single side). The original page content is then embedded into the larger page, shifted by the bleed offset. Optionally a background color fills the new bleed area, and crop marks at the trim corners guide the finishing cut.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Bleed-size calculator (mm → points). (2) 7 bleed-side options (all / top-bottom / left-right / top-only / bottom-only / left-only / right-only). (3) New page-size calculator. (4) Content offset calculator. (5) Crop-mark generator (4 trim corners). (6) Bleed-mark generator for verification. (7) Background-color parser (#hex). (8) Page-extension validator. (9) Text + CSV renderers. (10) Copy + Download. (11) History (localStorage, last 20). (12) Shareable URL. (13) Summary stats. (14) Trim-box calculator. (15) Bleed-area percentage calculator. (16) Print-ready verifier (3 mm / 5 mm standards). (17) 3 standard bleed presets (3 mm, 5 mm, 0.125 inch).",
      },
      {
        q: "Does the tool modify my original content?",
        a: "No. A new PDF is generated — your original content is embedded into enlarged pages unchanged. Vector text and graphics remain crisp; only the page size grows. Crop marks and bleed marks are drawn as additional vector lines on top.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. Bleed generation runs 100% locally in your browser using JavaScript and pdf-lib. Your PDF is never uploaded to a server — the tool works offline once the page is loaded.",
      },
    ],
  },
  status: "done",
};
