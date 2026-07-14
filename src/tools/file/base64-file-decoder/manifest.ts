import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "base64-file-decoder",
  name: "Base64 File Decoder",
  description:
    "Decode Base64 or data URL back into a binary file. Handles URL-safe, line-wrapped, and padded Base64. MIME detection, magic bytes verification, hex preview, custom filenames, batch decode. 100% client-side.",
  category: "file",
  keywords: [
    "base64 decode", "decode base64", "data url decoder", "base64 to file",
    "decode file", "url-safe base64 decode", "magic bytes", "mime detection",
    "hex preview", "base64 converter",
  ],
  icon: "binary",
  requiresNetwork: false,
  seo: {
    title: "Base64 File Decoder — Base64 / Data URL → File | UnQTools",
    faq: [
      { q: "How does Base64-to-file decoding work?", a: "Paste your Base64 string or data URL. The tool strips whitespace/newlines (line-wrapped Base64), converts URL-safe characters (-_ → +/) back to standard form, then decodes using atob into raw bytes. You can download the result as a binary file with the correct extension." },
      { q: "How is the MIME type detected?", a: "If the input is a data URL (data:<mime>;base64,...), the MIME is read from the prefix. Otherwise the tool inspects the first 8 bytes of the decoded output against a magic-byte database (PNG, JPEG, PDF, ZIP, etc.) to guess the format." },
      { q: "What extra features does this tool have?", a: "10 extras: (1) Drag-drop .b64 file. (2) Batch decode multiple inputs. (3) Hex preview of decoded bytes (first 256). (4) File size info (input chars + output bytes). (5) MIME type detection from data URL or magic bytes. (6) Magic bytes verification (shows matched signature). (7) Stats (input length, output size, overhead reversed). (8) Copy decoded bytes as hex. (9) Custom output filename. (10) History (localStorage — last 10 decodings)." },
      { q: "Is my Base64 data uploaded anywhere?", a: "No. All decoding runs in your browser using atob. Your data never leaves your device." },
      { q: "Why does my decoded file look corrupted?", a: "Common causes: (1) input is not actually Base64 (e.g. a raw text string), (2) padding is missing, (3) URL-safe characters weren't converted. This tool handles all three cases automatically, but if you still see garbage, check the magic bytes — if they don't match a known signature, the input is likely not Base64-encoded binary." },
    ],
  },
  status: "done",
};
