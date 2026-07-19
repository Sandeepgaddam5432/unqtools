import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "social-media-trend-detector",
  name: "Social Media Trend Detector",
  description:
    "Detect trending topics across Twitter, Instagram, TikTok, LinkedIn, and YouTube. Parse CSV of mention data, compute growth rates ((recent - prior) / prior × 100), classify trends (trending/stable/declining), rank by growth or absolute mentions, find emerging / sustained / declining trends, compute trend velocity, predict lifecycle stage, score opportunities, and find cross-platform trends. 20 features. 100% client-side.",
  category: "social",
  keywords: [
    "trend", "trends", "trend detector", "trending topics",
    "trend analyzer", "trending hashtags", "growth rate", "viral topics",
    "emerging trends", "twitter trends", "tiktok trends",
    "social media trends", "trend velocity",
  ],
  icon: "trending-up",
  requiresNetwork: false,
  seo: {
    title: "Social Media Trend Detector — Growth, Velocity, Lifecycle | UnQTools",
    faq: [
      {
        q: "What does the Trend Detector do?",
        a: "Paste CSV trend data (one row per date+topic+platform) and the tool computes growth rates as (recent_avg - prior_avg) / prior_avg × 100 over a configurable lookback window, classifies each topic as trending, stable, or declining based on your growth threshold, ranks by growth or absolute mentions, finds emerging trends (low absolute + high growth), sustained trends (high absolute + sustained), and declining trends (negative growth), computes trend velocity (acceleration), predicts lifecycle stage (early/mid/late), scores opportunity (high growth + low competition), and finds cross-platform trends.",
      },
      {
        q: "What CSV format does it expect?",
        a: "Five fields per line: date,topic,platform,mention_count,engagement_count. Platforms supported: twitter, instagram, tiktok, linkedin, youtube. A header row starting with 'date,' is auto-detected and skipped. Dates must be YYYY-MM-DD. Provide multiple data points per topic over time to enable growth analysis.",
      },
      {
        q: "How are growth rate and trend type calculated?",
        a: "Growth rate = (recent_avg - prior_avg) / prior_avg × 100, where recent_avg is the average mention_count over the most recent N days (default 7) and prior_avg is the average over the prior N days. If growth_rate > growth_threshold (default 50%) the topic is 'trending'; if < -growth_threshold it is 'declining'; otherwise 'stable'. Both thresholds are configurable.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) CSV parser with validation. (2) Topic aggregator (mentions + engagement). (3) Growth rate calculator. (4) Trend classifier (trending/stable/declining). (5) Trend ranker (by growth or absolute mentions or engagement). (6) Per-platform trend grouper. (7) Emerging trend finder (low absolute + high growth). (8) Sustained trend finder (high absolute + sustained growth). (9) Declining trend finder (negative growth). (10) Trend velocity calculator (acceleration). (11) Text report renderer. (12) CSV report renderer. (13) Copy + Download .txt + Download CSV. (14) History (localStorage, max 20). (15) Shareable URL encoding data in hash. (16) Summary stats (total topics, trending/declining counts, avg growth). (17) Trend lifecycle predictor (early/mid/late). (18) Cross-platform trend finder (trending on multiple platforms). (19) Trend opportunity scorer (high growth + low competition). (20) Best time to leverage trend (based on lifecycle stage).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All parsing, calculations, and rendering run locally in your browser. History is stored in localStorage on this device only. Shareable URLs encode data in the URL hash and never touch our server.",
      },
    ],
  },
  status: "done",
};
