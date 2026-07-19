import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "tweet-thread-planner",
  name: "Tweet Thread Planner",
  description:
    "Plan and format Twitter/X threads from long content. Breaks text into tweet-sized chunks (≤280 chars), generates a hook tweet, a CTA tweet, applies 1/2/3 numbering, inserts transition words between tweets, and supports 5 tones (informational, controversial, storytelling, listicle, thread-bois). Plus char-limit validator, flow validator, engagement score estimator, 2 alt-variations, best-time-to-post suggestion, summary stats, CSV/text export, history (localStorage), shareable URL. 100% client-side.",
  category: "social",
  keywords: [
    "tweet thread", "twitter thread", "x thread",
    "thread planner", "tweet planner", "twitter thread planner",
    "thread hook", "tweet formatter", "thread maker", "thread writer",
  ],
  icon: "messages-square",
  requiresNetwork: false,
  seo: {
    title: "Tweet Thread Planner — Break Long Content Into Numbered X Threads | UnQTools",
    faq: [
      {
        q: "How does the tweet thread planner work?",
        a: "Paste your long content (blog post, article, or rough thoughts), pick a tone, and the tool splits it into tweet-sized chunks (≤280 chars each, respecting sentence boundaries). It generates a hook tweet from the most engaging sentence, a CTA tweet asking for engagement (retweet/reply/follow), inserts transition words (But, And, So, Here's why, Plus) between tweets, and applies 1/, 2/, 3/ numbering.",
      },
      {
        q: "Which tones are supported?",
        a: "Five tones: informational (factual, clear), controversial (contrarian, debate-sparking), storytelling (narrative arc, hooks), listicle (numbered items, scannable), and thread-bois (casual, meme-aware, 'hot take' style). Each tone rewrites transitions and the hook to match its voice.",
      },
      {
        q: "What is the engagement score estimator?",
        a: "A heuristic score (0-100) based on hook strength (question/number/controversy), thread length (4-10 tweets optimal), presence of a CTA, average char count per tweet, and transition quality. Useful as a relative gauge when iterating — not a guarantee of virality.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Content splitter (≤280 chars, respects sentence boundaries). (2) Hook generator (most engaging sentence). (3) CTA generator (final tweet). (4) Numbering formatter (1/, 2/, 3/ ...). (5) Transition word inserter (5 transitions). (6) 5 tone presets. (7) Thread flow validator. (8) Tweet count calculator. (9) Char-limit validator per tweet. (10) Render as text thread. (11) Render as CSV (tweet_num, content, char_count, is_hook, is_cta). (12) Copy + Download .txt + Download CSV. (13) History (localStorage, last 20). (14) Shareable URL. (15) Summary stats (tweets, chars, avg, hook strength). (16) Engagement score estimator. (17) Alt-variation generator (2 variations). (18) Best-time-to-post suggestion (built-in Twitter engagement data by hour).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All thread generation runs locally in your browser. Your content never leaves this device. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
