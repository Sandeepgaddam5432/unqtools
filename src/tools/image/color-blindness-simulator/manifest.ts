/**
 * Color Blindness Simulator — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "color-blindness-simulator",
  name: "Color Blindness Simulator",
  description: "Simulate how images appear to users with color blindness (protanopia, deuteranopia, tritanopia, etc.).",
  category: "image",
  keywords: ["color blindness", "color blind", "protanopia", "deuteranopia", "accessibility"],
  icon: "Eye",
  requiresNetwork: false,
  seo: {
    title: "Color Blindness Simulator — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Simulate how images appear to users with color blindness (protanopia, deuteranopia, tritanopia, etc.)." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) Protanopia simulation, (2) (2) Deuteranopia simulation, (3) (3) Tritanopia simulation, (4) (4) Achromatopsia, (5) (5) Protanomaly, (6) (6) Deuteranomaly, (7) (7) Tritanomaly, (8) (8) Side-by-side comparison, (9) (9) Bulk processing, (10) (10) Download simulated, (11) (11) Accessibility score, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
