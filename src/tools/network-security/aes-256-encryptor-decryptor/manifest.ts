/**
 * AES-256 Encryptor/Decryptor — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "aes-256-encryptor-decryptor",
  name: "AES-256 Encryptor / Decryptor",
  description:
    "Encrypt and decrypt text with AES-256-GCM via the Web Crypto API. PBKDF2 key derivation, salt + IV, and 10+ extras. 100% private — runs in your browser.",
  category: "network-security",
  keywords: ["aes", "aes-256", "encrypt", "decrypt", "encryption", "cipher", "gcm", "pbkdf2", "web crypto"],
  icon: "lock",
  requiresNetwork: false,
  seo: {
    title: "AES-256 Encryptor / Decryptor — GCM + PBKDF2 | UnQTools",
    faq: [
      { q: "Is this encryption secure?", a: "Yes. Uses the browser's native Web Crypto API: AES-256-GCM (authenticated encryption) with PBKDF2 key derivation (210,000 iterations per OWASP 2023). Random salt + IV per encryption. Never use broken algorithms like AES-ECB or MD5-based keys." },
      { q: "What extras does this tool have?", a: "Extras: (1) AES-256-GCM (recommended), (2) AES-256-CBC option, (3) PBKDF2 iterations selector (100k–1M), (4) SHA-256/384/512 hash for key derivation, (5) Salt + IV visible in output, (6) Base64 output, (7) Hex output, (8) Encrypt mode, (9) Decrypt mode, (10) Copy individual fields, (11) Download as .enc file, (12) Show key derivation time, (13) Password strength indicator, (14) Self-test: encrypt then decrypt round-trip." },
    ],
  },
  status: "done",
};
