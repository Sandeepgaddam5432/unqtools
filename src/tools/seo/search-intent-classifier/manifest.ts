import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "search-intent-classifier",
  name: "Search Intent Classifier",
  description:
    "Classify search intent — informational, transactional, navigational, or commercial. Confidence score, content recommendations, SERP feature suggestions, bulk keywords, intent distribution stats, CSV export, history, shareable URL. 100% client-side.",
  category: "seo",
  keywords: [
    "search intent", "user intent", "informational", "transactional",
    "navigational", "commercial", "intent classification", "seo",
  ],
  icon: "brain",
  requiresNetwork: false,
  seo: {
    title: "Search Intent Classifier — Informational / Transactional / Navigational / Commercial | UnQTools",
    faq: [
      {
        q: "What are the four search intent types?",
        a: "Informational — user wants to learn ('what is seo'). Navigational — user wants a specific site/brand ('ahrefs login'). Transactional — user wants to buy now ('buy nike shoes'). Commercial — user is researching before buying ('best seo tools 2026'). This tool detects each type from word patterns in the query.",
      },
      {
        q: "How is the confidence score calculated?",
        a: "Each intent type has a set of weighted word patterns. We sum the pattern matches per intent type and normalize to 0-100%. If one intent dominates clearly, confidence is high (90%+). If two intents tie, confidence is low (50-60%) and the keyword is reported as 'mixed'.",
      },
      {
        q: "What content recommendations are provided?",
        a: "Informational → write a how-to guide or FAQ page. Transactional → product page with clear CTA. Navigational → make sure your homepage or branded landing page ranks for the brand. Commercial → comparison table / review article. Each recommendation includes SERP feature suggestions (featured snippet, shopping, sitelinks).",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 4 intent types (informational / transactional / navigational / commercial). (2) Confidence score 0-100%. (3) Content recommendations per intent. (4) SERP feature suggestions per intent. (5) Bulk keyword classification. (6) Intent distribution stats. (7) Word pattern reference. (8) Export as CSV. (9) History (localStorage, last 20). (10) Shareable URL.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All classification runs locally. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
