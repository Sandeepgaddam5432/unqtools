/**
 * Content Word Count & Comparison — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "content-word-count-tool",
  name: "Content Word Count & Comparison",
  description: "Word count, reading time, and content comparison tool. Compare two articles for overlap and uniqueness.",
  category: "seo",
  keywords: ["word count", "content comparison", "reading time", "content analysis"],
  icon: "FileText",
  requiresNetwork: false,
  seo: {
    title: "Content Word Count & Comparison — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Word count, reading time, and content comparison tool. Compare two articles for overlap and uniqueness." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) Word/sentence/paragraph count, (2) (2) Reading time estimation, (3) (3) Speaking time, (4) (4) Two-article comparison, (5) (5) Overlap percentage, (6) (6) Unique content percentage, (7) (7) Keyword density comparison, (8) (8) Heading count comparison, (9) (9) Export comparison report, (10) (10) Bulk paste, (11) (11) Copy stats, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
