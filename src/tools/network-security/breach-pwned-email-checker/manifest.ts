/**
 * Breach Pwned Email Checker — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "breach-pwned-email-checker",
  name: "Breach Pwned Email Checker",
  description: "Check if your email has been breached. Uses k-anonymity model for privacy-preserving HIBP-style checks.",
  category: "network-security",
  keywords: ["breach checker", "pwned email", "have i been pwned", "email breach"],
  icon: "ShieldAlert",
  requiresNetwork: false,
  seo: {
    title: "Breach Pwned Email Checker — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Check if your email has been breached. Uses k-anonymity model for privacy-preserving HIBP-style checks." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) Email breach check, (2) (2) k-anonymity privacy model, (3) (3) Hash prefix search, (4) (4) Breach database (bundled, offline), (5) (5) Breach details (name, date, data classes), (6) (6) Multiple email batch check, (7) (7) Password breach check (SHA-1), (8) (8) Breach timeline, (9) (9) Export report, (10) (10) Copy results, (11) (11) PWA offline, (12) (12) No network for core check (bundled DB)" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "planned",
};
