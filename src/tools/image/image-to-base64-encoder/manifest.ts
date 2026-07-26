/**
 * Image to Base64 Encoder — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "image-to-base64-encoder",
  name: "Image to Base64 Encoder",
  description: "Encode images to Base64 data URLs. Multiple output formats (raw, HTML, CSS, JSON, favicon).",
  category: "image",
  keywords: ["image to base64", "base64 encode", "data url", "image encode"],
  icon: "FileCode",
  requiresNetwork: false,
  seo: {
    title: "Image to Base64 Encoder — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Encode images to Base64 data URLs. Multiple output formats (raw, HTML, CSS, JSON, favicon)." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) Image to Base64, (2) (2) All formats (PNG/JPG/WebP/GIF/SVG), (3) (3) 5 output formats (raw, <img>, CSS, JSON, favicon), (4) (4) Auto-detect MIME, (5) (5) Bulk encode, (6) (6) Drag-drop, (7) (7) Copy data URL, (8) (8) Download HTML, (9) (9) File size + base64 size, (10) (10) 10KB inflation warning, (11) (11) Live preview, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
