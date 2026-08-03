/**
 * SSL/TLS Certificate Validator — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ssl-tls-certificate-validator",
  name: "SSL/TLS Certificate Validator",
  description: "Validate SSL/TLS certificates. Check expiry, chain, hostname, and common misconfigurations.",
  category: "network-security",
  keywords: ["ssl certificate", "tls certificate", "certificate validator", "ssl check"],
  icon: "Lock",
  requiresNetwork: false,
  seo: {
    title: "SSL/TLS Certificate Validator — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Validate SSL/TLS certificates. Check expiry, chain, hostname, and common misconfigurations." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) Certificate parser (paste PEM), (2) (2) Expiry date check, (3) (3) Hostname validation, (4) (4) Chain validation, (5) (5) Key algorithm, (6) (6) Signature algorithm, (7) (7) SAN (Subject Alt Names), (8) (8) Common misconfigurations, (9) (9) Expiry countdown, (10) (10) Copy cert info, (11) (11) Export report, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "planned",
};
