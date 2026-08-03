import type { ToolManifest } from "../../../lib/tool";
export const manifest: ToolManifest = {
  id: "pdf-background-image-tool",
  name: "Add Background Image to PDF",
  description: "Enhanced PDF background tool with image preview, rotation control, opacity slider, and advanced positioning. All client-side.",
  category: "pdf",
  keywords: ["pdf background", "background image", "watermark", "pdf watermark image", "pdf background tool"],
  icon: "ImageIcon",
  requiresNetwork: false,
  seo: {
    title: "Add Background Image to PDF — Enhanced Tool | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Adds background images to PDF pages with advanced controls for rotation, opacity, scaling, and positioning." },
      { q: "What formats are supported?", a: "PNG and JPEG images, applied to any PDF document." },
      { q: "Is it offline?", a: "Yes — 100% client-side with pdf-lib." },
    ],
  },
  status: "done",
};
