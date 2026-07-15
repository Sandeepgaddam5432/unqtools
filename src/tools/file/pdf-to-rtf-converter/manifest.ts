import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pdf-to-rtf-converter",
  name: "PDF to RTF Converter",
  description:
    "Convert PDF files to RTF (Rich Text Format) in the browser — pure JavaScript PDF text extractor + RTF generator. Extracts text from each page, generates an RTF document with paragraphs and page breaks, and downloads a .rtf file. 100% client-side.",
  category: "file",
  keywords: [
    "pdf to rtf", "convert pdf to rtf", "pdf rtf converter",
    "pdf to rich text", "pdf reader rtf", "extract text from pdf rtf",
    "pdf-to-rtf-converter", "pdf rtf", "pdf to wordpad",
  ],
  icon: "file-text",
  requiresNetwork: false,
  seo: {
    title: "PDF to RTF Converter — Convert PDF to RTF in Browser (Pure JS) | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "It converts PDF files to RTF (Rich Text Format) entirely in your browser. We load the PDF using pdf-lib, extract text from each page's content stream, generate an RTF document with paragraphs (\\par control word) and page breaks (\\page control word), and download a .rtf file. No external API, no upload — everything runs in JavaScript." },
      { q: "What is RTF and why use it?", a: "RTF (Rich Text Format) is a cross-platform document format developed by Microsoft in 1987. It's supported by Word, WordPad, LibreOffice Writer, Apple Pages, Google Docs, and many other word processors. Unlike DOCX (which is a ZIP of XML files), RTF is a single plain-text file with control words (like \\par, \\page, \\b for bold). It's a good choice when you need maximum compatibility with older word processors or want a single-file output that's easy to inspect." },
      { q: "What PDF features are supported?", a: "We support: text in standard content streams (Tj/TJ/'/\" operators), text in compressed streams (FlateDecode decompressed via DecompressionStream), multiple pages (each becomes an RTF page with \\page separator), page ranges, custom font family (Arial, Times New Roman, Courier New, Calibri), custom font size, custom margins, and basic paragraph spacing. We do NOT support: scanned PDFs (need OCR), encrypted/password-protected PDFs, embedded images, tables, hyperlinks, form fields, and complex formatting (bold/italic spans are flattened to regular text)." },
      { q: "What extra features does this tool have compared to others?", a: "10 extras: (1) Drag-drop input. (2) Page range selector. (3) Custom font family (4 RTF-friendly fonts). (4) Custom font size (8–36 pt). (5) Custom page margins (in points). (6) Stats — page count, word count, character count, paragraph count. (7) Live preview of extracted text. (8) Document title metadata. (9) History of recently converted PDFs (localStorage — last 10). (10) Shareable URL with conversion options." },
      { q: "Is my PDF uploaded anywhere?", a: "No. All PDF parsing and RTF generation runs in your browser using pure JavaScript. File contents never leave your device. Only conversion summaries (filename + page count) are saved to local history." },
      { q: "Will Microsoft Word open the generated .rtf?", a: "Yes — RTF is one of the most universally supported document formats. Microsoft Word, WordPad (Windows), LibreOffice Writer, Apple Pages, Google Docs, AbiWord, and even some text editors (with RTF plugins) all open the file. The document uses default page margins (1 inch) and the chosen font family. Page breaks are inserted between PDF pages using the \\page control word." },
    ],
  },
  status: "done",
};
