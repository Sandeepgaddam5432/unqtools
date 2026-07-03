import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "bold-text-generator",
  name: "Bold Text Generator",
  description:
    "Convert text to 𝐛𝐨𝐥𝐝 Unicode styles — serif, sans, italic, script, fraktur, double-struck. Copy-paste into LinkedIn, Instagram, Discord. Decode back to normal. 100% private.",
  category: "text",
  keywords: [
    "bold text generator",
    "unicode bold",
    "bold font",
    "bold copy paste",
    "linkedin bold text",
    "bold unicode",
  ],
  icon: "type",
  requiresNetwork: false,
  seo: {
    title: "Bold Text Generator — serif, sans, script, fraktur Unicode bold | UnQTools",
    faq: [
      {
        q: "Is this a font or Unicode characters?",
        a: "These are real Unicode characters from the Mathematical Alphanumeric Symbols block (U+1D400+), not fonts. They copy-paste as text and render using your device's installed fonts.",
      },
      {
        q: "Can screen readers read bold Unicode text?",
        a: "Screen readers often read these as 'mathematical bold capital A' etc. — they're meant for visual styling, not semantic emphasis. Use real <strong> tags in HTML for accessible bold.",
      },
    ],
  },
  status: "done",
};
