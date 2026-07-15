import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pdf-to-html-converter",
  name: "PDF to HTML Converter",
  description:
    "Convert PDF files to HTML in the browser — pure JavaScript PDF content-stream parser. Extracts text from each page, wraps it in semantic HTML with paragraphs and page separators, and downloads a .html file. 100% client-side.",
  category: "file",
  keywords: [
    "pdf to html", "convert pdf to html", "pdf html converter",
    "pdf to webpage", "pdf reader html", "extract text from pdf html",
    "pdf-to-html-converter", "pdf html", "pdf web",
  ],
  icon: "file-text",
  requiresNetwork: false,
  seo: {
    title: "PDF to HTML Converter — Convert PDF to HTML in Browser (Pure JS) | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "It converts PDF files to HTML entirely in your browser. We load the PDF using pdf-lib, walk each page's content stream looking for text-showing operators (Tj, TJ, ', \"), decode the string operands, wrap each text line in a <p> element, group them by page with <section> tags, and produce a complete HTML5 document. No external API, no upload — everything runs in JavaScript." },
      { q: "What PDF features are supported?", a: "We support: text in standard content streams (Tj/TJ/'/\" operators), text in compressed streams (FlateDecode is decompressed via DecompressionStream), multiple pages, page ranges, custom CSS for the output document, page separators with anchor IDs, and basic character decoding (UTF-16BE and PDFDocEncoding). We do NOT support: scanned PDFs (images of text — needs OCR), encrypted/password-protected PDFs, embedded fonts with custom encodings, images, vector graphics, hyperlinks (we extract the visible text but not link annotations), form fields, and right-to-left scripts." },
      { q: "Why is the HTML output not styled like the PDF?", a: "HTML is a reflowable format — text wraps based on the viewport width. PDF is a fixed-layout format where every glyph has absolute x/y coordinates. We deliberately don't try to replicate the PDF's visual layout because (1) it would require absolute positioning of every line, which produces fragile HTML, and (2) reflowable HTML is more useful for web publishing, screen readers, and mobile reading. If you need a pixel-perfect replica, use pdftohtml -xml (poppler-utils) which can preserve layout." },
      { q: "What extra features does this tool have compared to others?", a: "10 extras: (1) Drag-drop input. (2) Page range selector (e.g. '1-3,5,7-9'). (3) Custom page separator (HR / DIV / custom HTML). (4) Custom CSS stylesheet injected into the HTML head. (5) Stats — page count, word count, character count, line count. (6) Live preview of generated HTML in an iframe. (7) Output encoding (UTF-8 with/without BOM). (8) Document title customization. (9) History of recently converted PDFs (localStorage — last 10). (10) Shareable URL with conversion options." },
      { q: "Is my PDF uploaded anywhere?", a: "No. All PDF parsing and HTML generation runs in your browser using pure JavaScript and pdf-lib. File contents never leave your device. Only conversion summaries (filename + page count) are saved to local history." },
      { q: "Can I edit the HTML output?", a: "Yes — the generated HTML is clean, semantic, and uses standard tags (<html>, <head>, <body>, <section>, <p>). You can edit it in any text editor or IDE. The CSS is inline in a <style> tag in the head — replace it with your own stylesheet or remove it entirely for a default browser look." },
    ],
  },
  status: "done",
};
