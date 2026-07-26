/**
 * Image Background Changer — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "image-background-changer",
  name: "Image Background Changer",
  description: "Change image background color. Remove background (simple threshold), replace with solid color.",
  category: "image",
  keywords: ["background changer", "image background", "change background", "background color"],
  icon: "SquareStack",
  requiresNetwork: false,
  seo: {
    title: "Image Background Changer — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Change image background color. Remove background (simple threshold), replace with solid color." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) Background color change, (2) (2) Solid color replacement, (3) (3) Threshold-based removal, (4) (4) Tolerance control, (5) (5) Edge smoothing, (6) (6) Bulk processing, (7) (7) Download as PNG, (8) (8) Preset background colors, (9) (9) Custom color picker, (10) (10) Before/after preview, (11) (11) Transparency support, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
