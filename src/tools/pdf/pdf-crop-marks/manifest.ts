import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pdf-crop-marks",
  name: "PDF Crop Marks",
  description:
    "Add professional crop marks (trim marks), registration crosses, bleed marks, and color density bars to a PDF for print finishing. 100% client-side — runs entirely in your browser, no uploads.",
  category: "pdf",
  keywords: [
    "crop marks",
    "trim marks",
    "pdf crop marks",
    "registration marks",
    "registration crosses",
    "bleed marks",
    "density bars",
    "color bars",
    "print finishing",
    "prepress marks",
  ],
  icon: "scissors",
  requiresNetwork: false,
  seo: {
    title: "Add Crop Marks to PDF — Trim & Registration Marks | UnQTools",
    faq: [
      {
        q: "What are crop marks and why do I need them?",
        a: "Crop marks (also called trim marks) are short lines printed at the corners of a page that show the printer where to cut the paper to the final size. They are essential for any document that will be professionally trimmed, bound, or finished — business cards, brochures, posters, booklets and more.",
      },
      {
        q: "What types of marks can this tool add?",
        a: "Four types: (1) corner crop marks — the classic two-line L-shape at each trim corner; (2) edge crop marks — single short lines at the midpoints of each trim edge; (3) both — corner + edge marks together; (4) registration crosses — a plus-sign at each corner used for color registration. You can also add bleed marks beyond the trim edge and CMYK density bars for press verification.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 4 mark types (corner-crop, edge-crop, both, registration-cross). (2) Mark-length converter (mm → points). (3) Mark-weight converter (pt direct). (4) 4 mark colors (black, registration-black CMYK all-100%, red, blue). (5) Mark-offset calculator. (6) Corner crop-mark generator (4 corners × 2 lines). (7) Edge crop-mark generator (4 edges × 1 line). (8) Registration-cross generator. (9) Bleed-mark generator. (10) Density-bar generator (CMYK color bars). (11) Trim-box calculator. (12) Text + CSV renderers. (13) Copy + Download. (14) History (localStorage, last 20). (15) Shareable URL. (16) Summary stats. (17) Print-standard checker (ISO/ANSI). (18) Mark visibility verifier.",
      },
      {
        q: "Does adding crop marks change my page size?",
        a: "No. Marks are drawn just OUTSIDE the trim area (offset by a small gap so they don't touch the design). The page size itself is unchanged. If your page already has bleed and you want marks at the bleed edge, enable the 'bleed marks' option as well.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All mark generation runs 100% locally in your browser using JavaScript and pdf-lib. Your PDF is never uploaded — the tool works offline once the page is loaded.",
      },
    ],
  },
  status: "done",
};
