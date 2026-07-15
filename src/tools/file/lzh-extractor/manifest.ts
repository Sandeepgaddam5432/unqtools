import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "lzh-extractor",
  name: "LZH Extractor",
  description:
    "Extract files from LZH/LHA archives in the browser — pure JavaScript LZH parser. Support level 0 (stored, no compression) and basic level 1 headers. List files, view sizes + CRC, extract stored files, re-zip as ZIP. 100% client-side.",
  category: "file",
  keywords: [
    "lzh extractor", "lha extractor", "lzh viewer", "lzh reader",
    "lha archive", "lzh archive", "lha parser", "lzh parser",
    "level 0 lzh", "lzh-extractor",
  ],
  icon: "file-archive",
  requiresNetwork: false,
  seo: {
    title: "LZH Extractor — Extract .lzh / .lha Files in Browser (Pure JS) | UnQTools",
    faq: [
      { q: "What is an LZH file?", a: "LZH (LHA / Larc / LHarc) is an archive format popular in Japan and on early DOS/Amiga systems. The format has multiple header 'levels' (0, 1, 2, 3) with increasing metadata support. Level 0 is the simplest — a 22-byte fixed header + filename + CRC. Level 1 adds an extended header with timestamps and OS info. Levels 2 and 3 use 64-bit sizes and are used by modern LHA tools. The compression methods include -lh0- (stored, no compression), -lh1- through -lh7- (various LZSS + Huffman variants), and -lzs- / -lz4- / -lz5- (older methods)." },
      { q: "How does this tool work?", a: "We parse LZH archives in pure JavaScript: (1) read each entry's header (level 0, 1, 2, or 3 — detected by the header byte), (2) extract filename, size, CRC, compression method, and timestamp, (3) for level 0 (-lh0- / -lhd-) entries, extract the bytes directly (no decompression needed), (4) for other methods (-lh1- through -lh7-), we document as unsupported (decompression requires a 5KB+ WASM blob for Huffman tables). You can list all files, search by name, filter by extension, and re-zip the extractable files as a STORE-method ZIP." },
      { q: "Why can't I extract compressed LZH files?", a: "LZH compression methods (-lh1- through -lh7-) use a combination of LZSS sliding-window compression and adaptive Huffman coding. The Huffman tree reconstruction code is ~5KB+ of pure JS, and the bit-level reader adds another 1-2KB. To stay within the 50KB per-tool budget, we ship level 0 (stored) support only. Most LZH files in the wild use -lh5- compression — for those, use 7-Zip (desktop) which has full LHA support." },
      { q: "What's the difference between LZH and LHA?", a: "Nothing — they're the same format. '.lzh' is the file extension used on DOS/Windows, while '.lha' is used on Amiga/Unix. The internal structure is identical. Some tools also use '.lzs' or '.lzx' extensions for older variants. We accept all of these." },
      { q: "What's the LZH header structure?", a: "Level 0 header (22 bytes + variable filename): header size (1 byte), checksum (1 byte), method (5 bytes, e.g. '-lh0-'), compressed size (4 bytes LE), uncompressed size (4 bytes LE), timestamp (4 bytes LE — DOS format), attributes (1 byte), compression level (1 byte), filename length (1 byte), filename (variable), CRC16 (2 bytes LE). Level 1 adds an extended header (variable length, OS-specific). Level 2/3 use a different layout with 64-bit sizes." },
      { q: "What extra features does this tool have compared to others?", a: "10 extras: (1) Drag-drop input. (2) File list with sizes + compression methods. (3) Search files by name (case-insensitive). (4) Filter by file type (text, image, code, etc.). (5) Stats — file count, total uncompressed size, total compressed size, ratio. (6) Download individual files (when extractable). (7) Download all as ZIP (re-zip STORE method). (8) Header info display — compression method, level, OS, timestamp per file. (9) CRC verification for stored files (compares stored CRC with computed). (10) History of recently extracted LZHs (localStorage — last 10)." },
      { q: "Is my LZH uploaded anywhere?", a: "No. All LZH parsing runs in your browser using pure JavaScript. File contents never leave your device. Only archive summaries (filename + entry count) are saved to local history." },
      { q: "Why does my LZH file show 'unsupported compression method'?", a: "Most real-world LZH files use -lh5- compression (LZSS + Huffman), which we don't support in pure JavaScript (would need ~5KB of Huffman tree code, breaking our 50KB bundle budget). We list these files with their metadata intact, but extraction fails with a clear error. To extract: use 7-Zip on desktop, or use the LHA tool on Linux/macOS. Files stored with -lh0- (no compression) extract fully here." },
    ],
  },
  status: "done",
};
