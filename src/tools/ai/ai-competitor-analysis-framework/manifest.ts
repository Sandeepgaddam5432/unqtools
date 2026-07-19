import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-competitor-analysis-framework",
  name: "AI Competitor Analysis Framework Draft",
  description:
    "Generate a structured competitive-analysis draft from your inputs: feature/pricing comparison matrix, per-competitor SWOT, Porter's Five Forces, market positioning map, and white-space opportunity callouts. Multiple frameworks (SWOT, Feature Grid, Porter's, Perceptual Map) with synthesis of your notes. 100% client-side — your inputs never leave the browser. Optional BYO-key LLM polish.",
  category: "ai",
  keywords: [
    "competitor analysis", "competitive analysis", "swot",
    "porter's five forces", "feature comparison", "positioning map",
    "perceptual map", "white space analysis", "market positioning",
    "competitive matrix", "competitor matrix",
  ],
  icon: "microscope",
  requiresNetwork: false,
  seo: {
    title: "AI Competitor Analysis Framework Draft — SWOT, Porter's, Matrix, Positioning Map | UnQTools",
    faq: [
      {
        q: "How does the competitor analysis framework tool work?",
        a: "Enter your company and your competitors (one per line). For each competitor (and your own company), paste notes on their strengths, weaknesses, pricing, and key features. The tool scaffolds a rigorous competitive-analysis draft across four frameworks: a feature/pricing comparison matrix, per-competitor SWOTs, Porter's Five Forces (synthesized from your notes), and a market positioning map with white-space callouts. You supply the facts; it structures and synthesizes the analysis — it does not browse live competitor data.",
      },
      {
        q: "Which frameworks are supported?",
        a: "Four: (1) Feature/pricing comparison matrix — your company plus N competitors across features and pricing tier. (2) Per-competitor SWOT (strengths, weaknesses, opportunities, threats) scaffolded from your notes. (3) Porter's Five Forces — buyer power, supplier power, threat of new entrants, threat of substitutes, competitive rivalry — each rated low/medium/high and synthesized from your notes. (4) Perceptual positioning map with two selectable axes (e.g., price vs. quality) plotting you and your competitors, plus white-space callouts where no competitor occupies a quadrant.",
      },
      {
        q: "What are 'white-space opportunities' and how does the tool find them?",
        a: "White-space opportunities are gaps in the competitive landscape where no competitor (and not you) currently occupies a strong position. The tool computes these in two ways: (1) on the positioning map, it flags quadrants that are empty or thinly populated as candidates for white space; (2) in the feature matrix, it flags features that are absent across all competitors (green-field) or features where you are the only one missing (catch-up gaps). Each white-space callout cites the specific gap it is based on, so you can audit the inference.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Four frameworks: SWOT, Feature/pricing matrix, Porter's Five Forces, Positioning map. (2) Feature/pricing matrix with you + N competitors, auto-filling absent cells with '—'. (3) Per-competitor SWOT scaffolded from your notes. (4) Porter's Five Forces with low/medium/high ratings and synthesis notes. (5) Positioning map with two selectable axes (price, quality, ease-of-use, niche-vs-broad, enterprise-vs-SMB). (6) Auto-derived white-space opportunities citing their source gaps. (7) Live preview as you type. (8) Validation warnings (thin inputs, generic phrasing). (9) Markdown report export. (10) JSON export. (11) Copy individual section button. (12) History (localStorage, last 20). (13) Shareable URL with all inputs encoded. (14) Optional BYO-key LLM polish (OpenAI/Anthropic).",
      },
      {
        q: "Is my data sent anywhere, and can the tool browse live competitor data?",
        a: "No. All framework assembly, synthesis, white-space detection, and Markdown/JSON export run locally in your browser. Your company inputs never leave this device. The tool cannot browse or verify live competitor pricing or features — it structures and reasons over the facts you provide and flags anything it inferred. Analysis quality depends on your inputs. The only network call is if you paste your own LLM API key and click 'Polish with LLM' — that request goes directly from your browser to OpenAI or Anthropic.",
      },
    ],
  },
  status: "done",
};
