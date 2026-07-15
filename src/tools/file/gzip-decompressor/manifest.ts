import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "gzip-decompressor",
  name: "GZIP Decompressor",
  description:
    "Decompress .gz files back to their original content using the browser's native DecompressionStream API. Extracts the original filename from the GZIP header, supports .tar.gz auto-extraction (TAR + GZIP), and detects MIME type from magic bytes. Batch decompress multiple .gz files. 100% client-side.",
  category: "file",
  keywords: [
    "gzip decompressor", "gunzip", "decompress gz", "extract gzip",
    "tar.gz extractor", "gz file opener", "decompress .gz", "gzip reader",
    "ungzip", "gzip-decompressor",
  ],
  icon: "file-archive",
  requiresNetwork: false,
  seo: {
    title: "GZIP Decompressor — Decompress .gz Files in Browser | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "It decompresses GZIP (.gz) files back to their original content using the browser's native DecompressionStream API. The tool reads the GZIP header (RFC 1952) to extract the original filename embedded during compression. If the .gz file contains a TAR archive (.tar.gz), it automatically lists the TAR contents and lets you download individual files or all as a ZIP." },
      { q: "What if the GZIP header doesn't contain a filename?", a: "Some GZIP producers (e.g. server-side Content-Encoding) don't embed the original filename. In that case, we strip the .gz extension from the input filename (e.g. 'data.txt.gz' → 'data.txt'). If the input has no .gz extension, we fall back to 'decompressed.bin'." },
      { q: "How does .tar.gz extraction work?", a: "After GZIP-decompressing the .tar.gz file, we parse the TAR archive (512-byte blocks, USTAR format). Each TAR entry contains a filename, size, and type flag. We list all regular files and let you download them individually or all at once as a ZIP. Directories and symbolic links are shown but skipped for extraction." },
      { q: "What MIME types can it detect?", a: "We sniff the first few bytes (magic bytes) of the decompressed content: PNG, JPEG, GIF, WebP, BMP, PDF, ZIP, GZIP, TAR, ELF binary, Windows PE, and common text encodings (UTF-8 BOM, UTF-16 BOM). For unknown content, we sniff for ASCII-printable characters and report 'text/plain' if it looks like text." },
      { q: "Can I decompress multiple .gz files at once?", a: "Yes. Drag-drop or select multiple .gz files — each is decompressed independently and shown with its before/after size and ratio. Use 'Download all as ZIP' to get one ZIP containing all decompressed files." },
      { q: "What extra features does this tool have compared to others?", a: "10 extras: (1) Drag-drop file input. (2) Batch decompress multiple .gz files. (3) .tar.gz auto-extract — list TAR contents, download individual files. (4) Preview first 256 bytes of decompressed content (hex + ASCII). (5) Stats — compressed size, decompressed size, ratio per file. (6) Custom output filename. (7) MIME type detection from magic bytes. (8) Magic bytes check before decompression (validate GZIP signature). (9) History (localStorage — last 10 batch summaries). (10) Shareable URL with options." },
      { q: "Is my file uploaded anywhere?", a: "No. All GZIP decompression runs in your browser via the native DecompressionStream API. File contents never leave your device. Only batch summaries (filenames + sizes) are saved to local history." },
      { q: "Does it work offline?", a: "Yes. DecompressionStream is a browser-native API available in all modern browsers (Chrome 80+, Firefox 113+, Safari 16.4+). Once the page loads, no network access is required." },
    ],
  },
  status: "done",
};
