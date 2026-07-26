/**
 * DNSSEC Validator — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "dnssec-validator",
  name: "DNSSEC Validator",
  description: "Validate DNSSEC configuration. Check DS records, RRSIG, NSEC, and trust chain.",
  category: "network-security",
  keywords: ["dnssec validator", "dnssec check", "dns security", "dnssec"],
  icon: "ShieldCheck",
  requiresNetwork: false,
  seo: {
    title: "DNSSEC Validator — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Validate DNSSEC configuration. Check DS records, RRSIG, NSEC, and trust chain." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) DNSSEC validation logic, (2) (2) DS record parser, (3) (3) RRSIG validation, (4) (4) NSEC/NSEC3 check, (5) (5) Trust chain verification, (6) (6) Key tag calculation, (7) (7) Algorithm support check, (8) (8) Bulk domain check, (9) (9) Common misconfiguration warnings, (10) (10) Copy DS record, (11) (11) Export report, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
