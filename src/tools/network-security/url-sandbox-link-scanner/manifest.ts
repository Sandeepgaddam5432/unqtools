/**
 * URL Sandbox Link Scanner — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "url-sandbox-link-scanner",
  name: "URL Sandbox Link Scanner",
  description: "Scan URLs for suspicious patterns. Generate sandboxed viewing links and check reputation references.",
  category: "network-security",
  keywords: ["url scanner", "link scanner", "url safety", "url sandbox"],
  icon: "Link2",
  requiresNetwork: false,
  seo: {
    title: "URL Sandbox Link Scanner — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Scan URLs for suspicious patterns. Generate sandboxed viewing links and check reputation references." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) URL pattern analysis, (2) (2) Suspicious TLD flagging, (3) (3) Punycode/IDN detection, (4) (4) URL shortener expansion check, (5) (5) IP-as-hostname flag, (6) (6) Excessive subdomains, (7) (7) Suspicious query params, (8) (8) Sandbox viewer URL generator (VirusTotal, urlscan.io, AnyRun), (9) (9) Bulk URL scan, (10) (10) Copy sandbox links, (11) (11) Export report, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
