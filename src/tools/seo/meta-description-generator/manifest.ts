import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "meta-description-generator",
  name: "Meta Description Generator",
  description:
    "Generate and A/B test meta descriptions. Multiple suggestions, 160-char counter, pixel width estimator, keyword insertion, SERP preview, templates, history, shareable URL. 100% client-side.",
  category: "seo",
  keywords: [
    "meta description", "description tag", "serp snippet", "seo description",
    "ab testing", "pixel width", "ctr", "snippet preview", "html meta",
  ],
  icon: "align-left",
  requiresNetwork: false,
  seo: {
    title: "Meta Description Generator — A/B Test SERP Snippets | UnQTools",
    faq: [
      {
        q: "How long should a meta description be?",
        a: "Google typically truncates descriptions around 155-160 characters on desktop and ~120 on mobile. The pixel-width budget is roughly 920px on desktop. This tool counts characters and estimates pixel width so your description survives truncation.",
      },
      {
        q: "What does the A/B test mode do?",
        a: "You can write two competing description variants (A and B), and the tool computes character count, pixel width, keyword coverage, and an estimated CTR score for each — then highlights which version is more likely to win.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Multiple suggestion presets (concise, descriptive, question, list, how-to, transactional). (2) 160-char counter with warn/over states. (3) Pixel-width estimator (handles wide CJK + emoji). (4) A/B test mode comparing two versions. (5) Keyword insertion. (6) Template presets. (7) SERP preview. (8) Copy. (9) History (localStorage, last 20). (10) Shareable URL.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. Description generation is pure string manipulation in your browser. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
