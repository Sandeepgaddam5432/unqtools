/**
 * Complementary Color Finder — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "complementary-color-finder",
  name: "Complementary Color Finder",
  description: "Find complementary, analogous, triadic, tetradic, and split-complementary color schemes.",
  category: "image",
  keywords: ["complementary color", "color scheme", "color harmony", "analogous colors"],
  icon: "Pair",
  requiresNetwork: false,
  seo: {
    title: "Complementary Color Finder — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Find complementary, analogous, triadic, tetradic, and split-complementary color schemes." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) Complementary, (2) (2) Analogous, (3) (3) Triadic, (4) (4) Tetradic, (5) (5) Split-complementary, (6) (6) Square, (7) (7) Custom angle, (8) (8) Hex/RGB/HSL input, (9) (9) Copy all colors, (10) (10) Export palette, (11) (11) Live preview, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
