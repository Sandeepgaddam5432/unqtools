import type { ToolManifest } from "../../../lib/tool";
export const manifest: ToolManifest = {
  id: "pdf-background-image",
  name: "Add Background Image to PDF",
  description: "Add background images to PDF pages. Supports fit/fill/stretch, opacity control, page selection. Uses pdf-lib — 100% client-side.",
  category: "pdf",
  keywords: ["pdf background", "background image pdf", "watermark image", "pdf image background", "pdf watermark"],
  icon: "Image",
  requiresNetwork: false,
  seo: {
    title: "Add Background Image to PDF — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Adds an image as a background to PDF pages. You can choose which pages, scale mode, position, and opacity." },
      { q: "What image formats are supported?", a: "PNG and JPEG images can be used as backgrounds." },
      { q: "Is my data sent to a server?", a: "No. All processing uses pdf-lib and runs 100% in your browser." },
      { q: "Can I add backgrounds to specific pages?", a: "Yes — choose all pages, first page, last page, odd pages, or even pages." },
    ],
  },
  status: "done",
};
