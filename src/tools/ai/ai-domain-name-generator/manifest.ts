import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-domain-name-generator",
  name: "AI Domain Name Generator",
  description:
    "Generate short, brandable domain names from a keyword or idea using combinatorial templates (prefix + root + suffix, blends, compounds, coined words) × TLD patterns (.com, .io, .ai, .co, .app, .so, .dev, .xyz). Brandability score (memorability, pronounceability, length, uniqueness), TLD suggestions with one-click registrar-neutral search links (Namecheap + Google Domains), social-handle patterns, trademark-caution note, filters (length / no-hyphen / no-number), favorites, CSV/Markdown/JSON export, history (localStorage, last 20), shareable URL, optional BYO-key LLM polish. 100% client-side — name generation never leaves the browser.",
  category: "ai",
  keywords: [
    "domain name generator", "brandable domain ideas", "domain ideator",
    "registrar neutral domain search", "namelix alternative", "godaddy alternative free",
    "domain brainstorm", "tld suggestions", "domain finder",
    "domain name ideas", "ai domain generator", "available domain check",
  ],
  icon: "globe",
  requiresNetwork: false,
  seo: {
    title: "AI Domain Name Generator — Brandable Names + TLDs, Private | UnQTools",
    faq: [
      {
        q: "How does the domain name generator work?",
        a: "Enter 1–5 keywords and an optional style (modern, classic, playful, techy). The tool combines your keywords with built-in prefixes, suffixes, real words, foreign roots, blends, and alliteration patterns to produce 30+ candidate brandable names. Each candidate is scored for brandability (length, syllables, pronounceability, uniqueness) and paired with TLD suggestions (.com, .io, .ai, .co, .app, .so, .dev, .xyz). For each domain pattern you get one-click deep links into registrar-neutral search results (Namecheap + Google Domains) so you can verify availability yourself.",
      },
      {
        q: "Can this tool check if a domain is actually available?",
        a: "Real-time DNS / RDAP lookups require a network call. To stay 100% client-side by default, the tool generates domain patterns for each candidate name and gives you one-click deep links into registrar-neutral search pages (Namecheap, Google Domains) so you can verify availability on the registrar you choose — we don't steer you to any one registrar. If you explicitly enable the 'Live DNS-over-HTTPS check (network)' toggle, the tool can query Cloudflare/Google DoH resolvers directly from your browser; that toggle is the only network path, and it is clearly flagged. Always confirm availability and pricing at checkout before you buy.",
      },
      {
        q: "What is the brandability score?",
        a: "A transparent heuristic from 0 to 100. It combines (1) length — sweet spot 5–9 chars; (2) syllable count — sweet spot 2–3 syllables; (3) pronounceability — vowel/consonant alternation + no awkward clusters; (4) memorability — repetition, alliteration, distinctive sounds; (5) uniqueness — distance from common English words. Each component is shown so you understand why a name scored the way it did. The score is an indicator, not a guarantee — your market testing is the real test.",
      },
      {
        q: "What extra features does this tool have compared to other domain generators?",
        a: "(1) Four style presets (modern, classic, playful, techy) each shaping the affix/root pool. (2) Six generation techniques (compound, portmanteau, invented, prefix, suffix, alliterative). (3) Brandability score with per-component breakdown. (4) 8-TLD suggestion grid per name (.com, .io, .ai, .co, .app, .so, .dev, .xyz). (5) Registrar-neutral search links (Namecheap + Google Domains). (6) Social-handle pattern suggestions. (7) Trademark caution note + link to USPTO / WIPO search. (8) Filters (length, no-hyphen, no-number, TLD). (9) Favorites list (localStorage). (10) CSV/Markdown/JSON export. (11) History (localStorage, last 20). (12) Shareable URL with all inputs encoded. (13) Optional BYO-key LLM polish (OpenAI/Anthropic). (14) Optional live DNS-over-HTTPS availability check (clearly flagged as network). (15) Honesty disclaimer: pricing/availability change second-to-second — always verify at checkout.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All name generation, brandability scoring, TLD-pattern suggestion, favorites, history, and CSV/Markdown/JSON export run locally in your browser. Your keywords never leave this device. The only network paths are: (1) if you click an external registrar link (Namecheap / Google Domains) — that opens a new tab and searches the registrar's site directly; (2) if you explicitly toggle on the live DNS-over-HTTPS availability check — that queries Cloudflare/Google DoH resolvers directly from your browser; (3) if you paste your own LLM API key and click 'Polish with LLM' — that request goes directly to the LLM provider you choose. None of these paths send your data to UnQTools servers.",
      },
    ],
  },
  status: "done",
};
