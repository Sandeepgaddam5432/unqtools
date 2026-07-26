/**
 * Image Rotator & Flipper — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "image-rotator-flipper",
  name: "Image Rotator & Flipper",
  description: "Rotate images (90/180/270/custom) and flip (horizontal/vertical). Bulk processing.",
  category: "image",
  keywords: ["image rotator", "image flip", "rotate image", "flip image"],
  icon: "RotateCw",
  requiresNetwork: false,
  seo: {
    title: "Image Rotator & Flipper — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Rotate images (90/180/270/custom) and flip (horizontal/vertical). Bulk processing." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) Rotate 90° CW/CCW, (2) (2) Rotate 180°, (3) (3) Custom angle, (4) (4) Flip horizontal, (5) (5) Flip vertical, (6) (6) Bulk processing, (7) (7) Download rotated, (8) (8) Maintain quality, (9) (9) Per-image download, (10) (10) ZIP download, (11) (11) Before/after, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
