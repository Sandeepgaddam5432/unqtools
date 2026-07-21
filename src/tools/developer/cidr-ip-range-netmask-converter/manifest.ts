/**
 * CIDR ↔ IP Range / Netmask Converter — Tool Manifest.
 * Tool #383 — Category 4 (Developer & Code).
 *
 * Convert in every direction between CIDR notation, IP range (start–end),
 * netmask (dotted decimal), and wildcard mask. Supports both IPv4 (32-bit)
 * and IPv6 (128-bit). Decomposes any IP range into the minimal exact set
 * of CIDR blocks. Batch conversion of many CIDRs or ranges at once.
 * 100% client-side, no network.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "cidr-ip-range-netmask-converter",
  name: "CIDR ↔ IP Range / Netmask Converter",
  description:
    "Convert in every direction between CIDR notation, IP range (start–end), netmask (dotted decimal), and wildcard mask. Decompose any IP range into the minimal exact set of CIDR blocks. Supports both IPv4 and IPv6 with batch conversion of many CIDRs or ranges. 100% client-side.",
  category: "developer",
  keywords: [
    "cidr to ip range", "ip range to cidr", "netmask to cidr",
    "subnet mask converter", "wildcard mask calculator", "cidr converter",
    "ip range converter", "minimal cidr blocks", "batch cidr",
    "ipv4 ipv6 cidr", "netmask wildcard",
  ],
  icon: "network",
  requiresNetwork: false,
  seo: {
    title: "CIDR ↔ IP Range / Netmask Converter — IPv4 + IPv6, Batch | UnQTools",
    faq: [
      {
        q: "How does the CIDR ↔ range / netmask converter work?",
        a: "Pick a family (IPv4 or IPv6) and enter any one of the three synced inputs — a CIDR block (192.168.100.0/22), a start–end range (192.168.100.0–192.168.103.255), or a netmask (255.255.252.0). The tool computes the other two instantly. CIDR → range uses 32-bit (IPv4) or 128-bit BigInt (IPv6) mask math. Range → CIDR runs the standard greedy algorithm that emits the provably minimal exact list of CIDR blocks covering the range. Mask ↔ CIDR validates the mask is contiguous (all ones then all zeros) and converts to the equivalent prefix length.",
      },
      {
        q: "How does range → CIDR decomposition produce the minimal set?",
        a: "Given a start and end IP, the algorithm repeatedly emits the largest CIDR block that (a) starts at the current cursor, (b) is aligned to its own size, and (c) does not overshoot the end. This is the well-known greedy range-to-CIDR algorithm and provably produces the smallest possible number of blocks. For example, 192.168.100.0–192.168.103.255 collapses to a single 192.168.100.0/22, while 10.0.0.0–10.0.0.5 expands to /32 and /31 and /30 blocks. The total block count is shown for verification.",
      },
      {
        q: "What is a wildcard mask and how does it relate to the netmask?",
        a: "The wildcard mask (also called the inverse mask) is the bitwise NOT of the subnet mask. For a /24 IPv4 prefix, the netmask is 255.255.255.0 and the wildcard is 0.0.0.255. Wildcard masks are commonly used in Cisco ACLs. The tool computes both, plus the host count (2^(32−cidr) − 2 for /0–/30, 2 for /31 (RFC 3021), 1 for /32) and the total address count, and for IPv6 the total address count is BigInt-exact.",
      },
      {
        q: "Can I convert many CIDRs or ranges at once?",
        a: "Yes. Use the Batch tab and paste one entry per line. Each line may be a CIDR (192.168.0.0/24), a range (192.168.0.0–192.168.0.255 or 192.168.0.0 - 192.168.0.255), or a bare IP (treated as /32 IPv4 or /128 IPv6). The tool auto-detects IPv4 vs IPv6 per line, converts each to its full breakdown, and produces a combined CSV/JSON export plus a consolidated CIDR list.",
      },
      {
        q: "What extra features does this converter have versus others?",
        a: "(1) Bidirectional CIDR ↔ range ↔ mask ↔ wildcard in one view. (2) Both IPv4 (32-bit) and IPv6 (128-bit BigInt). (3) Range → minimal exact CIDR set via greedy algorithm. (4) Wildcard mask computed alongside netmask. (5) Host count (RFC 3021 aware) and total address count. (6) Batch mode with per-line family auto-detection. (7) Netmask equivalence reference table (CIDR, mask, wildcard, hosts, total). (8) Mask validation — rejects non-contiguous masks with a clear message. (9) CSV and JSON export. (10) History (localStorage, last 20). (11) Shareable URL with full state encoded. 100% client-side, no ads, no uploads.",
      },
    ],
  },
  status: "done",
};
