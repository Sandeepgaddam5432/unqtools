import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "social-media-post-generator",
  name: "Social Media Post Generator",
  description:
    "Generate platform-specific social media posts for Twitter/X, LinkedIn, Facebook, Instagram, and Mastodon. Tone presets, target audiences, per-platform char limits, CTA + hashtag + emoji generators, 3 variations per platform, best-time-to-post, CSV/text export, history (localStorage), shareable URL. 100% client-side.",
  category: "social",
  keywords: [
    "social media", "post generator", "twitter post", "linkedin post",
    "facebook post", "instagram caption", "mastodon post",
    "social media content", "caption generator", "tweet generator",
  ],
  icon: "message-circle",
  requiresNetwork: false,
  seo: {
    title: "Social Media Post Generator — Twitter, LinkedIn, Instagram + Mastodon | UnQTools",
    faq: [
      {
        q: "How does the social media post generator work?",
        a: "Enter a topic, your key points (one per line), pick a tone (professional, casual, friendly, urgent, inspirational, or humorous) and a target audience, then select platforms. The tool composes a tailored post per platform — respecting each platform's character limit (Twitter 280, Mastodon 500, Instagram 2200, LinkedIn 3000, Facebook 63206), and appending platform-appropriate CTA, hashtags, and emojis.",
      },
      {
        q: "Which platforms are supported?",
        a: "Five platforms: Twitter/X (280 char max), LinkedIn (3000 char max, 1300 optimal), Facebook (477 chars optimal), Instagram (2200 chars max, 125 above fold), and Mastodon (500 chars max). Each platform gets its own CTA (e.g. 'Link in bio' for Instagram, 'Retweet' for Twitter), its own hashtag count (Instagram 10-30, LinkedIn 3-5, Twitter 2-3), and tone-aware emoji if enabled.",
      },
      {
        q: "Can I generate multiple post variations?",
        a: "Yes. The tool produces three variations per platform per generation, each with a different hook (question, statement, story-style). You can copy any variation or download the whole batch as a text or CSV report (platform, post_text, char_count, hashtag_count).",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 5 platform-specific generators with platform char limits. (2) Per-platform char-limit validator with truncate warning. (3) 6 tone presets with greeting/closing modifiers. (4) 6 target-audience presets that adjust vocabulary. (5) CTA generator per platform. (6) Hashtag generator per platform (different counts). (7) Tone-aware emoji appender (optional). (8) Key-points parser and formatter. (9) Render as text report (per platform). (10) Render as CSV (platform, post_text, char_count, hashtag_count). (11) Copy + Download .txt + Download CSV. (12) History (localStorage, last 20). (13) Shareable URL (inputs encoded in hash). (14) Summary stats (total platforms, posts, total chars, avg chars). (15) Best-time-to-post suggestion per platform. (16) Live char count with platform color coding (green/yellow/red). (17) 3 variations per platform (different hooks).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All post generation runs locally in your browser. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
