import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "hash-generator",
  name: "Hash Generator",
  description:
    "Generate SHA-1, SHA-256, SHA-384, and SHA-512 hashes from text or files, with hex and Base64 output. Uses Web Crypto — 100% private.",
  category: "developer",
  keywords: ["hash", "sha1", "sha256", "sha384", "sha512", "checksum", "digest", "web crypto"],
  icon: "hash",
  requiresNetwork: false,
  seo: {
    title: "Hash Generator — SHA-1 / SHA-256 / SHA-512 | UnQTools",
    faq: [
      {
        q: "Which hashing algorithms are supported?",
        a: "SHA-1, SHA-256, SHA-384, and SHA-512 via the browser's native Web Crypto API. SHA-1 is included for legacy compatibility but should not be used for security-sensitive purposes — use SHA-256 or SHA-512.",
      },
      {
        q: "Can I hash files?",
        a: "Yes. Drop any file and it's hashed in a Web Worker using streaming chunked reads, so even multi-GB files work without memory issues. Files never leave your browser.",
      },
      {
        q: "Why not MD5?",
        a: "MD5 is cryptographically broken (collisions can be generated in seconds). Web Crypto doesn't expose it, and we don't ship a polyfill because no one should be using MD5 for any purpose in 2026.",
      },
    ],
  },
  status: "done",
};
