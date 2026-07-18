import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "brand-mention-monitor",
  name: "Brand Mention Monitor",
  description:
    "Generate brand mention monitoring queries — Google Alerts, social search URLs (Twitter/X, Reddit, LinkedIn, YouTube, Hacker News, Product Hunt), news search URLs, competitor mention queries, niche keyword queries, founder mention queries, and backlink opportunity queries. 11+ platforms, filters by query type, history (localStorage), shareable URL. 100% client-side.",
  category: "seo",
  keywords: [
    "brand monitoring", "mention", "google alerts",
    "social listening", "brand mentions", "backlink opportunities",
    "competitor monitoring", "reputation monitoring",
  ],
  icon: "radio",
  requiresNetwork: false,
  seo: {
    title: "Brand Mention Monitor — Google Alerts + Social Search URLs | UnQTools",
    faq: [
      {
        q: "How does the brand mention monitor work?",
        a: "Enter your brand name (and optional aliases, founder names, competitors, niche keywords). We generate Google Alerts query strings (with OR clauses for aliases + negative keyword filters), social mention search URLs for Twitter/X, Reddit, LinkedIn, YouTube, Hacker News, and Product Hunt, news search URLs (Google News, Bing News), competitor mention queries, niche mention queries, and backlink opportunity queries (e.g. 'best <niche> tools').",
      },
      {
        q: "What platforms are supported?",
        a: "Eleven platforms: Google Alerts (query strings), Twitter/X, Reddit, LinkedIn, YouTube, Hacker News (Algolia), Product Hunt (social), Google News, Bing News (news), plus generic backlink opportunity queries and niche keyword queries. Each result is a clickable URL that opens the platform's search results for your brand.",
      },
      {
        q: "Why include negative keywords in Google Alerts?",
        a: "Brand names often collide with common words (e.g. 'Apple' the brand vs 'apple' the fruit). Negative keywords like -fruit -recipe -pie filter out irrelevant matches. The tool auto-suggests common negative filters: -coupon, -review, -site:reddit.com (for clean mention stream) and you can add your own.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Brand + aliases parser. (2) Google Alerts query generator (exact + OR + negative keywords). (3) Social mention URL generator (6 platforms). (4) News URL generator (Google News, Bing News). (5) Competitor mention queries. (6) Niche keyword mention queries. (7) Backlink opportunity finder ('best <niche> tools' style). (8) Founder mention queries for personal branding. (9) Text report. (10) CSV export. (11) Copy + Download TXT + Download CSV. (12) History (localStorage, last 20). (13) Shareable URL. (14) Filter by query type. (15) Summary stats. (16) Direct clickable links.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All query generation runs locally. The generated URLs are clickable but the tool itself doesn't make any network requests. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
