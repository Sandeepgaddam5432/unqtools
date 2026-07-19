import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "linkedin-post-formatter",
  name: "LinkedIn Post Formatter",
  description:
    "Format raw thoughts into LinkedIn-ready posts with bold hooks, bullets, CTAs, hashtags, and algorithm-friendly line breaks. 5 post-type presets (text-post, article-share, poll, celebration, hiring), 5 tone presets (thought-leader, educator, mentor, storyteller, analyst), headline extractor, bullet formatter, CTA generator per post type, hashtag generator (3-5 professional), char-count validator (1300 optimal, 3000 max), format validator (emoji limit, professional language), 3 post variations, hook strength scorer (0-100), best time-to-post suggestion, history (localStorage), shareable URL. 100% client-side.",
  category: "social",
  keywords: [
    "linkedin post", "linkedin formatter", "linkedin hook",
    "linkedin post formatter", "linkedin caption", "linkedin post ideas",
    "professional post", "linkedin text formatter", "thought leadership",
  ],
  icon: "linkedin",
  requiresNetwork: false,
  seo: {
    title: "LinkedIn Post Formatter — Hooks, Bullets, CTAs, Hashtags | UnQTools",
    faq: [
      {
        q: "How does the LinkedIn Post Formatter work?",
        a: "Paste your raw thoughts into the textarea. The tool extracts the first engaging sentence as a bold hook, formats key points as bullets (•), adds proper line breaks that LinkedIn's algorithm prefers, generates a call-to-action matching the post type (comment, share, DM, follow), and appends 3-5 professional hashtags derived from your content. Pick from 5 post types (text-post, article-share, poll, celebration, hiring) and 5 tones (thought-leader, educator, mentor, storyteller, analyst) to shape the output.",
      },
      {
        q: "What are the LinkedIn character limit guidelines?",
        a: "LinkedIn posts have a hard limit of 3000 characters. The tool flags when your post exceeds this. The optimal length for engagement is around 1300 characters — long enough to tell a story but short enough to keep attention. The char-count validator shows green/yellow/red status and counts down to 3000.",
      },
      {
        q: "How does the line break formatter help with the LinkedIn algorithm?",
        a: "LinkedIn truncates posts in the feed after roughly 210 characters. The formatter separates your hook from the body with a blank line so the hook shows standalone, inserts single line breaks between paragraphs, and avoids triple+ newlines which LinkedIn collapses. This makes the post scannable on mobile and stops the 'See more' cut from breaking your opening line.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 5 post-type presets (text-post, article-share, poll, celebration, hiring). (2) Headline extractor (bold hook from first engaging sentence). (3) Bullet point formatter (• or numbers). (4) Line break formatter (LinkedIn algorithm-friendly). (5) CTA generator per post type (comment, share, DM, follow). (6) Hashtag generator (3-5 professional hashtags from content). (7) 5 tone presets (thought-leader, educator, mentor, storyteller, analyst). (8) Char count validator (1300 optimal, 3000 max). (9) LinkedIn format validator (emoji limit, professional language checker). (10) Render as text (formatted). (11) Render as HTML (formatted, copy-paste ready). (12) Render as Markdown (bullets). (13) Render as CSV (component, value). (14) Copy + Download .txt + Download HTML + Download MD + Download CSV. (15) History (localStorage, max 20). (16) Shareable URL (encode content in hash). (17) Summary stats (char count, word count, reading time, hashtag count). (18) Post variation generator (3 variations with different headlines). (19) Hook strength scorer (0-100 based on first-sentence patterns). (20) Best time-to-post suggestion (LinkedIn B2B engagement by day/hour).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All formatting runs locally in your browser. Your raw content never leaves this device. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
