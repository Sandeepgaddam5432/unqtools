import type { ToolManifest } from "../../../lib/tool";
export const manifest: ToolManifest = {
  id: "duplicate-lines-remover",
  name: "Duplicate Lines Remover",
  description:
    "Remove duplicate lines from a list — keep first or last, case-insensitive, trim before comparing, sort, and report removed lines. 100% private.",
  category: "text",
  keywords: [
    "remove duplicates",
    "dedupe lines",
    "duplicate remover",
    "unique lines",
    "deduplicate",
  ],
  icon: "type",
  requiresNetwork: false,
  seo: {
    title: "Duplicate Lines Remover — keep first/last, sort, report | UnQTools",
    faq: [
      {
        q: "Can I keep the last occurrence instead of the first?",
        a: "Yes. Select 'Keep last' in the options — the tool keeps the last occurrence of each duplicate line instead of the first.",
      },
    ],
  },
  status: "done",
};
