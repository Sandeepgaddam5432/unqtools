import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "data-url-converter",
  name: "Data URL Converter",
  description:
    "Convert files to data: URLs and back. SVG optimization, batch encoding, embed templates (HTML/CSS/JS/JSON), size validation, magic bytes detection, and drag-drop. 100% private, offline.",
  category: "network-security",
  keywords: [
    "data url", "data uri", "base64", "embed", "inline image",
    "data scheme", "rfc 2397", "convert", "svg optimize", "batch encode",
  ],
  icon: "file-code",
  requiresNetwork: false,
  seo: {
    title: "Data URL Converter — Embed Files, SVG Optimize, Batch | UnQTools",
    faq: [
      {
        q: "What is a data: URL?",
        a: "A data: URL (RFC 2397) is a URI scheme that embeds the file content directly in the URL itself. For example: data:text/plain;base64,SGVsbG8= embeds the text 'Hello' as base64. Browsers can render data URLs inline without a separate HTTP request.",
      },
      {
        q: "When should I use data: URLs?",
        a: "Use cases: small icons/avatars in CSS background-image, inlining critical above-the-fold images, embedding SVGs in HTML, passing file content in JSON APIs, and reducing HTTP requests for tiny assets. Avoid for large files (>50KB) — they bloat HTML/CSS and can't be cached separately. Our tool warns you when a data URL exceeds 10KB/100KB/2MB thresholds.",
      },
      {
        q: "What's the size limit for data: URLs?",
        a: "There's no RFC limit, but browsers impose practical limits. Chrome allows up to ~2MB per data URL. Our tool checks the size and warns at 10KB (info), 100KB (warning), and 2MB (error). For larger files, use object URLs (URL.createObjectURL) instead. Note that base64 encoding increases size by ~33%.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "Beyond basic encode/decode, we ship: (1) History (localStorage, last 20). (2) Batch encode — convert multiple files at once and export as JSON. (3) Decode to Blob — get a downloadable Blob object from a data URL. (4) Data URL comparison — diff two data URLs field-by-field. (5) Embed templates — generate ready-to-paste code for HTML <img>, CSS background, favicon <link>, JS string, JSON value, Markdown image, and inline SVG. (6) Deep validation — check size, MIME type, and sniffing risk. (7) Size estimator — calculate URL size before encoding. (8) SVG optimization — auto-pick base64 or plain encoding (whichever is smaller). (9) File info extractor — name, size, type, lastModified. (10) Shareable URL — encode small data URLs in fragment.",
      },
      {
        q: "How does SVG optimization work?",
        a: "SVGs are text-based XML, so URL-encoding (plain) is often smaller than base64. Our tool encodes the SVG both ways and picks the smaller one. For example, a 1KB SVG might be 1.4KB as base64 but only 1.1KB as plain URL-encoded text. The savings can be 20-30% for SVGs.",
      },
      {
        q: "Is my file sent anywhere?",
        a: "No. Encoding/decoding is done entirely in your browser using FileReader API and base64. Your file never leaves your device. You can verify by disconnecting your internet — the tool still works.",
      },
    ],
  },
  status: "done",
};
