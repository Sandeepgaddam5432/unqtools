import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "social-media-poll-generator",
  name: "Social Media Poll Generator",
  description:
    "Generate optimized polls for Twitter, LinkedIn, Instagram, and Facebook. Pick a poll type (this-or-that, multiple-choice, rating-scale, opinion-scale, yes-no-maybe), tone, and duration. Per-platform constraints, question generator, option generator, engagement optimizer, hashtag + caption generator, variations, best-time-to-post, follow-up content suggestions. 20 features. 100% client-side.",
  category: "social",
  keywords: [
    "poll", "poll generator", "social poll",
    "twitter poll", "linkedin poll", "instagram poll",
    "facebook poll", "this or that", "multiple choice",
    "rating scale", "opinion scale", "engagement",
    "poll question", "poll options",
  ],
  icon: "vote",
  requiresNetwork: false,
  seo: {
    title: "Social Media Poll Generator — Twitter, LinkedIn, IG, FB | UnQTools",
    faq: [
      {
        q: "How does the Poll Generator work?",
        a: "Enter your poll topic, choose a platform (Twitter, LinkedIn, Instagram, or Facebook), pick a poll type (this-or-that, multiple-choice, rating-scale, opinion-scale, yes-no-maybe), set the number of options, duration, and tone. The tool generates an optimized question, balanced options, captions, hashtags, best-time-to-post suggestion, engagement prediction, balance score, 3 variations, follow-up content suggestions, and a feasibility check against the chosen platform's limits.",
      },
      {
        q: "What are the per-platform poll constraints?",
        a: "Twitter: 2-4 options, 25 chars per option, max 7 days. LinkedIn: exactly 4 options, 30 chars, max 14 days. Instagram: 2-4 options (story polls 2), 25 chars, max 24 hours. Facebook: 2-7 options (groups), 80 chars, max 7 days. The tool validates your inputs against these limits.",
      },
      {
        q: "What poll types and tones are supported?",
        a: "Five poll types: this-or-that (2 opposing options), multiple-choice (2-7 distinct options), rating-scale (1-5), opinion-scale (5-point Likert), yes-no-maybe (3 options). Five tones: serious, casual, fun, controversial, educational. Each tone adjusts the wording of questions and options.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 4 platform presets with constraints. (2) 5 poll type generators. (3) Question generator per topic + tone. (4) Option generator per poll type. (5) Poll duration validator per platform. (6) Option char limit validator per platform. (7) Engagement optimizer (balanced options). (8) 5 tone presets. (9) Poll caption generator. (10) Hashtag generator (3-5 relevant). (11) Render as formatted text poll. (12) Render as CSV. (13) Copy + Download .txt + Download CSV. (14) History (localStorage, max 20). (15) Shareable URL. (16) Summary stats (total options, avg char count, duration, predicted engagement). (17) Poll variation generator (3 angles). (18) Best time to post suggestion per platform. (19) Option balance scorer (0-100). (20) Follow-up content suggester.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All poll generation, optimization, and rendering runs locally in your browser. History is stored in localStorage on this device only. Shareable URLs encode inputs in the URL hash and never touch our server.",
      },
    ],
  },
  status: "done",
};
