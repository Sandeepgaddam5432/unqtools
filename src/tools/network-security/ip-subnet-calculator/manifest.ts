import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ip-subnet-calculator",
  name: "IP Subnet Calculator",
  description:
    "IPv4 + IPv6 subnet calculator with CIDR/mask notation, VLSM subnetting, range↔CIDR conversion, CIDR merge, containment check, PTR lookup, wildcard mask, binary view, and CSV/JSON export. 100% client-side.",
  category: "network-security",
  keywords: [
    "ip", "subnet", "cidr", "calculator", "ipv4", "ipv6",
    "network", "broadcast", "mask", "vlsm", "supernetting",
    "wildcard", "ptr", "reverse dns", "cidr merge",
  ],
  icon: "network",
  requiresNetwork: false,
  seo: {
    title: "IP Subnet Calculator — IPv4/IPv6, VLSM, CIDR Merge | UnQTools",
    faq: [
      {
        q: "What is CIDR notation?",
        a: "CIDR (Classless Inter-Domain Routing) notation is a compact way to represent an IP range. For example, 192.168.1.0/24 means the first 24 bits are the network portion and the last 8 bits are for hosts. The /24 corresponds to a subnet mask of 255.255.255.0.",
      },
      {
        q: "Does this tool support IPv6?",
        a: "Yes — full IPv6 support using BigInt math (128-bit addresses). Calculate subnets from /0 to /128, detect special ranges (loopback ::1, link-local fe80::/10, unique local fc00::/7, multicast ff00::/8), generate PTR record names, and compute host counts (which can be astronomically large — e.g. /64 has 18 quintillion addresses).",
      },
      {
        q: "What is VLSM subnetting?",
        a: "Variable-Length Subnet Masking (VLSM) lets you split a network into subnets of different sizes, allocating larger subnets to segments that need more hosts. Enter your base network (e.g. 192.168.1.0/24) and the host counts for each segment (e.g. [50, 25, 10]), and the tool will assign the smallest fitting prefix to each, sorted largest-first.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "Beyond basic subnet math, we ship: (1) Subnet history (localStorage, last 20). (2) Cisco ACL wildcard mask conversion (inverted mask). (3) Reverse DNS (PTR) record name generation for IPv4 (in-addr.arpa) and IPv6 (ip6.arpa). (4) ASN whois + RIPEstat lookup URLs. (5) CIDR ↔ IP range conversion (range-to-CIDR aggregation). (6) CIDR merge — combine multiple CIDRs into the minimal covering set. (7) Subnet containment check — does parent CIDR contain child CIDR? (8) Binary view of IPv4 addresses and masks (32-bit). (9) CSV/JSON export of subnet details. (10) Shareable URL — encode input in fragment.",
      },
      {
        q: "What's the difference between total hosts and usable hosts?",
        a: "Total hosts = 2^(32-prefix) for IPv4, 2^(128-prefix) for IPv6. Usable hosts = total - 2 (one for the network address, one for the broadcast address). For IPv4 /31 and /32, special handling per RFC 3021. For IPv6 /127 and /128, special handling per RFC 6164. IPv6 doesn't technically require reserving network/broadcast addresses, but we follow the conservative convention.",
      },
      {
        q: "Is my subnet calculation sent anywhere?",
        a: "No. All subnet math (IPv4 bitwise + IPv6 BigInt) is done locally in your browser. No network requests are made. The whois/RIPEstat links are just URL generators — clicking them opens a new tab to those services, but the calculation itself never leaves your device.",
      },
    ],
  },
  status: "done",
};
