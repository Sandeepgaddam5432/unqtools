import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "content-outline-generator",
  name: "Content Outline Generator",
  description:
    "Generate SEO-optimized content outlines with H1 + H2s + H3s. Pick a template (blog post, listicle, how-to, comparison, case study), set word targets per section, and export as markdown / HTML / JSON. 100% client-side.",
  category: "seo",
  keywords: [
    "content outline", "blog outline", "seo outline", "content structure",
    "h1 h2 h3", "content template", "listicle", "how-to outline",
  ],
  icon: "list-tree",
  requiresNetwork: false,
  seo: {
    title: "Content Outline Generator — SEO Blog Outlines | UnQTools",
    faq: [
      {
        q: "What is a content outline?",
        a: "A content outline is the skeleton of an article — the H1, H2, and H3 headings you'll write under. A good outline ensures you cover the topic comprehensively, target the right keywords, and structure the content for both readers and search engines.",
      },
      {
        q: "What templates are available?",
        a: "Five: Blog Post (intro + body + conclusion), Listicle (10 numbered items), How-To (step-by-step), Comparison (X vs Y with criteria), and Case Study (challenge → solution → results). You can also start from a Custom blank outline.",
      },
      {
        q: "How do I use the {topic} and {keyword} placeholders?",
        a: "When you apply a template, headings like 'What is {topic}?' are auto-filled with your topic. You can also use {keyword} in custom headings. Re-applying a template will overwrite current sections.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Five built-in templates + custom. (2) Target keyword + secondary keywords. (3) Per-section word count target. (4) Key points (bullets) per section. (5) Auto-generated H1 from topic + keyword. (6) Suggested H2 topics (8 options). (7) Suggested H3 subtopics. (8) Export as Markdown / HTML / JSON. (9) History (localStorage, last 20). (10) Shareable URL — encode the outline in the fragment.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. Outline generation is pure string templating in your browser. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
