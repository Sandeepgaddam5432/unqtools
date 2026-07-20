import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-product-description-writer",
  name: "AI Product Description Writer",
  description:
    "Write benefit-driven, SEO product descriptions from product name + features + audience + tone. Multi-format outputs (paragraph, Amazon 5-bullet, Shopify, Etsy, meta description), feature→benefit translator, SEO keyword density meter, multiple lengths (short/medium/long), persona targeting, A/B variants, bulk CSV mode. Pure-JS template engine — optional BYO-key LLM. 100% client-side, nothing uploaded.",
  category: "ai",
  keywords: [
    "product description generator", "ai ecommerce copywriter",
    "amazon bullet point generator", "seo product description",
    "feature to benefit", "shopify description",
    "etsy description", "product copywriter free",
    "private ai writer", "benefit driven copy",
  ],
  icon: "shopping-bag",
  requiresNetwork: false,
  seo: {
    title: "AI Product Description Writer — Benefit-Driven, SEO, Private | UnQTools",
    faq: [
      {
        q: "How does the AI Product Description Writer work?",
        a: "Enter your product name, its features, the target audience, and a tone. The on-device template engine converts each feature into a customer-facing benefit, weaves your SEO keywords in at a natural density (no stuffing), and produces multiple format-correct outputs: a short/medium/long paragraph, Amazon's 5-bullet layout, Shopify paragraph, Etsy description, and a ≤155-character meta description. You can copy each format independently. Optionally paste your own LLM API key to enhance the draft.",
      },
      {
        q: "How does the feature-to-benefit translator work?",
        a: "Each feature is rewritten from a product-centered statement ('stainless steel blade') into a buyer-centered benefit ('stays sharp longer, so you slice cleanly every time'). The translator uses a built-in mapping dictionary of common feature types (material, size, speed, battery, warranty, integrations, etc.) plus a deterministic pattern rewriter for unknown features. You can edit each translated benefit before generating the final copy.",
      },
      {
        q: "How is SEO keyword density handled?",
        a: "Enter your target keywords (comma-separated). After generation, the tool counts occurrences and computes a density percentage (keyword occurrences / total words × 100). A green meter shows 0.5–2.5% (natural), amber 2.5–4% (pushing it), red >4% (keyword stuffing — flagged with a warning). The generator never inserts a keyword more than once per 100 words to avoid stuffing.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Four product types (physical, digital, service, SaaS) with type-specific templates. (2) Six tones (professional, casual, luxurious, playful, technical, persuasive). (3) Three lengths (short 60–80 words, medium 120–160 words, long 220–280 words). (4) Five formats (paragraph, Amazon 5-bullet, Shopify, Etsy, meta description). (5) Feature→benefit translator with editable results. (6) SEO keyword density meter. (7) Persona targeting input. (8) A/B variant generator (two distinct openings). (9) Bulk CSV mode (one product per row). (10) Honesty checks (flags unverifiable claims). (11) Copy + download (txt/Markdown/CSV). (12) History (localStorage, last 20). (13) Shareable URL. (14) Sample products. (15) Optional BYO-key LLM enhancement.",
      },
      {
        q: "Is my product data sent anywhere?",
        a: "No. All template rendering, feature→benefit translation, density checks, and formatting run locally in your browser. Product data never leaves this device. The only network call is if you paste your own LLM API key and click 'Enhance with LLM' — that request goes directly from your browser to the LLM provider you choose. The tool never fabricates specifications or compliance/health claims.",
      },
    ],
  },
  status: "done",
};
