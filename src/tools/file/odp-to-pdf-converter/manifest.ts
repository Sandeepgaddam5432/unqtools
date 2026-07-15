import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "odp-to-pdf-converter",
  name: "ODP to PDF Converter",
  description:
    "Convert OpenDocument Presentation (.odp) files to PDF in the browser — pure JavaScript ODP parser + pdf-lib renderer. Extracts slides from content.xml and renders each as a PDF page with title, bullet points, and configurable page size (4:3 or 16:9). 100% client-side.",
  category: "file",
  keywords: [
    "odp to pdf", "odp converter", "opendocument presentation to pdf",
    "libreoffice impress to pdf", "openoffice impress to pdf", "odp viewer",
    "convert odp", "odp-to-pdf-converter", "odp pdf",
  ],
  icon: "file-text",
  requiresNetwork: false,
  seo: {
    title: "ODP to PDF Converter — Convert .odp to PDF in Browser (Pure JS) | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "It converts OpenDocument Presentation (.odp) files to PDF entirely in your browser. We unzip the .odp (which is a ZIP container), read content.xml, extract slides (draw:page) with their titles (draw:text-box containing text:p) and bullet lists, then render each slide as a single PDF page using pdf-lib. No LibreOffice or OpenOffice is required." },
      { q: "What ODP features are supported?", a: "We support: slides (draw:page), titles (the first text box on each slide), bullet lists (text:list with text:list-item), text boxes (draw:text-box), plain paragraphs (text:p), and basic text formatting. Slide notes, animations, transitions, embedded images, charts, drawn shapes, and master-page inheritance are flattened to plain text or skipped. The output preserves the text content of each slide but does not replicate the visual layout." },
      { q: "Does it work for password-protected .odp files?", a: "No. Encrypted .odp files use a Blowfish/AES wrapping that requires the user's password and a WASM crypto blob to decrypt. We surface a clear 'encrypted ODP — password required' error. Use LibreOffice on desktop to remove the encryption first." },
      { q: "What extra features does this tool have compared to others?", a: "10 extras: (1) Drag-drop input. (2) Slide count and per-slide preview. (3) Page size selector (4:3 / 16:9 / Letter portrait). (4) Title extraction (largest text on each slide). (5) Stats — slide count, title count, word count, character count. (6) Live preview of extracted text per slide. (7) Background color (white / dark). (8) History of recently converted .odp files (localStorage — last 10). (9) Shareable URL with conversion options. (10) Custom font size for body text." },
      { q: "Is my .odp file uploaded anywhere?", a: "No. All ODP parsing and PDF rendering runs in your browser using pure JavaScript and pdf-lib. File contents never leave your device. Only conversion summaries (filename + slide count) are saved to local history." },
      { q: "Why are images and shapes missing from the PDF?", a: "pdf-lib can only draw text, lines, and rectangles — not arbitrary vector shapes or raster images without base64-encoding them first. For ODP files with rich graphics, the output is a text-only rendering. Use LibreOffice's native PDF export (File → Export As → PDF) for full fidelity, or use the SVG-to-PDF tool on individual SVG-rendered slides." },
    ],
  },
  status: "done",
};
