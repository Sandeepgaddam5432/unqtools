import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "tiktok-video-description-generator",
  name: "TikTok Video Description Generator",
  description:
    "Generate TikTok video descriptions optimized for the For You page. 8 video style presets (dance, comedy, tutorial, story-time, day-in-life, transition, challenge, trend), 5 target audience presets, style-specific openers, hook generator (first 3 seconds), 3-5 hashtag mix (trending + niche + branded), trending sound suggester (60+ sounds by category), style-aware CTA generator (duet, stitch, follow, comment), emoji appender, char-count validator (300 optimal, 2200 max), viral potential scorer, best time to post suggestion, 3 variations per request, summary stats, CSV export, history (localStorage), shareable URL. 100% client-side.",
  category: "social",
  keywords: [
    "tiktok description", "tiktok caption", "tiktok video",
    "tiktok hashtag", "tiktok sound", "fyp caption",
    "tiktok hook", "tiktok cta", "duet this", "tiktok description generator",
  ],
  icon: "music",
  requiresNetwork: false,
  seo: {
    title: "TikTok Video Description Generator — Hooks, Hashtags, Sounds | UnQTools",
    faq: [
      {
        q: "How does the TikTok description generator work?",
        a: "Enter your video topic, pick a video style (dance, comedy, tutorial, story-time, day-in-life, transition, challenge, or trend) and target audience (gen-z, gen-alpha, millennials, gen-x, all-ages). The tool composes a description with a style-specific opener, a hook for the first 3 seconds, 3-5 hashtags mixing trending + niche + branded tags, a style-aware CTA (duet this, stitch this, follow for more, comment below), and style-appropriate emojis. You can also enable trending sound suggestions.",
      },
      {
        q: "What is the optimal TikTok description length?",
        a: "TikTok allows up to 2200 characters in the description, but the optimal length for engagement is 150-300 characters. The tool's char-count validator highlights when your description is within the optimal range, near the limit, or over the 2200-character maximum.",
      },
      {
        q: "How many trending sounds are included?",
        a: "60+ trending sounds organized by 8 style categories (dance, comedy, tutorial, story-time, day-in-life, transition, challenge, trend). Each generation suggests 3 sounds that match your video style so you can pick the one that fits your content.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 8 video style presets. (2) 5 target audience presets. (3) Style-specific opener generator. (4) Hashtag generator (3-5, mix trending + niche + branded). (5) Trending sound suggester (60+ sounds by category). (6) CTA generator per style (duet, stitch, follow, comment). (7) Emoji appender (style-aware). (8) Hook generator (first 3 seconds). (9) Char count validator (300 optimal, 2200 max). (10) Render as text description. (11) Render as CSV (component, value). (12) Copy + Download .txt + Download CSV. (13) History (localStorage, last 20). (14) Shareable URL (inputs encoded in hash). (15) Summary stats (char count, hashtag count, emoji count, sound count). (16) Description variation generator (3 variations). (17) Best time to post suggestion (TikTok engagement data by hour). (18) Viral potential scorer (based on style + hashtags + sound trends).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All description generation runs locally in your browser. No network calls are made — your video topic never leaves your device. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
