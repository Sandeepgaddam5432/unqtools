import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "caption-generator",
  name: "Social Media Caption Generator",
  description:
    "Generate engaging captions for Instagram, TikTok, Facebook, and Pinterest. 8 mood presets, 3 caption lengths (short/medium/long), 70+ caption templates (mood × length), hook + body + CTA generators, mood-aware emoji appender, keyword-based hashtag generator (5-15 per caption), platform-specific CTAs, caption length validator, 3 variations per request, IG first-comment hashtag separator, CSV/text export, history (localStorage), shareable URL. 100% client-side.",
  category: "social",
  keywords: [
    "caption generator", "instagram caption", "tiktok caption",
    "facebook caption", "pinterest caption", "social media caption",
    "caption ideas", "caption writer", "post caption", "ig caption",
  ],
  icon: "message-square-quote",
  requiresNetwork: false,
  seo: {
    title: "Social Media Caption Generator — Instagram, TikTok, Facebook, Pinterest | UnQTools",
    faq: [
      {
        q: "How does the caption generator work?",
        a: "Describe what's in your photo or video, pick a mood (happy, excited, thoughtful, nostalgic, motivational, funny, cozy, or adventurous), choose a caption length (short/medium/long), and select a platform (Instagram, TikTok, Facebook, or Pinterest). The tool composes a caption from a 70+ template library (mood × length combinations) with a hook, supporting body, platform-specific CTA, mood-aware emojis, and 5-15 keyword-based hashtags.",
      },
      {
        q: "How many caption templates are included?",
        a: "70+ templates organized by 8 moods × 3 lengths. Each combination has multiple template variations, and each generation produces 3 distinct variations per request — so you can pick the one that fits your post best.",
      },
      {
        q: "Which platforms are supported?",
        a: "Four platforms: Instagram (2200 chars max, 125 above-fold optimal, 'link in bio' CTA, 15 hashtags), TikTok (2200 chars max, 'follow for more' CTA, 5 hashtags), Facebook (63206 chars max, 'comment below' CTA, 3 hashtags), and Pinterest (500 chars max, 'tap to save' CTA, 4 hashtags). Each platform has its own char-limit validator and CTA.",
      },
      {
        q: "What is the first-comment hashtag separator?",
        a: "For Instagram, you can choose to put all hashtags in the first comment instead of the caption itself — this keeps your caption clean and is a popular growth tactic. The tool splits the caption from the hashtag block and shows both separately for easy copy-paste.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 70+ caption templates (mood × length combinations). (2) 8 mood presets with emoji mappings. (3) 3 caption length presets (short/medium/long). (4) 4 platform presets with platform-specific CTAs and char limits. (5) Hook generator (first-sentence grabber). (6) Body generator (supporting sentences based on image description). (7) CTA generator per platform. (8) Mood-aware emoji appender. (9) Hashtag generator (keyword-based, 5-15 per caption). (10) Caption length validator per platform. (11) Render as text caption (full). (12) Render as CSV (component, value). (13) Copy + Download .txt + Download CSV. (14) History (localStorage, last 20). (15) Shareable URL (inputs encoded in hash). (16) Summary stats (caption length, char count, emoji count, hashtag count). (17) Caption variation generator (3 variations per request). (18) First-comment hashtag separator (for IG).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All caption generation runs locally in your browser. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
