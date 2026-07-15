import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "online-zip-extractor",
  name: "ZIP Extractor",
  description:
    "Extract files from .zip archives in the browser — pure JavaScript ZIP reader. Supports STORE (no compression) and DEFLATE entries via DecompressionStream. File tree, search, filter by extension, preview text files, download individual files or all as ZIP. 100% client-side.",
  category: "file",
  keywords: [
    "zip extractor", "unzip", "extract zip", "zip file", "zip reader",
    "unzip online", "zip viewer", "deflate", "store method",
    "zip extractor online", "online-zip-extractor",
  ],
  icon: "file-archive",
  requiresNetwork: false,
  seo: {
    title: "ZIP Extractor — Extract .zip Files in Browser (Pure JS, DEFLATE) | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "It extracts files from ZIP archives in your browser using a pure-JavaScript ZIP parser. Supports both STORE (no compression) and DEFLATE entries — DEFLATE decompression uses the browser's native DecompressionStream API, available in all modern browsers (Chrome 80+, Firefox 113+, Safari 16.4+, Edge 80+). You can browse the file tree, search by name, filter by extension, preview text files, download individual files, or re-zip everything for download." },
      { q: "How does it handle DEFLATE-compressed entries?", a: "ZIP archives commonly store entries with the DEFLATE algorithm (compression method 8). When we encounter such an entry, we pipe its raw compressed bytes through a DecompressionStream('deflate-raw') instance, which handles the inflate algorithm in native code. This is much faster than a pure-JS DEFLATE decoder and ships at zero bundle cost. For STORE entries (method 0), we just return the bytes verbatim." },
      { q: "Are password-protected ZIPs supported?", a: "No. Decrypting ZipCrypto or AES-encrypted ZIPs requires either an external WASM library (~3MB) or significant custom crypto code. We document this as an intentionally-omitted feature to keep the bundle size under 50KB gzipped. If your ZIP is password-protected, you'll see an error mentioning 'unsupported compression method 99' or an encryption flag." },
      { q: "Can I preview file contents?", a: "Yes. Click the eye icon next to any file to preview its first 8KB. Text files (UTF-8, ASCII) are shown as decoded text. Binary files are shown as a hex dump with ASCII gutter. The preview is read-only — extraction gives you the raw bytes." },
      { q: "How do I download all files at once?", a: "Click 'Download all as ZIP' to re-zip every file from the archive into a new STORE-method ZIP. This is useful when the original archive uses DEFLATE and you want a portable uncompressed version, or when you want to filter to a subset of files and download just those." },
      { q: "What extra features does this tool have compared to others?", a: "10 extras: (1) Drag-drop input. (2) File tree view — group files by directory. (3) Search files by name (case-insensitive). (4) Filter by file extension (.txt, .png, .csv, etc.). (5) Preview text files inline (UTF-8 decode) with hex fallback for binary. (6) Stats — file count, total uncompressed size, compressed size, compression ratio. (7) Download individual files. (8) Download all as ZIP (re-zip STORE method). (9) History of recently extracted archives (localStorage — last 10). (10) Shareable URL with filter + search preset." },
      { q: "Is my ZIP file uploaded anywhere?", a: "No. All ZIP parsing and DEFLATE decompression runs in your browser using pure JavaScript + the native DecompressionStream API. File contents never leave your device. Only archive summaries (filename + entry count) are saved to local history." },
      { q: "What's the maximum ZIP size?", a: "There's no hard limit, but very large archives (>1GB) will use lots of memory because we parse the whole central directory at once and may decompress multiple entries in memory simultaneously. The browser's per-tab memory cap (~2-4GB) is the practical limit. ZIP64 archives (>4GB or with files >4GB) are partially supported — the local file headers parse correctly, but 64-bit size fields in the central directory are not yet implemented." },
    ],
  },
  status: "done",
};
