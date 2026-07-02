import type { ToolManifest } from "../../../lib/tool";
export const manifest: ToolManifest = {
  id: "diff-checker",
  name: "Diff Checker",
  description:
    "Compare two texts — line, word, or character diff with inline highlighting. Additions, deletions, and changes clearly marked. 100% private, no upload.",
  category: "text",
  keywords: ["diff checker", "text compare", "text diff", "compare text", "file diff"],
  icon: "hash",
  requiresNetwork: false,
  component: () => import("./ui"),
  seo: {
    title: "Diff Checker — line, word, char text comparison | UnQTools",
    faq: [
      {
        q: "Is my text uploaded anywhere?",
        a: "No. All comparison happens in your browser. Your text never leaves your device.",
      },
      {
        q: "What diff algorithm is used?",
        a: "The tool uses the Longest Common Subsequence (LCS) algorithm, the same approach used by standard diff tools. It produces a minimal edit sequence.",
      },
    ],
  },
  status: "done",
};
