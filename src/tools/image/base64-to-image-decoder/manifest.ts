/**
 * Base64 to Image Decoder — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "base64-to-image-decoder",
  name: "Base64 to Image Decoder",
  description: "Decode Base64 data URLs back to image files. Supports PNG, JPG, WebP, GIF, SVG. Live preview.",
  category: "image",
  keywords: ["base64 to image", "decode base64", "base64 image", "data url decoder"],
  icon: "FileImage",
  requiresNetwork: false,
  seo: {
    title: "Base64 to Image Decoder — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Decode Base64 data URLs back to image files. Supports PNG, JPG, WebP, GIF, SVG. Live preview." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) Base64 to image decode, (2) (2) All formats (PNG/JPG/WebP/GIF/SVG), (3) (3) Live preview, (4) (4) Auto-detect MIME, (5) (5) Download as file, (6) (6) Image info (dimensions, size), (7) (7) Bulk decode, (8) (8) Drag-and-drop text file, (9) (9) Copy as data URL, (10) (10) Export all images as ZIP, (11) (11) Format conversion, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
