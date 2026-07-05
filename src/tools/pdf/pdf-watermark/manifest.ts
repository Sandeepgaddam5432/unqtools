import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pdf-watermark",
  name: "PDF Watermark",
  description:
    "Add a text watermark to any PDF. Control placement (diagonal, tiled, centered), opacity, color, font size, and which pages to watermark. 100% private, runs in your browser.",
  category: "pdf",
  keywords: [
    "add watermark to pdf",
    "pdf watermark",
    "stamp pdf",
    "pdf text overlay",
    "watermark pages",
  ],
  icon: "stamp",
  requiresNetwork: false,
  seo: {
    title: "Add Watermark to PDF Online — Text, Diagonal, Tiled | UnQTools",
    faq: [
      {
        q: "Is my PDF uploaded to a server?",
        a: "No. Watermarking runs entirely in your browser. Files never leave your device.",
      },
      {
        q: "What placement styles are available?",
        a: "Three styles: diagonal (text rotated 45° across the page center), tiled (repeated grid across the full page), and centered (horizontal text in the center of the page).",
      },
      {
        q: "Can I watermark only specific pages?",
        a: "Yes. Leave the page range blank to watermark all pages, or enter a spec like 1, 3-5 to target only those pages.",
      },
    ],
  },
  status: "done",
};
