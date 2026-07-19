import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "decision-matrix-builder",
  name: "Decision Matrix Builder",
  description:
    "Build weighted decision matrices to compare options across criteria. Enter options, criteria, weights, and scores (1-5). Compute weighted scores per cell, totals per option, rank options, identify the winner, and run ±10% sensitivity analysis. Export as text report, CSV, or color-coded HTML. 18 extra features: options parser, criteria parser, weights parser with normalization, scores parser with validation, weighted score calculator, total per option calculator, option ranker, best option identifier, weight normalizer, score validator (1-5), sensitivity analysis, multi-format renderers, copy/download, history (localStorage), shareable URL, summary stats. 100% client-side.",
  category: "business",
  keywords: [
    "decision matrix", "weighted scoring", "decision analysis",
    "comparison matrix", "prioritization matrix", "criteria scoring",
    "evaluation matrix", "decision making",
  ],
  icon: "git-compare",
  requiresNetwork: false,
  seo: {
    title: "Decision Matrix Builder — Weighted Scoring + Sensitivity | UnQTools",
    faq: [
      {
        q: "How does the decision matrix builder work?",
        a: "Enter your options (one per line), criteria (one per line), weights as `criterion,weight` (weights should sum to 100), and scores as `option,criterion,score` (score 1-5). The tool computes each cell's weighted score (score × weight), totals per option, ranks them, identifies the winner, and runs a ±10% sensitivity analysis to check whether the winner stays the winner under weight variation.",
      },
      {
        q: "What happens if my weights don't sum to 100?",
        a: "The weight normalizer scales all weights proportionally so they sum to 100. For example, weights 30/20/30/20 sum to 100 already and stay unchanged. Weights 3/2/3/2 sum to 10 and are scaled to 30/20/30/20. The normalized weights are used for all calculations.",
      },
      {
        q: "What is sensitivity analysis?",
        a: "We vary each weight ±10% (one at a time) and re-rank options. If the winner stays the winner across all variations, the decision is robust. If the winner changes for some variations, we flag that the decision is sensitive to that criterion's weight — useful when justifying the decision to stakeholders.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Options parser (one per line). (2) Criteria parser. (3) Weights parser with normalization. (4) Scores parser (option × criterion lookup). (5) Weighted score calculator (per cell). (6) Total score per option calculator. (7) Option ranker. (8) Best option identifier. (9) Weight normalizer (sum to 100). (10) Score validator (1-5 range). (11) Sensitivity analysis (±10% weight variation). (12) Text report renderer. (13) CSV renderer (option, criterion, score, weight, weighted_score). (14) Color-coded HTML table renderer. (15) Copy + download .txt/.csv/.html. (16) History (localStorage, last 20). (17) Shareable URL (encode inputs in hash). (18) Summary stats (options count, criteria count, winner, margin of victory).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All matrix parsing, scoring, ranking and sensitivity analysis happen 100% locally in your browser. History is stored in localStorage on this device only. Nothing is uploaded.",
      },
    ],
  },
  status: "done",
};
