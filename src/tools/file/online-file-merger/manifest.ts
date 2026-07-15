import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "online-file-merger",
  name: "File Merger",
  description:
    "Rejoin split file parts (.001, .002, ...) back into the original file. Auto-detect + sort by extension number, CRC32/SHA-256 checksum verification, missing-part detection, custom output name. 100% client-side.",
  category: "file",
  keywords: [
    "file merger", "merge file parts", "hjsplit join", "join file parts",
    "001 002 merge", "binary file merger", "rejoin file",
    "crc32 verify", "sha-256 verify", "file merger online",
  ],
  icon: "combine",
  requiresNetwork: false,
  seo: {
    title: "File Merger — Rejoin HJSplit Parts + Checksum Verification | UnQTools",
    faq: [
      { q: "What does the File Merger do?", a: "It rejoins split file parts (.001, .002, ...) back into the original file. Parts are auto-sorted by their extension number, then concatenated in order. If you provide a manifest file (.sha256 from the splitter), each part is verified with CRC32 + SHA-256 before merging." },
      { q: "How does auto-detection work?", a: "Drop multiple files ending in .001, .002, .003, etc. The merger parses the numeric extension and sorts them. It detects the base name (everything before the .001), so you can drop parts with any naming pattern (myfile.001, myfile.002, ...). Missing parts in the sequence are flagged before merging." },
      { q: "What if I don't have the manifest?", a: "You can still merge without a manifest — the merger will simply concatenate the parts in order. However, without the manifest, integrity (CRC32 + SHA-256) cannot be verified. We recommend keeping the .sha256 manifest file from the splitter." },
      { q: "What's HJSplit format?", a: "HJSplit is a popular cross-platform file-splitter. It names parts by appending a sequential 3-digit extension (.001 for part 1, .002 for part 2, etc.). This merger reads that format natively. 7-Zip also rejoins HJSplit parts (right-click .001 → 7-Zip → Extract here)." },
      { q: "What extra features does this tool have?", a: "10 extras: (1) Drag-drop multiple parts. (2) Auto-sort by extension number. (3) Progress bar during merge. (4) Checksum verification (CRC32 + SHA-256). (5) Stats (parts count, merged size, verification result). (6) Preview merged file info. (7) Custom output filename. (8) Missing part detection. (9) History (localStorage — last 10 merges). (10) Shareable URL with settings." },
      { q: "Are my files uploaded anywhere?", a: "No. All merging runs in your browser using ArrayBuffer concatenation. Your files never leave your device." },
    ],
  },
  status: "done",
};
