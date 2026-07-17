import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "keyword-grouping-tool",
  name: "Keyword Grouping Tool",
  description:
    "Group keywords by topic and intent for content clustering. Common-word grouping, informational/transactional/navigational intent, cluster naming, min size, dedup, CSV/JSON export, stats, history. 100% client-side.",
  category: "seo",
  keywords: [
    "keyword grouping", "keyword cluster", "topic cluster", "content cluster",
    "intent classification", "informational", "transactional", "navigational",
  ],
  icon: "layers",
  requiresNetwork: false,
  seo: {
    title: "Keyword Grouping Tool — Cluster by Topic + Intent | UnQTools",
    faq: [
      {
        q: "How does the grouping work?",
        a: "Two strategies: (1) Common-word grouping — keywords that share a head term (the most frequent non-stop word) are clustered together. (2) Intent classification — each keyword is classified as informational, transactional, or navigational based on modifier words (how, what, why → informational; buy, price, cheap → transactional; login, sign in → navigational).",
      },
      {
        q: "How are clusters named?",
        a: "The cluster name is the head term (most common non-stop word across its keywords). You can set a min cluster size to filter out noise.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Grouping by common word. (2) Grouping by intent (informational/transactional/navigational). (3) Automatic cluster naming. (4) Min cluster size filter. (5) Dedup. (6) Export as CSV. (7) Export as JSON. (8) Stats (cluster count, keywords per cluster). (9) History (localStorage, last 20). (10) Shareable URL.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. Keyword grouping runs locally. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
