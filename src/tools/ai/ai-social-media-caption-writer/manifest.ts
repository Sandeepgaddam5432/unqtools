import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-social-media-caption-writer",
  name: "AI Social Media Caption Writer",
  description:
    "Write per-platform social media captions for Instagram, X/Twitter, LinkedIn, TikTok, and Facebook. Built-in template engine produces hook + body + CTA + hashtags + emojis with each platform's char-limit, hashtag, and style conventions. Tone presets, emoji density slider, hook variants, CTA library, niche + branded hashtag suggestions with shadowban-risk flagging, hashtag-in-first-comment tip, A/B caption pairs, thread/carousel mode, multi-language ready, history (last 20), favorites (localStorage), and shareable URL. 100% client-side — optional BYO-key LLM enhancement.",
  category: "ai",
  keywords: [
    "caption generator", "instagram caption writer", "twitter caption",
    "linkedin caption", "tiktok caption", "facebook caption",
    "social media caption", "hashtag generator", "caption ai",
    "hook generator", "cta generator", "no login caption tool",
    "private caption writer",
  ],
  icon: "pen-tool",
  requiresNetwork: false,
  seo: {
    title: "AI Social Caption Writer — Per-Platform, Private / UnQTools",
    faq: [
      {
        q: "How does the AI Social Media Caption Writer work?",
        a: "Pick a platform (Instagram, X/Twitter, LinkedIn, TikTok, Facebook), enter your topic, choose a tone (bold, friendly, professional, playful, inspirational), and set an emoji density (none, low, medium, high). The tool composes multiple captions from a built-in per-platform template library, each with a hook line, body, CTA, emoji set, and a hashtag block tailored to that platform's length and hashtag norms. A live character meter flags over-limit captions.",
      },
      {
        q: "How are platform character limits handled?",
        a: "Each platform has a char limit baked in — Instagram 2,200, X 280, LinkedIn 3,000, TikTok 2,200, Facebook 5,000. The generator composes within the soft-target window for each platform (e.g., Instagram 138–150 chars is the sweet spot before the 'more' truncation; X is hard-capped at 280). Over-limit captions are auto-trimmed on word boundaries and flagged with a warning so you can edit before posting.",
      },
      {
        q: "What hashtag features are included?",
        a: "Per-niche hashtag suggestions (up to 30), branded-hashtag generation from your account name, shadowban-risk flagging against a bundled list of dated banned/risky tags (e.g., #anorexia, #costhings) so you can avoid them, and per-platform count guidance (Instagram 5–10, X 1–2, LinkedIn 3–5, TikTok 3–5, Facebook 0–2). The tool also surfaces a 'hashtag in first comment' tip for Instagram and TikTok.",
      },
      {
        q: "Can I generate thread/carousel captions or A/B test pairs?",
        a: "Yes. Thread mode splits a longer idea into a numbered X/Twitter thread (each tweet under 280 chars). Carousel mode produces 5–10 slide-ready captions for Instagram carousels. A/B pair mode generates a control caption and a challenger (different hook + tone) with a hypothesis explaining what it tests. Use these as starting points for real A/B tests; engagement depends on your audience and content mix.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 5 platforms (IG, X, LinkedIn, TikTok, Facebook). (2) 5 tone presets. (3) 4 emoji-density levels. (4) Live per-platform char meter with auto-trim. (5) Hook variant library (10+ hooks per tone). (6) CTA library (8 CTAs). (7) Niche + branded hashtag suggestions. (8) Shadowban-risk flagging (bundled list). (9) Hashtag-in-first-comment tip. (10) Thread mode. (11) Carousel mode. (12) A/B caption pairs. (13) Niche presets (12+). (14) Favorites (localStorage). (15) Copy + Download (text/JSON/CSV/Markdown). (16) Optional BYO-key LLM enhancement. (17) History (localStorage, last 20). (18) Shareable URL.",
      },
    ],
  },
  status: "done",
};
