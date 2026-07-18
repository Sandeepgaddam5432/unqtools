import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "structured-data-validator",
  name: "Structured Data Validator",
  description:
    "Validate JSON-LD structured data against Schema.org types. Detect schema type, validate required fields, suggest recommended fields, multi-schema support, Google Rich Results link, Schema.org docs link, history, shareable URL. 100% client-side.",
  category: "seo",
  keywords: [
    "structured data", "json-ld validator", "schema.org validator",
    "rich results", "schema validation", "google structured data",
  ],
  icon: "check-circle",
  requiresNetwork: false,
  seo: {
    title: "Structured Data Validator — JSON-LD Schema.org Checker | UnQTools",
    faq: [
      {
        q: "What does this validator check?",
        a: "It parses your JSON-LD, detects the @type (Article, Product, Event, Organization, LocalBusiness, Person, Recipe, Review, FAQPage, HowTo, BreadcrumbList, VideoObject), checks all required fields are present and valid (URLs, dates, numbers), flags missing recommended fields, and reports errors + warnings as human-readable messages.",
      },
      {
        q: "How do I use it?",
        a: "Paste your JSON-LD (with or without the <script> wrapper) into the textarea. The tool parses it in real time and shows: detected schema type, missing required fields (errors), missing recommended fields (warnings), and a Google Rich Results test link to verify with Google directly.",
      },
      {
        q: "Does it support multiple schemas in one document?",
        a: "Yes — if your JSON-LD is a @graph array, each schema in the graph is validated independently. Errors and warnings are listed per schema with its index in the graph.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Schema type auto-detection. (2) Required field validation. (3) Recommended field suggestions. (4) Human-readable error messages. (5) Warning messages for missing recommended fields. (6) Multi-schema (@graph) support. (7) Google Rich Results test link. (8) Schema.org docs link per type. (9) History (localStorage, last 20). (10) Shareable URL.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. Validation runs locally. The Google Rich Results link is a clickable external link — your data is not sent there automatically.",
      },
    ],
  },
  status: "done",
};
