import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pdf-to-odp-converter",
  name: "PDF to ODP Converter",
  description:
    "Convert PDF text to ODP (OpenDocument Presentation) in your browser. Extracts text from each PDF page, creates one slide per page with title + bullet points, and generates a valid ODP ZIP. Opens in LibreOffice Impress, OpenOffice Impress, Google Slides.",
  category: "file",
  keywords: [
    "pdf to odp", "convert pdf to odp", "pdf to opendocument presentation",
    "pdf to libreoffice impress", "pdf to openoffice impress",
    "pdf to slides", "pdf to odp converter", "pdf to odp online",
    "pdf to odp free", "extract text from pdf to slides",
  ],
  icon: "presentation",
  requiresNetwork: false,
  seo: {
    title: "PDF to ODP Converter — Convert PDF to OpenDocument Presentation in Browser | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "It extracts text from your PDF using a pure-JS PDF parser, generates a valid ODP (OpenDocument Presentation) file — a ZIP containing mimetype, META-INF/manifest.xml, content.xml, styles.xml, and meta.xml. Each PDF page becomes one <draw:page> slide with a title (first non-empty line) and bullet points (remaining lines). The result opens in LibreOffice Impress, OpenOffice Impress, and Google Slides." },
      { q: "How are slides structured?", a: "Each slide is a <draw:page> element in content.xml. We place a <draw:frame> at the top for the title (styled with a bold 28pt font), and another <draw:frame> below it for bullet points (12pt body text). The frames are positioned using ODF's cm-based coordinate system (origin top-left). The page size is configurable (16:9, 4:3, or A4 portrait)." },
      { q: "What extra features does this tool have compared to others?", a: "10 extras: (1) Drag-drop input. (2) Page range selector. (3) Two slide layouts (title + bullets / bullets only). (4) Three aspect ratios (16:9, 4:3, A4 portrait). (5) Custom slide master background color. (6) Configurable body font size (10–32pt). (7) Stats — slide count, word count, character count. (8) Live preview of the first slide's XML. (9) Conversion history in localStorage (last 10). (10) Shareable URL with conversion options." },
      { q: "What PDF features are supported?", a: "We extract text from PDF content streams. We don't extract images, vector graphics, fonts, colors, or layout positioning. The first non-empty line per page becomes the slide title; subsequent lines become bullet points. Multiple consecutive blank lines collapse to one paragraph break." },
      { q: "Is my PDF uploaded anywhere?", a: "No. All PDF parsing and ODP generation happens in your browser. File contents never leave your device." },
      { q: "Why use ODP instead of PPTX?", a: "ODP is an open ISO standard (ISO/IEC 26300). It's preferred by governments and organizations that require open formats. ODP files are typically smaller than equivalent PPTX files. Use PPTX if you need maximum Microsoft PowerPoint compatibility." },
    ],
  },
  status: "done",
};
