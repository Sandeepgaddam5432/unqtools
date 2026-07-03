import type { ToolManifest } from "../../../lib/tool";
export const manifest: ToolManifest = {
  id: "diff-checker",
  name: "Diff Checker",
  description:
    "Compare two texts side-by-side or unified — line, word, and character-level diff with the Myers algorithm. File input, .patch export, ignore whitespace/case. 100% private.",
  category: "text",
  keywords: [
    "diff checker",
    "text compare",
    "text diff",
    "compare text",
    "file diff",
    "unified diff",
    "patch",
  ],
  icon: "hash",
  requiresNetwork: false,
  seo: {
    title: "Diff Checker — side-by-side, unified, word/char diff | UnQTools",
    faq: [
      {
        q: "Is my text uploaded anywhere?",
        a: "No. All comparison happens in your browser using the Myers diff algorithm. Your text never leaves your device.",
      },
      {
        q: "What diff algorithm is used?",
        a: "The Myers diff algorithm — the same algorithm used by Git. It produces a minimal edit script and runs in O(ND) time where N is the total lines and D is the number of differences.",
      },
      {
        q: "Can I compare files?",
        a: "Yes. Click 'Load file' under either panel to load a .txt, .md, .json, .csv, or source code file. Files are read client-side — nothing is uploaded.",
      },
      {
        q: "Can I export the diff?",
        a: "Yes. Click 'Download .patch' to get a unified diff file compatible with the patch command, or 'Copy .patch' to copy it to your clipboard.",
      },
    ],
  },
  status: "done",
};
