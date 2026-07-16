import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pages-to-pdf-converter",
  name: "Pages to PDF Converter",
  description:
    "Convert Apple Pages (.pages) documents to PDF in the browser — pure JavaScript ZIP parser + pdf-lib. Extracts text from document.xml or preview.pdf when available, parses metadata, and renders text to PDF. Honest about layout fidelity limitations. 100% client-side.",
  category: "file",
  keywords: [
    "pages to pdf", "pages converter", "pages pdf",
    "apple pages", ".pages file", "iwork pages",
    "word to pdf alternative", "pages viewer",
    "pages-to-pdf-converter", "pages document",
  ],
  icon: "file-text",
  requiresNetwork: false,
  seo: {
    title: "Pages to PDF Converter — Convert .pages to PDF in Browser | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Converts Apple Pages (.pages) documents to PDF in your browser. Pages files are ZIP archives containing: (1) metadata.json with the title, author, creation date; (2) Document.iwa — Snappy-compressed Protobuf with the actual text + layout (we cannot decode); (3) preview.jpg — thumbnail; (4) sometimes a preview.pdf — Apple's own PDF rendering of the document (which we CAN extract directly!). When preview.pdf exists, we use it as the output. Otherwise, we extract text from the document.xml or .iwa files (best-effort) and render it as a fresh PDF." },
      { q: "Can I preserve the original layout?", a: "Partial yes: Apple Pages often embeds a 'preview.pdf' file inside the .pages ZIP (visible when you 'Quick Look' a .pages file in Finder). When this preview.pdf is present, we extract it directly — that gives you a 1:1 layout-faithful PDF. When preview.pdf is NOT present (newer Pages files), we have to extract text and re-render it, which loses layout fidelity (no images, no columns, no special formatting). The output PDF will contain the document's text content but with simpler formatting." },
      { q: "What's in the Pages ZIP?", a: "A typical .pages file contains: metadata.json (title, author, date); Document.iwa (compressed Protobuf with text + layout); preview.jpg (thumbnail); sometimes preview.pdf (Apple's PDF rendering); buildVersionHistory.plist; and an 'Indexes/' folder. We always extract metadata.json and preview.jpg. If preview.pdf exists, we use it as the output. Otherwise, we extract text from Document.iwa (best-effort — we look for plain UTF-8 text segments inside the .iwa bytes, since Snappy's magic bytes are absent in uncompressed sections)." },
      { q: "What text can you extract when preview.pdf is missing?", a: "Pages stores text inside .iwa files (Snappy-compressed Protobuf). We use a heuristic: we scan Document.iwa for sequences of printable UTF-8 characters (4+ chars) and concatenate them as plain text. This works decently for body text but misses formatting (bold, italics, headings) and images. The extracted text is then re-rendered as a fresh PDF using pdf-lib with configurable font size, page size, and margins." },
      { q: "What extra features does this tool have compared to others?", a: "10 extras: (1) Drag-drop file input. (2) preview.pdf extraction (when present — 1:1 layout fidelity). (3) Text extraction from .iwa as a fallback. (4) Stats — word count, char count, page count. (5) preview.jpg display. (6) Custom font size, page size, and margins for the re-rendered PDF. (7) Honest disclaimer about layout fidelity. (8) Title extraction from metadata. (9) History (localStorage — last 10 conversions). (10) Shareable URL with options." },
      { q: "Is my Pages file uploaded anywhere?", a: "No. All ZIP parsing, preview.pdf extraction, text extraction, and PDF generation runs in your browser using pure JavaScript + pdf-lib. File contents never leave your device. Only file summaries (filename, page count, title) are saved to local history." },
      { q: "How do I get a layout-perfect PDF when preview.pdf is missing?", a: "Use Apple Pages (macOS, free) or iCloud.com web Pages (free Apple ID) to open the .pages file and export to PDF (File → Export To → PDF). Both produce 1:1 layout-faithful PDFs. For Windows/Linux without an Apple ID, use a third-party converter (CloudConvert, Zamzar) — but those upload your file." },
    ],
  },
  status: "done",
};
