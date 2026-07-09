import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "crop-pdf",
  name: "Crop PDF Pages",
  description: "Crop PDF pages by setting custom margins (top, bottom, left, right). Apply to all or selected pages. 100% private, runs in your browser.",
  category: "pdf",
  keywords: ["crop pdf", "trim pdf", "pdf margins", "cut pdf", "pdf crop tool", "pdf page crop", "resize pdf pages"],
  icon: "crop",
  requiresNetwork: false,
  seo: { title: "Crop PDF Pages Online — Custom Margins Free | UnQTools", faq: [
    { q: "Are my PDFs uploaded to a server?", a: "No. Cropping runs entirely in your browser. Your files never leave your device." },
    { q: "What units are the margins in?", a: "Points (1/72 inch). A4 width = 595pt, Letter width = 612pt. Common margins: 36pt (0.5in), 72pt (1in)." },
    { q: "Does cropping remove content?", a: "No. Cropping sets the visible area (crop box). The content outside the crop box is still in the file but hidden. This keeps the operation reversible and fast." },
  ]},
  status: "done",
};
