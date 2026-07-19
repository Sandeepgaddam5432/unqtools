import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-jargon-simplifier",
  name: "AI Jargon Simplifier",
  description:
    "Turn dense technical, medical, legal, and financial text into plain English. Built-in jargon-to-plain dictionary (200+ terms across tech, medical, legal, financial domains), reading-level slider (grade 5–12/expert), inline glossary tooltips, locked tokens for figures/dates/citations, side-by-side diff, Flesch–Kincaid readability before/after, and history. Pure-JS engine — optional BYO-key LLM. 100% client-side, nothing uploaded.",
  category: "ai",
  keywords: [
    "jargon simplifier", "plain language converter", "simplify technical text",
    "decode legalese", "medical jargon translator", "financial jargon",
    "readability", "flesch-kincaid", "plain english",
  ],
  icon: "book-open-text",
  requiresNetwork: false,
  seo: {
    title: "AI Jargon Simplifier — Plain English, Private, On-Device | UnQTools",
    faq: [
      {
        q: "How does the AI Jargon Simplifier work?",
        a: "Paste jargon-heavy text and the engine scans it against a 200+ term plain-language dictionary spanning tech, medical, legal, and financial domains. Detected jargon is highlighted inline with a plain alternative shown as a tooltip. Adjust the reading-level slider (grade 5–12 or expert) and the engine re-renders, swapping denser synonyms in for higher levels and simpler phrasing in for lower levels. Locked tokens (figures, dates, dosages, citations) are preserved exactly.",
      },
      {
        q: "Which domains does the jargon dictionary cover?",
        a: "Four domains: (1) Technical (API, latency, refactor, idempotent, polymorphism, microservices, async, etc.). (2) Medical (hypertension, subcutaneous, contraindication, prognosis, etc.). (3) Legal (force majeure, indemnify, heretofore, notwithstanding, tort, etc.). (4) Financial (amortization, deleveraging, derivative, ETF, hedge, leverage, liquidity, etc.). Each entry has a plain-English gloss and a simplified replacement used at the chosen reading level.",
      },
      {
        q: "What does the 'preserve exactly' lock do?",
        a: "Lock mode wraps figures, dates, dosages, percentages, and citation patterns (Smith v. Jones, 2020; DOI: 10.xxxx) in protected tokens so they are never altered by simplification. This is critical for legal citations, medical dosages, and financial figures — the engine preserves them verbatim even while rewriting the surrounding sentence.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 200+ term jargon→plain dictionary across 4 domains. (2) Reading-level slider (grade 5/8/12/expert) with live re-render. (3) Inline glossary tooltips on detected jargon. (4) Preserve-exactly locks for figures/dates/citations/dosages. (5) Side-by-side original vs simplified diff. (6) Flesch reading ease + grade level before/after. (7) Domain presets (tech/medical/legal/financial/all). (8) Sentence-splitter for long sentences (over 25 words). (9) Custom ignore list (session). (10) Statistics (jargon count, by domain, sentence count). (11) Copy/download simplified text. (12) History (localStorage, last 20). (13) Shareable URL. (14) Sample text presets. (15) Optional BYO-key LLM enhancement.",
      },
      {
        q: "Is my text sent anywhere?",
        a: "No. All simplification, glossary matching, and readability scoring run locally in your browser. Text never leaves this device. The only network call is if you paste your own LLM API key and click 'Enhance with LLM' — that request goes directly from your browser to the LLM provider you choose.",
      },
    ],
  },
  status: "done",
};
