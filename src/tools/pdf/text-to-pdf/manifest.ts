import type { ToolManifest } from "../../../lib/tool";
export const manifest: ToolManifest = {
  id: "text-to-pdf", name: "Text to PDF",
  description: "Convert plain text to a PDF document. Choose font size, page size (A4/Letter), and orientation. Supports line wrapping and multi-page output. 100% private, runs in your browser.",
  category: "pdf", keywords: ["text to pdf", "txt to pdf", "convert text pdf", "plain text pdf", "text document pdf", "txt converter", "text file to pdf"],
  icon: "file-text", requiresNetwork: false,
  seo: { title: "Text to PDF Online — Convert TXT to PDF Free | UnQTools", faq: [
    { q: "Are my files uploaded to a server?", a: "No. Conversion runs entirely in your browser." },
    { q: "Does it handle long text?", a: "Yes. Text is automatically wrapped to fit the page width and split across multiple pages. A 100-page text file works fine." },
    { q: "What font is used?", a: "Helvetica (standard PDF font). Font size is customizable (8–24pt)." },
  ]}, status: "done",
};
