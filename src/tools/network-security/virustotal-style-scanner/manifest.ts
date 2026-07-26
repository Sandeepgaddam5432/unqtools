/**
 * VirusTotal-style Online Scanner Reference — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "virustotal-style-scanner",
  name: "VirusTotal-style Online Scanner Reference",
  description: "Reference tool for multi-engine URL/file scanning. Generate links to VirusTotal, Hybrid Analysis, etc.",
  category: "network-security",
  keywords: ["virustotal", "url scan", "file scan", "malware scan"],
  icon: "ShieldAlert",
  requiresNetwork: false,
  seo: {
    title: "VirusTotal-style Online Scanner Reference — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Reference tool for multi-engine URL/file scanning. Generate links to VirusTotal, Hybrid Analysis, etc." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) Multi-scanner URL generator, (2) (2) VirusTotal URL, (3) (3) Hybrid Analysis URL, (4) (4) urlscan.io URL, (5) (5) AnyRun URL, (6) (6) VirusTotal file hash search, (7) (7) Hybrid Analysis file hash, (8) (8) Malware Bazaar, (9) (9) URLhaus, (10) (10) Copy scan URLs, (11) (11) Open in new tab, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
