import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "schema-jsonld-generator",
  name: "Schema.org JSON-LD Generator",
  description:
    "Generate Schema.org structured data in JSON-LD format for rich results — Article, Product, Event, Organization, LocalBusiness, Person, Recipe, Review, FAQPage, HowTo, BreadcrumbList, VideoObject. Includes validation, multi-schema support, custom properties, and Google Rich Results test link. 100% client-side.",
  category: "seo",
  keywords: [
    "schema.org", "json-ld", "structured data", "rich results", "rich snippets",
    "microdata", "article", "product", "event", "organization", "faq",
  ],
  icon: "braces",
  requiresNetwork: false,
  seo: {
    title: "Schema.org JSON-LD Generator — Structured Data | UnQTools",
    faq: [
      {
        q: "What is JSON-LD?",
        a: "JSON-LD (JavaScript Object Notation for Linked Data) is Google's recommended format for adding Schema.org structured data to web pages. You embed a <script type=\"application/ld+json\"> block in the HTML head, and search engines use it to display rich results like star ratings, FAQ accordions, breadcrumbs, and event cards.",
      },
      {
        q: "Which schema types does this generator support?",
        a: "Article, Product, Event, Organization, LocalBusiness, Person, Recipe, Review, FAQPage, HowTo, BreadcrumbList, and VideoObject — with required-field indicators per type and validation against Schema.org conventions.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Type selector with per-type templates. (2) Required fields indicator (shows which fields Google requires). (3) Google Rich Results test link. (4) Schema.org docs link. (5) Multi-schema support — combine several types in a @graph. (6) Custom properties — add any extra key/value beyond the template. (7) Validation warnings (missing recommended fields). (8) Pretty-rendered JSON preview. (9) History (localStorage, last 20). (10) Shareable URL — encode the schema in the fragment.",
      },
      {
        q: "Does this tool validate my schema?",
        a: "It performs lightweight structural validation — checks required fields, URL formats, and JSON validity. For full validation, use the Google Rich Results test link (opens in a new tab; you'd paste your URL or markup there).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. JSON-LD generation is pure string/template work in your browser. History is stored in localStorage on your device only.",
      },
    ],
  },
  status: "done",
};
