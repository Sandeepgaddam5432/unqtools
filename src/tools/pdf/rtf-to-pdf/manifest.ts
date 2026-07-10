import type { ToolManifest } from "../../../lib/tool";
export const manifest: ToolManifest = {
  id: "rtf-to-pdf", name: "RTF to PDF",
  description: "Convert Rich Text Format (RTF) to PDF. Extracts plain text from RTF, stripping formatting codes, then renders as a clean PDF. 100% private, runs in your browser.",
  category: "pdf", keywords: ["rtf to pdf", "convert rtf pdf", "rtf pdf converter", "rich text to pdf", "rtf document pdf", "rtf converter", "word to pdf"],
  icon: "file-type", requiresNetwork: false,
  seo: { title: "RTF to PDF Online — Convert Rich Text to PDF Free | UnQTools", faq: [
    { q: "Are my files uploaded to a server?", a: "No. Conversion runs entirely in your browser." },
    { q: "Does it preserve RTF formatting?", a: "Partially. The tool extracts plain text from the RTF, stripping all formatting codes (fonts, colors, sizes, styles). The output is a clean, uniformly-styled PDF. For full formatting preservation, use a desktop word processor." },
    { q: "What RTF features are supported?", a: "Text content extraction with paragraph breaks. Bold/italic/font info is stripped. Tables, images, and embedded objects are not supported — only text is extracted." },
  ]}, status: "done",
};
