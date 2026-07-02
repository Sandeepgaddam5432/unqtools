import type { ToolManifest } from "../../../lib/tool";
export const manifest: ToolManifest = {
  id: "csv-to-markdown",
  name: "CSV to Markdown Table",
  description:
    "Convert CSV/TSV to GitHub-Flavored Markdown, HTML, or Jira tables. RFC-4180-aware (handles quoted fields, pipes, newlines). Per-column alignment. 100% private.",
  category: "text",
  keywords: ["csv to markdown", "csv converter", "markdown table", "tsv to markdown"],
  icon: "hash",
  requiresNetwork: false,
  component: () => import("./ui"),
  seo: {
    title: "CSV to Markdown Table — GFM, HTML, Jira | UnQTools",
    faq: [
      {
        q: "Does it handle quoted fields with commas?",
        a: 'Yes. The parser is RFC-4180 compliant — quoted fields with embedded commas, newlines, and escaped quotes ("") are parsed correctly.',
      },
    ],
  },
  status: "done",
};
