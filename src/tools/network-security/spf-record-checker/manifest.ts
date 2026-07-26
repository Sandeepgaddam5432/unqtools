/**
 * SPF Record Checker — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "spf-record-checker",
  name: "SPF Record Checker",
  description: "Check SPF (Sender Policy Framework) DNS records. Validate include, a, mx, ip4, ip6, and ~all/-all.",
  category: "network-security",
  keywords: ["spf record", "spf checker", "sender policy framework", "email authentication"],
  icon: "MailCheck",
  requiresNetwork: false,
  seo: {
    title: "SPF Record Checker — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Check SPF (Sender Policy Framework) DNS records. Validate include, a, mx, ip4, ip6, and ~all/-all." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) SPF record parser, (2) (2) Include mechanism check, (3) (3) a/mx mechanism, (4) (4) ip4/ip6 mechanism, (5) (5) all qualifier (~all/-all/?all/+all), (6) (6) DNS lookup count (10 max), (7) (7) Common misconfiguration warnings, (8) (8) Bulk domain check, (9) (9) Copy corrected record, (10) (10) Export report, (11) (11) SPF record generator, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
