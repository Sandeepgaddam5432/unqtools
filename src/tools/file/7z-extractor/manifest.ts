import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "7z-extractor",
  name: "7Z Extractor",
  description:
    "Inspect and extract files from 7z archives. Detects the 7z signature (0x37 0x7A 0xBC 0xAF 0x27 0x1C), parses the SignatureHeader and StartHeader, lists files from the archive metadata, and extracts STORE-method files when possible. Honest about LZMA compression limitations. 100% client-side.",
  category: "file",
  keywords: [
    "7z extractor", "7zip extractor", "extract 7z",
    "7z file", "7z archive", "7zip viewer", "7z inspector",
    "lzma", "7z-extractor", "7-zip",
  ],
  icon: "file-archive",
  requiresNetwork: false,
  seo: {
    title: "7Z Extractor — Inspect & Extract .7z Files in Browser | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "It inspects 7z archives. The tool detects the 7z signature (0x37 0x7A 0xBC 0xAF 0x27 0x1C — the 6-byte magic at the start of every .7z file), parses the 32-byte SignatureHeader, reads the 40-byte StartHeader (which points to the compressed metadata section), and lists all files stored in the archive. For files using the STORE method (no compression), we can extract them." },
      { q: "Can it extract all 7z files?", a: "Honest answer: No. Most 7z archives use LZMA or LZMA2 compression (the default 7-Zip algorithm). A pure-JS LZMA decoder is ~50KB+ and we don't bundle it to stay within our per-tool budget. We CAN extract files stored with the COPY method (compression method 0), but those are rare — most users let 7-Zip choose LZMA. For compressed 7z files, we parse the header and list file entries, but file content extraction fails. For full LZMA support, use 7-Zip (desktop) or 7z-wasm (browser WASM)." },
      { q: "What's in the 7z SignatureHeader?", a: "The first 32 bytes of every .7z file: (1) 6-byte signature '7z\\xbc\\xaf\\x27\\x1c', (2) 1-byte major version (usually 0), (3) 1-byte minor version (usually 4), (4) 4-byte StartHeader CRC (LE), (5) 8-byte NextHeaderOffset (LE, points to compressed metadata), (6) 8-byte NextHeaderSize (LE, size of compressed metadata), (7) 8-byte NextHeaderCRC (LE, CRC of compressed metadata). We parse and display all of these in the file info panel." },
      { q: "What compression methods does 7z support?", a: "The 7z format supports many codecs: COPY (0x00, no compression), LZMA (0x030101, default), LZMA2 (0x21), BCJ (0x03030103, x86 branch cutter), BCJ2 (0x0303011B), BZIP2 (0x040202), DEFLATE (0x040108), COPY (0), DELTA (0x03), and others. LZMA is by far the most common. We display the compression method ID for each file in the listing." },
      { q: "What extra features does this tool have compared to others?", a: "10 extras: (1) Drag-drop file input. (2) 7z signature detection (6-byte magic). (3) SignatureHeader parsing (32 bytes — version, NextHeaderOffset, NextHeaderSize, CRCs). (4) StartHeader display. (5) File listing from header (filename, size, method). (6) Stats — file count, total sizes, compression method breakdown. (7) Compression method display (COPY, LZMA, LZMA2, etc). (8) Honest disclaimer displayed prominently. (9) Alternative suggestions (7-Zip desktop, 7z-wasm). (10) History (localStorage — last 10 inspected 7z files)." },
      { q: "Is my 7z file uploaded anywhere?", a: "No. All 7z signature detection, SignatureHeader parsing, and file listing runs in your browser using pure JavaScript. File contents never leave your device. Only archive summaries (filename + entry count) are saved to local history." },
      { q: "Why can't I extract most files?", a: "LZMA compression is the default for 7z files. Implementing a pure-JS LZMA decoder is feasible (~50KB minified), but we chose not to bundle it to keep our per-tool bundle under 50KB. We CAN extract COPY-method files (compression method 0), but those are rare in practice. For full LZMA extraction, use 7-Zip desktop, or 7z-wasm in the browser. This is documented as an honesty-clause limitation." },
    ],
  },
  status: "done",
};
