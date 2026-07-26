/**
 * MAC Address Vendor Lookup — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "mac-address-vendor-lookup",
  name: "MAC Address Vendor Lookup",
  description: "Look up the vendor/manufacturer of any MAC address against the IEEE OUI database. Supports all MAC formats. 100% offline.",
  category: "network-security",
  keywords: ["mac address lookup", "oui lookup", "vendor lookup", "ieee oui", "mac vendor"],
  icon: "Network",
  requiresNetwork: false,
  seo: {
    title: "MAC Address Vendor Lookup — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Look up the vendor/manufacturer of any MAC address against the IEEE OUI database. Supports all MAC formats. 100% offline." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely. It works offline as a PWA." },
      { q: "What extra features does this tool have?", a: "Extras: (1) IEEE OUI database (top 500+ vendors bundled), (2) All MAC formats supported (colon, dash, dot, none), (3) Vendor name, address, country, registry (MA-L, MA-M, MA-S, IAB), (4) Locally-administered bit detection (LAM), (5) Multicast bit detection, (6) Universal vs Local classification, (7) Random MAC generator (with optional Apple/Google prefix), (8) Bulk lookup (one MAC per line), (9) Reverse lookup — vendor name → OUI prefixes, (10) Export as CSV/JSON, (11) Copy individual fields, (12) Privacy: all lookups happen locally, no network" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network. All processing happens client-side." },
    ],
  },
  status: "done",
};
