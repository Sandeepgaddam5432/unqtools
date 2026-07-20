import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-swot-analysis-creator",
  name: "AI SWOT Analysis Creator",
  description:
    "Generate a structured SWOT analysis (Strengths, Weaknesses, Opportunities, Threats) plus TOWS-derived strategy actions (SO/ST/WO/WT) from a business, product, project, or career description. 14 industry templates with concrete starter bullets, keyword-based enrichment from your description, editable quadrants, per-quadrant regeneration, prioritization scoring (impact × feasibility), and Markdown / JSON / HTML matrix export. Optional BYO-key LLM hook for depth — key stays 100% client-side. 100% offline.",
  category: "ai",
  keywords: [
    "swot analysis", "swot generator", "swot maker",
    "tows strategy", "swot matrix", "ai swot",
    "swot free no login", "strengths weaknesses opportunities threats",
    "business strategy generator", "swot analysis creator",
  ],
  icon: "layout-grid",
  requiresNetwork: false,
  seo: {
    title: "AI SWOT Analysis Creator — Structured SWOT + TOWS Strategy, Private | UnQTools",
    faq: [
      {
        q: "How does the SWOT analysis creator work?",
        a: "Enter a subject (company, product, project, or career), pick an industry from 14 templates, optionally add a goal and short description, then click Generate. The tool fills each of the four quadrants (Strengths, Weaknesses, Opportunities, Threats) with concrete starter bullets from the industry template, then enriches them with description-specific items detected via keyword rules (e.g. 'recurring' → a Strength, 'single founder' → a Weakness, 'AI' → an Opportunity, 'incumbent' → a Threat). It then derives TOWS strategy actions (SO, ST, WO, WT) by crossing strengths/weaknesses with opportunities/threats.",
      },
      {
        q: "What is TOWS and how are the strategy actions generated?",
        a: "TOWS is the action-oriented counterpart to SWOT. It crosses the four quadrants into four strategy types: SO (use Strengths to capture Opportunities), ST (use Strengths to defend against Threats), WO (fix Weaknesses to unlock Opportunities), and WT (mitigate Weaknesses to reduce Threat exposure). The generator emits one action per strength-opportunity, strength-threat, weakness-opportunity, and weakness-threat pair (capped to keep the output manageable), each scored by impact × feasibility so you can prioritize.",
      },
      {
        q: "What extras does this tool have compared to others?",
        a: "(1) 14 industry templates (saas, ecommerce, agency, restaurant, freelance, nonprofit, mobile-app, hardware, podcast, blog, consulting, retail, fintech, education) with 4 concrete bullets each. (2) Keyword-based quadrant enrichment from your description. (3) TOWS strategy-action generator (SO/ST/WO/WT). (4) Editable quadrants with per-quadrant regeneration. (5) Prioritization scoring (impact × feasibility) with sortable TOWS list. (6) Industry auto-detection from free-text. (7) SWOT validator (each quadrant has ≥1 item, impact in range). (8) Markdown export. (9) JSON export. (10) HTML 2×2 matrix export. (11) HTML TOWS table export. (12) Local history (max 20). (13) Shareable URL with all inputs encoded. (14) Optional BYO-key LLM enhancement hook with JSON-schema-constrained response. (15) Honesty disclaimers (SWOT is a starting framework, not validated strategy).",
      },
      {
        q: "Can I edit or regenerate a single quadrant without redoing the whole analysis?",
        a: "Yes. After generation, each quadrant is fully editable — add, edit, or remove bullets, adjust the impact score, and click Regenerate. The TOWS actions are re-derived automatically from the new quadrants. You can also clear a quadrant and rebuild it from scratch.",
      },
      {
        q: "Is my business description sent anywhere?",
        a: "No. All generation, enrichment, TOWS derivation, and rendering run locally in your browser. The BYO-key LLM hook only fires if you paste an API key into the optional field, and even then the request goes directly from your browser to the model endpoint — nothing is logged or stored on our servers. History is stored in localStorage on this device only. SWOT is a starting framework, not validated strategy or business advice — verify the bullets with real data.",
      },
    ],
  },
  status: "done",
};
