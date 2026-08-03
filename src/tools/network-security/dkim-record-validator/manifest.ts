/**
 * DKIM Record Validator — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "dkim-record-validator",
  name: "DKIM Record Validator",
  description: "Validate DKIM DNS records. Check selector, public key, key length, and signing algorithm compatibility.",
  category: "network-security",
  keywords: ["dkim validator", "dkim record", "email authentication", "dkim check"],
  icon: "MailCheck",
  requiresNetwork: false,
  seo: {
    title: "DKIM Record Validator — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Validate DKIM DNS records. Check selector, public key, key length, and signing algorithm compatibility." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) DKIM record lookup (manual paste), (2) (2) Public key extraction, (3) (3) Key length validation, (4) (4) Signing algorithm check, (5) (5) Selector validation, (6) (6) Tag validation (v/k/s/h/t), (7) (7) Key rotation detection, (8) (8) Bulk selector check, (9) (9) Common misconfiguration warnings, (10) (10) Copy corrected record, (11) (11) Export report, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "planned",
};
