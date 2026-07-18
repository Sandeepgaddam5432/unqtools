import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "serp-competitor-analysis",
  name: "SERP Competitor Analysis Tool",
  description:
    "Analyze competitor content for a target keyword. Paste HTML from top results (up to 3) — extract word count, heading structure, keyword usage, meta tags, content gaps. Markdown report export, history, shareable URL. 100% client-side.",
  category: "seo",
  keywords: [
    "serp analysis", "competitor analysis", "content gap", "html analysis",
    "heading structure", "meta tags", "keyword density per competitor", "seo",
  ],
  icon: "users",
  requiresNetwork: false,
  seo: {
    title: "SERP Competitor Analysis Tool — Compare Top-3 Results | UnQTools",
    faq: [
      {
        q: "How do I use this tool?",
        a: "Pick a target keyword, then paste the raw HTML of the top 3 ranking pages (right-click → View Page Source → copy). The tool extracts word count, heading structure, keyword usage, meta tags, and content gaps — then builds a comparison report you can copy as Markdown.",
      },
      {
        q: "What is a content gap?",
        a: "A content gap is a heading or sub-topic that appears in competitors' content but not in yours. If 2 of 3 competitors have an H2 titled 'Pricing' and your content doesn't, that's a gap to fill. This tool flags headings that appear in multiple competitors but not in your primary HTML.",
      },
      {
        q: "Does this tool fetch pages from the web?",
        a: "No — it's 100% client-side and offline-capable. You paste the HTML yourself. We never make network requests. This keeps you in control and avoids CORS / rate-limit issues.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Multi-competitor comparison (up to 3). (2) Word count comparison per competitor. (3) Heading structure extraction (H1-H6). (4) Keyword density per competitor. (5) Content gap detection (headings in competitors but not yours). (6) Stats summary table. (7) Export as Markdown report. (8) Copy report. (9) History (localStorage, last 20). (10) Shareable URL.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. HTML parsing runs locally. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
