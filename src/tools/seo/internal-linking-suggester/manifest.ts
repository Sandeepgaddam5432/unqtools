import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "internal-linking-suggester",
  name: "Internal Linking Suggester",
  description:
    "Suggest internal links between pages based on keyword matches. Anchor text, relevance scores, dedup, export as HTML or markdown, stats, history, shareable URL. 100% client-side.",
  category: "seo",
  keywords: [
    "internal links", "linking", "anchor text", "seo links", "link building",
    "content cluster", "topic cluster", "silo", "cross-linking",
  ],
  icon: "network",
  requiresNetwork: false,
  seo: {
    title: "Internal Linking Suggester — Anchor Text & Relevance | UnQTools",
    faq: [
      {
        q: "How does the internal linking suggester work?",
        a: "You paste the current page's content, then provide a list of other pages on your site (URL + comma-separated target keywords). The tool scans the content for keyword matches and proposes internal links with anchor text and a relevance score.",
      },
      {
        q: "How is relevance scored?",
        a: "Each match gets a 0-100 score: base 60, +20 if the keyword appears 2-5 times (natural density), +10 if the keyword appears in the first third of the page, +10 if the anchor phrase is at least 2 words long. Scores below 30 are dropped.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Keyword matching against page content. (2) Anchor text suggestion. (3) Link count per match. (4) Relevance scoring 0-100. (5) Dedup of overlapping matches. (6) Export as HTML (anchor tags). (7) Export as Markdown. (8) Stats (total matches, pages matched). (9) History (localStorage, last 20). (10) Shareable URL.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. Linking analysis runs locally. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
