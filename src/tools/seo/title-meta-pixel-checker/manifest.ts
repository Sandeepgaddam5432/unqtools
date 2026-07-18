import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "title-meta-pixel-checker",
  name: "Title & Meta Description Pixel Checker",
  description:
    "Check pixel width of titles and meta descriptions for SERP truncation. Desktop vs mobile limits, character & word counts, batch mode, sort by pixel width, CSV export, SERP preview, history, shareable URL. 100% client-side.",
  category: "seo",
  keywords: [
    "title pixel width", "meta description pixel", "serp truncation",
    "title length", "meta length", "google serp preview", "title tag checker",
  ],
  icon: "ruler",
  requiresNetwork: false,
  seo: {
    title: "Title & Meta Pixel Checker — Desktop + Mobile SERP Truncation | UnQTools",
    faq: [
      {
        q: "What are the SERP pixel limits?",
        a: "Google truncates titles at ~568px on desktop and ~485px on mobile. Meta descriptions truncate at ~980px desktop and ~685px mobile. The exact limit varies by character mix (W is wider than i). This tool estimates pixel width per character and shows where truncation will occur.",
      },
      {
        q: "How is pixel width estimated?",
        a: "Each character has an approximate pixel width based on Arial (Google's SERP font): narrow chars (i, l, 1, .) ~4.5px, wide chars (W, M, O, 0) ~12.6px, average chars ~9px, and CJK/double-width chars ~18px. Sum the per-character widths for the total pixel width.",
      },
      {
        q: "What is batch mode?",
        a: "Paste multiple titles (one per line) and the tool analyzes each — showing pixel width, character count, word count, and whether it truncates. Sort the table by pixel width to prioritize which titles to shorten first.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Desktop vs mobile limits. (2) Character-based pixel width estimation. (3) Truncation point indicator (shows where Google would cut off). (4) Character count. (5) Word count. (6) Batch mode (multiple titles). (7) Sort by pixel width. (8) Export as CSV. (9) History (localStorage, last 20). (10) Shareable URL. (11) Live SERP preview.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. Pixel estimation runs locally. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
