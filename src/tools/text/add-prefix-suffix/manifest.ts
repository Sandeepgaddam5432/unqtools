import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "add-prefix-suffix",
  name: "Add Prefix/Suffix to Lines",
  description:
    "Add a prefix and/or suffix to every line — wrap in quotes, build HTML lists, add SQL commas, number lines with a counter token. Skip empty, regex-conditional, escape for JSON/HTML/SQL. 100% private.",
  category: "text",
  keywords: [
    "add prefix suffix",
    "wrap each line",
    "bulk prefix",
    "line wrapper",
    "add text to lines",
    "number lines",
  ],
  icon: "type",
  requiresNetwork: false,
  component: () => import("./ui"),
  seo: {
    title: "Add Prefix/Suffix to Lines — bulk wrap, numbered, regex-conditional | UnQTools",
    faq: [
      {
        q: "Can I number each line?",
        a: "Yes. Use the {n} token in the prefix or suffix field. Set the start, step, and padding (e.g., {n} with padding 3 gives 001, 002, 003).",
      },
      {
        q: "Can I wrap only certain lines?",
        a: "Yes. Enter a regex in the 'Only wrap lines matching' field. Lines that don't match the regex are left unchanged.",
      },
      {
        q: "Can I remove an existing prefix/suffix?",
        a: "Yes. Toggle 'Reverse (strip)' mode — the tool will remove the prefix from the start and suffix from the end of each line if they're present.",
      },
    ],
  },
  status: "done",
};
