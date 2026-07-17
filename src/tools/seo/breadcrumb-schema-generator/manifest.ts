import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "breadcrumb-schema-generator",
  name: "Breadcrumb Schema Generator",
  description:
    "Generate BreadcrumbList schema.org JSON-LD for rich results. Add/remove items, reorder up/down, bulk paste, live preview, Google Rich Results test link, and HTML script-tag wrapper. 100% client-side.",
  category: "seo",
  keywords: [
    "breadcrumb schema", "breadcrumblist", "json-ld", "structured data",
    "rich results", "schema.org", "breadcrumbs", "navigation", "google",
  ],
  icon: "navigation",
  requiresNetwork: false,
  seo: {
    title: "Breadcrumb Schema Generator — BreadcrumbList JSON-LD | UnQTools",
    faq: [
      {
        q: "What is BreadcrumbList schema?",
        a: "BreadcrumbList is a Schema.org type that marks up the breadcrumb navigation trail of a page. When added as JSON-LD, Google may show a breadcrumb trail in search results instead of the page's URL — giving users context about where the page sits in your site hierarchy.",
      },
      {
        q: "How do I add breadcrumb schema to my page?",
        a: "Generate the JSON-LD with this tool, then paste the <script type=\"application/ld+json\"> block into the HTML <head> of the page. The visible breadcrumb trail on the page should match the schema order and names.",
      },
      {
        q: "How many breadcrumb items should I include?",
        a: "At minimum 2 items (e.g., Home › Category) for a meaningful trail. Most pages have 3-5 levels. Avoid exceeding 50 items — extremely deep trails are usually a sign of poor site structure.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Add/remove breadcrumb items dynamically. (2) Reorder items up/down with one click. (3) Bulk paste — Name | URL one per line (also supports comma/tab/space separators). (4) Google Rich Results test link. (5) Live rendered preview (breadcrumb trail as users would see it). (6) HTML script-tag wrapper ready to paste. (7) Validation — min 2 items, valid URLs, no duplicates. (8) Multi-breadcrumb support via @graph. (9) History (localStorage, last 20). (10) Shareable URL — encode the items in the fragment.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. Breadcrumb schema generation is pure string templating in your browser. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
