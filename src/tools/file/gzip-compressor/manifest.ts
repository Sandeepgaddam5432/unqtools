import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "gzip-compressor",
  name: "GZIP Compressor",
  description:
    "Compress files to .gz format using the browser's native CompressionStream API. Batch compress multiple files, preserve original filenames, show before/after size comparison, and build .tar.gz archives (TAR + GZIP). 100% client-side — your files never leave the browser.",
  category: "file",
  keywords: [
    "gzip compressor", "gz compressor", "compress file", "gzip file",
    "compress to gz", "tar.gz", "tar.gz maker", "batch gzip",
    "compression ratio", "file compressor", "gzip-compressor",
  ],
  icon: "file-archive",
  requiresNetwork: false,
  seo: {
    title: "GZIP Compressor — Compress Files to .gz in Browser | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "It compresses files to the GZIP (.gz) format using the browser's native CompressionStream API. The output .gz file preserves the original filename in its header so GZIP decompressors (gunzip, 7-Zip, WinRAR, macOS Archive Utility) restore the original name automatically. For multiple files, you can combine them into a single .tar.gz archive (TAR + GZIP)." },
      { q: "What compression level does it use?", a: "CompressionStream uses the browser's built-in zlib implementation, which is typically level 6 (default). The browser API doesn't expose level control, so we display 'Default (browser-managed, ~level 6)' in the stats. This gives a good balance between speed and ratio for most file types." },
      { q: "Why are some files barely smaller after compression?", a: "Already-compressed formats (JPEG, PNG, MP4, ZIP, XLSX, GZIP) don't compress further — they're already entropy-coded. Text files (TXT, CSV, JSON, XML, HTML, source code) typically shrink 60-90%. Random binary data won't compress at all." },
      { q: "What's the maximum file size?", a: "There's no hard limit, but very large files (> 500MB) will use lots of memory because GZIP compresses the whole file at once. For multi-GB files, consider splitting first. The browser also has a per-tab memory cap (~2-4GB) that limits total batch size." },
      { q: "Can I compress multiple files at once?", a: "Yes. Drag-drop or select multiple files — each becomes a separate .gz file preserving its original name. For a single output, enable 'Combine as .tar.gz' to bundle all files into a TAR archive then GZIP-compress it into one .tar.gz file." },
      { q: "What extra features does this tool have compared to others?", a: "10 extras: (1) Drag-drop file input. (2) Batch compress multiple files at once. (3) Compression level display (browser-managed, ~level 6). (4) Before/after size comparison per file. (5) Aggregate stats — total saved bytes, total ratio. (6) Progress bar during batch compression. (7) Custom output filename. (8) .tar.gz support — combine TAR + GZIP into one archive. (9) History (localStorage — last 10 batch summaries). (10) Shareable URL with options (tar.gz toggle, custom filename)." },
      { q: "Is my file uploaded anywhere?", a: "No. All GZIP compression runs in your browser via the native CompressionStream API. File contents never leave your device. Only batch summaries (filenames + sizes) are saved to local history." },
      { q: "Does it work offline?", a: "Yes. CompressionStream is a browser-native API available in all modern browsers (Chrome 80+, Firefox 113+, Safari 16.4+). Once the page loads, no network access is required." },
    ],
  },
  status: "done",
};
