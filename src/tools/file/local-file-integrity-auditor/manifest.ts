import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "local-file-integrity-auditor",
  name: "File Integrity Auditor",
  description:
    "Create and verify SHA-256 hash manifests for folders — detect added, modified, or deleted files. Multi-algorithm support, exclude patterns, CSV/JSON export, manifest diff visualization. 100% client-side.",
  category: "file",
  keywords: [
    "file integrity", "hash manifest", "sha256 manifest", "verify files",
    "detect changes", "modified files", "added files", "deleted files",
    "checksum manifest", "folder audit", "file integrity auditor",
  ],
  icon: "file-check",
  requiresNetwork: false,
  seo: {
    title: "File Integrity Auditor — SHA-256 Folder Manifests | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "It scans a folder of files and produces a hash manifest — a list of file paths paired with their SHA-256 (or SHA-1, SHA-512, MD5) hashes. Later, you can re-scan the same folder and verify the manifest to detect which files were added, modified, or deleted." },
      { q: "How do I scan a folder?", a: "Use the 'Pick folder' button (Chrome / Edge / Firefox 100+ support directory picking via webkitdirectory). On browsers without directory support, drag-drop a folder or pick multiple files manually. Every file is hashed via WebCrypto — large files stream in chunks of 4 MB to avoid memory blowup." },
      { q: "What is a manifest?", a: "A JSON or CSV file containing the relative path, size, last-modified date, and hash of every file in the audited folder. Save it once, and you can re-import it later to verify the folder's current state against the original baseline." },
      { q: "Which algorithms are supported?", a: "SHA-256 (default, recommended), SHA-512, SHA-1, MD5. SHA-1 and MD5 are deprecated for cryptographic integrity but remain available for legacy manifest verification. Switch the algorithm in the options before creating a manifest." },
      { q: "Can I exclude files?", a: "Yes. Use glob-style exclude patterns like *.log, .git/*, node_modules/*, *.tmp. Patterns match against the relative path. Multiple patterns can be combined with commas." },
      { q: "What extra features does this tool have compared to others?", a: "10 extras: (1) Drag-drop folder. (2) Progress bar showing files processed / total. (3) Multiple hash algorithms (SHA-256/SHA-512/SHA-1/MD5). (4) Manifest stats — file count, total size, average size. (5) File filter — show only added / modified / deleted / unchanged. (6) Exclude patterns (glob-style). (7) Manifest diff visualization — color-coded rows for added (green), modified (amber), deleted (red). (8) Copy changed-files list as plain text. (9) History of recent audits (localStorage). (10) Shareable URL encoding algorithm + exclude patterns." },
      { q: "Is my data uploaded anywhere?", a: "No. All hashing runs in your browser via WebCrypto. File contents never leave your device. Only the manifest (paths + hashes) is saved if you choose to export or save to history." },
      { q: "How big a folder can I audit?", a: "There's no hard limit — we hash files in 4 MB chunks via streaming, so even multi-GB files work. Very large folders (10,000+ files) will take a while; the progress bar keeps you informed." },
    ],
  },
  status: "done",
};
