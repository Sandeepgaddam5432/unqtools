import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "product-review-schema-generator",
  name: "Product Review Schema Generator",
  description:
    "Generate Product + Review + AggregateRating JSON-LD schema for product review pages. Includes BreadcrumbList + FAQPage companion schemas, Google rich results compliance checker, 7 currency presets, 4 availability presets, history (localStorage), shareable URL. 100% client-side.",
  category: "seo",
  keywords: [
    "product review schema", "json-ld", "structured data",
    "schema.org", "review schema", "aggregate rating",
    "rich results", "product schema", "google review",
    "breadcrumb schema", "faq schema",
  ],
  icon: "star",
  requiresNetwork: false,
  seo: {
    title: "Product Review Schema Generator — JSON-LD for Reviews | UnQTools",
    faq: [
      {
        q: "How does the Product Review Schema Generator work?",
        a: "Fill in the product details (name, brand, image, URL, price, currency), the single review (author, rating 1-5, body, date), and the aggregate rating (count + value). The tool outputs a Product JSON-LD with nested Review and AggregateRating objects, wrapped in a <script type=\"application/ld+json\"> tag ready to paste into your page.",
      },
      {
        q: "Which schema.org fields are supported?",
        a: "Product fields: name, image, brand, description, sku, gtin, category, offers (price, currency, availability). Review fields: author, reviewRating (ratingValue, bestRating=5, worstRating=1), reviewBody, datePublished. AggregateRating: ratingValue, reviewCount. Plus BreadcrumbList and FAQPage companion schemas.",
      },
      {
        q: "How do I know if my schema is Google rich results compliant?",
        a: "The validation report lists required fields (productName, reviewRating, reviewAuthor) and recommended fields (productBrand, productImageUrl, productUrl, productPrice). The compliance checker confirms whether Google will accept the schema and shows errors and warnings inline.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Product JSON-LD generator with all schema.org fields. (2) Nested Review object generator. (3) AggregateRating calculator (clamp 1-5, count ≥ 1). (4) Required fields validator per Google spec. (5) HTML script tag wrapper. (6) BreadcrumbList companion (Home > Reviews > Product). (7) FAQPage companion (3 auto-generated questions). (8) Currency presets (USD/EUR/GBP/INR/JPY/AUD/CAD). (9) Availability presets (InStock/OutOfStock/PreOrder/BackOrder). (10) Text report renderer. (11) CSV renderer (field,value). (12) Copy + Download .json + Download .html. (13) History (last 20). (14) Shareable URL. (15) Schema validation report. (16) Summary stats. (17) Google rich results compliance checker.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All schema generation runs locally in your browser. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
