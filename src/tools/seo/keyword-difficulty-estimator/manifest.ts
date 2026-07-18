import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "keyword-difficulty-estimator",
  name: "Keyword Difficulty Estimator",
  description:
    "Estimate keyword difficulty (0-100) from known factors — keyword length, word count, commercial intent, brand presence, SERP competition indicators. Bulk keywords, opportunity score, recommendations, CSV export, history, shareable URL. 100% client-side.",
  category: "seo",
  keywords: [
    "keyword difficulty", "kd", "seo difficulty", "competition",
    "serp competition", "opportunity score", "easy keywords", "hard keywords",
  ],
  icon: "gauge",
  requiresNetwork: false,
  seo: {
    title: "Keyword Difficulty Estimator — KD 0-100 + Recommendations | UnQTools",
    faq: [
      {
        q: "How is keyword difficulty calculated?",
        a: "We score each keyword 0-100 using a weighted blend of factors: word count (head terms score high), character length, presence of commercial-intent tokens (buy, cheap, price, deal), brand-like short tokens, question/comparison modifiers (which reduce difficulty), and intent prefix words (best, top). Each factor adds or subtracts points; the final score is clamped to 1-100.",
      },
      {
        q: "What do the categories Easy / Medium / Hard / Very Hard mean?",
        a: "Easy (<30) — a new site can rank with on-page SEO. Medium (30-54) — needs solid content + basic links. Hard (55-74) — needs established authority and consistent link building. Very Hard (75+) — dominated by major brands; new sites should target longer-tail variants instead.",
      },
      {
        q: "What is the opportunity score?",
        a: "Opportunity = (100 - difficulty) — adjusted for commercial intent. A keyword with low difficulty and high commercial intent has a high opportunity score (high ROI). Use it to prioritize which keywords to target first.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Difficulty score 0-100. (2) Difficulty factor breakdown (word count, commercial intent, brand, modifiers). (3) Recommendation engine (target/avoid/long-tail variant). (4) Bulk keyword analysis. (5) Sort by difficulty. (6) Difficulty categories (Easy/Medium/Hard/Very Hard). (7) Opportunity score. (8) Export as CSV. (9) History (localStorage, last 20). (10) Shareable URL.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All difficulty calculations run locally. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
