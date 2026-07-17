import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "heading-structure-analyzer",
  name: "Heading Structure Analyzer",
  description:
    "Extract H1-H6 from HTML, view the heading outline as a tree, count per-level, and detect SEO issues: multiple H1s, missing H1, skipped levels, long headings, and empty headings. Export as markdown. 100% client-side.",
  category: "seo",
  keywords: [
    "heading structure", "h1 h2 h3", "html outline", "heading tree",
    "seo audit", "heading analysis", "heading hierarchy", "outline",
  ],
  icon: "heading",
  requiresNetwork: false,
  seo: {
    title: "Heading Structure Analyzer — H1-H6 SEO Checker | UnQTools",
    faq: [
      {
        q: "Why does heading structure matter for SEO?",
        a: "Search engines use headings to understand the topic and structure of a page. A clear H1 → H2 → H3 hierarchy helps crawlers and screen readers navigate. Common issues: multiple H1s (confusing), missing H1 (no clear topic), skipped levels (H2 → H4 breaks the outline), and headings over 60 characters (may be truncated).",
      },
      {
        q: "How does the analyzer extract headings?",
        a: "We use a regex to match <h1>…<h6> tags (case-insensitive, with attributes). The inner HTML is stripped of nested tags and decoded for entities, so the visible text is what we analyze.",
      },
      {
        q: "What issues does it detect?",
        a: "Five: (1) multiple H1 tags — best practice is one; (2) missing H1 — every page needs one; (3) skipped levels — e.g., H2 → H4 (don't skip for styling); (4) long headings over 60 chars; (5) empty headings with no text.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Heading tree visualization (H2 nests under H1). (2) Per-level count (H1-H6). (3) Word count per heading. (4) Five SEO issue detectors. (5) Markdown outline export. (6) Numbered outline export (1, 1.1, 1.2 form). (7) Copy outline to clipboard. (8) Long-heading (>60 chars) flagging. (9) History (localStorage, last 20). (10) Shareable URL — encode HTML in the fragment.",
      },
      {
        q: "Can I fetch a URL to analyze?",
        a: "Not directly — most websites block cross-origin fetches from the browser. Use your browser's View Source or DevTools, copy the HTML, and paste it here. This keeps the tool 100% client-side and offline-capable.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. Heading extraction runs locally with regex. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
