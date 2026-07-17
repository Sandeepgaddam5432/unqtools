import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "people-also-ask-extractor",
  name: "People Also Ask Extractor",
  description:
    "Extract and organize 'People Also Ask' style questions for content ideas. Question word selector (7 Ws), templates, bulk keyword input, dedup, count per type, CSV/markdown export, history. 100% client-side.",
  category: "seo",
  keywords: [
    "people also ask", "paa", "question keywords", "content ideas",
    "faq ideas", "seo questions", "question generator",
  ],
  icon: "help-circle",
  requiresNetwork: false,
  seo: {
    title: "People Also Ask Extractor — Generate PAA Questions | UnQTools",
    faq: [
      {
        q: "What does this tool do?",
        a: "Takes a topic or seed keyword and generates dozens of 'People Also Ask'-style questions using the 7 Ws (what, how, why, when, where, who, which) plus templated question patterns. Output is grouped by question word, deduped, and exportable as CSV or Markdown for use in FAQ schema or content briefs.",
      },
      {
        q: "Which question templates are used?",
        a: "Basic (What is X? How to X? Why X?), comparative (X vs Y?), how-many (How much does X cost?), how-long (How long does X take?), best-of (What are the best X?), and people-focused (Who needs X? Who uses X?). You can toggle which question words to include.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Question word selector (7 Ws). (2) Question templates (basic, comparative, how-many, how-long, best-of, people). (3) Bulk keyword input (one per line). (4) Dedup. (5) Question count per type. (6) Export as CSV. (7) Export as Markdown. (8) Copy. (9) History (localStorage, last 20). (10) Shareable URL.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. Question generation runs locally. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
