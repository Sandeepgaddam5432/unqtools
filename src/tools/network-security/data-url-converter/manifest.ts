import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "data-url-converter",
  name: "Data URL Converter",
  description:
    "Convert files to data: URLs and back. Encode images, text, or any binary file as a base64 data URL for embedding in HTML/CSS/JSON. 100% private.",
  category: "network-security",
  keywords: [
    "data url",
    "data uri",
    "base64",
    "embed",
    "inline image",
    "data scheme",
    "rfc 2397",
    "convert",
  ],
  icon: "file-code",
  requiresNetwork: false,
  seo: {
    title: "Data URL Converter — Embed Files as data: URLs | UnQTools",
    faq: [
      {
        q: "What is a data: URL?",
        a: "A data: URL (RFC 2397) is a URI scheme that embeds the file content directly in the URL itself. For example: data:text/plain;base64,SGVsbG8= embeds the text 'Hello' as base64. Browsers can render data URLs inline without a separate HTTP request.",
      },
      {
        q: "When should I use data: URLs?",
        a: "Use cases: small icons/avatars in CSS background-image, inlining critical above-the-fold images, embedding SVGs in HTML, passing file content in JSON APIs, and reducing HTTP requests for tiny assets. Avoid for large files (>50KB) — they bloat HTML/CSS and can't be cached separately.",
      },
      {
        q: "What's the size limit for data: URLs?",
        a: "There's no RFC limit, but browsers impose practical limits. Chrome allows up to ~2MB per data URL. For larger files, use object URLs (URL.createObjectURL) instead. Also note that base64 encoding increases size by ~33%.",
      },
      {
        q: "Is my file sent anywhere?",
        a: "No. Encoding/decoding is done entirely in your browser using FileReader API and base64. Your file never leaves your device. You can verify by disconnecting your internet — the tool still works.",
      },
    ],
  },
  status: "done",
};
