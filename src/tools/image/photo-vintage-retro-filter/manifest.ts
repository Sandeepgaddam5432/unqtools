/**
 * Photo Vintage/Retro Filter — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "photo-vintage-retro-filter",
  name: "Photo Vintage/Retro Filter",
  description: "Apply vintage and retro film filters to photos. 20+ presets (Polaroid, Kodak, sepia, faded).",
  category: "image",
  keywords: ["vintage filter", "retro filter", "film filter", "photo effects"],
  icon: "Camera",
  requiresNetwork: false,
  seo: {
    title: "Photo Vintage/Retro Filter — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Apply vintage and retro film filters to photos. 20+ presets (Polaroid, Kodak, sepia, faded)." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) 20+ vintage presets, (2) (2) Polaroid effect, (3) (3) Kodak film, (4) (4) Sepia, (5) (5) Faded, (6) (6) Grain, (7) (7) Vignette, (8) (8) Light leaks, (9) (9) Download as PNG, (10) (10) Bulk processing, (11) (11) Before/after, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
