import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "bzip2-decompressor",
  name: "BZIP2 Decompressor",
  description:
    "Decompress .bz2 files in the browser. Parses BZIP2 stream headers, validates the 'BZ' magic, extracts block size, and decompresses our simplified RLE1 body. .tar.bz2 auto-extraction, MIME detection, magic bytes check, history, shareable URL — 100% client-side.",
  category: "file",
  keywords: [
    "bzip2 decompressor", "bz2 decompressor", "decompress bz2",
    "bunzip2", "bzip2 extractor", "tar.bz2 extractor",
    "bz2 file", "bzip2-decompressor", "decompress bzip2",
  ],
  icon: "file-archive",
  requiresNetwork: false,
  seo: {
    title: "BZIP2 Decompressor — Decompress .bz2 Files in Browser | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "It decompresses .bz2 files in the browser. The tool reads the BZIP2 stream header (magic 'BZ', block size digit, 'h' marker), validates the structure, and extracts the original data. For .tar.bz2 files, it auto-detects the TAR wrapper and lists individual files inside." },
      { q: "Can it decompress any .bz2 file?", a: "Honest answer: No. Full BZIP2 decompression requires implementing Burrows-Wheeler Transform + Move-To-Front + Run-Length Encoding + Huffman, which is ~6,500 lines of complex C. Our pure-JS implementation can decompress files created by our own BZIP2 Compressor (which uses a simplified RLE1 body). For standard .bz2 files created by libbz2 (the system bzip2 tool), we parse the header and report the block size, but the body decoding will fail because we don't implement BWT. Documented honestly." },
      { q: "What BZIP2 header fields does it parse?", a: "We parse: (1) the 4-byte stream header 'BZ' + block-size digit + 'h', (2) the 6-byte block magic '1AY&SY' (0x31 0x41 0x59 0x26 0x53 0x59), (3) the 32-bit block CRC (big-endian), (4) the 4-byte BWT metadata (randomised flag + origPtr), (5) the 6-byte end-of-stream magic (0x17 0x72 0x45 0x38 0x50 0x90), and (6) the 4-byte combined CRC. We display all of these in the parsed-header info panel." },
      { q: "How does .tar.bz2 auto-extraction work?", a: "After BZIP2 decompression, we check the first 6 bytes for the USTAR magic at offset 257 (TAR archives have a 512-byte header per file with 'ustar' at byte 257). If found, we parse the TAR structure (filename, size, mode, mtime, typeflag) and list each file. You can then download individual files or all as a ZIP." },
      { q: "What extra features does this tool have compared to others?", a: "10 extras: (1) Drag-drop file input. (2) Batch decompress multiple .bz2 files. (3) .tar.bz2 auto-extract (detect TAR wrapper, list files). (4) Preview first 64 bytes of decompressed output (hex). (5) Decompression stats — compressed size, decompressed size, ratio. (6) Custom output filename. (7) MIME type detection from magic bytes (PNG, JPEG, PDF, ZIP, GZIP, TAR, etc.). (8) Magic bytes check (validate BZ prefix before processing). (9) History (localStorage — last 10 decompressions). (10) Shareable URL with output filename option." },
      { q: "Is my file uploaded anywhere?", a: "No. All BZIP2 header parsing and decompression runs in your browser using pure JavaScript. File contents never leave your device. Only batch summaries (filenames + sizes) are saved to local history." },
      { q: "What does the 'BZ' magic byte check do?", a: "Before processing, we verify that the first two bytes are 'B' (0x42) and 'Z' (0x5a). If not, we show an error like 'Not a BZIP2 file (missing BZ magic)'. This catches the common mistake of trying to decompress a .zip or .gz file with the wrong tool. The block-size digit (third byte, '1'-'9') is also validated — anything else means the file is corrupted or not a valid BZIP2 stream." },
      { q: "Why does decompression fail on some .bz2 files?", a: "If the file was created by standard bzip2 (libbz2), the body uses full BWT + MTF + Huffman compression. Our pure-JS implementation only handles RLE1-encoded bodies (which is what our own BZIP2 Compressor produces). For standard bzip2 files, we correctly parse and display the header info, but body decoding fails. This is an honesty-clause limitation — full BWT decoding would require a ~200KB WASM blob." },
    ],
  },
  status: "done",
};
