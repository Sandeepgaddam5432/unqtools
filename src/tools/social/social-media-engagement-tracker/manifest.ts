import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "social-media-engagement-tracker",
  name: "Social Media Engagement Tracker",
  description:
    "Track social media engagement metrics — likes, comments, shares, saves, impressions. CSV parser with validation, engagement-rate calculator, per-post ranker (5 metrics), per-platform aggregator, date-range filter, trend analyzer (first half vs second half), best/worst post finder, summary stats, platform benchmarks, posting frequency, best-time-to-post suggestion, audience growth predictor. 100% client-side, history (localStorage), shareable URL.",
  category: "social",
  keywords: [
    "engagement", "social media metrics", "likes", "comments",
    "shares", "saves", "impressions", "engagement rate",
    "follower growth", "analytics", "tracker",
  ],
  icon: "bar-chart-3",
  requiresNetwork: false,
  seo: {
    title: "Social Media Engagement Tracker — Likes, Comments, Shares, Rate | UnQTools",
    faq: [
      {
        q: "How does the engagement tracker work?",
        a: "Paste your post data as CSV (one post per line: date,platform,post_url,likes,comments,shares,saves,impressions). The tool computes engagement rate = (likes + comments + shares + saves) / impressions × 100, totals, per-platform averages, ranks posts by your chosen metric, finds best/worst performers, and analyzes trends by comparing first-half vs second-half of your date range.",
      },
      {
        q: "What metrics can I rank posts by?",
        a: "Five ranking options: engagement-rate (default), total-engagement (likes+comments+shares+saves), impressions, likes, or comments. Use the metric selector to switch instantly — all stats and rankings recompute live.",
      },
      {
        q: "What platforms are supported?",
        a: "Twitter, Instagram, Facebook, LinkedIn, TikTok, and YouTube. The platform filter narrows the analysis to one platform at a time. Built-in benchmarks compare your engagement rate against typical industry rates per platform.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) CSV parser with field validation. (2) Engagement-rate calculator. (3) Total engagement calculator. (4) Per-post ranker (5 metrics). (5) Per-platform aggregator (totals + averages). (6) Date-range filter. (7) Trend analyzer (first vs second half). (8) Best post finder. (9) Worst post finder. (10) Text report renderer. (11) CSV export. (12) Copy + download .txt + download CSV. (13) History (localStorage, max 20). (14) Shareable URL. (15) Summary stats. (16) Per-platform engagement benchmarks. (17) Posting frequency analyzer (posts/week). (18) Best-time-to-post suggestion. (19) Audience growth predictor based on trend.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All parsing, calculation, and rendering happens locally in your browser. History is stored in localStorage on this device only. Shareable URLs encode data in the URL hash, which never touches our server.",
      },
    ],
  },
  status: "done",
};
