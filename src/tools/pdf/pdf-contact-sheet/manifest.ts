import type { ToolManifest } from "../../../lib/tool";
export const manifest: ToolManifest = {
  id: "pdf-contact-sheet", name: "PDF Contact Sheet",
  description: "Generate a contact sheet (thumbnail grid) of all pages in a PDF as a new PDF. Choose grid size (2×2, 3×3, 4×4) and page labels. 100% private, runs in your browser.",
  category: "pdf", keywords: ["pdf contact sheet", "pdf thumbnail grid", "pdf overview", "pdf thumbnail sheet", "pdf grid view", "pdf page overview", "pdf summary"],
  icon: "grid-3x3", requiresNetwork: false,
  seo: { title: "PDF Contact Sheet Generator — Thumbnail Grid Free | UnQTools", faq: [
    { q: "Are my PDFs uploaded to a server?", a: "No. Contact sheet generation runs entirely in your browser." },
    { q: "What is a contact sheet?", a: "A single PDF page that shows all pages of the source PDF as small thumbnails arranged in a grid. Useful for getting an overview of a long document." },
    { q: "What grid sizes are available?", a: "2×2 (4 thumbnails per sheet), 3×3 (9), 4×4 (16), and 5×5 (25). Higher grid sizes fit more pages but each thumbnail is smaller." },
  ]}, status: "done",
};
