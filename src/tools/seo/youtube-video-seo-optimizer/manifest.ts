import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "youtube-video-seo-optimizer",
  name: "YouTube Video SEO Optimizer",
  description:
    "Optimize YouTube video metadata — title, description, tags, chapters, hashtags. Title length analyzer (60-70 optimal), keyword placement checker, clickbait score, above-the-fold extractor, keyword density, link detector, chapter parser + validator, tag analyzer, hashtag generator, thumbnail text suggestion, scoring (0-100), CSV export, history (localStorage), shareable URL. 100% client-side.",
  category: "seo",
  keywords: [
    "youtube seo", "youtube video", "video seo",
    "youtube title", "youtube description", "youtube tags",
    "youtube chapters", "youtube hashtags", "thumbnail text",
    "youtube optimizer", "video metadata",
  ],
  icon: "youtube",
  requiresNetwork: false,
  seo: {
    title: "YouTube Video SEO Optimizer — Title, Description, Tags, Chapters | UnQTools",
    faq: [
      {
        q: "How does the YouTube SEO optimizer work?",
        a: "Enter your video title (max 100 chars), description (max 5000 chars), tags, channel name, target keywords, and category. The tool analyzes each component against YouTube best practices, scores your video 0-100, and breaks down the score by title (30pts), description (30pts), tags (25pts), and hashtags (15pts).",
      },
      {
        q: "What does the title analysis check?",
        a: "Three things: (1) Length — 60-70 chars is optimal for YouTube search snippets; (2) Keyword placement — front-loaded keywords (in the first half of the title) rank better; (3) Clickbait score — penalizes ALL-CAPS words, 'BEST', excessive '!' and '?' marks, and emoji overload.",
      },
      {
        q: "How are chapters and hashtags handled?",
        a: "Chapters: parse `0:00 Intro` style timestamps from your description, validate the sequence is monotonically increasing, and use them for description scoring. Hashtags: extract `#hashtag` occurrences from your description, suggest additional hashtags based on your title and category, and check that hashtags match your video category presets.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Title length analyzer (60-70 optimal). (2) Title keyword placement checker (front-loaded). (3) Clickbait score (penalizes CAPS/!/emojis). (4) Description length analyzer. (5) Above-the-fold (first 125 chars) extractor. (6) Keyword density (top 5 keywords). (7) Link detector (affiliate/social/website). (8) Timestamp chapter parser + sequence validator. (9) Chapter generator. (10) Tag analyzer (count/relevance/long-tail). (11) Hashtag generator (extract + suggest). (12) Thumbnail text suggestion (3-5 word hook). (13) Text report renderer. (14) CSV export. (15) Copy + Download .txt + Download CSV. (16) History (localStorage, last 20). (17) Shareable URL. (18) 10 video category presets with default tags/hashtags. (19) Summary stats (total score + breakdown).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All metadata analysis runs locally in your browser. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
