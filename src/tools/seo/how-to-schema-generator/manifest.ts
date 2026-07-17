import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "how-to-schema-generator",
  name: "How-To Schema Generator",
  description:
    "Generate HowTo schema.org JSON-LD for step-by-step guides. Add steps, supplies, tools, total time, estimated cost, per-step images, reordering, and live preview. Includes Google Rich Results test link. 100% client-side.",
  category: "seo",
  keywords: [
    "how-to schema", "howto", "json-ld", "structured data",
    "rich results", "schema.org", "instructions", "tutorial", "guide",
  ],
  icon: "list-ordered",
  requiresNetwork: false,
  seo: {
    title: "How-To Schema Generator — HowTo JSON-LD | UnQTools",
    faq: [
      {
        q: "What is HowTo schema?",
        a: "HowTo is a Schema.org type that marks up step-by-step instructions for completing a task. When added as JSON-LD, Google may show a rich result with the steps, total time, and an image carousel in search results.",
      },
      {
        q: "How do I add HowTo schema to my page?",
        a: "Generate the JSON-LD with this tool, then paste the <script type=\"application/ld+json\"> block into the HTML <head> of the page. The visible instructions on the page must match the schema steps.",
      },
      {
        q: "Should every step have an image?",
        a: "Images are optional per step but highly recommended — Google can show a step image carousel in rich results. Use absolute https URLs and at least 696px wide images for best results.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Add/remove steps dynamically. (2) Reorder steps up/down. (3) Per-step image URL. (4) Total time calculator (minutes → ISO 8601 PT#H#M). (5) Estimated cost input (parses $10 USD into MonetaryAmount). (6) Supplies list. (7) Tools list. (8) Bulk paste steps (Name | Text). (9) History (localStorage, last 20). (10) Shareable URL — encode the form in the fragment.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. HowTo schema generation is pure string templating in your browser. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
