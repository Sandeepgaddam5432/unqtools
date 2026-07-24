/**
 * Hash Verifier — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "hash-verifier",
  name: "File Hash Verifier",
  description:
    "Verify file integrity by computing and comparing hashes (MD5, SHA-1, SHA-256, SHA-384, SHA-512). Drag-drop, expected-hash input, batch mode, and 10+ extras. 100% private.",
  category: "network-security",
  keywords: ["hash verifier", "file hash", "checksum", "md5", "sha-256", "sha-512", "file integrity", "verify hash"],
  icon: "file-check",
  requiresNetwork: false,
  seo: {
    title: "File Hash Verifier — MD5/SHA-1/SHA-256/SHA-512 + Compare | UnQTools",
    faq: [
      { q: "Why verify file hashes?", a: "Hash verification confirms file integrity after download. If the computed hash matches the publisher's expected hash, the file hasn't been corrupted or tampered with. Always verify ISO images, software installers, and sensitive documents." },
      { q: "What extras does this tool have?", a: "Extras: (1) MD5, SHA-1, SHA-256, SHA-384, SHA-512 all at once, (2) Compare against expected hash (any algorithm), (3) Drag-drop file input, (4) Batch mode (multiple files), (5) Show file size + type, (6) Hash-length detection (auto-identify algorithm from length), (7) Copy individual hashes, (8) CSV export of batch results, (9) Uppercase/lowercase toggle, (10) Show progress for large files, (11) Verify against hashlist file, (12) Generate hashlist file (.sha256sum format), (13) Multi-file compare, (14) Show mismatch warnings." },
    ],
  },
  status: "done",
};
