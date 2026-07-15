import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "rar-extractor",
  name: "RAR Extractor",
  description:
    "Inspect RAR archives (RAR4 and RAR5). Detects the RAR signature, parses archive headers, lists file entries with sizes and compression methods, and displays archive metadata. Honest about RAR extraction limitations — full decompression requires WASM. 100% client-side.",
  category: "file",
  keywords: [
    "rar extractor", "rar archive", "rar file",
    "extract rar", "rar viewer", "rar inspector",
    "rar4", "rar5", "rar-extractor", "unrar",
  ],
  icon: "file-archive",
  requiresNetwork: false,
  seo: {
    title: "RAR Extractor — Inspect .rar Files in Browser (RAR4 + RAR5) | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "It inspects RAR archives. The tool detects both RAR4 (7-byte signature 'Rar!\\x1a\\x07\\x00') and RAR5 (8-byte signature 'Rar!\\x1a\\x07\\x01\\x00') formats, parses the archive headers (MainArchiveHeader + per-file FileHeader), lists all file entries with their names, sizes, compression methods, and CRCs, and displays archive-level metadata (multi-volume, solid, recovery record, encryption)." },
      { q: "Can it extract files?", a: "Honest answer: No. RAR uses a proprietary compression algorithm (the spec is closed). A pure-JS implementation would be ~500KB+ of WASM. We parse the headers and list all file entries (you'll see every file inside the RAR with its size, method, and CRC), but cannot decompress file contents. For extraction, use a desktop tool like 7-Zip, The Unarchiver, WinRAR, or unrar." },
      { q: "What's the difference between RAR4 and RAR5?", a: "RAR4 (legacy): 7-byte signature, 13-byte main header, file headers with 2-byte sizes. RAR5 (modern, since 2013): 8-byte signature, variable-length vint-encoded header fields, supports AES-256 encryption, larger dictionary sizes (up to 64GB), better compression ratio. We detect and parse both formats correctly. RAR5 is the default for WinRAR 5.0+." },
      { q: "What information is shown per file?", a: "For each file entry: filename (UTF-8), uncompressed size, compressed size (RAR4 only — RAR5 doesn't store per-file compressed size in the file header directly), compression method (0=stored, 1-5=fastest to best in RAR4; 0-5 in RAR5), CRC32, modification date, whether the file is encrypted, and whether it's a directory. We also display the header offset for debugging." },
      { q: "What extra features does this tool have compared to others?", a: "10 extras: (1) Drag-drop file input. (2) RAR4 signature detection (7-byte magic). (3) RAR5 signature detection (8-byte magic). (4) File listing from header (filename, size, method, CRC). (5) Stats — file count, total sizes, largest file. (6) Compression method display per file. (7) Honest disclaimer displayed prominently. (8) Alternative suggestions (WinRAR, 7-Zip, The Unarchiver, unrar). (9) File info display (RAR version, archive flags — multi-volume, solid, recovery, encrypted). (10) History (localStorage — last 10 inspected RAR files)." },
      { q: "Is my RAR file uploaded anywhere?", a: "No. All RAR signature detection, header parsing, and file listing runs in your browser using pure JavaScript. File contents never leave your device. Only archive summaries (filename + entry count + RAR version) are saved to local history." },
      { q: "What's a 'solid' archive?", a: "A solid RAR archive compresses multiple files together as a single stream (rather than each file independently). This typically gives 5-15% better compression ratios for many small similar files, but extracting any single file requires decompressing all previous files. We display the solid flag if set. Solid archives are common for software distributions." },
      { q: "What's a 'recovery record'?", a: "A recovery record is extra error-correction data appended to a RAR archive so it can be repaired if corrupted (e.g., on a failing disk or bad network transfer). We display the flag if a recovery record is present. WinRAR can use the recovery record to repair damaged archives. We just detect it; we don't use it." },
    ],
  },
  status: "done",
};
