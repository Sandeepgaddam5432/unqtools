import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "e-commerce-product-seo-optimizer",
  name: "E-commerce Product SEO Optimizer",
  description:
    "Optimize e-commerce product page SEO — generate SEO title (60 chars), meta description (155 chars), URL slug, Product JSON-LD schema, heading structure, keyword extraction, alt-text suggestions, content score with breakdown, bulk CSV mode, currency presets, history, shareable URL. 100% client-side — paste product details, get instant SEO output.",
  category: "seo",
  keywords: [
    "ecommerce seo", "product seo", "product schema", "json-ld",
    "seo title", "meta description", "url slug", "product page",
    "schema markup", "shopping seo", "structured data",
  ],
  icon: "shopping-bag",
  requiresNetwork: false,
  seo: {
    title: "E-commerce Product SEO Optimizer — Title, Meta, Schema & Slug | UnQTools",
    faq: [
      {
        q: "What does the e-commerce product SEO optimizer generate?",
        a: "Seven outputs per product: SEO title (≤60 chars), meta description (≤155 chars), URL slug (kebab-case), Product JSON-LD schema markup, heading structure (H1/H2/H2/H2), top 5 keywords, and alt-text suggestions for product images. Plus a 0-100 content completeness score with per-field breakdown.",
      },
      {
        q: "How is the content score calculated?",
        a: "Each field contributes points: +10 productName, +10 brand, +10 price, +10 description (over 50 chars), +10 features (3+), +10 SKU, +10 GTIN, +10 availability, +5 MPN, +5 condition, +10 description over 200 chars. Maximum 100. Empty fields show as missing in the breakdown so you know exactly what to add.",
      },
      {
        q: "What is the Product JSON-LD schema format?",
        a: "Standard Schema.org Product type with name, image (placeholder), description, brand, sku, mpn, gtin, offers (price, currency, availability), and category. Output is minified JSON ready to paste into a <script type=\"application/ld+json\"> tag. Validate in Google's Rich Results Test before deploying.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) SEO title generator (60 char limit). (2) Meta description generator (155 char limit). (3) URL slug generator (kebab-case). (4) Product schema JSON-LD generator. (5) Heading structure suggestion. (6) Keyword extraction (top 5). (7) Alt-text suggestions for product images. (8) Content score with breakdown. (9) Render as text report. (10) Render as CSV. (11) Copy + Download .txt + Download JSON-LD. (12) History (localStorage, last 20). (13) Shareable URL (encodes inputs in hash). (14) Bulk mode (CSV input of multiple products). (15) Summary stats. (16) Currency presets (USD, EUR, GBP, INR, JPY, AUD, CAD).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All generation runs locally in your browser. History is stored in localStorage on this device only. No product data ever leaves the page — safe for confidential catalog work.",
      },
    ],
  },
  status: "done",
};
