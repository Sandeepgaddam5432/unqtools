import type { ToolManifest } from "../../../lib/tool";
export const manifest: ToolManifest = {
  id: "html-to-pdf", name: "HTML to PDF",
  description: "Convert HTML content to a PDF document. Renders HTML with basic CSS styling, then rasterizes to PDF. 100% private, runs in your browser.",
  category: "pdf", keywords: ["html to pdf", "convert html pdf", "html pdf converter", "webpage to pdf", "html document pdf", "html2pdf", "html render pdf"],
  icon: "globe", requiresNetwork: false,
  seo: { title: "HTML to PDF Online — Convert HTML to PDF Free | UnQTools", faq: [
    { q: "Are my files uploaded to a server?", a: "No. Conversion runs entirely in your browser." },
    { q: "What HTML features are supported?", a: "Basic HTML elements (headings, paragraphs, lists, tables, images, links) with inline CSS. Complex JavaScript-driven layouts may not render correctly. The HTML is rasterized to an image then embedded in the PDF." },
    { q: "Why is the output a raster image?", a: "Browser-based HTML rendering produces pixels, not vector text. The PDF contains high-DPI images of the rendered HTML. Text is not selectable in the output. For selectable text, use Text to PDF or Markdown to PDF." },
  ]}, status: "done",
};
