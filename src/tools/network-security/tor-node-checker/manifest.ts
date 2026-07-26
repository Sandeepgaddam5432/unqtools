/**
 * Tor Node Checker — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "tor-node-checker",
  name: "Tor Node Checker",
  description: "Check if an IP is a known Tor exit node. Reference database of Tor exit relays.",
  category: "network-security",
  keywords: ["tor node", "tor check", "tor exit node", "onion router"],
  icon: "Eye",
  requiresNetwork: false,
  seo: {
    title: "Tor Node Checker — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Check if an IP is a known Tor exit node. Reference database of Tor exit relays." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) Tor exit node check, (2) (2) Bulk IP check, (3) (3) Tor relay type (exit/guard/middle), (4) (4) Bulk IP check, (5) (5) Onionoo URL generator, (6) (6) Tor usage detection, (7) (7) Privacy recommendations, (8) (8) History (localStorage), (9) (9) Export CSV, (10) (10) Copy results, (11) (11) PWA offline (bundled DB), (12) (12) Educational resources" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
