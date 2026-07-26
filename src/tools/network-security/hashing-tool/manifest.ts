/**
 * Hashing Tool — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "hashing-tool",
  name: "Hashing Tool",
  description:
    "Compute MD5, SHA-1, SHA-256/384/512 and HMAC all at once — for text or streamed files — 100% in-browser via WebCrypto. Includes input/output encoding, compare-to-expected, and security flags on broken hashes (MD5/SHA-1).",
  category: "network-security",
  keywords: [
    "hash generator",
    "md5 generator",
    "sha256 online",
    "hmac generator",
    "online hashing tool",
    "sha1",
    "sha512",
    "file hash",
    "checksum",
    "integrity",
  ],
  icon: "Hash",
  requiresNetwork: false,
  seo: {
    title: "Hashing Tool — MD5, SHA-1, SHA-256/512 & HMAC, All At Once, Offline | UnQTools",
    faq: [
      {
        q: "Which hash algorithms does this tool compute?",
        a: "MD5 (128-bit), SHA-1 (160-bit), SHA-256 (256-bit), SHA-384, and SHA-512 — all simultaneously, for any text or file you paste or drop. HMAC mode (HMAC-SHA-256/384/512) is also supported. The SHA family uses the browser's native WebCrypto API; MD5 is implemented in pure JavaScript per RFC 1321 because WebCrypto dropped MD5 support.",
      },
      {
        q: "Is MD5 / SHA-1 safe to use?",
        a: "No, not for security. MD5 and SHA-1 are cryptographically broken — collisions are practical. They are flagged as 'broken — checksum only' in this tool. Use them only for non-security checksums (file identity, change detection). For password hashing, integrity of signed data, or any security-sensitive purpose, use SHA-256 or stronger (or a password-hash like bcrypt/argon2).",
      },
      {
        q: "Can this tool hash files? How big?",
        a: "Yes. Files are read as ArrayBuffer and hashed via WebCrypto.subtle.digest. Large files (>100 MB) are processed in a single chunk in this build — hashing is synchronous on the bytes, but happens off-main-thread thanks to WebCrypto. Very large files (multi-GB) may take a few seconds but won't freeze your tab. Files never leave your browser.",
      },
      {
        q: "What input encodings are supported?",
        a: "UTF-8 (default), Hex, and Base64. The input bytes are decoded according to your selected encoding before hashing. Output can be displayed as lowercase hex (default) or Base64. You can also normalize Unicode (NFC) before hashing to avoid surprising cross-tool mismatches.",
      },
      {
        q: "What extras does this tool include?",
        a: "(1) All five algorithms computed at once. (2) HMAC mode for SHA-256/384/512 with any key. (3) File drop-or-pick hashing. (4) Input encoding selector (UTF-8 / Hex / Base64). (5) Output encoding selector (Hex / Base64). (6) Compare-to-expected with case-insensitive match. (7) Per-row copy. (8) Download all hashes as .txt or CSV. (9) Empty-string reference hashes shown by default. (10) Security warnings on MD5/SHA-1. (11) Hash-length auto-detection from expected value. (12) Auto-detect matching algorithm against expected. (13) Unicode NFC normalization toggle. (14) No network — pure client-side.",
      },
      {
        q: "How does the compare-to-expected feature work?",
        a: "Paste the expected hash (hex or Base64) into the Compare field. The tool normalizes both sides (strips spaces, colons, dashes; lowercases) and flags which computed algorithm matches. If you paste an expected hash without naming the algorithm, the length-based auto-detector (32 hex chars = MD5, 40 = SHA-1, 64 = SHA-256, etc.) suggests the right one.",
      },
      {
        q: "What are the known empty-string hashes?",
        a: "MD5 = d41d8cd98f00b204e9800998ecf8427e, SHA-1 = da39a3ee5e6b4b0d3255bfef95601890afd80709, SHA-256 = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855, SHA-384 = 38b060a751ac96384cd9327eb1b1e36a21fdb71114be07434c0cc7bf63f6e1da274edebfe76f65fbd51ad2f14898b95b, SHA-512 = cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e. These appear when input is empty so you can sanity-check the implementation.",
      },
      {
        q: "Is my text or file sent anywhere?",
        a: "No. All hashing runs locally via window.crypto.subtle and an in-page MD5 implementation. Text and file bytes never leave your browser. There is no upload, no server, no logging — this works fully offline and is installable as a PWA.",
      },
    ],
  },
  status: "done",
};
