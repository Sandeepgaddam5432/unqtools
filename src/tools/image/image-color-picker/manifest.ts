/**
 * Image Color Picker (Eyedropper) — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "image-color-picker",
  name: "Image Color Picker (Eyedropper)",
  description: "Pick colors from any image. Click to sample, hex/RGB/HSL output, palette history.",
  category: "image",
  keywords: ["color picker", "eyedropper", "image color", "pick color"],
  icon: "Pipette",
  requiresNetwork: false,
  seo: {
    title: "Image Color Picker (Eyedropper) — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Pick colors from any image. Click to sample, hex/RGB/HSL output, palette history." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) Click to sample color, (2) (2) Hex/RGB/HSL output, (3) (3) Color history (last 20), (4) (4) Average color in region, (5) (5) Drag-drop image, (6) (6) Zoom for precision, (7) (7) Copy color, (8) (8) Export palette, (9) (9) Contrast checker, (10) (10) WCAG compliance, (11) (11) Live preview, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
