/**
 * SSL/TLS Cipher Suite Analyzer — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ssl-tls-cipher-suite-analyzer",
  name: "SSL/TLS Cipher Suite Analyzer",
  description: "Analyze SSL/TLS cipher suites. Check strength, key exchange, encryption, and MAC for each cipher.",
  category: "network-security",
  keywords: ["cipher suite", "tls cipher", "ssl cipher", "cipher analyzer"],
  icon: "Lock",
  requiresNetwork: false,
  seo: {
    title: "SSL/TLS Cipher Suite Analyzer — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Analyze SSL/TLS cipher suites. Check strength, key exchange, encryption, and MAC for each cipher." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) Cipher suite database (300+), (2) (2) Strength rating (weak/medium/strong), (3) (3) Key exchange algorithm, (4) (4) Encryption algorithm, (5) (5) MAC algorithm, (6) (6) TLS 1.0-1.3 support, (7) (7) PFS (Perfect Forward Secrecy), (8) (8) Search by name or hex code, (9) (9) Bulk cipher analysis, (10) (10) Copy cipher list, (11) (11) Export report, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
