import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "social-media-character-counter",
  name: "Social Media Character Counter",
  description:
    "Live Unicode-aware character counter for Twitter, Instagram, Facebook, LinkedIn, TikTok, and Mastodon. Counts characters (emojis count as 2 per Twitter spec), words, hashtags, mentions, URLs (counted as 23 chars on Twitter), emoji with skin-tone variations, and line breaks. Per-platform char limits per mode (post, bio, comment, DM). Remaining chars with over-limit warnings and optimal-length indicators. Plus CSV export, reading-time estimator, auto-truncator, live preview, history (localStorage), and shareable URL. 100% client-side.",
  category: "social",
  keywords: [
    "character counter", "twitter counter", "tweet counter",
    "instagram char limit", "facebook char limit", "linkedin char limit",
    "tiktok char limit", "mastodon char limit", "post length",
    "character count", "unicode counter", "emoji counter",
  ],
  icon: "gauge",
  requiresNetwork: false,
  seo: {
    title: "Social Media Character Counter — Twitter, IG, FB, LinkedIn, TikTok, Mastodon | UnQTools",
    faq: [
      {
        q: "How does the character counter work?",
        a: "Type or paste your text and the tool updates live. It counts characters in a Unicode-aware way (emojis outside the Basic Multilingual Plane count as 2 chars per Twitter's spec — so 😀 counts as 2), words, hashtags (#word), mentions (@word), URLs (auto-detected and counted as 23 chars on Twitter per t.co shortening), emoji with skin-tone variations, and line breaks. Pick a platform (Twitter, Instagram, Facebook, LinkedIn, TikTok, or Mastodon) and a mode (post, bio, comment, DM) to see the platform-specific char limit and remaining characters.",
      },
      {
        q: "Why does Twitter count emojis as 2 characters?",
        a: "Twitter's character-counting spec counts each UTF-16 code unit as 1 character. Emojis like 😀 (U+1F600) live outside the Basic Multilingual Plane and are encoded as a surrogate pair — two UTF-16 code units — so they count as 2 characters. Our counter uses the same algorithm so you see exactly what Twitter will count when you post.",
      },
      {
        q: "What are the character limits per platform?",
        a: "Twitter post 280 / bio 160 / comment 280 / DM 10000. Instagram post 2200 / bio 150 / comment 1000 / DM 500. Facebook post 63206 / bio 101 / comment 8000 / DM 20000. LinkedIn post 3000 / bio (headline) 220 / comment 1250 / DM 8000. TikTok caption 2200 / bio 80 / comment 150 / DM 1500. Mastodon post 500 / bio 500 / comment 500 / DM 500 (default instance).",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Unicode-aware char counter (emojis = 2 chars). (2) Word counter. (3) Hashtag counter (#word). (4) Mention counter (@word). (5) URL counter (auto-detect, count as 23 chars per Twitter). (6) Emoji counter with skin-tone variation handling. (7) Line break counter. (8) 6 platform presets with char limits per mode (post/bio/comment/DM). (9) Remaining char calculator. (10) Over-limit warning (color-coded). (11) Optimal length indicator (color-coded ranges). (12) Render as text stats report. (13) Render as CSV (metric, value). (14) Copy + Download .txt + Download CSV. (15) History (localStorage, last 20 recent texts). (16) Shareable URL (text + platform encoded in hash). (17) Summary stats (chars, words, hashtags, mentions, URLs, emojis). (18) Reading time estimator (200 wpm). (19) Truncator (auto-truncate to fit limit with ellipsis). (20) Live preview (text rendered as it would appear).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All counting runs locally in your browser. History (recent texts) is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
