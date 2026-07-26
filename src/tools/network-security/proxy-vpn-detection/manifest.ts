/**
 * Proxy VPN Detection Tool — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "proxy-vpn-detection",
  name: "Proxy VPN Detection Tool",
  description: "Detect if an IP is a known proxy, VPN, or Tor exit node. Offline database of known proxy ranges.",
  category: "network-security",
  keywords: ["proxy detection", "vpn detection", "tor detection", "ip reputation"],
  icon: "Eye",
  requiresNetwork: false,
  seo: {
    title: "Proxy VPN Detection Tool — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Detect if an IP is a known proxy, VPN, or Tor exit node. Offline database of known proxy ranges." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) Proxy detection, (2) (2) VPN detection, (3) (3) Tor exit node check, (4) (4) Datacenter IP detection, (5) (5) Residential IP check, (6) (6) Anonymous proxy flag, (7) (7) Satellite provider, (8) (8) Bulk IP check, (9) (9) Risk score, (10) (10) Export CSV, (11) (11) Copy results, (12) (12) PWA offline (bundled DB)" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
