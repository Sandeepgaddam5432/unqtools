import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "hex-viewer",
  name: "Hex Viewer",
  description:
    "Inspect any file's bytes in a hex dump with ASCII sidebar. Configurable bytes per line (8/16/32), search by hex or ASCII string, jump to offset, endian swap view, entropy per chunk, and download the hex dump as text. 100% client-side.",
  category: "file",
  keywords: [
    "hex viewer", "hex dump", "binary inspector", "hex editor",
    "byte viewer", "ascii sidebar", "file hex", "binary to hex",
    "magic bytes", "entropy", "hex search",
  ],
  icon: "binary",
  requiresNetwork: false,
  seo: {
    title: "Hex Viewer — Hex Dump with ASCII Sidebar & Search | UnQTools",
    faq: [
      { q: "How does the hex viewer work?", a: "Each byte of your file is read into a Uint8Array, then rendered as a classic hex dump: offset | hex bytes | ASCII. Non-printable bytes (outside 32-126) are shown as dots. You can switch between 8, 16, or 32 bytes per line for readability." },
      { q: "Can I search within the file?", a: "Yes. Search by hex string (e.g. 'FFD8FF' for JPEG) or by ASCII text. The tool highlights all matches with their byte offsets, and you can click any match to jump to it." },
      { q: "What extra features does this tool have?", a: "10 extras: (1) Drag-drop file. (2) Configurable bytes per line (8/16/32). (3) Search by hex string. (4) Search by ASCII string. (5) Jump to offset (decimal or hex). (6) Endian swap view (big/little). (7) Entropy calculation per chunk (1KB). (8) File stats (size, type, magic bytes). (9) Copy selection to clipboard. (10) History (localStorage — last 10 inspected)." },
      { q: "Is my file uploaded anywhere?", a: "No. All byte reading runs in your browser using ArrayBuffer. Your file never leaves your device." },
      { q: "What's the maximum file size?", a: "There's no hard limit, but files larger than 50MB may slow the browser (the hex dump renders in chunks). A 'chunked reading' mode reads the file in 1MB slices to avoid loading it all at once." },
    ],
  },
  status: "done",
};
