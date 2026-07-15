import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "online-zip-compressor",
  name: "ZIP Compressor",
  description:
    "Create ZIP archives from multiple files in the browser — pure JavaScript ZIP writer (STORE method, no compression). Add files via drag-drop, reorder, rename archive, view per-file sizes + compression ratio, download .zip. 100% client-side.",
  category: "file",
  keywords: [
    "zip compressor", "create zip", "zip maker", "zip files",
    "compress files", "zip archive", "online zip", "make zip",
    "zip online", "online-zip-compressor",
  ],
  icon: "file-archive",
  requiresNetwork: false,
  seo: {
    title: "ZIP Compressor — Create ZIP Archives in Browser (Pure JS) | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "It creates a ZIP archive from multiple files entirely in your browser using a pure-JavaScript ZIP writer (no WASM, no native dependencies). You can drag-drop files in any order, reorder them, remove unwanted files, set a custom archive name, and download the resulting .zip file. The archive uses the STORE method (no compression), which means files are stored verbatim — perfect for already-compressed data like images, videos, and PDFs where re-compressing would just waste CPU without saving space." },
      { q: "Why STORE (no compression) instead of DEFLATE?", a: "Two reasons: (1) The browser's native CompressionStream('deflate-raw') is available, but mixing STORE + DEFLATE entries with proper per-entry CRC32 calculation adds significant complexity; STORE-only keeps things deterministic and verifiable. (2) Most data users ZIP today (images, videos, audio, PDFs, Office documents) is already compressed — running DEFLATE on it would barely shrink the result, but would consume 5-10x more CPU. For text files where DEFLATE would actually help, consider GZIP Compressor instead." },
      { q: "Does it support password protection?", a: "No — the STORE method we use does not include password protection. ZIP password protection (ZipCrypto or AES) requires either an external WASM library (~3MB) or significant custom crypto code. For sensitive files, encrypt them with a tool like Veracrypt or GPG first, then ZIP the encrypted output. The FAQ documents this as an intentionally-omitted feature to keep the tool's bundle size under 50KB gzipped." },
      { q: "Is there a file size limit?", a: "There's no hard limit, but the practical limit is your browser's per-tab memory (~2-4 GB). Files are loaded into memory as Uint8Array, then assembled into the ZIP structure in memory. For very large files (>500MB), consider compressing them one at a time. ZIP64 (for archives >4GB or files >4GB) is documented but not currently enabled — the format is supported by the ZIP spec, but our writer uses 32-bit size fields for compatibility with older extractors." },
      { q: "What extra features does this tool have compared to others?", a: "10 extras: (1) Drag-drop multiple files at once. (2) Reorder files (move up/down) before archiving. (3) Remove individual files from the list. (4) Stats — total uncompressed size, archive size, compression ratio. (5) Per-file size display with human-readable formatting. (6) Custom archive name (defaults to 'archive.zip'). (7) ZIP64 support note — documented behavior for files >4GB. (8) Preview file list before downloading. (9) History of recently created archives (localStorage — last 10). (10) Shareable URL with archive name preset." },
      { q: "Is my data uploaded anywhere?", a: "No. All file reading, ZIP assembly, and download happen entirely in your browser using pure JavaScript. File contents never leave your device. Only archive summaries (name + file count + total size) are saved to local history for convenience." },
      { q: "Can I add folders?", a: "Not directly — folder structure must be encoded in the file name (e.g. 'subfolder/file.txt'). Most modern ZIP extractors honor this convention. We preserve whatever filename you supply, including any path separators. For a flat archive, just upload files normally." },
    ],
  },
  status: "done",
};
