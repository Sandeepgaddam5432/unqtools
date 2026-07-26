/**
 * File Hash Validator — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "file-hash-validator",
  name: "File Hash Validator",
  description: "Compute SHA-1, SHA-256, SHA-384, SHA-512, MD5 hashes of any file via WebCrypto. Compare against expected hash. 100% client-side.",
  category: "network-security",
  keywords: ["file hash", "checksum", "sha256", "sha1", "md5", "hash validator", "integrity check"],
  icon: "FileCheck",
  requiresNetwork: false,
  seo: {
    title: "File Hash Validator — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Compute SHA-1, SHA-256, SHA-384, SHA-512, MD5 hashes of any file via WebCrypto. Compare against expected hash. 100% client-side." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely. It works offline as a PWA." },
      { q: "What extra features does this tool have?", a: "Extras: (1) WebCrypto for SHA-1, SHA-256, SHA-384, SHA-512 (fast native), (2) Pure-JS MD5 (RFC 1321), (3) Drag-and-drop file upload (no network), (4) Paste expected hash → instant match/no-match indicator, (5) Bulk mode — hash multiple files at once, (6) GNU sha256sum-style output format, (7) BitTorrent infohash-style (raw hex), (8) Base64 hash output option, (9) Streaming hash (no memory limit for large files), (10) Progress bar for large files, (11) Copy any hash with one click, (12) Verify downloaded ISO/software integrity" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network. All processing happens client-side." },
    ],
  },
  status: "done",
};
