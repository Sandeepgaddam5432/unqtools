import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "online-file-splitter",
  name: "File Splitter",
  description:
    "Split any file into smaller parts by size or count — HJSplit-compatible naming (.001, .002, ...). CRC32 + SHA-256 checksum manifest, custom naming template, merge instructions, progress bar. 100% client-side.",
  category: "file",
  keywords: [
    "file splitter", "split file", "hjsplit", "split file by size",
    "file parts", "001 002 003", "binary file split", "split binary",
    "crc32 checksum", "sha-256 manifest", "file splitter online",
  ],
  icon: "scissors",
  requiresNetwork: false,
  seo: {
    title: "File Splitter — HJSplit-Compatible Parts + Checksum Manifest | UnQTools",
    faq: [
      { q: "What does the File Splitter do?", a: "It splits any file into smaller parts by part size (KB/MB/GB) or by number of parts. Parts are named with HJSplit-compatible extension (.001, .002, .003, ...) so they can be rejoined by any HJSplit-compatible tool. A checksum manifest (CRC32 + SHA-256 per part) is generated for integrity verification on rejoin." },
      { q: "What is HJSplit format?", a: "HJSplit is a popular cross-platform file-splitter. It names parts by appending a sequential 3-digit extension (.001 for part 1, .002 for part 2, etc.). The UnQTools File Merger rejoins these parts natively, and so does the original HJSplit app, 7-Zip, and many others." },
      { q: "How does checksum verification work?", a: "For each part, the splitter computes a CRC32 (8-char hex) and a SHA-256 (64-char hex). These are written to a .sha256 manifest file alongside the parts. The File Merger reads this manifest on rejoin and verifies each part's integrity before merging." },
      { q: "What extra features does this tool have?", a: "10 extras: (1) Drag-drop file. (2) Progress bar during splitting. (3) CRC32 checksum per part. (4) SHA-256 manifest file. (5) Stats (total size, parts count, part size). (6) Custom naming template. (7) Merge instructions display. (8) Preview first bytes of each part. (9) History (localStorage — last 10 splits). (10) Shareable URL with settings." },
      { q: "Is my file uploaded anywhere?", a: "No. All splitting runs in your browser using ArrayBuffer slicing. Your file never leaves your device." },
      { q: "What's the maximum file size?", a: "There's no hard limit, but files larger than 500MB may exhaust browser memory. For larger files, use a native HJSplit tool." },
    ],
  },
  status: "done",
};
