import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ip-subnet-calculator",
  name: "IP Subnet Calculator",
  description:
    "Calculate IPv4 subnet details from CIDR notation — network address, broadcast, host range, mask, and host count. Supports both IP/CIDR and IP + subnet mask input.",
  category: "network-security",
  keywords: [
    "ip",
    "subnet",
    "cidr",
    "calculator",
    "ipv4",
    "network",
    "broadcast",
    "mask",
    "vlsm",
    "supernetting",
  ],
  icon: "network",
  requiresNetwork: false,
  seo: {
    title: "IP Subnet Calculator — IPv4 CIDR & Mask | UnQTools",
    faq: [
      {
        q: "What is CIDR notation?",
        a: "CIDR (Classless Inter-Domain Routing) notation is a compact way to represent an IP range. For example, 192.168.1.0/24 means the first 24 bits are the network portion and the last 8 bits are for hosts. The /24 corresponds to a subnet mask of 255.255.255.0.",
      },
      {
        q: "What inputs does this calculator accept?",
        a: "You can enter either CIDR notation (192.168.1.0/24) or an IP address with a separate subnet mask (192.168.1.0 + 255.255.255.0). The tool will compute network address, broadcast address, host range, total hosts, and usable hosts.",
      },
      {
        q: "Does it support IPv6?",
        a: "Currently only IPv4 is supported. IPv6 subnet calculation requires BigInt math (128-bit addresses) and will be added in a future update. For IPv6, the /64 boundary is the typical subnet size.",
      },
      {
        q: "What's the difference between total hosts and usable hosts?",
        a: "Total hosts = 2^(32-prefix). Usable hosts = total hosts - 2 (one for the network address, one for the broadcast address). For /31 and /32, the calculation is special per RFC 3021.",
      },
    ],
  },
  status: "done",
};
