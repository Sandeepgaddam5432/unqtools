import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "empty-file-creator",
  name: "Empty File Creator",
  description:
    "Generate empty or fixed-size dummy files for testing. Fill patterns (zeros, random, 0xFF, sequential), size presets (1KB / 1MB / 100MB / 1GB), custom extensions, filename templates with numbering, batch creation, and download. 100% client-side.",
  category: "file",
  keywords: [
    "empty file creator", "dummy file", "test file generator", "fill file",
    "fixed size file", "create empty file", "fill pattern", "zeros file",
    "random file", "1gb dummy file", "file generator",
  ],
  icon: "file-plus",
  requiresNetwork: false,
  seo: {
    title: "Empty File Creator — Generate Fixed-size Dummy Files | UnQTools",
    faq: [
      { q: "What can this tool create?", a: "Empty (0-byte) files, fixed-size files filled with a pattern of your choice (zeros, 0xFF, sequential bytes 0..255..0, or cryptographically-random), with custom size in B/KB/MB/GB, custom filename, custom extension, and filename templates with auto-numbering for batch creation." },
      { q: "Why would I need an empty file?", a: "Empty files are commonly used for placeholder files (.gitkeep, .keep), testing file-system behavior, seeding directory structures, or testing upload/download pipelines without transferring real data. Fixed-size dummy files are used for benchmarking disk I/O, network transfer limits, or testing quota systems." },
      { q: "What extra features does this tool have?", a: "10 extras: (1) Multiple file batch creation. (2) Fill pattern (zeros/random/0xFF/sequential). (3) File size presets (1KB/1MB/100MB/1GB). (4) Custom extension. (5) Stats (created count, total size). (6) Filename template with numbering ({n} → 001, 002, ...). (7) Preview first 64 bytes as hex. (8) Copy file info to clipboard. (9) History (localStorage — last 10 creations). (10) Shareable URL with settings." },
      { q: "Is my generated file uploaded anywhere?", a: "No. All file generation happens in your browser using Uint8Array + Blob. The file never leaves your device." },
      { q: "What's the maximum file size?", a: "There's no hard limit, but generating files larger than 1GB may exhaust browser memory (Chrome tab limit is ~4GB). Use the 100MB preset for safe benchmarks; for >1GB use a native tool (e.g. `truncate -s 1G file.bin` on Linux or `fsutil file createnew file.bin 1073741824` on Windows)." },
    ],
  },
  status: "done",
};
