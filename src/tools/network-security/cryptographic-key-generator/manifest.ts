/**
 * Cryptographic Key Generator (AES/RSA/ECDSA) — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "cryptographic-key-generator",
  name: "Cryptographic Key Generator (AES/RSA/ECDSA)",
  description: "Generate cryptographic keys for AES, RSA, ECDSA, Ed25519 using WebCrypto. Export in PEM/JWK/raw formats.",
  category: "network-security",
  keywords: ["cryptographic key", "aes key", "rsa key", "ecdsa key", "ed25519"],
  icon: "KeyRound",
  requiresNetwork: false,
  seo: {
    title: "Cryptographic Key Generator (AES/RSA/ECDSA) — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Generate cryptographic keys for AES, RSA, ECDSA, Ed25519 using WebCrypto. Export in PEM/JWK/raw formats." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) AES-128/192/256 key generation, (2) (2) RSA 2048/4096 key pair, (3) (3) ECDSA P-256/P-384/P-521, (4) (4) Ed25519 key pair, (5) (5) PEM export (PKCS#8/SPKI), (6) (6) JWK export, (7) (7) Raw hex/base64 export, (8) (8) Key fingerprint (SHA-256), (9) (9) Bulk generation, (10) (10) Copy key, (11) (11) Export key file, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
