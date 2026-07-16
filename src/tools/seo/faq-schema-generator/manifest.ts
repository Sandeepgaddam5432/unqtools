import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "faq-schema-generator",
  name: "FAQ Schema Generator",
  description:
    "Generate FAQPage schema.org JSON-LD for rich results. Add/remove Q&A pairs, bulk paste, character counters, validation, Google Rich Results test link, and HTML script-tag wrapper. 100% client-side.",
  category: "seo",
  keywords: [
    "faq schema", "faqpage", "json-ld", "structured data", "rich results",
    "schema.org", "faq", "questions", "answers", "google",
  ],
  icon: "help-circle",
  requiresNetwork: false,
  seo: {
    title: "FAQ Schema Generator — FAQPage JSON-LD | UnQTools",
    faq: [
      {
        q: "What is FAQPage schema?",
        a: "FAQPage is a Schema.org type that marks up a list of Frequently Asked Questions. When you add it as JSON-LD to your page, Google may show an FAQ rich result in search — an expandable list of questions with answers directly in the SERP.",
      },
      {
        q: "How do I add FAQ schema to my page?",
        a: "Generate the JSON-LD with this tool, then paste the <script type=\"application/ld+json\"> block into the HTML <head> of the page that contains the visible FAQ. The visible text and the schema must match.",
      },
      {
        q: "What makes a FAQ eligible for rich results?",
        a: "Each Question must have an acceptedAnswer with text. The same Q&A must be visible on the page. Don't use FAQ schema for advertising or to display alternative answers. Google has tightened eligibility — FAQ rich results now show mainly for well-known authoritative sites.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Add/remove Q&A pairs dynamically. (2) Bulk paste — Q: ... A: ... per line. (3) Character counter per answer (recommended max ~3000 chars). (4) Google Rich Results test link. (5) Schema validation (required fields). (6) Pretty-rendered JSON preview. (7) HTML script-tag wrapper ready to paste. (8) Multi-FAQ support — multiple FAQPage blocks. (9) History (localStorage, last 20). (10) Shareable URL — encode the form in the fragment.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. FAQ schema generation is pure string templating in your browser. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
