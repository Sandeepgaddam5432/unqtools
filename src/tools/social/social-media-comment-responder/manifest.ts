import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "social-media-comment-responder",
  name: "Social Media Comment Responder",
  description:
    "Generate professional responses to social media comments categorized by sentiment and intent. Sentiment analyzer (4 sentiments), 72-template response library (sentiment × tone combinations), 6 platform presets with platform-specific formatting, 6 tone presets, 3 length presets, emoji appender, CTA generator, 3 response variations, char count validator, quality scorer, escalation detector, keyword highlighter, response time suggestion, best practice tips. 100% client-side.",
  category: "social",
  keywords: [
    "comment responder", "social media reply", "comment reply generator",
    "sentiment analysis", "customer service", "community management",
    "response generator", "social media management", "reply templates",
  ],
  icon: "message-circle-reply",
  requiresNetwork: false,
  seo: {
    title: "Social Media Comment Responder — Sentiment + Tone Templates | UnQTools",
    faq: [
      {
        q: "How does the comment responder work?",
        a: "Paste the comment you want to respond to, pick the sentiment (or let the tool auto-detect it), choose a tone (professional, friendly, casual, apologetic, grateful, educational), pick a platform (Twitter, Instagram, Facebook, LinkedIn, TikTok, YouTube), and choose a length (short, medium, long). The tool generates 3 ready-to-use response variations from a library of 72 templates, formatted for the platform you selected.",
      },
      {
        q: "How is sentiment detected automatically?",
        a: "The tool scans the comment for ~30 positive keywords (love, great, amazing, etc.) and ~30 negative keywords (hate, terrible, broken, etc.). If both are present, the sentiment is 'mixed'. If only positive, 'positive'. If only negative, 'negative'. If neither, 'neutral'. You can always override the auto-detection by picking a sentiment manually.",
      },
      {
        q: "What platforms are supported and how does formatting differ?",
        a: "Six platforms: Twitter/X (280 chars), Instagram (2200 chars, casual), Facebook (8000 chars, friendly), LinkedIn (3000 chars, professional), TikTok (150 chars, very short), YouTube (10000 chars, informative). Responses are truncated with an ellipsis if they exceed the platform limit and you'll see a 'truncated' flag.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Sentiment analyzer (4 sentiments). (2) 72-template response library (4 sentiments × 6 tones × 3 templates). (3) 6 platform presets with platform-specific formatting. (4) 6 tone presets with vocabulary modifier. (5) 3 response length presets. (6) Emoji appender (sentiment-aware). (7) CTA generator (per platform). (8) 3 response variations per request. (9) Char count validator per platform. (10) Render as text. (11) Render as CSV. (12) Copy + Download .txt + Download CSV. (13) History (localStorage, max 20). (14) Shareable URL. (15) Summary stats. (16) Response quality scorer (0-100). (17) Escalation detector (angry / threatening / legal). (18) Keyword highlighter for sensitive words. (19) Response time suggestion per platform. (20) Best practice tips per sentiment.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All sentiment analysis, template selection, and response generation run locally in your browser. History is stored in localStorage on this device only. Shareable URLs encode inputs in the URL hash and never touch our server.",
      },
    ],
  },
  status: "done",
};
