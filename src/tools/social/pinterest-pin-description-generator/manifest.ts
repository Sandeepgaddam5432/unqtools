import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pinterest-pin-description-generator",
  name: "Pinterest Pin Description Generator",
  description:
    "Generate SEO-optimized Pinterest pin descriptions with keyword-rich copy. 10 Pinterest category presets (diy, food, fashion, home-decor, beauty, travel, fitness, education, business, tech), keyword density calculator (1-3% optimal per keyword), category-specific openers, 4 CTA types (click, save, follow, comment), optional hashtag generator, keyword position optimizer (main keyword in first 100 chars), long-tail keyword suggester, 3 description length presets (short/medium/long), SEO score estimator, board name suggester, pin title generator (100 chars max), 3 variations per request, summary stats, CSV export, history (localStorage), shareable URL. 100% client-side.",
  category: "social",
  keywords: [
    "pinterest description", "pin description", "pinterest seo",
    "pinterest keywords", "pinterest pin", "pin title",
    "pinterest board", "pinterest caption", "keyword density",
    "pinterest description generator",
  ],
  icon: "pin",
  requiresNetwork: false,
  seo: {
    title: "Pinterest Pin Description Generator — SEO-Optimized Copy | UnQTools",
    faq: [
      {
        q: "How does the Pinterest pin description generator work?",
        a: "Enter your pin topic, pick a category (diy, food, fashion, home-decor, beauty, travel, fitness, education, business, or tech), and add your target keywords (comma-separated). The tool generates an SEO-optimized description with a category-specific opener, places your main keyword in the first 100 characters, ensures each keyword hits 1-3% density, suggests long-tail keyword variations, and adds an optional CTA (click, save, follow, or comment). You also get a suggested pin title (100 chars max) and board name based on your category and keywords.",
      },
      {
        q: "What is the optimal Pinterest description length?",
        a: "Pinterest allows up to 500 characters in the pin description. This tool offers three length presets: short (100-200 chars), medium (200-400 chars), and long (400-500 chars). Long descriptions tend to perform best for SEO because they let you naturally repeat keywords and include long-tail variations.",
      },
      {
        q: "How is keyword density calculated?",
        a: "Keyword density = (number of times the keyword appears × word length) / total words in the description. The optimal range is 1-3% per keyword — below 1% is too sparse to rank, above 3% looks spammy to Pinterest's algorithm. The tool flags any keyword that falls outside the optimal range.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 10 Pinterest category presets. (2) Description generator (keyword-rich, SEO-optimized). (3) Keyword density calculator (1-3% optimal per keyword). (4) Category-specific opener generator. (5) CTA generator (4 types: click, save, follow, comment). (6) Hashtag generator (optional). (7) Keyword position optimizer (main keyword in first 100 chars). (8) Long-tail keyword suggester (from main keywords). (9) 3 description length presets (short/medium/long). (10) Render as text description. (11) Render as CSV (component, value). (12) Copy + Download .txt + Download CSV. (13) History (localStorage, last 20). (14) Shareable URL (inputs encoded in hash). (15) Summary stats (char count, keyword count, keyword density, hashtag count). (16) Description variation generator (3 variations). (17) SEO score estimator (based on keyword placement + density). (18) Board name suggester (based on category + keywords). (19) Pin title generator (separate from description — 100 chars max).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All pin description generation runs locally in your browser. No network calls are made — your topic and keywords never leave your device. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
