import type { ToolManifest } from "../../../lib/tool";
export const manifest: ToolManifest = {
  id: "add-line-numbers",
  name: "Add Line Numbers",
  description: "Add sequential line numbers to text. Custom start, step, padding, format ([n], n., n:), position, skip empty lines. 100% client-side.",
  category: "developer",
  keywords: ["line numbers", "number lines", "add numbers", "line numbering", "text numbering"],
  icon: "ListOrdered",
  requiresNetwork: false,
  seo: { title: "Add Line Numbers — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Adds sequential line numbers to each line of text with customizable formatting." },
      { q: "Can I customize the format?", a: "Yes — choose plain, [n], (n), n., n:, or | n | formats, plus custom start, step, and padding." },
      { q: "Is my data sent to a server?", a: "No. Everything runs 100% in your browser." },
    ],
  },
  status: "done",
};
