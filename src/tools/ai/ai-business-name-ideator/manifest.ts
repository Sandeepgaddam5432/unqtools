import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-business-name-ideator",
  name: "AI Business Name Ideator",
  description:
    "Generate 30+ themed business / brand name ideas from your keywords, industry, and style (modern, classic, playful, techy) using combinatorial templates — compounds, portmanteaus, invented words, affixes, alliteration. Brandability scoring (length, syllables, pronounceability, uniqueness), suggested domain patterns with one-click registrar links, social-handle patterns, trademark-caution note, tagline pairing, favorites, CSV export, history (localStorage), shareable URL, optional BYO-key LLM polish. 100% client-side — name generation never leaves the browser.",
  category: "ai",
  keywords: [
    "business name generator", "brand name ideas", "startup name generator",
    "domain name ideator", "company name generator", "brandable name",
    "name ideas", "compound name", "portmanteau", "invented name",
    "alliterative name", "name brainstorm", "naming tool",
  ],
  icon: "sparkles",
  requiresNetwork: false,
  seo: {
    title: "AI Business Name Ideator — Styled Names + Domain Check, Private | UnQTools",
    faq: [
      {
        q: "How does the business name ideator work?",
        a: "Enter 1–5 keywords, your industry, and a style (modern, classic, playful, techy). The tool combines your keywords with built-in prefixes, suffixes, real words, foreign roots, blends, and alliteration patterns to generate 30+ candidate names. Each candidate is scored for brandability (length, syllable count, pronounceability, Latin-root uniqueness) and tagged with the technique used to build it (compound, portmanteau, invented, affixed, alliterative). You can favorite, copy, export, and share — all without an account.",
      },
      {
        q: "Can this tool check if a domain is available?",
        a: "Actual real-time DNS / RDAP lookups require a network call. To stay 100% client-side by default, the tool generates suggested domain patterns for each name (yourname.com, yourname.io, yourname.co, get yourname.com) and gives you one-click deep links into Namecheap and Google Domains search so you can verify availability yourself. If you explicitly enable the 'Live DNS check (network)' toggle, the tool can query DNS-over-HTTPS resolvers — that toggle is the only network path, and it is clearly flagged.",
      },
      {
        q: "What is the brandability score?",
        a: "A transparent heuristic from 0 to 100. It combines (1) length — sweet spot 5–9 chars; (2) syllable count — sweet spot 2–3 syllables; (3) pronounceability — vowel/consonant alternation + no awkward clusters; (4) uniqueness — distance from common English words. Each component is shown so you understand why a name scored the way it did. The score is an indicator, not a guarantee — your market testing is the real test.",
      },
      {
        q: "What extra features does this tool have compared to other name generators?",
        a: "(1) Four style presets (modern, classic, playful, techy) each shaping the affix/root pool. (2) Six generation techniques (compound, portmanteau, invented, prefix, suffix, alliterative). (3) Brandability score with per-component breakdown. (4) Domain pattern suggestions + one-click registrar links. (5) Social-handle pattern suggestions. (6) Trademark caution note + link to USPTO / WIPO search. (7) Tagline pairing per name. (8) Favorites list (localStorage). (9) CSV export of all names + scores. (10) Markdown export. (11) JSON export with full inputs. (12) Length & syllable sliders. (13) Live count + dedupe. (14) History (localStorage, last 20). (15) Shareable URL with all inputs encoded. (16) Optional BYO-key LLM polish (OpenAI/Anthropic). (17) Optional live DNS-over-HTTPS availability check (clearly flagged as network).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All name generation, brandability scoring, domain-pattern suggestion, favorites, history, and CSV/Markdown/JSON export run locally in your browser. Your keywords never leave this device. The only network paths are: (1) if you click an external registrar link (Namecheap / Google Domains) — that opens a new tab and searches the registrar's site directly; (2) if you explicitly toggle on the live DNS-over-HTTPS availability check — that queries Cloudflare/Google DoH resolvers directly from your browser; (3) if you paste your own LLM API key and click 'Polish with LLM' — that request goes directly to the LLM provider you choose. None of these paths send your data to UnQTools servers.",
      },
    ],
  },
  status: "done",
};
