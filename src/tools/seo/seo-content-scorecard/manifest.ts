import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "seo-content-scorecard",
  name: "SEO Content Scorecard",
  description:
    "Audit content for SEO best practices. 10+ check categories, 0-100 score, pass/warn/fail per check, prioritized recommendations, markdown export, custom thresholds, history, shareable URL. 100% client-side.",
  category: "seo",
  keywords: [
    "seo audit", "content scorecard", "seo checker", "content quality",
    "headings audit", "word count", "readability", "image alt text",
    "schema markup", "seo score",
  ],
  icon: "clipboard-check",
  requiresNetwork: false,
  seo: {
    title: "SEO Content Scorecard — 10+ Category Audit | UnQTools",
    faq: [
      {
        q: "What does the scorecard check?",
        a: "Ten+ categories: title length, meta description length, H1 presence, heading hierarchy (H1-H6), keyword density, word count, readability (Flesch-Kincaid), internal links, image alt text, schema markup detection, mobile viewport, and duplicate H1s. Each check is graded pass / warn / fail with a 0-100 overall score.",
      },
      {
        q: "How is the overall score calculated?",
        a: "Each category gets a weight (title: 15, meta: 10, H1: 10, headings: 10, density: 10, word count: 10, readability: 10, links: 5, alt text: 10, schema: 5, viewport: 5). Pass = full weight, warn = half weight, fail = 0. Sum / total weight × 100 = score.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 10+ check categories. (2) Score (0-100). (3) Pass/warn/fail per check. (4) Prioritized recommendations sorted by impact. (5) Export report as Markdown. (6) Copy report. (7) Stats. (8) History (localStorage, last 20). (9) Shareable URL. (10) Custom thresholds (word count min/max, density target).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. Content analysis runs locally. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
