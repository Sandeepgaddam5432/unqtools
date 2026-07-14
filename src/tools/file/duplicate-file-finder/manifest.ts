import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "duplicate-file-finder",
  name: "Duplicate File Finder",
  description:
    "Find duplicate files by comparing sizes and SHA-256 hashes. Drop multiple files, see which are identical, group duplicates, and export results. Partial-hash (first 4KB) for speed, full-hash for confirmation. 100% client-side.",
  category: "file",
  keywords: [
    "duplicate files", "find duplicates", "duplicate finder", "dedupe files",
    "sha256 files", "file hash compare", "identical files", "duplicate cleaner",
    "file size compare", "duplicate file finder",
  ],
  icon: "copy-check",
  requiresNetwork: false,
  seo: {
    title: "Duplicate File Finder — SHA-256 File Deduplication | UnQTools",
    faq: [
      { q: "What does the Duplicate File Finder do?", a: "It scans the files you drop, groups them by size, and for any files sharing a size, computes a SHA-256 hash to confirm whether they are byte-for-byte identical. You get a list of duplicate groups with file paths, sizes, and how much space you'd save by removing the extras." },
      { q: "Why does it use a partial hash first?", a: "Computing SHA-256 on large files is slow. We hash only the first 4KB of each file as a quick filter — only if two files share both their size AND their first-4KB hash do we compute the full SHA-256 to confirm. This makes scanning 100s of files dramatically faster." },
      { q: "What hash algorithm is used?", a: "SHA-256 via the browser's built-in WebCrypto API. This is the same primitive used for file integrity verification and TLS certificates." },
      { q: "Can I delete the duplicates?", a: "Yes, on Chromium browsers with the File System Access API you can open a folder and delete the duplicate files in-place. On other browsers, you can export the duplicate list (CSV or JSON) and delete manually." },
      { q: "What extra features does this tool have?", a: "10 extras: (1) Drag-drop multiple files at once. (2) Progress bar during scan. (3) Partial-hash (first 4KB) quick filter. (4) Full-hash confirmation only when needed. (5) Live stats (total files, duplicates found, space saved). (6) Filter by size threshold (ignore files < N KB). (7) Sort by size / name / date. (8) Export as CSV or JSON. (9) History (localStorage — last 10 scans). (10) Shareable URL with scan settings." },
      { q: "Are my files uploaded anywhere?", a: "No. All hashing runs in your browser using WebCrypto. Your files never leave your device." },
      { q: "What's the maximum number of files?", a: "There's no hard limit, but scanning 1000+ large files may take a while and use significant memory. We process files in chunks and show progress." },
    ],
  },
  status: "done",
};
