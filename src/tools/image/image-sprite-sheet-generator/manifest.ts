/**
 * Image Sprite Sheet Generator — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "image-sprite-sheet-generator",
  name: "Image Sprite Sheet Generator",
  description: "Generate CSS sprite sheets from multiple images. Automatic layout, CSS output, padding control.",
  category: "image",
  keywords: ["sprite sheet", "css sprite", "image sprite", "sprite generator"],
  icon: "Grid3x3",
  requiresNetwork: false,
  seo: {
    title: "Image Sprite Sheet Generator — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Generate CSS sprite sheets from multiple images. Automatic layout, CSS output, padding control." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) Auto-layout (horizontal/vertical/grid), (2) (2) Padding between sprites, (3) (3) CSS background-position output, (4) (4) JSON manifest, (5) (5) Drag-drop reorder, (6) (6) Custom dimensions, (7) (7) Download sprite sheet, (8) (8) Copy CSS, (9) (9) Copy JSON, (10) (10) Per-sprite preview, (11) (11) Bulk import, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
