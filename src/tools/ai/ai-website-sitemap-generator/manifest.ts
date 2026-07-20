import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-website-sitemap-generator",
  name: "AI Website Sitemap Generator",
  description:
    "Generate website sitemaps by site type (blog, e-commerce, SaaS, portfolio, docs). Paste your URLs or use a built-in template, then export a valid XML sitemap (with priority/changefreq/lastmod), an HTML sitemap, and a visual tree. Auto-split into a sitemap index at 50k URLs, image + hreflang (multilingual) entries, exclude patterns, per-URL overrides. Pure-JS engine — optional BYO-key LLM. 100% client-side, no page cap, no upload.",
  category: "ai",
  keywords: [
    "sitemap generator", "xml sitemap", "sitemap.xml",
    "html sitemap", "sitemap index", "visual sitemap",
    "free sitemap generator", "no page limit sitemap",
    "paste urls sitemap", "sitemap by site type",
    "blog sitemap", "ecommerce sitemap", "saas sitemap",
  ],
  icon: "network",
  requiresNetwork: false,
  seo: {
    title: "AI Website Sitemap Generator — XML + HTML + Visual, No Page Limit | UnQTools",
    faq: [
      {
        q: "How does the AI Website Sitemap Generator work?",
        a: "Pick a site type (blog, e-commerce, SaaS, portfolio, or docs) and the tool loads a template of canonical URLs (home, about, blog list, post detail, product list, product detail, pricing, docs root, etc.). Paste your own URL list on top — or use the template as-is — and the generator builds a valid XML sitemap with <loc>, <lastmod>, <changefreq>, and <priority>, an HTML sitemap, and a visual indented tree. Site type drives default priority and changefreq per URL pattern.",
      },
      {
        q: "Can I paste my own URLs instead of using a template?",
        a: "Yes. Paste a newline- or comma-separated list of URLs into the 'Paste URLs' box. The tool validates each URL (https/http scheme, dedupes, sorts), applies default priority/changefreq by pattern (home=1.0, list=0.8, detail=0.6, etc.), and lets you override per-URL. You can also merge your pasted URLs with a site-type template.",
      },
      {
        q: "How does sitemap-index splitting work?",
        a: "The sitemaps.org spec caps each sitemap at 50,000 URLs and 50MB uncompressed. When your URL list exceeds 50,000 entries, the tool auto-splits into a sitemap index file pointing at multiple sitemap-1.xml, sitemap-2.xml, etc. Each chunk is well under the cap. The split is deterministic — same input always produces the same partition.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Five site-type templates (blog, e-commerce, SaaS, portfolio, docs). (2) Paste-URL mode (any list). (3) Template + paste merge. (4) Valid XML sitemap with priority/changefreq/lastmod. (5) HTML sitemap. (6) Visual tree render. (7) Sitemap-index auto-split at 50k URLs. (8) Image sitemap entries. (9) Hreflang (multilingual) entries. (10) Exclude-pattern filters (regex). (11) Per-URL priority/changefreq overrides. (12) Stats (count by depth, by section). (13) Download XML / HTML / JSON / TXT / Markdown. (14) History (localStorage, last 20). (15) Shareable URL. (16) Optional BYO-key LLM enhancement. (17) Deterministic — same inputs always produce the same output.",
      },
      {
        q: "Is my site data sent anywhere?",
        a: "No. All template loading, URL parsing, validation, deduplication, splitting, and XML/HTML rendering run locally in your browser. URL lists never leave this device. The only network call is if you paste your own LLM API key and click 'Enhance with LLM' — that request goes directly from your browser to the LLM provider you choose.",
      },
    ],
  },
  status: "done",
};
