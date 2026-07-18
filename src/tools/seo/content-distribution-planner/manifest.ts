import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "content-distribution-planner",
  name: "Content Distribution Planner",
  description:
    "Plan multi-channel content distribution. Generate platform-specific snippets for 11 channels (Twitter/X, LinkedIn, Facebook, Instagram, Email, Reddit, Hacker News, Dev.to, Medium, YouTube Community, Discord). Per-platform char limit validation, hashtag limits, hashtag generator, CTA inserter, CSV export, history (localStorage), shareable URL. 100% client-side.",
  category: "seo",
  keywords: [
    "content distribution", "content planner", "social media",
    "multi-channel", "twitter snippet", "linkedin post",
    "reddit post", "dev.to", "medium", "instagram caption",
    "email newsletter", "youtube community", "discord",
  ],
  icon: "share-2",
  requiresNetwork: false,
  seo: {
    title: "Content Distribution Planner — 11 Channels + Snippets | UnQTools",
    faq: [
      {
        q: "How does the Content Distribution Planner work?",
        a: "Enter your content title, description, URL, target channels, hashtags, and CTA. The tool generates a platform-specific snippet per channel, respecting each platform's tone and character limit: Twitter/X (280), LinkedIn (1300), Facebook (477), Instagram (2200), Email (subject + preview + 3-section body), Reddit (markdown TL;DR + body), Hacker News (80-char title), Dev.to (markdown + 4 tags), Medium (title + subtitle + hook), YouTube Community (150-char poll-style), Discord (short message + channel suggestions).",
      },
      {
        q: "What channels are supported?",
        a: "Eleven channels: Twitter/X, LinkedIn, Facebook, Instagram, Email Newsletter, Reddit, Hacker News, Dev.to, Medium, YouTube Community, and Discord. Each has its own tone rules, character limit, and hashtag allowance.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 11-channel snippet generator. (2) Per-platform char limit validation with truncate warning. (3) Per-platform hashtag count validation. (4) Twitter/X 280-char strict compliance. (5) LinkedIn professional tone modifier. (6) Email Newsletter 3-section generator (subject + preview + body). (7) Reddit markdown formatter (TL;DR + body + link). (8) Dev.to markdown + 4-tag limiter. (9) Hashtag generator (extract + suggest from title keywords). (10) CTA inserter. (11) Render as text report. (12) Render as CSV (channel, snippet, char_count, hashtag_count). (13) Copy + Download .txt + Download CSV. (14) History (localStorage, max 20). (15) Shareable URL (encode inputs in hash). (16) Filter by channel. (17) Summary stats (total channels, total chars, total hashtags). (18) Channel presets (11 channels with default config).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All snippet generation runs locally in your browser. History is stored in localStorage on this device only. No content, URLs, or inputs ever leave your device.",
      },
    ],
  },
  status: "done",
};
