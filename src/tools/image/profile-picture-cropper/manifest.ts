/**
 * Profile Picture Cropper (Circle) — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "profile-picture-cropper",
  name: "Profile Picture Cropper (Circle)",
  description: "Crop images into circular profile pictures. Multiple sizes, border, background color.",
  category: "image",
  keywords: ["profile picture", "circular crop", "avatar maker", "pfp maker"],
  icon: "CircleUser",
  requiresNetwork: false,
  seo: {
    title: "Profile Picture Cropper (Circle) — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Crop images into circular profile pictures. Multiple sizes, border, background color." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) Circular crop, (2) (2) Multiple sizes (128/256/512/1024), (3) (3) Border color, (4) (4) Border width, (5) (5) Background color (for square export), (6) (6) Drag to reposition, (7) (7) Zoom, (8) (8) Download as PNG, (9) (9) Bulk crop, (10) (10) Live preview, (11) (11) Copy as data URL, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
