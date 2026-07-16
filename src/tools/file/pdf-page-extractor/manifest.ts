import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pdf-page-extractor",
  name: "PDF Page Extractor",
  description:
    "Extract specific pages from a PDF and create a new PDF containing only the pages you select. Supports page ranges (1-3, 5, 8-10), reverse order, shuffle, custom output filename, thumbnail previews, and per-page stats. Uses pdf-lib — 100% client-side.",
  category: "file",
  keywords: [
    "pdf page extractor", "extract pdf pages", "pdf page selector",
    "pdf subset", "extract pages from pdf", "pdf page range",
    "pdf split pages", "pdf trim pages", "pdf cut pages",
    "pdf page extractor online", "pdf-page-extractor",
  ],
  icon: "file-text",
  requiresNetwork: false,
  seo: {
    title: "PDF Page Extractor — Extract Selected Pages from PDF | UnQTools",
    faq: [
      { q: "How does this PDF page extractor work?", a: "You load a PDF (drag-drop or click), we render thumbnails of every page, you enter a page range spec like '1-3, 5, 8-10' (or click thumbnails to toggle individual pages), then click Extract. We use pdf-lib to copy the selected pages into a brand-new PDF and download it. Original PDF is never modified." },
      { q: "What page range formats are supported?", a: "Single pages ('5'), ranges ('1-10'), open-ended ranges ('8-' means from page 8 to the end), and comma-separated combinations ('1-3, 5, 8-10, 12-'). Whitespace is ignored. Pages outside the document range produce a clear error." },
      { q: "Does this preserve bookmarks, hyperlinks, and form fields?", a: "pdf-lib's copyPages preserves the page content (text, images, vectors) and most page-level annotations. Outlines (bookmarks) and document-level metadata are NOT copied to the new PDF — this is a pdf-lib limitation. If you need bookmark preservation, use our separate 'merge-pdf' tool which preserves them." },
      { q: "Can I reorder pages or repeat them?", a: "Yes. The page range spec is order-preserving and allows duplicates. '5, 1, 5, 1' produces a new PDF with pages 5, 1, 5, 1 in that order. You can also use the 'reverse' option to flip the order, or 'shuffle' to interleave even/odd pages (useful for booklet printing)." },
      { q: "What extra features does this tool have compared to others?", a: "10 extras: (1) Drag-drop input. (2) Page range spec with full syntax (single/range/open-ended/combinations). (3) Click thumbnails to toggle selection. (4) Per-page thumbnails rendered via pdf-lib. (5) Page count display. (6) Stats panel (selected count, original size, extracted size, time taken). (7) Custom output filename. (8) Reverse order toggle. (9) Shuffle (interleave) toggle for booklet printing. (10) History of recently extracted PDFs in localStorage + shareable URL with current selection." },
      { q: "Is my PDF uploaded anywhere?", a: "No. All PDF parsing, page copying, and rendering happens in your browser using pdf-lib. The PDF file never leaves your device. Only filenames and page counts are saved to local history." },
      { q: "Does this work on encrypted PDFs?", a: "No. If the PDF is password-protected, pdf-lib cannot load it and we surface a clear error. Use a tool like qpdf to remove the password first (or our pdf-security-remover tool if you know the password)." },
    ],
  },
  status: "done",
};
