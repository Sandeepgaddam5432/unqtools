import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "social-media-collab-finder",
  name: "Social Media Collab Finder",
  description:
    "Find collaboration opportunities: influencer outreach query generator, brand partnership matcher, cross-promotion partner finder, affiliate program structure, sponsored content briefs, giveaway collab planner, follow-up sequence, compensation calculator. 6 collab types, 5 platforms, 4 audience tiers, 20 features. 100% client-side.",
  category: "social",
  keywords: [
    "collab", "collaboration", "influencer outreach",
    "brand partnership", "cross-promotion", "affiliate",
    "sponsored content", "giveaway collab",
    "influencer marketing", "outreach email",
    "compensation calculator", "follow-up",
  ],
  icon: "handshake",
  requiresNetwork: false,
  seo: {
    title: "Social Media Collab Finder — Influencer Outreach + Brand Match | UnQTools",
    faq: [
      {
        q: "How does the Collab Finder work?",
        a: "Enter your brand, niche, collab type (influencer-outreach, brand-partnership, cross-promotion, affiliate, sponsored-content, giveaway-collab), target platforms (Instagram/YouTube/TikTok/Twitter/blog), audience size target (micro/mid/macro/mega), budget range, and your value proposition. The tool generates Google search footprints to find influencers per platform, an outreach email template per collab type, a brand partnership compatibility score, complementary niches for cross-promotion, an affiliate program structure (commission + cookie duration), a sponsored content brief template per platform, a giveaway collab plan, a 3-step follow-up sequence, and a typical-rate compensation estimate.",
      },
      {
        q: "What collab types and platforms are supported?",
        a: "Six collab types: influencer-outreach, brand-partnership, cross-promotion, affiliate, sponsored-content, giveaway-collab. Five platforms: Instagram, YouTube, TikTok, Twitter (X), blog. Four audience tiers: micro (1k–10k), mid (10k–100k), macro (100k–1M), mega (1M+).",
      },
      {
        q: "How is compensation calculated?",
        a: "Compensation uses typical market-rate ranges per audience tier and collab type (e.g., micro Instagram post ≈ $100–$500; mega YouTube integration ≈ $10k–$50k). The tool returns a low/mid/high range as an estimate. Always confirm actual rates with each partner — these are planning figures, not guarantees.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 6 collab type presets. (2) 5 target platform presets. (3) 4 audience size tier presets. (4) Influencer search query generator (Google footprints per platform). (5) Outreach email template generator (per collab type). (6) Brand partnership matcher (compatibility scoring). (7) Cross-promotion partner finder (complementary niche lookup). (8) Affiliate program structure suggester (commission + cookie duration). (9) Sponsored content brief template (per platform). (10) Giveaway collab planner. (11) Value prop formatter. (12) Render as text outreach plan. (13) Render as CSV (component, value). (14) Copy + Download .txt + Download CSV. (15) History (localStorage, max 20). (16) Shareable URL encoding inputs in hash. (17) Summary stats (outreach targets, by platform, by collab type). (18) Outreach tracker (CSV template). (19) Follow-up sequence generator (3 templates). (20) Compensation calculator (per audience size + collab type).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All query generation, email templating, and rendering runs locally in your browser. History is stored in localStorage on this device only. Shareable URLs encode inputs in the URL hash and never touch our server.",
      },
    ],
  },
  status: "done",
};
