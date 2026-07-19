import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "social-media-content-repurposer",
  name: "Social Media Content Repurposer",
  description:
    "Repurpose one piece of content across 7 target formats — blog post, YouTube transcript, podcast transcript, email newsletter, or presentation slides into Twitter threads, LinkedIn posts, Instagram captions, Facebook posts, TikTok scripts, email summaries, and Medium articles. Content analyzer extracts title, hook, key points, quotes, stats, and CTAs. 5 source-type presets, 5 tone presets, 2 variations per format, quality scorer, cross-format consistency checker, best-format recommender, CSV/text export, history (localStorage), shareable URL. 100% client-side.",
  category: "social",
  keywords: [
    "content repurposing", "repurpose content", "content reuse",
    "twitter thread generator", "linkedin post generator",
    "instagram caption generator", "facebook post generator",
    "tiktok script generator", "email summary generator",
    "medium article generator", "blog to social", "video to blog",
    "podcast to quotes", "content multiplier", "cross-platform content",
  ],
  icon: "repeat",
  requiresNetwork: false,
  seo: {
    title: "Social Media Content Repurposer — Blog → Tweets, Video → Blog, 7 Formats | UnQTools",
    faq: [
      {
        q: "How does the content repurposer work?",
        a: "Paste your source content (a blog post, YouTube transcript, podcast transcript, email newsletter, or presentation slides), choose your source type, then pick one or more of seven target formats: Twitter thread, LinkedIn post, Instagram caption, Facebook post, TikTok script, email summary, or Medium article. The analyzer extracts a title, hook, key points, quotes, stats, and CTAs, then each format generator composes a platform-appropriate version respecting character limits, structure, and tone.",
      },
      {
        q: "Which source and target formats are supported?",
        a: "Five source types: blog-post, youtube-transcript, podcast-transcript, email-newsletter, presentation-slides. Seven target formats: Twitter thread (5-10 numbered tweets), LinkedIn post (~1300 chars, professional bullets), Instagram caption (2200 chars, emoji-heavy, hashtags), Facebook post (~477 chars, question hook), TikTok script (60-sec scene-by-scene), email summary (subject + preview + body), and Medium article (800-1500 words with headers).",
      },
      {
        q: "Can I generate variations and check consistency across formats?",
        a: "Yes. The tool generates 2 variations per target format with different hooks, runs a cross-format consistency check that flags key points missing from any format, scores content quality (0-100) based on length, structure, and hooks, and recommends the best target format for your source type. You can also tune tone (professional, casual, educational, inspirational, entertaining), toggle CTA inclusion, and cap items per format (e.g., max tweets in a thread).",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 5 source-type presets (blog, YouTube transcript, podcast, email, presentation). (2) 7 target format generators. (3) Content analyzer (title, hook, key points, quotes, stats, CTA). (4) Hook extractor (most engaging sentence). (5) Quote extractor (memorable one-liners). (6) Stat extractor (numbers, percentages, dollar amounts). (7) Key-point extractor (3-7 main points). (8) CTA generator per format. (9) 5 tone presets with vocabulary modifier. (10) Max-items limiter per format. (11) Render as text repurposed content (per format). (12) Render as CSV (format, content, char_count, item_count). (13) Copy + Download .txt + Download CSV. (14) History (localStorage, last 20). (15) Shareable URL (encode source + settings in hash). (16) Summary stats (total formats, items, chars, by format). (17) Content quality scorer (length, structure, hooks). (18) Cross-format consistency checker. (19) Best-format recommender per source type. (20) 2 variations per format.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All content analysis and repurposing runs locally in your browser. History is stored in localStorage on this device only — your source content never leaves your machine.",
      },
    ],
  },
  status: "done",
};
