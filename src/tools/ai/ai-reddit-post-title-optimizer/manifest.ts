import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-reddit-post-title-optimizer",
  name: "AI Reddit Post Title Optimizer",
  description:
    "Generate subreddit-aware, non-clickbait Reddit post titles from your draft. Five title formulas (question, story, list, controversy, AMA), per-subreddit char limits, authenticity + clickbait-risk scoring, rule-risk flags, A/B pairs, copy per title. Pure-JS engine — optional BYO-key LLM. 100% client-side, nothing uploaded.",
  category: "ai",
  keywords: [
    "reddit title generator", "reddit post title optimizer",
    "subreddit title ideas", "non-clickbait reddit titles",
    "reddit post ideas", "askreddit title", " ama title",
    "private reddit tool", "reddit upvote titles",
  ],
  icon: "message-circle",
  requiresNetwork: false,
  seo: {
    title: "AI Reddit Post Title Optimizer — Subreddit-aware, Private | UnQTools",
    faq: [
      {
        q: "How does the AI Reddit Post Title Optimizer work?",
        a: "Paste your post draft and the target subreddit. The tool extracts the core topic and angle, then generates 5+ title options across five proven Reddit formulas — question, story, list, controversy, and AMA. Each title is scored 0–100 on authenticity and clickbait-risk, with a 'why it fits' note explaining how it matches the community's norms. Rule-risk flags warn you about self-promotion or editorializing phrasing before you post.",
      },
      {
        q: "What title formulas are included?",
        a: "Five classic Reddit angle templates: (1) Question — open with a question that invites discussion; (2) Story — lead with a personal anecdote hook; (3) List — 'X ways / X things / X lessons' style; (4) Controversy — a politely contrarian take that sparks debate; (5) AMA — 'I am X, ask me anything'. Each formula has subreddit-aware variants and respects the community's char limit (Reddit's hard limit is 300, but many subreddits prefer 100–120).",
      },
      {
        q: "How are subreddit norms detected?",
        a: "A built-in preset library covers the most popular subreddits (AskReddit, IAmA, todayilearned, science, technology, explainlikeimfive, programming, personal finance, fitness, relationships, writing-prompts, and more). Each preset stores the community's typical tone, preferred angle, char-limit guidance, and rule-risk hot buttons (e.g., no editorializing in r/news, no personal stories in r/science). For unknown or niche subreddits, the tool falls back to general best practices and reminds you to read the community rules.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Five title-formula templates (question, story, list, controversy, AMA). (2) Subreddit preset library with tone + char-limit + rule hints. (3) Authenticity + clickbait-risk scoring with score bars. (4) Rule-risk flags (self-promo, editorializing, low-effort). (5) 'Why it fits' notes per title. (6) A/B pair generator. (7) Char-limit guidance per subreddit. (8) Copy per title. (9) History (localStorage, last 20). (10) Shareable URL. (11) Sample drafts. (12) CSV/JSON export. (13) Optional BYO-key LLM enhancement. (14) Deterministic — same input always produces the same output.",
      },
      {
        q: "Is my draft sent anywhere?",
        a: "No. All title generation, scoring, and flagging run locally in your browser. Your draft never leaves this device. The only network call is if you paste your own LLM API key and click 'Enhance with LLM' — that request goes directly from your browser to the LLM provider you choose. We have no marketing funnel, no sign-up, and no upload.",
      },
    ],
  },
  status: "done",
};
