import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "social-media-bio-generator",
  name: "Social Media Bio Generator",
  description:
    "Generate platform-specific bios/profiles for Twitter/X, Instagram, LinkedIn, TikTok, and YouTube. 5 tone presets (professional, casual, creative, minimalist, humorous), per-platform char limits (Twitter 160, IG 150, LinkedIn 220 headline, TikTok 80, YouTube 1000), tone-aware emoji appender, platform CTAs, website link inserter, hashtag/keyword inserter, pronoun inserter, bullet formatter, name formatter (full/first/initials), 3 variations per platform, CSV/text export, history (localStorage), shareable URL. 100% client-side.",
  category: "social",
  keywords: [
    "bio generator", "social media bio", "twitter bio",
    "instagram bio", "linkedin headline", "tiktok bio",
    "youtube bio", "profile bio", "bio writer", "bio ideas",
  ],
  icon: "user-square",
  requiresNetwork: false,
  seo: {
    title: "Social Media Bio Generator — Twitter, IG, LinkedIn, TikTok, YouTube | UnQTools",
    faq: [
      {
        q: "How does the bio generator work?",
        a: "Enter your name, profession, and a comma-separated list of interests (optionally your location and website URL). Pick a tone (professional, casual, creative, minimalist, or humorous) and select the platforms you need bios for. The tool generates a platform-specific bio respecting each platform's character limit (Twitter 160, Instagram 150, LinkedIn 220 headline, TikTok 80, YouTube 1000) and adds tone-aware emojis, platform CTAs, website links, and discoverable keywords.",
      },
      {
        q: "Which platforms are supported?",
        a: "Five platforms: Twitter/X (160 char max), Instagram (150 char max), LinkedIn (220 char headline + 2000 char about section), TikTok (80 char max), and YouTube (1000 char max). Each platform has its own bio template, CTA (e.g. 'DM for collab' for Instagram, 'Subscribe for more' for YouTube), and char-limit validator with green/yellow/red status indicator.",
      },
      {
        q: "What tone presets are available?",
        a: "Five tones: Professional (formal, achievement-focused), Casual (friendly, conversational), Creative (expressive, playful), Minimalist (clean, terse), and Humorous (witty, lighthearted). Each tone adjusts vocabulary, structure, and the emoji set used when emojis are enabled.",
      },
      {
        q: "Can I generate multiple bio variations?",
        a: "Yes. The tool produces three variations per platform per generation, each with a different structure (terse, conversational, story-style). You can copy any variation or download the whole batch as a text or CSV report (platform, bio_text, char_count, emoji_count).",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 5 platform-specific bio generators (Twitter, IG, LinkedIn, TikTok, YouTube). (2) Per-platform char-limit validator with green/yellow/red status. (3) 5 tone presets (professional, casual, creative, minimalist, humorous). (4) Tone-aware emoji appender (optional). (5) CTA generator per platform. (6) Link inserter (website URL). (7) Hashtag/keyword inserter for discoverability. (8) Interests parser + formatter. (9) Render as text report (per platform). (10) Render as CSV (platform, bio_text, char_count, emoji_count). (11) Copy + Download .txt + Download CSV. (12) History (localStorage, last 20). (13) Shareable URL (inputs encoded in hash). (14) Summary stats (total platforms, avg char count, total emojis, total CTAs). (15) Bio variation generator (3 variations per platform). (16) Pronoun inserter (optional — for inclusive bios). (17) Bullet point formatter (for LinkedIn about section). (18) Name formatter (full name, first name, initials — per platform convention).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All bio generation runs locally in your browser. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
