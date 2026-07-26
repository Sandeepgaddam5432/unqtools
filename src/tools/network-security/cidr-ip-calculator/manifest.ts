/**
 * CIDR IP Calculator — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "cidr-ip-calculator",
  name: "CIDR IP Calculator",
  description: "Calculate IPv4 and IPv6 CIDR network info: network address, broadcast, host range, subnet mask, wildcard, host count. 100% offline.",
  category: "network-security",
  keywords: ["cidr calculator", "subnet calculator", "ip calculator", "ipv4 calculator", "ipv6 calculator"],
  icon: "Calculator",
  requiresNetwork: false,
  seo: {
    title: "CIDR IP Calculator — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Calculate IPv4 and IPv6 CIDR network info: network address, broadcast, host range, subnet mask, wildcard, host count. 100% offline." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely. It works offline as a PWA." },
      { q: "What extra features does this tool have?", a: "Extras: (1) IPv4 CIDR calculation (/0 to /32), (2) IPv6 CIDR calculation (/0 to /128), (3) Network address, broadcast, first/last host, host count, (4) Subnet mask, wildcard mask (IPv4), (5) CIDR to subnet mask and vice versa, (6) Subnet divider — split a /N into multiple /M subnets, (7) Supernet calculator — combine multiple subnets, (8) IP range generator (first..last), (9) IP type detection (private, loopback, multicast, reserved, link-local), (10) Reverse DNS (PTR) name generation, (11) IPv4 ↔ IPv6 mapping (IPv4-mapped IPv6, IPv4-compatible), (12) Copy individual values, export JSON" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network. All processing happens client-side." },
    ],
  },
  status: "done",
};
