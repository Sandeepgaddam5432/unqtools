import type { ToolManifest } from "../../../lib/tool";
export const manifest: ToolManifest = {
  id: "markdown-to-pdf", name: "Markdown to PDF",
  description: "Convert Markdown to a styled PDF document. Supports headings, bold, italic, lists, code blocks, and links. Choose page size and orientation. 100% private, runs in your browser.",
  category: "pdf", keywords: ["markdown to pdf", "md to pdf", "convert markdown", "markdown pdf", "md pdf", "markdown converter", "github markdown pdf"],
  icon: "file-code", requiresNetwork: false,
  seo: { title: "Markdown to PDF Online — Convert MD to PDF Free | UnQTools", faq: [
    { q: "Are my files uploaded to a server?", a: "No. Conversion runs entirely in your browser." },
    { q: "What Markdown features are supported?", a: "Headings (H1-H6), bold, italic, inline code, code blocks, unordered/ordered lists, links, blockquotes, and horizontal rules. Tables are rendered as basic HTML." },
    { q: "How is the styling?", a: "Clean, readable defaults: serif body text, sans-serif headings, monospace code blocks. Font size is 12pt body, scaled for headings." },
  ]}, status: "done",
};
