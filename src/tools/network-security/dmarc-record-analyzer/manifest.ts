/**
 * DMARC Record Analyzer — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "dmarc-record-analyzer",
  name: "DMARC Record Analyzer",
  description: "Analyze DMARC DNS records. Policy (none/quarantine/reject), alignment, reporting (RUA/RUF), percentage.",
  category: "network-security",
  keywords: ["dmarc analyzer", "dmarc record", "email authentication", "dmarc policy"],
  icon: "MailWarning",
  requiresNetwork: false,
  seo: {
    title: "DMARC Record Analyzer — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Analyze DMARC DNS records. Policy (none/quarantine/reject), alignment, reporting (RUA/RUF), percentage." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) DMARC record parser, (2) (2) Policy (p=none/quarantine/reject), (3) (3) Subdomain policy (sp), (4) (4) Alignment (relaxed/strict), (5) (5) Reporting (rua/ruf), (6) (6) Percentage (pct), (7) (7) Failure reporting options (fo), (8) (8) DKIM/SPF alignment check, (9) (9) Policy recommendation, (10) (10) Copy corrected record, (11) (11) Export report, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
