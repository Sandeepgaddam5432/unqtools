import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pdf-to-postscript-converter",
  name: "PDF to PostScript Converter",
  description:
    "Convert PDF text to PostScript (.ps) format in your browser. Pure JavaScript — extracts text from each PDF page, generates valid PostScript with proper header, page setup, text rendering commands, and showpage. Downloads a .ps file.",
  category: "file",
  keywords: [
    "pdf to postscript", "convert pdf to ps", "pdf to ps",
    "pdf to postscript converter", "pdf to ps converter",
    "pdf to ps online", "pdf to ps free",
    "pdf to postscript online", "extract text from pdf to ps",
    "postscript generator",
  ],
  icon: "file-text",
  requiresNetwork: false,
  seo: {
    title: "PDF to PostScript Converter — Convert PDF to PS in Browser | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "It extracts text from your PDF using a pure-JS PDF parser, then generates a valid PostScript (.ps) file. Each PDF page becomes one PostScript page with the proper header (%!PS-Adobe-3.0), page setup (findfont / scalefont / setfont), text rendering (moveto + show), and showpage. The result can be sent to a PostScript printer, viewed with Ghostscript/GhostView, or converted back to PDF with ps2pdf." },
      { q: "How is text rendered in PostScript?", a: "Each text line is rendered using the PostScript 'show' operator. We pick a font (Helvetica by default, or Times-Roman / Courier), scale it to your chosen size, position the cursor with 'moveto', and call 'show'. Long lines are wrapped using a simple word-wrap algorithm based on character count. Pages end with 'showpage' to advance to the next page." },
      { q: "What extra features does this tool have compared to others?", a: "10 extras: (1) Drag-drop input. (2) Page range selector. (3) Three page sizes (A4, Letter, Legal). (4) Configurable margins (0.5–2 inches). (5) Three font families (Helvetica, Times-Roman, Courier). (6) Configurable font size (8–24pt). (7) Word wrap for long lines (40–120 chars). (8) Stats — page count, word count, character count. (9) Live preview of the generated PS source. (10) Conversion history in localStorage (last 10)." },
      { q: "What PDF features are supported?", a: "We extract text from PDF content streams. We don't extract images, vector graphics, fonts, colors, or layout positioning — just the text. The PostScript output is plain text rendered in a single font on each page. For PDFs that are scanned images, no text can be extracted — you'd need OCR first." },
      { q: "Is my PDF uploaded anywhere?", a: "No. All PDF parsing and PostScript generation happens in your browser. File contents never leave your device." },
      { q: "Why use PostScript?", a: "PostScript is a Turing-complete page description language — the predecessor to PDF. It's still used in professional printing workflows (PS printers, RIPs, prepress). It's also useful for archival (PS files are human-readable) and for converting to other formats via Ghostscript. If you don't have a specific reason to use PS, you probably want PDF or SVG." },
    ],
  },
  status: "done",
};
