/**
 * Aspect Ratio Crop Presets — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "aspect-ratio-crop-presets",
  name: "Aspect Ratio Crop Presets",
  description: "Crop images to common aspect ratios (16:9, 4:3, 1:1, 9:16, etc.) with visual crop overlay.",
  category: "image",
  keywords: ["aspect ratio", "image crop", "crop presets", "ratio crop"],
  icon: "Crop",
  requiresNetwork: false,
  seo: {
    title: "Aspect Ratio Crop Presets — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Crop images to common aspect ratios (16:9, 4:3, 1:1, 9:16, etc.) with visual crop overlay." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) 12 common aspect ratio presets, (2) (2) Custom ratio input, (3) (3) Visual crop overlay, (4) (4) Drag to reposition, (5) (5) Resize crop area, (6) (6) Output format (PNG/JPG/WebP), (7) (7) Quality control, (8) (8) Bulk crop, (9) (9) Maintain EXIF, (10) (10) Download cropped, (11) (11) Preview before/after, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
