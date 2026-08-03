/**
 * AES Encrypt/Decrypt — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "aes-encrypt-decrypt",
  name: "AES Encrypt/Decrypt",
  description: "AES-GCM/CBC encryption with PBKDF2 key derivation. 128/192/256-bit keys. WebCrypto API, fully client-side.",
  category: "developer",
  keywords: ["aes", "encrypt", "decrypt", "cipher", "AES-GCM", "AES-CBC", "PBKDF2", "password", "webcrypto", "encryption", "security"],
  icon: "Lock",
  requiresNetwork: false,
  seo: {
    title: "AES Encrypt/Decrypt — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Encrypts and decrypts text using AES (Advanced Encryption Standard) with PBKDF2 key derivation. Supports AES-GCM and AES-CBC modes with 128/192/256-bit keys." },
      { q: "Is my data sent to a server?", a: "No. All encryption happens in your browser using the WebCrypto API. Nothing is uploaded or tracked." },
      { q: "What is PBKDF2?", a: "PBKDF2 (Password-Based Key Derivation Function 2) converts your password into a strong encryption key. Higher iterations make brute-force attacks harder." },
      { q: "What cipher mode should I use?", a: "AES-GCM is recommended for most use cases — it provides authenticated encryption (detects tampering). AES-CBC is available for legacy compatibility." },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
