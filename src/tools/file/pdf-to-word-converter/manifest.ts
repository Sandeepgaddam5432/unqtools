import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pdf-to-word-converter",
  name: "PDF to Word Converter",
  description:
    "Convert PDF files to DOCX (Microsoft Word) in the browser — pure JavaScript PDF text extractor + OOXML generator. Extracts text from each page, generates a minimal Word document (word/document.xml), and packages it as a .docx ZIP. 100% client-side.",
  category: "file",
  keywords: [
    "pdf to word", "pdf to docx", "convert pdf to word",
    "pdf to doc", "pdf word converter", "extract text from pdf to word",
    "pdf-to-word-converter", "pdf docx", "pdf to office",
  ],
  icon: "file-text",
  requiresNetwork: false,
  seo: {
    title: "PDF to Word Converter — Convert PDF to DOCX in Browser (Pure JS) | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "It converts PDF files to DOCX (Microsoft Word 2007+) entirely in your browser. We load the PDF using pdf-lib, extract text from each page's content stream, generate a minimal Office Open XML document (word/document.xml with paragraph and run elements), and package it as a .docx ZIP file. No external API, no upload — everything runs in JavaScript." },
      { q: "What PDF features are supported?", a: "We support: text in standard content streams (Tj/TJ/'/\" operators), text in compressed streams (FlateDecode decompressed via DecompressionStream), multiple pages (each becomes a section with a page break), page ranges, custom font size, custom font family (Calibri / Times / Courier / Arial), and basic paragraph spacing. We do NOT support: scanned PDFs (need OCR), encrypted/password-protected PDFs, embedded images, tables, hyperlinks, form fields, and complex formatting (bold/italic spans are flattened to regular text)." },
      { q: "Will the DOCX look identical to the PDF?", a: "No. We extract the text content and reflow it into Word paragraphs. The visual layout (fonts, sizes, colors, positioning) is not preserved. Each PDF page becomes a Word page (with a page break), and each text line becomes a paragraph. If you need pixel-perfect conversion, use Adobe Acrobat's PDF-to-Word feature or a commercial tool like Nuance PDF Converter." },
      { q: "What extra features does this tool have compared to others?", a: "10 extras: (1) Drag-drop input. (2) Page range selector. (3) Custom font family (4 standard Word fonts). (4) Custom font size. (5) Custom page margins (Word section properties). (6) Stats — page count, word count, character count. (7) Live preview of extracted text. (8) Document title and author metadata. (9) History of recently converted PDFs (localStorage — last 10). (10) Shareable URL with conversion options." },
      { q: "Is my PDF uploaded anywhere?", a: "No. All PDF parsing and DOCX generation runs in your browser using pure JavaScript. File contents never leave your device. Only conversion summaries (filename + page count) are saved to local history." },
      { q: "Will Microsoft Word open the generated .docx?", a: "Yes — we generate a standards-compliant OOXML package: [Content_Types].xml, _rels/.rels, word/document.xml, word/_rels/document.xml.rels, and word/styles.xml. Word, LibreOffice Writer, Google Docs, and Apple Pages all open the file without warnings. The document uses default section properties (Letter size, 1-inch margins) and the chosen font family." },
    ],
  },
  status: "done",
};
