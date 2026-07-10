import type { ToolManifest } from "../../../lib/tool";
export const manifest: ToolManifest = {
  id: "svg-to-pdf", name: "SVG to PDF",
  description: "Convert SVG images to PDF. Renders SVG at high resolution and embeds as a page. Supports custom page size and margins. 100% private, runs in your browser.",
  category: "pdf", keywords: ["svg to pdf", "convert svg pdf", "svg pdf converter", "vector to pdf", "svg image pdf", "svg render pdf", "scalable vector graphics pdf"],
  icon: "image", requiresNetwork: false,
  seo: { title: "SVG to PDF Online — Convert SVG to PDF Free | UnQTools", faq: [
    { q: "Are my files uploaded to a server?", a: "No. Conversion runs entirely in your browser." },
    { q: "Is the SVG preserved as vector in the PDF?", a: "No. The SVG is rasterized to a high-DPI PNG (2x scale) then embedded in the PDF. For true vector preservation, use a desktop tool like Inkscape. The output quality is high enough for most use cases." },
    { q: "What SVG features are supported?", a: "All features supported by the browser's native SVG renderer: paths, shapes, text, gradients, patterns, clipping, masking. SVG filters may have limited support depending on the browser." },
  ]}, status: "done",
};
