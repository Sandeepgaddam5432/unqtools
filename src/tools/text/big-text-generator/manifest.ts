import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "big-text-generator",
  name: "Big Text Generator",
  description:
    "Convert text to big, wide Unicode styles — fullwidth, bold sans, monospace, circled, squared. Copy-paste into bios, chats, and usernames. 100% private, accessibility-honest.",
  category: "text",
  keywords: [
    "big text generator",
    "fullwidth text",
    "large text",
    "wide font",
    "giant text",
    "big letters",
  ],
  icon: "type",
  requiresNetwork: false,
  seo: {
    title: "Big Text Generator — fullwidth & block letters, copy-paste | UnQTools",
    faq: [
      {
        q: "Will the big text copy-paste into Instagram/Twitter/Discord?",
        a: "Yes — all styles use real Unicode characters (Mathematical Alphanumeric Symbols, Enclosed Alphanumerics, Fullwidth Forms). They copy-paste as text, not images. Some platforms may not render every style — the accessibility note warns you which ones read oddly to screen readers.",
      },
      {
        q: "Are these fonts or Unicode characters?",
        a: "They are Unicode characters, not fonts. The characters already exist in Unicode (e.g., fullwidth A is U+FF21, bold sans A is U+1D5D4). Your device renders them using its installed fonts — no downloads needed.",
      },
    ],
  },
  status: "done",
};
