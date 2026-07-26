/**
 * Image Sharpen Tool — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "image-sharpen",
  name: "Image Sharpen Tool",
  description: "Sharpen images using unsharp mask. Radius, amount, threshold control for precise sharpening.",
  category: "image",
  keywords: ["image sharpen", "sharpen", "unsharp mask", "image focus"],
  icon: "Focus",
  requiresNetwork: false,
  seo: {
    title: "Image Sharpen Tool — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Sharpen images using unsharp mask. Radius, amount, threshold control for precise sharpening." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) Unsharp mask, (2) (2) Radius control, (3) (3) Amount control, (4) (4) Threshold, (5) (5) Real-time preview, (6) (6) Reset, (7) (7) Download sharpened, (8) (8) Preset sharpening (light/medium/strong), (9) (9) Bulk processing, (10) (10) Copy CSS filter, (11) (11) Before/after, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
