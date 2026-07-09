import type { ToolManifest } from "../../../lib/tool";
export const manifest: ToolManifest = {
  id: "remove-blank-pages", name: "Remove Blank PDF Pages",
  description: "Detect and remove blank pages from a PDF automatically. Keeps pages with any text, images, or drawings. 100% private, runs in your browser.",
  category: "pdf", keywords: ["remove blank pages", "delete blank pdf", "pdf blank page remover", "clean pdf", "strip empty pages", "pdf blank detector", "remove empty pages"],
  icon: "file-x", requiresNetwork: false,
  seo: { title: "Remove Blank PDF Pages Online — Auto-Detect & Delete Free | UnQTools", faq: [
    { q: "Are my PDFs uploaded to a server?", a: "No. Detection and removal run entirely in your browser." },
    { q: "How does blank page detection work?", a: "Each page's content stream is analyzed. If the page has no drawing operators (text, images, paths), it's considered blank. Pages with whitespace-only text are also detected as blank." },
    { q: "Will it remove pages that look blank but have content?", a: "Pages with even a single character of text or a tiny image are kept. Only truly empty pages (no content stream operators) are removed." },
  ]}, status: "done",
};
