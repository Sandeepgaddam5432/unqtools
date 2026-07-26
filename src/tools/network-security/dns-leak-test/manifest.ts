/**
 * DNS Leak Test — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "dns-leak-test",
  name: "DNS Leak Test",
  description: "Test for DNS leaks by generating unique subdomain queries. Detects if your DNS is leaking to ISP.",
  category: "network-security",
  keywords: ["dns leak", "dns leak test", "vpn dns leak", "dns privacy"],
  icon: "Network",
  requiresNetwork: false,
  seo: {
    title: "DNS Leak Test — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Test for DNS leaks by generating unique subdomain queries. Detects if your DNS is leaking to ISP." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) DNS leak detection method explanation, (2) (2) Unique subdomain generator, (3) (3) Manual test instructions, (4) (4) Leak detection logic (if using VPN), (5) (5) DNS server identification, (6) (6) Multiple resolver check, (7) (7) Test history (localStorage), (8) (8) VPN privacy checklist, (9) (9) Copy test URL, (10) (10) Export results, (11) (11) PWA offline, (12) (12) Educational resources" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
