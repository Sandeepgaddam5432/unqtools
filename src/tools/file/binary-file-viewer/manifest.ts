import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "binary-file-viewer",
  name: "Binary File Viewer",
  description:
    "Decode any file's structure — inspect bytes as int8/16/32/64, uint, float32/64, ASCII, UTF-8, and hex. Big/little endian toggle, byte range selection, PNG/JPEG/ZIP/PDF structure templates, magic bytes detection, entropy stats. 100% client-side.",
  category: "file",
  keywords: [
    "binary viewer", "binary file inspector", "data type decoder",
    "int8 int16 int32 int64", "float32 float64", "hex dump",
    "endian toggle", "byte inspector", "magic bytes", "file structure",
    "binary parser", "ascii utf-8 decoder",
  ],
  icon: "binary",
  requiresNetwork: false,
  seo: {
    title: "Binary File Viewer — Decode Bytes as Int/Float/ASCII/UTF-8 | UnQTools",
    faq: [
      { q: "What does the Binary File Viewer do?", a: "It reads any file as a Uint8Array and lets you inspect the bytes in many representations: signed/unsigned int8/16/32/64, float32/64, ASCII, UTF-8, and classic hex dump. You can toggle big/little endian, select byte ranges, and decode structures like PNG, JPEG, ZIP, or PDF headers using built-in templates." },
      { q: "How do structure templates work?", a: "Pick a template (e.g. PNG, JPEG, ZIP, PDF) and the viewer applies a parser that maps the first N bytes to named fields with their offsets and decoded values. Each template knows the file's magic bytes, header layout, and key offsets." },
      { q: "What is the endian toggle for?", a: "Different CPU architectures store multi-byte integers differently. x86 (Intel/AMD) is little-endian, while many network protocols and ARM (configurable) are big-endian. The toggle reinterprets the same bytes both ways so you can spot which the file uses." },
      { q: "What extra features does this tool have?", a: "10 extras: (1) Drag-drop file. (2) Configurable bytes per line (8/16/32). (3) Search by hex string. (4) Search by ASCII string. (5) Jump to offset (decimal or hex). (6) Data type preview at cursor. (7) File stats (size, type, entropy). (8) Copy selection as hex / ASCII / C-array. (9) History (localStorage — last 10 inspected). (10) Shareable URL with options." },
      { q: "Is my file uploaded anywhere?", a: "No. All byte reading runs in your browser using ArrayBuffer. Your file never leaves your device." },
      { q: "What's the maximum file size?", a: "There's no hard limit, but files larger than 100MB may slow the browser. The viewer reads the whole file into memory for full-text search; for larger files, use a chunked hex viewer instead." },
    ],
  },
  status: "done",
};
