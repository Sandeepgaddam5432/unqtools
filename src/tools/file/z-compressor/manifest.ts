import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "z-compressor",
  name: "Z Compressor",
  description:
    "Compress and decompress Unix .Z files using LZW compression as defined by ncompress / gzip-compatible .Z format. Magic bytes 0x1f 0x9d, configurable max bits (9–16), block mode toggle. Pure JavaScript, 100% local.",
  category: "file",
  keywords: [
    "z compressor", "compress z file", "lzw compressor", "lzw decompressor",
    "unix compress", "uncompress", ".z file", "tar.z", "taz",
    "compress 1f 9d", "z-compressor",
  ],
  icon: "archive",
  requiresNetwork: false,
  seo: {
    title: "Z Compressor — Unix .Z LZW Compress / Decompress | UnQTools",
    faq: [
      { q: "What is a .Z file?", a: "A .Z file is the output of the classic Unix `compress` utility (also known as LZW compress, ncompress). It uses Lempel-Ziv-Welch (LZW) compression with a 2-byte magic header (0x1f 0x9d), a flags byte encoding max-bits and block-mode, then a stream of variable-width LZW codes. Files ending in .tar.Z (often called .taz) are TAR archives that have been LZW-compressed." },
      { q: "How does this tool differ from gzip?", a: "Gzip uses DEFLATE (LZ77 + Huffman coding) and is the modern Unix standard. .Z uses older LZW compression, which is typically 5–15% worse than gzip but is supported by every Unix system going back to 1985. .Z files are still found on legacy FTP mirrors, in Solaris packages, and in some scientific data archives." },
      { q: "What is the maximum code width supported?", a: "We support the standard 9–16 bit range (the original `compress` cap was 16 bits). Higher bit depths give better compression ratios at the cost of more memory and slower decompression. We default to 16 bits, which matches `compress -b 16`." },
      { q: "What is block mode?", a: "Block mode (flag bit 0x80) tells the decoder to periodically reset the LZW dictionary at block boundaries. This lets the decoder resynchronise after corrupt bytes. The original `compress` defaults to block mode ON. We follow that convention." },
      { q: "What extra features does this tool have compared to others?", a: "10 extras: (1) Drag-drop input. (2) Batch compress multiple files. (3) Auto-detect compress vs. decompress mode based on file extension. (4) Before/after size comparison. (5) Stats panel (ratio, saved bytes, processing time). (6) Custom output filename. (7) Hex preview of compressed bytes. (8) Configurable max bits (9–16). (9) Block mode toggle. (10) History of recently processed files in localStorage + shareable URL with current settings." },
      { q: "Is my file uploaded anywhere?", a: "No. All LZW compression and decompression happens in your browser using pure JavaScript. File contents never leave your device." },
    ],
  },
  status: "done",
};
