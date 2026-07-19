import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-instagram-bio-generator",
  name: "AI Instagram Bio Generator",
  description:
    "Generate scroll-stopping Instagram bios within the 150-character limit. Built-in template library for creator, business, personal, and brand account types — each variant comes with tasteful emojis, line breaks, a call-to-action (link in bio / DM / shop / book), relevant hashtag suggestions, and matching username/handle ideas. Live character counter with emoji-width handling, A/B bio pairs, searchable keyword optimization, tone presets (aesthetic, bold, minimal, playful, professional), niche presets, favorites (localStorage), history (last 20), and shareable URL. 100% client-side — optional BYO-key LLM enhancement.",
  category: "ai",
  keywords: [
    "instagram bio generator", "ig bio ideas", "instagram bio with emojis",
    "aesthetic bio generator", "bio for instagram", "150 character bio",
    "creator bio", "business bio", "ig handle ideas", "instagram username ideas",
    "no login bio generator", "private bio tool",
  ],
  icon: "instagram",
  requiresNetwork: false,
  seo: {
    title: "AI Instagram Bio Generator — 150-Char Bios with Emojis, Hashtags & CTA | UnQTools",
    faq: [
      {
        q: "How does the AI Instagram Bio Generator work?",
        a: "Pick an account type (creator, business, personal, brand), enter your niche and name, choose a tone (aesthetic, bold, minimal, playful, professional), and pick a CTA (link in bio, DM me, shop now, book now, follow). The tool composes multiple bio variants from a built-in template library, each fitting Instagram's 150-character limit with emojis and line breaks, plus matching hashtag suggestions and username/handle ideas.",
      },
      {
        q: "How is the 150-character limit handled with emojis and line breaks?",
        a: "Every generated bio is scored against Instagram's 150-character limit. The counter treats each emoji as one character (matching Instagram's own UI for most common emojis) and counts line breaks as one character. Variants that exceed the limit are auto-trimmed and flagged with a warning so you can edit before publishing.",
      },
      {
        q: "Can I generate A/B test pairs for my Instagram bio?",
        a: "Yes. Each run produces an A/B pair — a control bio and a challenger bio drawn from different templates and tones — with a hypothesis explaining what the challenger tests (e.g., 'minimal vs bold framing'). Use these as the starting point for real A/B tests; bio performance depends on your audience and niche, so measure impressions and profile clicks rather than assuming one style always wins.",
      },
      {
        q: "Can I use my own LLM API key for more creative bios?",
        a: "Yes. The tool builds an optimal prompt (account type + niche + tone + CTA + 150-char constraint) and calls OpenAI or Anthropic with a key you paste — stored only in localStorage on this device. Without a key, the on-device template engine produces solid baseline bios fully offline. Nothing is uploaded unless you opt in.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 4 account types (creator, business, personal, brand). (2) 5 tone presets (aesthetic, bold, minimal, playful, professional). (3) 5 CTA presets (link in bio, DM me, shop now, book now, follow). (4) Live 150-char counter with emoji handling. (5) Auto-trim + warning on overflow. (6) Hashtag suggestions per niche. (7) Username/handle idea generator. (8) A/B bio pairs with hypothesis. (9) Searchable keyword optimization for bio discovery. (10) Niche presets (10+). (11) Favorites (localStorage). (12) Copy + Download (text/JSON/CSV/Markdown). (13) Optional BYO-key LLM enhancement. (14) History (localStorage, last 20). (15) Shareable URL.",
      },
    ],
  },
  status: "done",
};
