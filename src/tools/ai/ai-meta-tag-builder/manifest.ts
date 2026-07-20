import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-meta-tag-builder",
  name: "AI Meta Tag Builder",
  description:
    "Build SEO meta tags with live previews. Generate title, description, canonical, robots, Open Graph, Twitter Card, and JSON-LD snippets. Pixel-width and character meters, Google SERP / Facebook / X / LinkedIn / Slack / Discord previews, on-device AI drafting of titles and descriptions from page text, and copyable HTML — 100% client-side. Optional BYO-key LLM enhancement.",
  category: "ai",
  keywords: [
    "meta tag generator", "open graph generator", "twitter card",
    "seo title description", "meta tags", "og tags", "json-ld",
    "serp preview", "meta preview", "canonical url",
  ],
  icon: "tags",
  requiresNetwork: false,
  seo: {
    title: "AI Meta Tag Builder — SEO Title/Description + OG/Twitter with Live Previews | UnQTools",
    faq: [
      {
        q: "How does the AI Meta Tag Builder work?",
        a: "Enter your page title, description, URL, image, type, and robots directive. The engine renders valid HTML meta tags for title, description, canonical, robots, Open Graph, and Twitter Card, plus a JSON-LD stub (Article / Product / Website / Breadcrumb). Live previews show how your snippet will look on Google SERP, Facebook, X (Twitter), LinkedIn, Slack, and Discord. Pixel-width and character meters warn you when titles or descriptions exceed typical platform limits.",
      },
      {
        q: "What are the pixel-width and character limits?",
        a: "Google SERP title: 600px (≈ 50–60 chars). Google SERP description: 920px (≈ 150–160 chars). Open Graph title: 60 chars (no strict pixel limit). Twitter title: 70 chars. Twitter description: 200 chars. The tool shows red/amber/green indicators per platform so you can resize before publishing.",
      },
      {
        q: "Can the AI draft titles and descriptions from my page content?",
        a: "Yes. Paste your page text and click 'Draft from content' — the on-device engine extracts the top keywords and generates a title candidate and description candidate using the first sentences of the content. For higher-quality drafts, paste your own LLM API key (OpenAI or Anthropic) and click 'Enhance with LLM' — that request goes directly from your browser to the LLM provider.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Title/description/canonical/robots + Open Graph + Twitter Card fields. (2) Live previews: Google SERP, Facebook, X, LinkedIn, Slack, Discord. (3) Pixel-width + character meters with red/amber/green warnings. (4) On-device AI to draft title/description from page text. (5) OG image dimension helper. (6) JSON-LD stubs (Article / Product / Website / Breadcrumb). (7) Copyable HTML block. (8) 6 robots directive presets (index,follow / noindex,follow / index,nofollow / noindex,nofollow / noarchive / nosnippet). (9) 4 OG type presets (website/article/product/profile). (10) 3 Twitter card presets (summary/summary_large_image/player). (11) Local history (last 20). (12) Shareable URL with all fields encoded. (13) Optional BYO-key LLM enhancement. (14) Sample page presets. (15) Honesty note about search-engine rewrites.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All tag generation, preview rendering, and pixel-width calculation run locally in your browser. The page text never leaves this device. The only network call is if you paste your own LLM API key and click 'Enhance with LLM' — that request goes directly from your browser to the LLM provider you choose.",
      },
    ],
  },
  status: "done",
};
