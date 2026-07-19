import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "social-media-mention-tracker",
  name: "Social Media Mention Tracker",
  description:
    "Track brand mentions across platforms — Twitter, Reddit, LinkedIn, YouTube, Hacker News, Product Hunt. CSV parser with validation, brand-name matcher with aliases, per-platform mention counter, basic sentiment analyzer (keyword + user-provided), mention trend analyzer, top author finder, mention reach estimator (platform + author heuristics), date-range filter, mention content searcher, summary stats, sentiment trend, mention velocity, top mentions, alert threshold. 100% client-side, history (localStorage), shareable URL.",
  category: "social",
  keywords: [
    "mentions", "brand monitoring", "social listening",
    "sentiment", "twitter mentions", "reddit mentions",
    "brand tracking", "reach", "social listening tool",
  ],
  icon: "megaphone",
  requiresNetwork: false,
  seo: {
    title: "Social Media Mention Tracker — Brand Mentions + Sentiment | UnQTools",
    faq: [
      {
        q: "How does the mention tracker work?",
        a: "Paste your mention data as CSV (one per line: date,platform,author,content,url,sentiment). Sentiment is optional (-1/0/1). Enter your brand name and aliases (comma-separated). The tool finds all mentions of your brand (case-insensitive, includes aliases), counts per-platform, computes sentiment (using your provided value or built-in keyword analysis), identifies top authors, estimates reach, and analyzes trends over time.",
      },
      {
        q: "What platforms are supported?",
        a: "Six platforms: Twitter/X, Reddit, LinkedIn, YouTube, Hacker News, and Product Hunt. Each has its own typical audience size and reach heuristics used to estimate mention reach.",
      },
      {
        q: "How is sentiment computed if I don't provide it?",
        a: "Built-in keyword analysis: the tool scans mention content for ~30 positive words (great, love, amazing, etc.) and ~30 negative words (bad, hate, terrible, etc.). Each mention receives a score of -1, 0, or +1. If you provide sentiment in the CSV (-1/0/1), that takes precedence.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) CSV parser with validation. (2) Brand name matcher (case-insensitive, aliases). (3) Per-platform mention counter. (4) Sentiment analyzer (keyword + user-provided). (5) Mention trend analyzer (per day/week). (6) Top author finder. (7) Mention reach estimator (platform + author heuristics). (8) Date-range filter. (9) Mention content searcher. (10) Text report renderer. (11) CSV export. (12) Copy + download .txt + download CSV. (13) History (localStorage, max 20). (14) Shareable URL. (15) Summary stats (mentions, by platform, by sentiment, avg reach). (16) Sentiment trend (improving/declining). (17) Mention velocity (mentions per day). (18) Top mentions list (highest reach). (19) Alert threshold setter (notify if mentions > N per day).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All parsing, sentiment analysis, and reporting happen locally in your browser. History is stored in localStorage on this device only. Shareable URLs encode data in the URL hash and never touch our server.",
      },
    ],
  },
  status: "done",
};
