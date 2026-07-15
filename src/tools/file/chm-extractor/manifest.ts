import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "chm-extractor",
  name: "CHM Extractor",
  description:
    "List and inspect Microsoft Compiled HTML Help (.chm) files in the browser — pure JavaScript ITSF + directory parser. View file tree (HTML files, images, index), detect file types, download individual uncompressed files. 100% client-side.",
  category: "file",
  keywords: [
    "chm extractor", "chm viewer", "chm reader", "compiled html help",
    "itsf parser", "chm browser", "chm inspector", "windows help file",
    "chm file list", "chm-extractor",
  ],
  icon: "file-archive",
  requiresNetwork: false,
  seo: {
    title: "CHM Extractor — Inspect Microsoft .chm Files in Browser (Pure JS) | UnQTools",
    faq: [
      { q: "What is a CHM file?", a: "CHM (Compiled HTML Help) is Microsoft's proprietary help file format used by Windows applications from 1997 onward. A CHM file contains: HTML files, images, an index, a table of contents, and optional search data — all compressed with Microsoft's LZX algorithm and packaged in an ITSF (Information Technology Stored Format) container." },
      { q: "How does this tool work?", a: "We parse the ITSF container header (96 bytes for v3) and the directory chunks (PMGL format with ENCINT variable-length integers). The directory is stored UNCOMPRESSED in the file, so we can list every file inside the CHM without needing LZX decompression. For file content extraction: most CHM content is LZX-compressed, which we cannot decompress in pure JavaScript without a 200+ KB WASM blob. We CAN extract files that are stored uncompressed (rare but possible). For LZX-compressed content, we document this as an honesty-clause limitation." },
      { q: "Why can't I extract most files?", a: "LZX is a complex compression format used by Microsoft (also used in WIM images and Xbox Live downloads). A pure-JS implementation is ~200+ KB, which would blow our 50 KB per-tool budget. We parse the file listing and metadata completely, but actual file extraction is limited to: (1) uncompressed content sections (rare), (2) individual file download for inspection. To extract all files, use 7-Zip (desktop) which supports LZX." },
      { q: "What does the file tree show?", a: "Every file path inside the CHM, organized as a directory tree. Common paths include: / (root HTML files), /images/, /styles/, / (hhk = index, hhc = table of contents). You can search by name, filter by extension (.html, .css, .png, .js), preview small text files, and download individual files when extractable." },
      { q: "What are the ITSF, ITSP, PMGL signatures?", a: "CHM uses a series of 4-byte ASCII signatures to mark structures: 'ITSF' (Information Technology Stored Format — the file header), 'ITSP' (Information Technology Stored Properties — the directory header), 'PMGL' (Listing chunk — contains file entries), 'PMGI' (Index chunk — directory navigation), 'LZXC' (LZX compressed content section), 'UNCOMP' (uncompressed content section, rare). We parse all of these signatures to walk the file structure." },
      { q: "What extra features does this tool have compared to others?", a: "10 extras: (1) Drag-drop input. (2) File tree grouped by directory. (3) Search files by name. (4) Filter by file type (HTML, CSS, JS, image, etc.). (5) Stats — file count, total uncompressed size (estimated from directory metadata), directory count. (6) Preview text files inline (when extractable). (7) Download individual files (when content section is uncompressed). (8) Download all as ZIP (re-zip STORE method, when all files are extractable). (9) File type detection + extension summary. (10) History of recently inspected CHMs (localStorage — last 10)." },
      { q: "Is my CHM uploaded anywhere?", a: "No. All ITSF + directory parsing runs in your browser using pure JavaScript. File metadata never leaves your device. Only archive summaries (filename + entry count) are saved to local history." },
      { q: "Can I run .exe or .dll files from a CHM?", a: "We list any .exe/.dll files in the CHM but you cannot execute them — browsers don't have that capability, and even if extracted, running executables from untrusted help files is a security risk. Microsoft has deprecated CHM as a help format (partly due to security issues with embedded executables). Use this tool for inspection only." },
    ],
  },
  status: "done",
};
