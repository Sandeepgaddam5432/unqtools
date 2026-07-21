/**
 * IPv4 Subnet Calculator (CIDR / VLSM) — Tool Manifest.
 * Tool #381 — Category 4 (Developer & Code).
 *
 * Compute network / broadcast / host range / wildcard from an IPv4
 * address + CIDR (or dotted / inverse mask), split a block evenly into
 * N subnets, plan VLSM allocations from host requirements, and check
 * overlap / containment between two blocks. 100% client-side.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ipv4-subnet-calculator-cidr-vlsm",
  name: "IPv4 Subnet Calculator (CIDR / VLSM)",
  description:
    "Compute network, broadcast, first/last usable host, host count, subnet & wildcard mask, IP class, and private/reserved detection from an IPv4 address + CIDR (or dotted / inverse mask). Includes binary bit visualization, even split into N subnets, VLSM best-fit allocation from host requirements, overlap / containment checker between two blocks, and CSV / JSON export. 100% client-side.",
  category: "developer",
  keywords: [
    "ipv4 subnet calculator", "cidr calculator", "vlsm calculator",
    "subnet mask calculator", "ip subnet host range", "network broadcast",
    "wildcard mask", "subnet divider", "split subnet", "vlsm allocation",
    "subnet overlap", "ip class",
  ],
  icon: "network",
  requiresNetwork: false,
  seo: {
    title: "IPv4 Subnet Calculator (CIDR / VLSM) — Network, Broadcast, Host Range | UnQTools",
    faq: [
      {
        q: "How does the subnet calculator compute network and broadcast addresses?",
        a: "Given an IPv4 address and a CIDR prefix length, the tool builds a 32-bit subnet mask (CIDR ones followed by zeros), ANDs it with the IP to get the network address, and ORs the IP with the inverse (wildcard) mask to get the broadcast address. The first usable host is network + 1, the last usable host is broadcast − 1, and the host count is 2^(32−CIDR) − 2 for /0–/30. /31 (RFC 3021) yields 2 point-to-point hosts and /32 yields a single host route.",
      },
      {
        q: "Can I enter the mask in dotted-decimal or inverse form, not just CIDR?",
        a: "Yes. The mask field accepts CIDR notation (/24), a bare integer (24), a dotted-decimal mask (255.255.255.0), or an inverse / wildcard mask (0.0.0.255). The parser validates that the mask is contiguous (all ones followed by all zeros, or the inverse) and converts it to the equivalent prefix length. You can also enter 'IP/CIDR' or 'IP mask' as a single combined input.",
      },
      {
        q: "How does VLSM allocation work?",
        a: "Enter your parent block (e.g. 192.168.1.0/24) and a list of subnets by required host count (one per line, e.g. 'LAN-A 50'). The tool sorts requirements largest-first (best-fit), computes the smallest prefix that fits each (2^(32−c) − 2 ≥ hosts), aligns each subnet to its block boundary, and allocates sequentially from the parent's network address. Subnets that don't fit are flagged as overflow. A waste percentage shows how much of the parent block is unused.",
      },
      {
        q: "How is the even split calculated?",
        a: "Pick a parent block and a target count N. The tool finds the smallest extra bit count b such that 2^b ≥ N, giving the new prefix parentCidr + b. It then lists all 2^b equal-sized subnets with their network / broadcast / mask / host count. For example, splitting 192.168.1.0/24 into 4 subnets yields four /26s (.0, .64, .128, .192).",
      },
      {
        q: "What extra features does this tool have versus other subnet calculators?",
        a: "(1) Single-subnet compute with full breakdown (network, broadcast, host range, mask, wildcard, class, private/reserved). (2) Accepts CIDR, dotted, or inverse masks. (3) Color-coded 32-bit binary visualization of IP, mask, network, and wildcard. (4) Even split into N subnets. (5) VLSM best-fit allocation with waste reporting. (6) Overlap / containment checker between two CIDR blocks. (7) IP class (A/B/C/D/E) and RFC 1918 private / reserved / loopback / link-local detection. (8) RFC 3021 /31 and /32 support. (9) CSV and JSON export. (10) History (localStorage, last 20). (11) Shareable URL with full state encoded. 100% client-side — no uploads, no ads.",
      },
    ],
  },
  status: "done",
};
