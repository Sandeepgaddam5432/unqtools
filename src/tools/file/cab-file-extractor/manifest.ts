import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "cab-file-extractor",
  name: "CAB File Extractor",
  description:
    "List and extract files from Microsoft Cabinet (.cab) archives in the browser — pure JavaScript MSCF parser. Lists folders and files with sizes/attributes, extracts stored (uncompressed) files, downloads all extractable files as a ZIP. 100% client-side.",
  category: "file",
  keywords: [
    "cab extractor", "cab viewer", "cab reader", "mscf",
    "microsoft cabinet", "cab file", "cab archive",
    "extract cab", "cab-extractor", "cab parser",
  ],
  icon: "file-archive",
  requiresNetwork: false,
  seo: {
    title: "CAB File Extractor — Extract .cab Files in Browser (Pure JS) | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "It parses Microsoft Cabinet (.cab) files in your browser using a pure-JavaScript MSCF parser. We list all folders and files with their sizes, attributes, and timestamps, and we extract files that are stored uncompressed (folder compression method 0). Compressed files (MSZIP, Quantum, or LZX) cannot be extracted in pure JS without a multi-KB decompressor blob, but we still show their metadata so you can see what's inside. You can download individual extracted files or all extractable files as a ZIP." },
      { q: "What is the CAB/MSCF format?", a: "CAB (Microsoft Cabinet) is a compressed archive format used by Windows Installer, Windows Update, and Internet Explorer downloads. The signature is 'MSCF' (4 bytes) at offset 0. The header (36 bytes) contains: signature, reserved1, total cabinet size, reserved2, files offset, reserved3, version (minor + major), number of folders, number of files, flags, set ID, and cabinet index. After the header (optionally extended with header data + reserved fields), the CFFOLDER entries describe each folder's compression method and offset. After the folders come CFFILE entries which describe each file's name, size, folder index, date, and attributes." },
      { q: "Why can't I extract compressed CAB files?", a: "Real-world .cab files usually use MSZIP (DEFLATE variant), Quantum (Lempel-Ziv + arithmetic coding), or LZX (variant of LZ77 + arithmetic). MSZIP is technically DEFLATE-compatible but with a 2-byte 'CK' header per block; LZX and Quantum are proprietary Microsoft algorithms requiring several KB of bit-level reader code. To stay within the per-tool 50KB bundle budget, we ship only stored (uncompressed) extraction. For compressed .cab files, use 7-Zip (desktop) or expand.exe (built into Windows) for full support." },
      { q: "What extra features does this tool have compared to others?", a: "10 extras: (1) Drag-drop input. (2) File list with size, date, attributes per file. (3) Search files by name (case-insensitive). (4) Filter by attribute (read-only, hidden, system, etc.). (5) Stats — file count, folder count, total size, compressed size, ratio. (6) Download individual files (when stored). (7) Download all stored files as ZIP. (8) Folder info panel — compression method, data offset, file count per folder. (9) History of recently inspected .cab files (localStorage — last 10). (10) Shareable URL with view options." },
      { q: "Is my .cab file uploaded anywhere?", a: "No. All MSCF parsing runs in your browser using pure JavaScript. File contents never leave your device. Only archive summaries (filename + file count) are saved to local history." },
      { q: "What about multi-volume CABs?", a: "CAB format supports multi-volume archives (split across multiple .cab files for floppy disks). We only parse the first cabinet in a set — if the flags indicate 'prev cabinet' or 'next cabinet', we note this and recommend using a desktop tool (7-Zip, IZArc) to reassemble and extract. The CFDATA of a single .cab file is fully self-contained for stored folders." },
    ],
  },
  status: "done",
};
