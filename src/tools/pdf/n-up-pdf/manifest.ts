import type { ToolManifest } from "../../../lib/tool";
export const manifest: ToolManifest = {
  id: "n-up-pdf", name: "N-Up PDF (Booklet)",
  description: "Arrange multiple PDF pages per sheet — 2-up, 4-up, 6-up, 8-up, or 16-up. Perfect for booklet printing and saving paper. 100% private, runs in your browser.",
  category: "pdf", keywords: ["n-up pdf", "booklet pdf", "2-up pdf", "4-up pdf", "pdf imposition", "multiple pages per sheet", "pdf n-up"],
  icon: "layout-grid", requiresNetwork: false,
  seo: { title: "N-Up PDF — Multiple Pages Per Sheet (2-up, 4-up) Free | UnQTools", faq: [
    { q: "Are my PDFs uploaded to a server?", a: "No. N-up imposition runs entirely in your browser." },
    { q: "What N-up values are available?", a: "2-up, 4-up, 6-up, 8-up, and 16-up. 2-up puts 2 pages side by side. 4-up puts 4 pages in a 2×2 grid. Higher values fit more pages per sheet but each page becomes smaller." },
    { q: "What page size is the output?", a: "The output uses the same page size as the input. Each input page is scaled down to fit the grid. For example, with 4-up on an A4 input, each page becomes A6 size on an A4 sheet." },
  ]}, status: "done",
};
