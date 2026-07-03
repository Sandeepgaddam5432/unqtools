import type { ToolManifest } from "../../../lib/tool";
export const manifest: ToolManifest = {
  id: "csv-to-text-list",
  name: "CSV to Text List",
  description:
    "Convert CSV to a plain text list — one item per line or custom-delimited. Column selection, dedupe, quote/prefix/suffix wrapping. RFC-4180-aware. 100% private.",
  category: "text",
  keywords: ["csv to list", "csv to text", "column to list", "csv flatten", "csv converter"],
  icon: "type",
  requiresNetwork: false,
  seo: {
    title: "CSV to Text List — column extract, flatten, dedupe | UnQTools",
    faq: [
      {
        q: "Can I extract just one column?",
        a: "Yes. Set the column index (0-based) in the options. Use -1 to flatten all columns into one list.",
      },
    ],
  },
  status: "done",
};
