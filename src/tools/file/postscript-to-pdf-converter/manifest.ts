import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "postscript-to-pdf-converter",
  name: "PostScript to PDF Converter",
  description:
    "Convert PostScript (.ps) files to PDF format. Parses PS commands (showpage, moveto, show, lineto, etc.), extracts text per page, and renders to PDF using pdf-lib. Page detection, text extraction, custom margins, font/page size — 100% client-side.",
  category: "file",
  keywords: [
    "postscript to pdf", "ps to pdf", "convert ps",
    "postscript converter", "ps converter", "ghostscript alternative",
    "showpage", "moveto", "postscript-to-pdf-converter",
  ],
  icon: "file-text",
  requiresNetwork: false,
  seo: {
    title: "PostScript to PDF Converter — Convert .ps to PDF in Browser | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "It converts PostScript (.ps) files to PDF format. The tool parses the PostScript source code to extract text content and page boundaries (via the `showpage` command), then renders each page to a PDF using pdf-lib with configurable fonts, margins, and page sizes." },
      { q: "Does it support full PostScript rendering?", a: "Honest answer: No — full PostScript is a Turing-complete programming language, not a static format. A complete PS interpreter (like Ghostscript) is ~500,000 lines of C code. We implement a simplified PS text extractor: we parse `show`, `moveto`, `showpage`, and other text-related commands, extract the text strings, and render them as PDF text objects. Vector graphics (lineto, curveto, arc), images (image operator), and font metrics are NOT fully supported. For complex PS files, use Ghostscript." },
      { q: "What PostScript commands does it parse?", a: "We recognize and handle: `showpage` (page break), `moveto` (text positioning), `show` (render text string), `findfont`, `scalefont`, `setfont` (font selection), `setrgbcolor`, `setgray` (color — recorded but not applied), `translate`, `scale`, `rotate` (coordinate transforms — recorded but not fully applied), `%%Page:` comments (DSC page markers), and `%%EOF` (end of document). All other operators are ignored." },
      { q: "What are the page size and margin options?", a: "Page sizes: A4 (595×842 pt), Letter (612×792 pt), Legal (612×1008 pt). Margins: 0-100 points (1 inch = 72 points), default 50 pt. Font sizes: 8-24 pt, default 12 pt. Font family: Helvetica, Times-Roman, or Courier. Line height: 1.0-2.0x font size." },
      { q: "What extra features does this tool have compared to others?", a: "10 extras: (1) Drag-drop file input. (2) Page detection via showpage and %%Page: DSC comments. (3) Text extraction — concatenates all `show` strings per page. (4) Stats — page count, word count, character count. (5) Preview of extracted text per page (text view). (6) Font family selector (Helvetica / Times-Roman / Courier). (7) Font size selector (8-24 pt). (8) Page size selector (A4 / Letter / Legal). (9) Custom margins (0-100 pt). (10) History (localStorage — last 10 conversions)." },
      { q: "Is my PostScript file uploaded anywhere?", a: "No. All PS parsing, text extraction, and PDF rendering runs in your browser using pure JavaScript + pdf-lib. Your file contents never leave your device. Only conversion summaries (filename + page count) are saved to local history." },
      { q: "Why does my converted PDF look different from the original PS?", a: "PostScript is a vector graphics language with full programming capabilities (loops, conditionals, variables). Our simplified parser only handles text via the `show` operator. Vector drawings (lines, curves, fills), images, and complex font substitutions are NOT reproduced. The converted PDF contains the text content of the original PS but not the layout, graphics, or styling. For faithful conversion, use Ghostscript (desktop) or an online converter that runs Ghostscript server-side." },
      { q: "Can I convert Encapsulated PostScript (.eps)?", a: "Yes — EPS files are a subset of PostScript with a bounding box comment (%%BoundingBox:). We parse them the same way as .ps files. The bounding box is read but we use the selected page size for the output PDF (we don't auto-fit to the EPS bounding box — that would require parsing the bbox and creating a custom-sized PDF). Use the page size selector to choose the closest standard size." },
    ],
  },
  status: "done",
};
