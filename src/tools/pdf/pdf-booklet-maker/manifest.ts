import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pdf-booklet-maker",
  name: "PDF Booklet Maker",
  description:
    "Arrange PDF pages for booklet printing — saddle-stitch, perfect-bound, or gate-fold. 2 pages per sheet with duplex ordering for fold-and-staple binding. 100% client-side, no uploads. Includes crop marks, signature calculator, spine width estimator, and 16+ extra features.",
  category: "pdf",
  keywords: [
    "pdf booklet",
    "booklet maker",
    "saddle stitch",
    "perfect bound",
    "gate fold",
    "pdf imposition",
    "booklet printing",
    "fold and staple",
    "pdf signature",
    "duplex booklet",
  ],
  icon: "book-open",
  requiresNetwork: false,
  seo: {
    title: "PDF Booklet Maker — Saddle-Stitch, Perfect-Bound & Gate-Fold Free | UnQTools",
    faq: [
      {
        q: "Are my PDFs uploaded to a server?",
        a: "No. Booklet imposition runs entirely in your browser using JavaScript and pdf-lib. Your files never leave your device, and the tool works offline.",
      },
      {
        q: "What booklet types are supported?",
        a: "Three: (1) Saddle-stitch — fold sheets in half and staple through the spine, ideal for 8-64 page booklets. (2) Perfect-bound — group pages into signatures, then bind with glue along the spine, ideal for thicker books. (3) Gate-fold — 3 panels per side (6 pages per sheet) for tri-fold brochures and booklets.",
      },
      {
        q: "How is the page order calculated for saddle-stitch?",
        a: "For a booklet of N pages (multiple of 4), sheet i has: front=[N-2i, 2i+1], back=[2i+2, N-2i-1]. When sheets are nested and folded, pages read sequentially from 1 to N. The tool pads blank pages automatically if your page count isn't a multiple of 4.",
      },
      {
        q: "What extra features does this tool have?",
        a: "(1) 3 booklet types (saddle-stitch, perfect-bound, gate-fold). (2) Saddle-stitch page order algorithm. (3) Perfect-bound signature grouping. (4) Gate-fold 3-up algorithm. (5) Sheet count + signature calculators. (6) 6 paper size presets (A4/A3/Letter × portrait/landscape). (7) Page position calculator. (8) Crop marks generator. (9) Page count validator + blank padder. (10) Duplex front/back arrangement. (11) Multi-format renderers (text/CSV/HTML). (12) Copy + Download. (13) History (localStorage, last 20). (14) Shareable URL. (15) Summary stats. (16) Binding margin calculator. (17) Spine width estimator. (18) Page order validator (no duplicates).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All booklet calculation and PDF assembly runs 100% locally in your browser. History is stored in localStorage on this device only — nothing is uploaded to any server.",
      },
    ],
  },
  status: "done",
};
