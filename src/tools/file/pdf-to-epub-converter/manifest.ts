import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pdf-to-epub-converter",
  name: "PDF to EPUB Converter",
  description:
    "Convert PDF text to EPUB ebook format in your browser. Extracts text from PDF pages, splits into chapters by page or heading, generates a complete EPUB (mimetype, container.xml, content.opf, NCX/NAV TOC, chapter XHTML files), and packages as a .epub ZIP. 100% client-side.",
  category: "file",
  keywords: [
    "pdf to epub", "convert pdf to epub", "pdf ebook converter",
    "pdf to ebook", "pdf to kindle", "pdf to ereader",
    "pdf to epub converter", "pdf ebook", "make epub from pdf",
    "pdf to epub online", "pdf to epub free",
  ],
  icon: "book-open",
  requiresNetwork: false,
  seo: {
    title: "PDF to EPUB Converter — Convert PDF to EPUB Ebook in Browser | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "It extracts text from your PDF using a pure-JS PDF parser, splits the content into chapters (one per page, or by detected headings), generates valid EPUB structure (mimetype, META-INF/container.xml, OEBPS/content.opf, OEBPS/toc.ncx, OEBPS/chapterN.xhtml), and packages everything into a .epub ZIP archive. The result opens in Apple Books, Calibre, Kobo, Nook, and most e-readers." },
      { q: "What chapter splitting modes are supported?", a: "Three: (1) 'page' — one chapter per PDF page (default). (2) 'heading' — splits at lines that look like headings (ALL CAPS, Markdown #, or numbered headings like 'Chapter 1'). (3) 'single' — the entire PDF becomes one big chapter." },
      { q: "Why is the EPUB text-only?", a: "EPUB is a reflowable ebook format — it stores text as HTML with CSS styling, not as page images. We extract the PDF's text layer (not vector graphics or images) and wrap it in XHTML. If your PDF is a scanned document (images of text), we can't extract text — you'd need OCR first. For text-based PDFs (Word exports, text PDFs), the conversion is excellent." },
      { q: "What extra features does this tool have compared to others?", a: "10 extras: (1) Drag-drop input. (2) Three chapter-splitting modes (page / heading / single). (3) Custom title and author metadata. (4) Configurable base font size (12–24pt). (5) Stats — chapters, words, characters. (6) Live preview of the first chapter's XHTML. (7) Custom CSS injection into the EPUB stylesheet. (8) Conversion history in localStorage (last 10). (9) Shareable URL with conversion options. (10) Both NCX (EPUB 2) and NAV (EPUB 3) tables of contents for maximum reader compatibility." },
      { q: "Is my PDF uploaded anywhere?", a: "No. All PDF parsing, chapter splitting, EPUB XML generation, and ZIP packaging happens in your browser. File contents never leave your device." },
      { q: "Will the EPUB preserve images from the PDF?", a: "No. We currently extract text only. PDF images (raster or vector) are not extracted and embedded in the EPUB. This keeps the converter pure-JS and lightweight. If you need image extraction, use a desktop tool like Calibre or pdf2epub." },
    ],
  },
  status: "done",
};
