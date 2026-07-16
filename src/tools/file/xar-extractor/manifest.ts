import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "xar-extractor",
  name: "XAR Extractor",
  description:
    "Extract files from XAR (eXtensible Archive) — Apple's archive format with XML TOC + heap. Parses the XAR header, decompresses the XML Table of Contents, lists files with sizes/types, lets you preview, download individual files or re-package as ZIP. 100% client-side.",
  category: "file",
  keywords: [
    "xar extractor", "xar file", "apple xar", "extensible archive",
    "xar unpack", "xar viewer", "xar to zip", "xar toc",
    "xar header", "xar-extractor",
  ],
  icon: "file-archive",
  requiresNetwork: false,
  seo: {
    title: "XAR Extractor — Open Apple .xar Archives in Browser | UnQTools",
    faq: [
      { q: "What is a XAR file?", a: "XAR (eXtensible Archive Resource) is Apple's archive format introduced in Mac OS X 10.4. It starts with the magic 'xar!' (0x78 0x61 0x72 0x21), followed by a 28-byte header containing offsets to a compressed XML Table of Contents, and a heap of compressed file data. XAR is used for macOS installer packages (.pkg) and Software Update payloads." },
      { q: "How does this extractor work?", a: "We read the 28-byte XAR header to find the compressed TOC (always zlib-deflated), decompress it with the browser's built-in DecompressionStream, parse the resulting XML, and walk the <toc> tree to build a list of files with their offsets into the heap. Each file may be individually zlib-compressed; we decompress on demand when you click Download." },
      { q: "Can this tool fully extract every XAR file?", a: "Yes for files using zlib (the most common compression). XAR also supports bzip2, gzip, and LZMA per-file encodings — we support zlib and stored (no compression); other methods surface a clear 'unsupported compression' error. Encrypted XAR payloads (rare) are not supported." },
      { q: "What is the XML TOC?", a: "The Table of Contents is a zlib-compressed XML document that lists every file in the archive with its name, size, type (file/dir/symlink), encoding, and offset into the heap. We render the raw XML in a viewer so you can inspect the structure of any XAR file." },
      { q: "What extra features does this tool have compared to others?", a: "10 extras: (1) Drag-drop input. (2) File tree with directories expanded. (3) Search filter by name. (4) Type filter (all / files / dirs / symlinks). (5) Stats panel (file count, total uncompressed, compression ratio, encoding breakdown). (6) Download individual files. (7) Download all as a new ZIP archive. (8) Raw XML TOC viewer. (9) History of recently opened .xar files (localStorage — last 10). (10) Shareable URL with current view settings." },
      { q: "Is my .xar file uploaded anywhere?", a: "No. All XAR parsing, zlib decompression, and ZIP repackaging happens in your browser using native APIs. File contents never leave your device. Only filenames and counts are saved to local history." },
    ],
  },
  status: "done",
};
