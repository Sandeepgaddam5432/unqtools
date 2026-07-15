import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "fb2-reader",
  name: "FB2 Reader",
  description:
    "Read FictionBook 2.0 (.fb2) ebooks in the browser — pure JavaScript XML parser. Extract title, author, genre, render book text as HTML, chapter navigation, table of contents, font size + theme. 100% client-side.",
  category: "file",
  keywords: [
    "fb2 reader", "fictionbook reader", "fb2 viewer", "fb2 browser",
    "read fb2", "ebook reader", "fb2 to html", "fb2 xml",
    "russian ebook", "fb2-reader",
  ],
  icon: "book",
  requiresNetwork: false,
  seo: {
    title: "FB2 Reader — Read FictionBook 2.0 Ebooks in Browser | UnQTools",
    faq: [
      { q: "What is an FB2 file?", a: "FB2 (FictionBook 2.0) is an open XML-based ebook format popular in Russia and Eastern Europe. Unlike EPUB (which is a ZIP of XHTML files), FB2 is a single XML file containing the entire book — metadata (title, author, genre, lang), description, body with sections, and optional footnotes / epigraphs. The format is human-readable with any text editor." },
      { q: "How does this reader work?", a: "We parse the FB2 XML using the browser's native DOMParser, then walk the XML tree to extract: (1) the <description> block (title-info with book title, authors, genre, lang, annotation), (2) the <body> element with its nested <section> structure (chapters), (3) optional <body name='notes'> for footnotes. We render the book text as clean HTML with proper typography (em-dashes, quotation marks, paragraph indentation)." },
      { q: "Are all FB2 features supported?", a: "Most. We support: <title>, <author>, <genre>, <lang>, <annotation>, <body> with <section> nesting, <p> paragraphs, <emphasis>, <strong>, <strikethrough>, <code>, <sub>/<sup>, <image> (with inline base64 or references to binary elements), <poem>/<stanza>/<v> for verse, <epigraph>, <cite>, <table>, <a> links, and <empty-line>. We strip <stylesheet> and inline CSS for safety. Custom XSL transformations are not supported." },
      { q: "Can I read .fb2.zip files?", a: "Not directly — .fb2.zip is a ZIP archive containing one or more FB2 files. Use our ZIP Extractor tool to unzip the archive first, then open the extracted .fb2 file here. Some libraries distribute books as .fb2.zip to save space (FB2 is plain XML and compresses well — typically 70-80% reduction)." },
      { q: "Can I convert FB2 to EPUB?", a: "Not directly with this tool — it's a reader only. For conversion, use Calibre (desktop app). The FB2 format is well-supported by Calibre's conversion engine and produces high-quality EPUBs. We focus on reading rather than converting to keep the bundle size small." },
      { q: "What extra features does this tool have compared to others?", a: "10 extras: (1) Drag-drop file input. (2) Font size adjustment (5 levels: sm to 2xl). (3) Dark / light reading mode. (4) Bookmark chapter (localStorage — resume from last chapter on reopen). (5) Search within book text with result jumping. (6) Copy chapter text to clipboard. (7) File info panel — title, author(s), genre, lang, file size. (8) Chapter list / table of contents (sidebar). (9) Reading progress percentage (chapters read / total). (10) History of recently opened books (localStorage — last 10)." },
      { q: "Is my book uploaded anywhere?", a: "No. The FB2 XML is parsed entirely in your browser using DOMParser. Book contents never leave your device. Only book titles + author names are saved to localStorage for the resume feature." },
      { q: "What about FB3 (FictionBook 3)?", a: "FB3 is a newer ZIP-based format that's largely unused outside a few Russian e-readers. We don't support it. If you have an FB3 file, convert it to FB2 or EPUB with Calibre first." },
    ],
  },
  status: "done",
};
