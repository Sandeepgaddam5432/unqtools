import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "large-file-generator",
  name: "Large File Generator",
  description:
    "Create exact-size dummy test files filled with zeros, random data, 0xFF, sequential bytes, or repeating text. Batch generation, size presets (1KB-1GB), filename templates with numbering, progress bar, hex preview. 100% client-side.",
  category: "file",
  keywords: [
    "large file generator", "dummy file", "test file generator",
    "exact size file", "1gb dummy file", "fill pattern",
    "zeros file", "random file", "sequential bytes", "file creator",
    "benchmark file", "sparse file generator",
  ],
  icon: "file-plus",
  requiresNetwork: false,
  seo: {
    title: "Large File Generator — Create Exact-Size Dummy Test Files | UnQTools",
    faq: [
      { q: "What does the Large File Generator do?", a: "It creates dummy test files of an exact size (bytes/KB/MB/GB), filled with a pattern of your choice: zeros, cryptographically-random bytes, 0xFF bytes, sequential bytes (0..255..0), or repeating text. Useful for benchmarking disk I/O, testing upload limits, quota testing, or seeding test fixtures." },
      { q: "How is this different from the Empty File Creator?", a: "The Large File Generator focuses on larger sizes with a progress bar (so generation doesn't freeze the tab), adds a 'repeating text' fill pattern (useful for compression testing), reports time taken, and supports batch generation with auto-numbered filenames." },
      { q: "What's the maximum file size?", a: "There's no hard limit, but generating files larger than 500MB in a single browser tab may exhaust memory (Chrome tab limit is ~4GB). Use the 100MB preset for safe benchmarks; for >1GB use a native tool (e.g. `truncate -s 1G file.bin` on Linux or `fsutil file createnew file.bin 1073741824` on Windows)." },
      { q: "What extra features does this tool have?", a: "10 extras: (1) Batch generate multiple files. (2) Fill patterns (zeros/random/0xFF/sequential/text). (3) Size presets (1KB/100KB/1MB/10MB/100MB/1GB). (4) Custom file extension. (5) Stats (total size, time taken). (6) Filename template with numbering {n}. (7) Progress bar during generation. (8) Preview first 64 bytes as hex. (9) History (localStorage — last 10 generations). (10) Shareable URL with settings." },
      { q: "Is my generated file uploaded anywhere?", a: "No. All file generation happens in your browser using Uint8Array + Blob. The file never leaves your device." },
    ],
  },
  status: "done",
};
