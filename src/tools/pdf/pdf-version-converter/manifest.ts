import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pdf-version-converter",
  name: "PDF Version Converter",
  description:
    "Convert PDFs between versions — 1.4 / 1.5 / 1.6 / 1.7 / 2.0 / PDF/A-1b / PDF/A-2b / PDF/A-3b / PDF/X-1a. Detects current version, rewrites header, removes unsupported features, embeds fonts & color profiles for PDF/A, adds output intents for PDF/X. 100% client-side, no uploads.",
  category: "pdf",
  keywords: [
    "pdf version converter",
    "pdf to pdf/a",
    "pdf/a converter",
    "pdf/x converter",
    "pdf 1.4",
    "pdf 1.7",
    "pdf 2.0",
    "pdf archive",
    "pdf print ready",
    "convert pdf version",
  ],
  icon: "git-compare-arrows",
  requiresNetwork: false,
  seo: {
    title: "PDF Version Converter — Convert to PDF/A, PDF/X Free | UnQTools",
    faq: [
      {
        q: "Is my data sent anywhere?",
        a: "No. Version conversion runs entirely in your browser using JavaScript and pdf-lib. Your PDF never leaves your device, and the tool works offline.",
      },
      {
        q: "What extra features does this tool include?",
        a: "9 target version presets (PDF 1.4 / 1.5 / 1.6 / 1.7 / 2.0 / PDF/A-1b / PDF/A-2b / PDF/A-3b / PDF/X-1a), version detector (reads the PDF header), version setter (rewrites the header), PDF/A requirements checker (font embedding, XMP, color profile), PDF/X requirements checker (output intent, trim box, bleed), feature compatibility checker, unsupported-feature remover, XMP metadata generator (for PDF/A), color profile embedder (sRGB), output intent generator (for PDF/X), compliance checker, feature-loss reporter, font-embedding verifier, RGB-to-CMYK color space converter, multi-format reports (text/CSV/JSON), 20-entry history with shareable URLs.",
      },
      {
        q: "What's the difference between PDF/A and PDF/X?",
        a: "PDF/A is an ISO-standardized subset of PDF for long-term archival — it requires fonts to be embedded, disallows JavaScript and external references, and mandates XMP metadata. PDF/X is a standard for print production exchange — it requires an output intent (color profile), trim and bleed boxes, and disallows RGB-only color. This tool can convert to PDF/A-1b, A-2b, A-3b, and PDF/X-1a.",
      },
      {
        q: "Does conversion lose any features?",
        a: "Possibly, yes. Older targets (PDF 1.4) don't support features introduced in 1.7+ (e.g., AES-256 encryption, some compression filters). PDF/A disables encryption, JavaScript, and external references. The feature-loss reporter in the output tells you exactly what was removed or modified.",
      },
      {
        q: "Is this a full ISO-compliant PDF/A or PDF/X generator?",
        a: "This tool implements the most important requirements (font embedding, XMP metadata, color profile embedding, output intent, trim/bleed boxes) using pdf-lib. For mission-critical archiving or pre-press workflows, we recommend validating the output with a dedicated ISO-compliant validator such as veraPDF or callas pdfToolbox.",
      },
    ],
  },
  status: "done",
};
