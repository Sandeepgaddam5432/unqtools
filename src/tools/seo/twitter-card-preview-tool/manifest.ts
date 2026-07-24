/**
 * Twitter Card Preview Tool — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "twitter-card-preview-tool",
  name: "Twitter Card Preview Tool",
  description:
    "Preview how your URL will look when shared on Twitter/X. Validate twitter:card meta tags, see summary vs summary_large_image vs player cards, and 10+ extras. 100% private.",
  category: "seo",
  keywords: ["twitter card", "twitter preview", "x.com preview", "twitter meta tags", "card validator", "tweet preview"],
  icon: "twitter",
  requiresNetwork: false,
  seo: {
    title: "Twitter Card Preview Tool — Validate + Visual Mock | UnQTools",
    faq: [
      { q: "What are Twitter Card types?", a: "summary: small square image + text. summary_large_image: large 2:1 image + text (most engaging). player: embeds video/audio player. app: deep-links to mobile apps. Most websites should use summary_large_image for max engagement." },
      { q: "What extras does this tool have?", a: "Extras: (1) 4 card type previews, (2) Realistic Twitter UI mock (light + dark), (3) Auto-pull meta tags from URL field, (4) Image upload preview, (5) Character counter for title (max 70) and description (max 200), (6) Validation warnings for missing/oversized fields, (7) Generate full twitter: meta tag set, (8) Mobile vs desktop preview, (9) Image dimension checker (min 300×157, recommended 1200×628), (10) Show character count + pixel-width estimate, (11) Compare side-by-side summary vs large, (12) Copy individual tags, (13) Save history (localStorage), (14) Copy entire meta block." },
    ],
  },
  status: "done",
};
