/**
 * Traceroute Online (Reference) — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "traceroute-online",
  name: "Traceroute Online (Reference)",
  description: "Reference tool for traceroute. Generate traceroute commands and understand network paths.",
  category: "network-security",
  keywords: ["traceroute", "trace route", "network path", "traceroute command"],
  icon: "Route",
  requiresNetwork: false,
  seo: {
    title: "Traceroute Online (Reference) — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Reference tool for traceroute. Generate traceroute commands and understand network paths." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) traceroute command generator, (2) (2) Linux/macOS (traceroute), (3) (3) Windows (tracert), (4) (4) mtr command, (5) (5) Common hop analysis, (6) (6) Network path explanation, (7) (7) ASN per hop lookup, (8) (8) Hop count estimator, (9) (9) Copy commands, (10) (10) Export report, (11) (11) PWA offline, (12) (12) Educational resources" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "planned",
};
