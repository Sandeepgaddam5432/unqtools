import type { ToolManifest } from "../../../lib/tool";
export const manifest: ToolManifest = {
  id: "pdf-bookmarks-editor", name: "PDF Bookmarks Editor",
  description: "Add, rename, or delete bookmarks (outline entries) in a PDF. Create a table of contents that appears in the PDF reader sidebar. 100% private, runs in your browser.",
  category: "pdf", keywords: ["pdf bookmarks", "pdf outline", "pdf table of contents", "pdf toc", "edit pdf bookmarks", "pdf chapters", "pdf navigator"],
  icon: "bookmark", requiresNetwork: false,
  seo: { title: "Edit PDF Bookmarks Online — Add Outline / TOC Free | UnQTools", faq: [
    { q: "Are my PDFs uploaded to a server?", a: "No. Bookmark editing runs entirely in your browser." },
    { q: "What are PDF bookmarks?", a: "Bookmarks (also called outline entries) are navigation links that appear in the sidebar of PDF readers. They let users jump to specific pages or sections quickly." },
    { q: "Can I set nested bookmarks?", a: "This version supports flat (top-level) bookmarks. Each bookmark has a title and a target page number. Nested bookmarks will be added in a future update." },
  ]}, status: "done",
};
