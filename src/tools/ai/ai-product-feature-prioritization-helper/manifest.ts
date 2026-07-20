import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-product-feature-prioritization-helper",
  name: "AI Product Feature Prioritization Helper (RICE)",
  description:
    "Score and rank your feature backlog using RICE (Reach × Impact × Confidence ÷ Effort) with an auto-ranked, sortable table. Also includes ICE, MoSCoW, and WSJF framework views, sensitivity analysis, CSV/Markdown export, and an optional AI-assist that drafts R/I/C/E scores from a feature description. Pure-JS scoring engine — optional BYO-key LLM. 100% client-side, nothing uploaded.",
  category: "ai",
  keywords: [
    "rice prioritization", "rice score calculator", "feature prioritization",
    "rice ice moscow wsjf", "product management tool",
    "backlog prioritization", "productboard alternative",
    "private rice tool", "no login prioritization",
  ],
  icon: "list-todo",
  requiresNetwork: false,
  seo: {
    title: "RICE Prioritization Helper — Score & Rank Features, Private | UnQTools",
    faq: [
      {
        q: "How does the RICE prioritization helper work?",
        a: "Enter each feature with four inputs: Reach (how many users it affects, per period), Impact (0.25 / 0.5 / 1 / 2 / 3), Confidence (50% / 80% / 100%, or a custom percentage), and Effort (person-weeks or person-months). The tool computes RICE = (Reach × Impact × Confidence) ÷ Effort, then auto-ranks features by score. You can also switch to ICE (Impact × Confidence × Ease), MoSCoW (Must / Should / Could / Won't), or WSJF (Cost of Delay ÷ Job Size) views — all computed transparently on-device.",
      },
      {
        q: "What is the RICE formula and why divide by Effort?",
        a: "RICE = (Reach × Impact × Confidence) ÷ Effort. Reach × Impact × Confidence gives the expected total value of the feature; dividing by Effort converts that into value-per-unit-of-work, so quick wins with high impact float to the top. Impact uses a fixed scale (0.25 = minimal, 0.5 = low, 1 = medium, 2 = high, 3 = massive). Confidence is a percentage that discounts the score for uncertainty. Effort is the estimated person-weeks (or any consistent unit) required to ship.",
      },
      {
        q: "What is the difference between RICE, ICE, MoSCoW, and WSJF?",
        a: "RICE is the most rigorous of the four — it factors in Reach (audience size), Impact (per-user value), Confidence (estimate certainty), and Effort (cost). ICE is a simpler version: Impact × Confidence × Ease (where Ease is the inverse of Effort, scored 1–10). MoSCoW is a categorical prioritization — every feature is labeled Must-have, Should-have, Could-have, or Won't-have — useful for release scoping. WSJF (Weighted Shortest Job First, from SAFe) prioritizes by Cost of Delay ÷ Job Size, favoring high-value, low-effort work.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Four frameworks — RICE, ICE, MoSCoW, WSJF — switchable live. (2) Auto-ranked, sortable table with rank badges. (3) RICE formula displayed inline per row. (4) Sensitivity analysis — vary any of R/I/C/E across a range and see if rank order changes. (5) Divide-by-zero guard for zero/low effort. (6) Editable R/I/C/E inputs with sensible defaults and dropdowns for the canonical Impact scale. (7) MoSCoW labels with category counts. (8) Optional AI-assist that drafts R/I/C/E from a feature description (BYO-key LLM, can be ignored). (9) CSV export (one row per feature) + Markdown table export. (10) History of saved backlogs (localStorage, last 20). (11) Shareable URL with full backlog encoded. (12) Sample backlogs (3). (13) Aggregate stats — average score, top/bottom feature, total effort. (14) Honesty notes (RICE is a decision aid, not truth). (15) 100% client-side — no signup, no upload.",
      },
      {
        q: "Is my backlog data sent anywhere?",
        a: "No. All RICE / ICE / MoSCoW / WSJF math, ranking, sensitivity analysis, and CSV/Markdown rendering run locally in your browser. Your backlog never leaves this device. The only network call is if you paste your own LLM API key and click 'AI-assist draft scores' — that request goes directly from your browser to the LLM provider you choose. AI-drafted scores are starting points you must review.",
      },
    ],
  },
  status: "done",
};
