/**
 * Reverse IP Lookup — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "reverse-ip-lookup",
  name: "Reverse IP Lookup",
  description: "Find domains hosted on the same IP address. Reference tool with manual input and bulk processing.",
  category: "network-security",
  keywords: ["reverse ip", "reverse dns", "ip to domain", "reverse lookup"],
  icon: "Search",
  requiresNetwork: false,
  seo: {
    title: "Reverse IP Lookup — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Find domains hosted on the same IP address. Reference tool with manual input and bulk processing." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) IP to domain reference, (2) (2) Reverse DNS (PTR), (3) (3) Shared hosting explanation, (4) (4) Manual domain list input, (5) (5) Bulk IP lookup, (6) (6) ASN information, (7) (7) Hosting provider, (8) (8) IP history (manual), (9) (9) CSV import/export, (10) (10) Copy results, (11) (11) Export JSON, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
