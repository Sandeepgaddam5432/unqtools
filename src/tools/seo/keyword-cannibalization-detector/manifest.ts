import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "keyword-cannibalization-detector",
  name: "Keyword Cannibalization Detector",
  description:
    "Detect when multiple pages target the same keyword. Bulk input, dedup, severity scoring, export report, merge/canonicalize suggestions, stats, history, shareable URL. 100% client-side.",
  category: "seo",
  keywords: [
    "keyword cannibalization", "duplicate keywords", "seo audit",
    "page conflict", "keyword overlap", "canonicalize", "merge pages",
  ],
  icon: "git-merge",
  requiresNetwork: false,
  seo: {
    title: "Keyword Cannibalization Detector — Find Duplicate Keywords | UnQTools",
    faq: [
      {
        q: "What is keyword cannibalization?",
        a: "When two or more of your own pages compete for the same search query, Google may rank neither — or pick the wrong one. This tool finds URLs that share a target keyword so you can merge, canonicalize, or differentiate them.",
      },
      {
        q: "How is severity scored?",
        a: "High = 3+ pages on the same keyword (likely competing). Medium = 2 pages (worth a review). Low = keyword appears across pages but with case/whitespace variations only. Each flagged cluster also gets a recommended action: merge, canonicalize, or differentiate intent.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Bulk input (URL,keyword per line). (2) Dedup of identical URL+keyword pairs. (3) Severity scoring (high/medium/low). (4) Export report (Markdown). (5) Merge/canonicalize/differentiate suggestions. (6) Stats. (7) History (localStorage, last 20). (8) Shareable URL. (9) Keyword normalization (trim, collapse whitespace). (10) Case-insensitive matching.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. Cannibalization detection runs locally. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
