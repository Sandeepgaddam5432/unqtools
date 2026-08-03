/**
 * WHOIS Domain Checker (Reference) — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "whois-domain-checker",
  name: "WHOIS Domain Checker (Reference)",
  description: "Generate WHOIS lookup commands and reference for domain registration info.",
  category: "network-security",
  keywords: ["whois", "domain whois", "whois lookup", "domain info"],
  icon: "Search",
  requiresNetwork: false,
  seo: {
    title: "WHOIS Domain Checker (Reference) — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Generate WHOIS lookup commands and reference for domain registration info." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) WHOIS command generator, (2) (2) Linux/macOS whois, (3) (3) Windows Sysinternals whois, (4) (4) RDAP URL generator, (5) (5) WHOIS fields reference, (6) (6) TLD-specific WHOIS servers, (7) (7) Bulk domain check, (8) (8) Expiry date extraction helper, (9) (9) Copy commands, (10) (10) Export domain list, (11) (11) PWA offline, (12) (12) Educational resources" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "planned",
};
