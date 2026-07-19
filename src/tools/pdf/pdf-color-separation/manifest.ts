import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pdf-color-separation",
  name: "PDF Color Separation",
  description:
    "Separate PDF colors into CMYK (4), RGB (3), or grayscale (1) channels for print prep. " +
    "Generate per-channel PDFs, combined PDF, or side-by-side preview. Includes registration marks, " +
    "channel labels, ink-coverage stats, color-usage analyzer, ZIP packaging, history, and shareable URL. " +
    "100% client-side — no uploads.",
  category: "pdf",
  keywords: [
    "color separation",
    "cmyk separation",
    "pdf channels",
    "print prepress",
    "color channels",
    "cyan magenta yellow black",
    "rgb separation",
    "registration marks",
  ],
  icon: "layers",
  requiresNetwork: false,
  seo: {
    title: "PDF Color Separation — CMYK / RGB / Grayscale Channels | UnQTools",
    faq: [
      {
        q: "What does PDF color separation do?",
        a: "It analyzes the colors on every page of your PDF and produces a separate page (or PDF) for each color channel — Cyan, Magenta, Yellow and Black for CMYK mode, Red/Green/Blue for RGB mode, or a single Gray channel for grayscale mode. Each separated page shows that channel's contribution as a tinted overlay plus the original page beneath, ready for proofing or print-prep workflows.",
      },
      {
        q: "Which separation modes are supported?",
        a: "Four modes: CMYK (4 channels), RGB (3 channels), grayscale (1 channel), and custom (you pick which of the 8 available channels to include). Output can be packaged as separate PDFs inside a ZIP, a single combined PDF with one page per channel per source page, or a side-by-side preview where all channels share one large page per source page.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 4 separation modes (CMYK, RGB, grayscale, custom). (2) CMYK converter. (3) RGB separator. (4) Grayscale luminance converter. (5) Color analyzer. (6) Per-page channel intensity calculator. (7) Registration marks generator (4 corners + center). (8) Channel label generator. (9) 3 output formats (ZIP, combined, side-by-side). (10) Pure-JS ZIP builder for the separate-PDFs package. (11) Text + CSV reports. (12) Copy + Download. (13) History (localStorage, last 20). (14) Shareable URL. (15) Summary stats (channels, pages per channel, avg intensity). (16) Ink coverage calculator per channel per page. (17) Top-10 color usage analyzer per page. (18) Coverage percentage per channel.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. The entire color separation pipeline runs in your browser using JavaScript and pdf-lib. Your PDF never leaves your device, and the tool works offline. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
