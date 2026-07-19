import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "social-media-hashtag-analyzer",
  name: "Social Media Hashtag Analyzer",
  description:
    "Analyze hashtag performance across Instagram, Twitter, LinkedIn, TikTok, and YouTube. Parse CSV of hashtag data, aggregate per-hashtag stats (avg engagement, avg reach, total posts), rank by 4 metrics, find top performers, analyze trends, density, co-occurrence, recommend hashtags, find best combos, flag saturated hashtags. 19 features. 100% client-side.",
  category: "social",
  keywords: [
    "hashtag", "hashtags", "hashtag analyzer", "hashtag performance",
    "hashtag analytics", "instagram hashtags", "tiktok hashtags",
    "twitter hashtags", "linkedin hashtags", "youtube hashtags",
    "hashtag reach", "hashtag engagement", "hashtag ranking",
  ],
  icon: "hash",
  requiresNetwork: false,
  seo: {
    title: "Social Media Hashtag Analyzer — Reach, Engagement, Rank, Trends | UnQTools",
    faq: [
      {
        q: "What does the Hashtag Analyzer do?",
        a: "Paste CSV hashtag data (one row per hashtag-platform-date) and the tool aggregates per-hashtag stats (total posts, avg engagement, avg reach), per-platform groups, ranks hashtags by engagement, reach, post count, or engagement-per-post, finds top performers, tracks engagement over time, computes posting density, detects co-occurring hashtags, recommends similar hashtags, finds the best hashtag combinations, and flags over-saturated hashtags that are too competitive.",
      },
      {
        q: "What CSV format does it expect?",
        a: "Six fields per line: hashtag,platform,post_count,avg_engagement,avg_reach,date. Platforms supported: instagram, twitter, linkedin, tiktok, youtube. A header row starting with 'hashtag,' is auto-detected and skipped. Dates must be YYYY-MM-DD.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) CSV parser with validation. (2) Per-hashtag stats aggregator (avg engagement, avg reach, total posts). (3) Per-platform grouper. (4) Hashtag ranker by 4 metrics. (5) Top-performing hashtag finder. (6) Engagement-over-time trend analyzer. (7) Posting-density analyzer (posts per day). (8) Hashtag co-occurrence finder (frequently paired hashtags). (9) Engagement-per-post calculator. (10) Text report renderer. (11) CSV report renderer. (12) Copy + Download .txt + Download CSV. (13) History (localStorage, max 20). (14) Shareable URL encoding data in hash. (15) Summary stats (total hashtags, posts, avg engagement, by platform). (16) Hashtag category classifier (popular/medium/niche). (17) Hashtag recommendation engine. (18) Best hashtag combination finder (top combos by avg engagement). (19) Saturation warning for over-competitive hashtags.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All parsing, aggregation, ranking, and rendering run locally in your browser. History is stored in localStorage on this device only. Shareable URLs encode data in the URL hash and never touch our server.",
      },
      {
        q: "How is hashtag saturation determined?",
        a: "If a hashtag's total post count exceeds 100,000 across the dataset, it is flagged as 'high saturation' (too competitive — your post may get buried). 10,000-100,000 is 'medium' saturation; below 10,000 is 'low saturation' (better discovery opportunity).",
      },
    ],
  },
  status: "done",
};
