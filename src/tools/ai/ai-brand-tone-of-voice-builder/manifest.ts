import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-brand-tone-of-voice-builder",
  name: "AI Brand Tone of Voice Builder",
  description:
    "Build an AI-operable brand voice guide from your sample content. Six Nielsen-Norman-style tone dimensions (formal↔casual, funny↔serious, respectful↔irreverent, matter-of-fact↔enthusiastic, subversive↔conservative, cynical↔earnest), heuristic sample analysis, do/don't rules, approved/avoid vocabulary, sentence-rhythm notes, before/after examples, reusable system prompt, check-a-draft mode, inclusivity checks, Markdown/JSON export, history, shareable URL, optional BYO-key LLM. 100% client-side — your samples never leave the browser.",
  category: "ai",
  keywords: [
    "tone of voice", "brand voice", "voice guide", "brand voice generator",
    "tone dimensions", "nielsen norman tone", "voice profile",
    "ai operable voice", "system prompt", "do dont voice rules",
    "brand voice alternative", "hubspot brand voice",
  ],
  icon: "mic",
  requiresNetwork: false,
  seo: {
    title: "AI Brand Tone of Voice Builder — Voice Guide, Do/Don't, System Prompt | UnQTools",
    faq: [
      {
        q: "How does the brand tone of voice builder work?",
        a: "Paste 2–5 samples of your best on-brand content. The tool estimates six Nielsen-Norman-style tone dimensions (formal↔casual, funny↔serious, respectful↔irreverent, matter-of-fact↔enthusiastic, subversive↔conservative, cynical↔earnest) from linguistic cues (contractions, exclamation density, intensifiers, slang, humor markers). It then derives voice traits, do/don't rules, approved/avoid vocabulary, sentence-rhythm notes, before/after examples, and a reusable system prompt you can paste into any AI. Adjust any slider to override the estimate.",
      },
      {
        q: "What is the 'check-a-draft' mode?",
        a: "Switch to the Check-a-Draft tab, paste a new piece of writing, and the tool will estimate its dimensions, compare them against your saved voice profile, score the alignment 0–100, and surface specific fixes ('too many contractions for a formal voice', 'exclamation density is 3× your profile'). Use it as a pre-publish gate to keep content on-brand.",
      },
      {
        q: "Can I export the voice guide for use in other AI tools?",
        a: "Yes. The tool generates a reusable 'system prompt' — a single text block that describes your voice in AI-operable language (dimensions, traits, do/don't, vocabulary, rhythm, examples). Copy it into ChatGPT, Claude, Gemini, or any LLM that supports system prompts. You can also export the full guide as Markdown or JSON.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Six tone dimensions with heuristic sample-based estimation. (2) Adjustable sliders to override estimates. (3) Auto-derived voice traits. (4) Auto-derived do/don't rules per dimension combination. (5) Approved-vocabulary list (top non-stopword unigrams + bigrams from your samples). (6) Avoid-vocabulary list (jargon, ableist, gendered terms detected in samples). (7) Sentence-rhythm analysis (avg length, stddev, label). (8) Before/after worked examples. (9) Reusable system prompt for any AI. (10) Check-a-draft mode with score + fixes. (11) Flesch readability + grade level. (12) Inclusivity checks (ableist, gendered terms with replacements). (13) Markdown export. (14) JSON export. (15) History (localStorage, last 20). (16) Shareable URL with profile encoded. (17) Optional BYO-key LLM enhancement.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All sample analysis, dimension estimation, vocabulary derivation, system-prompt generation, check-a-draft scoring, and Markdown/JSON export run locally in your browser. Your samples never leave this device. The only network call is if you paste your own LLM API key and click 'Enhance with LLM' — that request goes directly from your browser to the LLM provider you choose (OpenAI or Anthropic).",
      },
    ],
  },
  status: "done",
};
