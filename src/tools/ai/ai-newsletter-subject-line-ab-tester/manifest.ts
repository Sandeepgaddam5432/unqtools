import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-newsletter-subject-line-ab-tester",
  name: "AI Newsletter Subject Line A/B Tester",
  description:
    "Generate newsletter subject-line variants by angle (curiosity, urgency, benefit, personalization, question), transparently score each for open-rate potential (length, spam triggers, emoji, personalization, clarity), preview desktop/mobile truncation, lint spam risks, and compute a proper A/B test — sample size, split %, runtime, and two-proportion z-test for significance. Pure-JS template engine with optional BYO-key LLM. 100% client-side.",
  category: "ai",
  keywords: [
    "subject line tester", "email subject line", "newsletter open rate",
    "a/b test subject line", "subject line generator", "email split test",
    "open rate optimizer", "ab testing calculator",
  ],
  icon: "mail",
  requiresNetwork: false,
  seo: {
    title: "Newsletter Subject Line A/B Tester — Generate, Score, Test | UnQTools",
    faq: [
      {
        q: "How does the newsletter subject line A/B tester work?",
        a: "Enter your topic and (optionally) an audience hint. The tool generates five or more subject-line variants across five proven angles — curiosity, urgency, benefit, personalization, and question — then scores each variant on a 0-100 open-rate-potential scale. Each score is broken down by contributing factor (length, spam-trigger risk, emoji usage, personalization tokens, clarity, capitalization/punctuation) so you can see exactly why one variant out-scores another. You can A/B test the top variants using the built-in sample-size and significance calculator.",
      },
      {
        q: "What scoring factors are used?",
        a: "Six heuristic factors, each contributing a sub-score: (1) Length — 30-60 characters is optimal on mobile; longer subject lines get truncated. (2) Spam triggers — known spam words (FREE, GUARANTEE, $$, !!!, ALL CAPS, etc.) penalize. (3) Emoji — one emoji can boost opens, two or more tend to hurt. (4) Personalization — tokens like [name] or [city] add a small bonus. (5) Clarity — clear, concrete language scores higher than vague hype. (6) Capitalization/punctuation — excessive caps or punctuation flags as spammy. Scores are heuristic predictions, not open-rate guarantees — your real audience decides.",
      },
      {
        q: "How does the A/B test calculator work?",
        a: "Enter your total list size, the number of variants you want to test (2-5), your baseline open rate, the minimum detectable effect (the lift you want to reliably see, e.g. 10%), and the desired statistical power (typically 80%). The tool computes the required sample size per variant using a standard two-proportion power formula, the recommended split (e.g. 10% holdout + 90% test, or equal splits), the estimated runtime based on daily send volume, and after the test runs you can enter observed opens/sends to compute a two-proportion z-test and check statistical significance.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Five subject-line angle templates (curiosity, urgency, benefit, personalization, question). (2) Generate 5+ variants per topic. (3) Transparent scoring with per-factor breakdown bars. (4) Inbox truncation preview (desktop ~60 chars, mobile ~30-40 chars). (5) Preheader preview. (6) Spam-trigger + all-caps/excess-punctuation linter. (7) A/B sample-size calculator (power-based). (8) Two-proportion z-test for significance. (9) Variant comparison table sorted by score. (10) Auto-pick winner. (11) Copy/download variants as CSV. (12) History (localStorage, last 20). (13) Shareable URL. (14) Topic presets. (15) Optional BYO-key LLM enhancement. Apple MPP note included.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All variant generation, scoring, linting, and the stats engine run locally in your browser. Topic and audience text never leave this device. The only network call is if you paste your own LLM API key and click 'Enhance with LLM' — that request goes directly from your browser to the LLM provider you choose. Note: Apple Mail Privacy Protection (MPP) inflates open rates since 2021; this tool flags that and nudges toward click-based testing for definitive results.",
      },
    ],
  },
  status: "done",
};
