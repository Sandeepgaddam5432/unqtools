import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pdf-to-odt-converter",
  name: "PDF to ODT Converter",
  description:
    "Convert PDF text to ODT (OpenDocument Text) in your browser. Extracts text from each PDF page and generates a valid ODT ZIP (mimetype, META-INF/manifest.xml, content.xml, styles.xml, meta.xml). Opens in LibreOffice, OpenOffice, Google Docs, and MS Word with ODT support.",
  category: "file",
  keywords: [
    "pdf to odt", "convert pdf to odt", "pdf to opendocument",
    "pdf to libreoffice", "pdf to openoffice",
    "pdf to odt converter", "pdf to odt online", "pdf to odt free",
    "pdf to odt text", "extract text from pdf to odt",
  ],
  icon: "file-text",
  requiresNetwork: false,
  seo: {
    title: "PDF to ODT Converter — Convert PDF to OpenDocument Text in Browser | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "It extracts text from your PDF using a pure-JS PDF parser, then generates a valid ODT (OpenDocument Text) file — a ZIP containing mimetype, META-INF/manifest.xml, content.xml, styles.xml, and meta.xml. The result opens in LibreOffice Writer, OpenOffice Writer, Google Docs, and Microsoft Word (with ODT support installed)." },
      { q: "How is text structured in the ODT?", a: "Each non-empty PDF text line becomes a <text:p> paragraph in content.xml. Pages are separated by a paragraph with class 'page-break' (visible as a thin dashed line in LibreOffice). The first paragraph of each page is styled as a 'Heading 1' so you get a navigable outline. You can disable the page-break paragraphs and the heading styling from the options." },
      { q: "What extra features does this tool have compared to others?", a: "10 extras: (1) Drag-drop input. (2) Page range selector (e.g. '1-3,5'). (3) Custom page size (A4, Letter, Legal). (4) Custom margins (0.5–2 inches). (5) Configurable base font size (10–24pt). (6) Three font families (serif, sans, mono). (7) Stats — paragraph count, word count, character count. (8) Live preview of the generated content.xml. (9) Conversion history in localStorage (last 10). (10) Shareable URL with conversion options." },
      { q: "What PDF features are supported?", a: "We extract text from PDF content streams (Tj, TJ, ', \" operators). We don't extract images, vector graphics, fonts, colors, or layout positioning — just the text. Headings, paragraphs, and page breaks are inferred from the text. For PDFs that are scanned images, no text can be extracted — you'd need OCR first." },
      { q: "Is my PDF uploaded anywhere?", a: "No. All PDF parsing and ODT generation happens in your browser. File contents never leave your device." },
      { q: "Why use ODT instead of DOCX?", a: "ODT is an open ISO standard (ISO/IEC 26300). It's preferred by governments and organizations that require open formats. ODT files are typically smaller than equivalent DOCX files (no redundant styles.xml overhead), and they render more consistently across LibreOffice / OpenOffice / Google Docs. Use DOCX if you need maximum Microsoft Word compatibility." },
    ],
  },
  status: "done",
};
