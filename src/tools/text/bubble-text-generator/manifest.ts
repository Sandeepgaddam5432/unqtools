import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "bubble-text-generator",
  name: "Bubble Text Generator",
  description:
    "Turn text into ⓑⓤⓑⓑⓛⓔ circled, 🅐🅑🅒 negative circled, and 🄰🄱 squared Unicode letters. Copy-paste anywhere. Decode back to normal. 100% private.",
  category: "text",
  keywords: ["bubble text", "circled text", "bubble letters", "bubble font", "circled unicode"],
  icon: "type",
  requiresNetwork: false,
  component: () => import("./ui"),
  seo: {
    title: "Bubble Text Generator — circled & squared Unicode | UnQTools",
    faq: [
      {
        q: "Why do some lowercase letters look different in negative circled style?",
        a: "Unicode doesn't have negative circled lowercase letters — only uppercase. The tool falls back to regular circled lowercase (ⓐ) when negative circled lowercase isn't available.",
      },
    ],
  },
  status: "done",
};
