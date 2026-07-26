/**
 * Noise Texture Generator — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "noise-texture-generator",
  name: "Noise Texture Generator",
  description: "Generate noise textures (Perlin, Simplex, Value, Worley) as seamless tiles for games/design.",
  category: "image",
  keywords: ["noise texture", "perlin noise", "simplex noise", "texture generator"],
  icon: "Waves",
  requiresNetwork: false,
  seo: {
    title: "Noise Texture Generator — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Generate noise textures (Perlin, Simplex, Value, Worley) as seamless tiles for games/design." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) Perlin noise, (2) (2) Simplex noise, (3) (3) Value noise, (4) (4) Worley (cellular), (5) (5) Seamless tiling, (6) (6) Resolution control, (7) (7) Octaves, (8) (8) Persistence, (9) (9) Lacunarity, (10) (10) Download as PNG, (11) (11) Copy as data URL, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
