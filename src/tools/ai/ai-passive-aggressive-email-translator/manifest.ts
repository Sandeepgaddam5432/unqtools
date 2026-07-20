import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-passive-aggressive-email-translator",
  name: "AI Passive-Aggressive Email Translator",
  description:
    "Decode passive-aggressive corporate emails into plain-English 'what they actually mean', with a 0–100 passive-aggression score, inline phrase highlighting, escalation meter, and a Defuse mode that rewrites your own angry drafts into Calm / Professional / Warm / Direct tones. Built-in glossary of 60+ classic corporate phrases ('per my last email', 'as I mentioned', 'going forward', 'gentle reminder', 'do the needful'). Pure-JS engine — optional BYO-key LLM. 100% client-side, nothing uploaded.",
  category: "ai",
  keywords: [
    "passive aggressive email", "decode email meaning", "email tone analyzer",
    "corporate jargon translator", "passive aggression score", "defuse email",
    "rewrite email tone", "professional email rewriter", "work email decoder",
    "tone fixer",
  ],
  icon: "mail-warning",
  requiresNetwork: false,
  seo: {
    title: "AI Passive-Aggressive Email Translator — Decode + Defuse, Private | UnQTools",
    faq: [
      {
        q: "How does the Passive-Aggressive Email Translator work?",
        a: "Two modes. (1) Decode: paste a corporate email and the engine scans it against a curated glossary of 60+ passive-aggressive phrases — 'per my last email', 'as I mentioned', 'going forward', 'gentle reminder', 'do the needful', 'please advise', 'just checking in', and more. Each match is highlighted inline with a plain-English 'what they actually mean' tooltip, a severity rating (low/medium/high), and an escalation weight. The hits are aggregated into a 0–100 passive-aggression score plus an escalation meter ('mild' → 'HR incident territory'). (2) Defuse: paste your own angry/passive-aggressive draft, pick a tone (Calm / Professional / Warm / Direct), and the engine rewrites each flagged phrase into constructive language while preserving your intent.",
      },
      {
        q: "What phrases does the glossary recognize?",
        a: "60+ classic corporate passive-aggressive phrases across six categories: (1) Point-scoring ('per my last email', 'as I mentioned', 'as we discussed', 'for your reference'); (2) Fake politeness ('kindly', 'please advise', 'just checking in', 'gentle reminder'); (3) Hostile directives ('do the needful', 'going forward', 'going ahead with', 'as per my previous email'); (4) Conditional threats ('if you could', 'at your earliest convenience', 'when you get a chance'); (5) Exclusion/sarcasm ('as you may or may not be aware', 'I'm sure you're aware', 'just to confirm'); (6) Bureaucratic padding ('per our conversation', 'in re', 'reaching out', 'touch base'). Each entry has a plain-English gloss, a severity rating, and an escalation weight.",
      },
      {
        q: "How is the passive-aggression score calculated?",
        a: "Each detected phrase carries an escalation weight (1–3). The raw score is the sum of escalation weights × severity multipliers (low=1, medium=2, high=3), normalized against text length and clamped to 0–100. A short email with three high-severity phrases will score higher than a long email with the same three phrases (density matters). The escalation meter buckets the score into 5 levels: 'mild', 'annoyed', 'passive-aggressive', 'hostile', 'HR incident territory'. The tool flags low-confidence calls (single hit, ambiguous phrasing) so you can read the score in context.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 60+ phrase passive-aggression glossary across 6 categories. (2) Decode mode with inline highlight + plain-English tooltip per phrase. (3) 0–100 passive-aggression score. (4) Escalation meter (5 levels). (5) Per-phrase severity (low/medium/high) + escalation weight. (6) Defuse mode rewrites into Calm / Professional / Warm / Direct tones. (7) Side-by-side original vs defused diff. (8) Per-phrase 'why this reads as passive-aggressive' explanation. (9) Sample email presets (decoded + defused). (10) Statistics (phrase count, by category, by severity). (11) Copy/download decoded summary or defused rewrite. (12) Local history (localStorage, last 20). (13) Shareable URL. (14) Honesty disclaimer (tone is subjective — read is not a verdict). (15) Optional BYO-key LLM enhancement.",
      },
      {
        q: "Is my email text sent anywhere?",
        a: "No. All phrase matching, scoring, and rewriting runs locally in your browser. Your emails never leave this device. The only network call is if you paste your own LLM API key (OpenAI or Anthropic) and click 'Enhance with LLM' — that request goes directly from your browser to the provider you choose. History is stored in localStorage on this device only and can be cleared at any time.",
      },
    ],
  },
  status: "done",
};
