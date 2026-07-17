import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "content-brief-generator",
  name: "Content Brief Generator",
  description:
    "Generate SEO content briefs for writers: target keyword, title, search intent, word count target, outline, key points, LSI keywords, internal/external links, and competitor URLs. Export as Markdown or HTML. 100% client-side.",
  category: "seo",
  keywords: [
    "content brief", "seo brief", "writer brief", "content strategy",
    "search intent", "lsi keywords", "content outline", "word count target",
  ],
  icon: "clipboard-list",
  requiresNetwork: false,
  seo: {
    title: "Content Brief Generator — SEO Briefs for Writers | UnQTools",
    faq: [
      {
        q: "What is a content brief?",
        a: "A content brief is a document that tells a writer exactly what to write. It includes the target keyword, search intent, word count, outline, key points to cover, LSI/related keywords, internal/external links to include, and competitor URLs to review. A good brief reduces revisions and keeps content on-strategy.",
      },
      {
        q: "What are the four search intents?",
        a: "Informational (user wants to learn), Transactional (user wants to buy now), Navigational (user wants a specific site/brand), Commercial (user is researching before buying). Aligning content with intent is critical — a transactional page won't rank for an informational query.",
      },
      {
        q: "What are LSI keywords?",
        a: "Latent Semantic Indexing keywords are related terms that help search engines understand topical depth. For 'email marketing' LSI terms might include 'drip campaign', 'newsletter', 'automation', 'open rate'. Including 5-10 LSI terms in your content signals you're covering the topic comprehensively.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Search intent selector (4 types with descriptions). (2) Word count target with validation warnings. (3) Audience and tone fields. (4) LSI keyword list with auto-suggestions. (5) Internal link list with anchor text. (6) External link list with anchor text. (7) Competitor URL list. (8) Outline items with notes per section. (9) Export as Markdown and HTML. (10) History (localStorage, last 20) + shareable URL.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. Brief generation is pure string templating in your browser. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
