import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "tar-extractor",
  name: "TAR Extractor",
  description:
    "Extract files from .tar archives in the browser — pure JavaScript TAR parser (USTAR format), no WASM. File tree view, search, filter by type, preview text files, download individual files or all as ZIP. Shows file permissions and modification times. 100% client-side.",
  category: "file",
  keywords: [
    "tar extractor", "untar", "extract tar", "tar file", "tar archive",
    "ustar parser", "tar viewer", "tar reader", "tar to zip",
    "tar extractor online", "tar-extractor",
  ],
  icon: "file-archive",
  requiresNetwork: false,
  seo: {
    title: "TAR Extractor — Extract .tar Files in Browser (Pure JS) | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "It extracts files from TAR archives in your browser using a pure-JavaScript parser (no WASM, no native dependencies). Supports the USTAR format (POSIX IEEE P1003.2) including the magic field, prefix field for long paths, type flags for regular files / directories / symlinks / hard links, and octal-encoded size/mode/mtime/uid/gid fields. You can preview text files, download individual files, or download everything as a ZIP." },
      { q: "Does it support .tar.gz or .tar.bz2?", a: "For .tar.gz files, use our GZIP Decompressor tool which auto-extracts TAR archives after GZIP decompression. This tool accepts plain .tar files only — no compression layer. If you upload a .tar.gz here, you'll see a 'not a TAR archive' error. Run it through GZIP Decompressor first, or use the .tar.gz auto-extract mode there." },
      { q: "What TAR formats are supported?", a: "USTAR (the standard POSIX format with the 'ustar\\0' or 'ustar  \\0' magic at offset 257). This covers >99% of TAR files in the wild. GNU TAR (with L/K long-name records) and PAX TAR (with x/g extended headers) are partially supported — we read the long name records and use them, but ignore PAX key/value attributes." },
      { q: "Can I preview file contents?", a: "Yes. Click the eye icon next to any regular file to preview its first 8KB. Text files (UTF-8, UTF-16, ASCII) are shown as decoded text. Binary files are shown as a hex dump with ASCII gutter. The preview is read-only — extraction gives you the raw bytes." },
      { q: "How do I download all files at once?", a: "Click 'Download all as ZIP' to get a single .zip containing every regular file from the TAR archive. The ZIP uses STORE method (no compression) since the TAR is already extracted. Directories and symlinks are skipped (only regular files go into the ZIP)." },
      { q: "What extra features does this tool have compared to others?", a: "10 extras: (1) Drag-drop input. (2) File tree view — group files by directory. (3) Stats — file count, total extracted size, archive size, ratio. (4) Search files by name (case-insensitive). (5) Filter by file type (regular, directory, symlink, etc.). (6) Preview text files inline. (7) File permissions display (octal mode). (8) Batch download as ZIP. (9) History (localStorage — last 10 extracted archives). (10) Shareable URL with options." },
      { q: "Is my TAR file uploaded anywhere?", a: "No. All TAR parsing runs in your browser using pure JavaScript. File contents never leave your device. Only archive summaries (filename + entry count) are saved to local history." },
      { q: "What's the maximum TAR size?", a: "There's no hard limit, but very large archives (> 1GB) will use lots of memory because we parse the whole archive at once. For multi-GB files, consider splitting first. The browser's per-tab memory cap (~2-4GB) is the practical limit." },
    ],
  },
  status: "done",
};
