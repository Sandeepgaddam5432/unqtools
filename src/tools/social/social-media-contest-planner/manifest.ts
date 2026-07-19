import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "social-media-contest-planner",
  name: "Social Media Contest Planner",
  description:
    "Plan social media contests and giveaways with official rules, entry mechanics, prize formatting, eligibility checks, winner-selection suggestions, hashtag generator, per-platform disclaimers, promotion schedule, and compliance checker. 5 platforms, 6 contest types, 7 entry methods, 20 features. 100% client-side.",
  category: "social",
  keywords: [
    "contest", "giveaway", "contest planner",
    "instagram contest", "twitter giveaway", "tiktok contest",
    "youtube giveaway", "facebook contest",
    "contest rules", "official rules", "winner selection",
    "contest hashtag", "promotion schedule",
  ],
  icon: "trophy",
  requiresNetwork: false,
  seo: {
    title: "Social Media Contest Planner — Rules, Mechanics, Prizes | UnQTools",
    faq: [
      {
        q: "How does the Contest Planner work?",
        a: "Enter your contest name, platform (Instagram/Twitter/Facebook/TikTok/YouTube), contest type (like-comment-follow, share-tag, UGC, hashtag, photo, video), prize details, dates, eligibility (followers/age/geography), and entry methods. The tool generates official rules, entry mechanics, prize descriptions, duration stats, eligibility checks, winner-selection suggestions, a unique contest hashtag, per-platform disclaimers, a promotion schedule, and a compliance check.",
      },
      {
        q: "What platforms and contest types are supported?",
        a: "Five platforms: Instagram, Twitter (X), Facebook, TikTok, YouTube. Six contest types: like-comment-follow, share-tag, user-generated-content, hashtag-contest, photo-contest, video-contest. Seven entry methods: follow, like, comment, share, tag-friends, post-with-hashtag, story-mention.",
      },
      {
        q: "How are official rules and disclaimers generated?",
        a: "Official rules combine eligibility, entry mechanics, prize description, duration, and winner-selection method into a structured rules document. Each platform gets a tailored disclaimer (e.g., Instagram: 'Not sponsored, endorsed, or administered by Instagram'). Compliance checks flag known platform-specific requirements (e.g., Instagram's promotion guidelines, Facebook's page-mention requirement).",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 5 platform presets. (2) 6 contest type presets. (3) Official rules generator. (4) Entry mechanics generator. (5) Prize description formatter. (6) Duration calculator (days). (7) Eligibility checker (followers + age + geography). (8) Winner selection method suggester (3 methods). (9) Hashtag generator (unique from contest name). (10) Disclaimer generator (per platform). (11) Render as text contest brief. (12) Render as printable HTML rules. (13) Render as Markdown blog announcement. (14) Render as CSV (component, value). (15) Copy + Download .txt + Download HTML + Download MD + Download CSV. (16) History (localStorage, max 20). (17) Shareable URL encoding inputs in hash. (18) Summary stats (duration, prize value, entry methods count). (19) Contest promotion schedule (reminder timeline). (20) Compliance checker (per platform).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All rule generation, hashtag creation, and rendering runs locally in your browser. History is stored in localStorage on this device only. Shareable URLs encode inputs in the URL hash and never touch our server.",
      },
    ],
  },
  status: "done",
};
