import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "file-hash-checker",
  name: "File Hash Checker",
  description:
    "Compute MD5, SHA-1, SHA-256, SHA-512, and CRC32 checksums of any file. Verify against expected hash, parse SHASUMS files, batch hash multiple files, and export manifests. 100% client-side, unlimited size.",
  category: "file",
  keywords: [
    "file hash", "checksum", "sha256", "md5", "sha1", "sha512", "crc32",
    "verify", "integrity", "shasums", "checksum file", "file hash checker",
  ],
  icon: "hash",
  requiresNetwork: false,
  seo: {
    title: "File Hash Checker — MD5/SHA-256/SHA-512 Checksums | UnQTools",
    faq: [
      { q: "What is a file hash?", a: "A file hash (checksum) is a fixed-size string computed from the file's contents. If even one byte changes, the hash changes completely. Hashes are used to verify file integrity — e.g. confirming a downloaded file matches the publisher's original." },
      { q: "Which hash algorithms are supported?", a: "SHA-256 (recommended), SHA-512, SHA-384, SHA-1 (deprecated), MD5 (deprecated), and CRC32 (non-cryptographic). All are computed simultaneously — no need to select one at a time." },
      { q: "Can I verify a file against a known hash?", a: "Yes. Paste the expected hash and the tool auto-detects the algorithm from the hash length (MD5=32, SHA-1=40, SHA-256=64, SHA-512=128 hex chars). You'll see a clear ✅ MATCH or ❌ NO MATCH banner." },
      { q: "What extra features does this tool have?", a: "10 extras: (1) All algorithms computed at once. (2) SHASUMS/checksum file parser. (3) Batch hash multiple files. (4) CSV/JSON export of batch results. (5) History (localStorage). (6) Hash format options (hex/upper/base64). (7) File comparison (are two files identical?). (8) Hash diff visualization (highlight differing chars). (9) HMAC mode with key. (10) Manifest generator for folder integrity." },
      { q: "Is my file uploaded anywhere?", a: "No. All hashing runs in your browser using WebCrypto (SHA family) and pure-JS implementations (MD5/CRC32). Your file never leaves your device." },
      { q: "Why are MD5 and SHA-1 marked as deprecated?", a: "MD5 and SHA-1 have known collision attacks — two different files can produce the same hash. They're shown for legacy compatibility (many old checksum files use them) but should not be used for new integrity verification. Use SHA-256 or SHA-512 instead." },
    ],
  },
  status: "done",
};
