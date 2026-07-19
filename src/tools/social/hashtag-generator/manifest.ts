import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "hashtag-generator",
  name: "Hashtag Generator",
  description:
    "Generate platform-specific hashtags for Instagram, Twitter/X, LinkedIn, TikTok, and YouTube. 5 variation types (direct, compound, variations, community, trending-style), categorizer (popular/medium/niche), mix generator (30/40/30 ratio), spam filter, branded + niche generators, validator, density analyzer, 10+ trending niches, CSV/text export, history (localStorage), shareable URL. 100% client-side.",
  category: "social",
  keywords: [
    "hashtag", "hashtags", "hashtag generator", "instagram hashtags",
    "twitter hashtags", "linkedin hashtags", "tiktok hashtags",
    "youtube hashtags", "trending hashtags", "hashtag research",
  ],
  icon: "hash",
  requiresNetwork: false,
  seo: {
    title: "Hashtag Generator — Instagram, Twitter, TikTok, LinkedIn, YouTube | UnQTools",
    faq: [
      {
        q: "How does the hashtag generator work?",
        a: "Enter a topic (e.g. 'javascript programming') and pick a platform. The tool generates five types of hashtags — direct (#javascript), compound (#javascriptprogramming), variations (#javascriptdev), community (#javascriptcommunity), and trending-style (#javascript2026) — then filters by platform limits, applies spam-tag exclusion, and optionally mixes popular + medium + niche hashtags in a 30/40/30 ratio.",
      },
      {
        q: "Which platforms are supported and what are the limits?",
        a: "Five platforms: Instagram (30 max, 10-20 optimal), Twitter/X (2-3 optimal), LinkedIn (3-5 optimal), TikTok (3-5 optimal), YouTube (3-5 optimal, in description). The tool warns when you request more than the optimal count and hard-caps at the platform maximum.",
      },
      {
        q: "How are hashtags categorized?",
        a: "Each hashtag is tagged as popular (estimated 1M+ posts), medium (100K-1M), or niche (<100K). The mix generator combines the three categories in a 30/40/30 ratio for balanced reach — enough popular tags for discovery, enough niche tags for relevance.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 5 variation types: direct, compound, variations, community, trending-style. (2) 5 platform presets (Instagram, Twitter/X, LinkedIn, TikTok, YouTube). (3) Platform-specific count limits (optimal vs max). (4) Hashtag categorizer (popular/medium/niche). (5) Mix generator (30/40/30 ratio). (6) Spam hashtag filter (banned list per platform). (7) Branded hashtag generator (#LearnJS, #JSMastery). (8) Niche hashtag generator. (9) Generic hashtag excluder (#like4like, #follow4follow). (10) Render as text report grouped by category. (11) Render as CSV (hashtag, category, platform, est_reach). (12) Copy + Download .txt + Download CSV. (13) History (localStorage, last 20). (14) Shareable URL. (15) Summary stats (total, by category, by type). (16) Hashtag validator (max 30 chars, alphanumeric + underscore only). (17) Hashtag density analyzer (count vs char limit per platform). (18) Trending hashtag suggestions across 10+ niches.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All hashtag generation runs locally in your browser. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
