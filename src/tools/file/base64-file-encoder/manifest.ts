import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "base64-file-encoder",
  name: "Base64 File Encoder",
  description:
    "Convert any file to Base64 or a data URL. URL-safe Base64, line-wrapped output (76 chars), batch encoding, MIME detection, size warnings, copy/download. 100% client-side.",
  category: "file",
  keywords: [
    "base64 encode", "file to base64", "data url", "base64 data url",
    "encode file", "base64 converter", "url-safe base64", "line wrap base64",
    "batch base64", "mime type", "file encoder",
  ],
  icon: "binary",
  requiresNetwork: false,
  seo: {
    title: "Base64 File Encoder — File → Base64 / Data URL | UnQTools",
    faq: [
      { q: "How does file-to-Base64 encoding work?", a: "Each byte of your file is read into an ArrayBuffer, then converted to a Base64 string using btoa (binary-to-ASCII). The result can be output as raw Base64, a data: URL (with MIME type prefix), URL-safe Base64 (with -_ replacing +/), or line-wrapped at 76 characters per line (RFC 2045)." },
      { q: "What's a data URL?", a: "A data URL embeds the entire file inline as `data:<mime>;base64,<base64>`. You can paste it directly into <img src>, <a href>, or CSS url() without a separate request. Useful for inline images, embedded fonts, and self-contained HTML." },
      { q: "What extra features does this tool have?", a: "10 extras: (1) Drag-drop file. (2) Batch encode multiple files. (3) Size warning for files > 2MB. (4) URL-safe Base64 output (-_ instead of +/). (5) Line-wrapped output at 76 chars (RFC 2045). (6) Stats (input size, output size, overhead %). (7) Preview first 500 chars. (8) Copy as data URL. (9) Copy as raw Base64. (10) History (localStorage — last 10 encodings)." },
      { q: "Is my file uploaded anywhere?", a: "No. All encoding runs in your browser using FileReader / ArrayBuffer. Your file never leaves your device." },
      { q: "Why is the Base64 output ~33% larger than the original?", a: "Base64 encodes every 3 bytes into 4 ASCII characters (6 bits each). This 4/3 ratio means a 3 KB file becomes 4 KB of Base64 text. The stats panel shows the exact overhead percentage so you can plan for it." },
    ],
  },
  status: "done",
};
