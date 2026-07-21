/**
 * IPv6 Subnet Calculator — Tool Manifest.
 * Tool #382 — Category 4 (Developer & Code).
 *
 * Compute IPv6 network / range / host count (BigInt-exact) from an address +
 * prefix, expand and compress addresses (RFC 5952 canonical form), show the
 * 128-bit binary representation with nibble markers, subdivide a prefix into
 * child prefixes (e.g. /48 → /56 → /64), and generate the ip6.arpa reverse
 * DNS zone. 100% client-side, BigInt math, no network.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ipv6-subnet-calculator",
  name: "IPv6 Subnet Calculator",
  description:
    "Compute IPv6 network address, first/last address, total address count (BigInt-exact) and number of /64s from an address + prefix length. Expand and compress addresses (RFC 5952 canonical form), show the 128-bit binary representation with nibble markers, subdivide a prefix into smaller child prefixes (e.g. /48 → /56 → /64), and generate the ip6.arpa reverse DNS zone. 100% client-side with BigInt 128-bit math.",
  category: "developer",
  keywords: [
    "ipv6 subnet calculator", "ipv6 cidr to range", "ipv6 prefix calculator",
    "ipv6 expand compress", "number of /64 in ipv6", "ipv6 binary representation",
    "ipv6 subdivide", "ipv6 subnet divider", "ip6.arpa reverse zone",
    "ipv6 address range", "rfc 5952 canonical", "ipv6 host count",
  ],
  icon: "network",
  requiresNetwork: false,
  seo: {
    title: "IPv6 Subnet Calculator — CIDR, Range, /64 Count, Subdivide, ip6.arpa | UnQTools",
    faq: [
      {
        q: "How does the IPv6 subnet calculator compute the network and range?",
        a: "Given an IPv6 address and a prefix length (0–128), the tool parses the address into eight 16-bit hextets, builds a 128-bit BigInt value, computes a 128-bit mask (prefix ones followed by zeros), ANDs the IP with the mask to get the network address, and ORs it with the inverse mask to get the last address. The total address count is 2^(128−prefix) computed with BigInt so even a /0 (the full 3.4×10^38 space) is exact. There is no broadcast in IPv6 — the first address is the subnet-router anycast and all addresses are usable.",
      },
      {
        q: "How are compressed and expanded forms produced?",
        a: "The compressed form follows RFC 5952: leading zeros in each hextet are stripped, the longest run of consecutive zero hextets is replaced with '::' (and only one such run is compressed, chosen as the first longest run). The expanded form writes all eight hextets padded to four hex digits with no '::' shorthand. The tool also shows the 128-bit binary representation grouped into nibble-aligned 4-bit groups so you can see the nibble boundaries used in reverse DNS delegation.",
      },
      {
        q: "How does the subnet divider work for IPv6?",
        a: "Enter a parent prefix (e.g. 2001:db8::/48) and a target child prefix length (e.g. /64). The tool validates the child is longer than the parent, computes how many children fit (2^(child − parent), BigInt-exact), and lists each child network address with its compressed + expanded form, range, /64 count, and ip6.arpa zone. The list is capped at 4096 entries for performance, but the exact total count is always shown.",
      },
      {
        q: "How is the ip6.arpa reverse DNS zone generated?",
        a: "The reverse zone for a prefix is built from the network address by writing each nibble (4 bits) of the 128-bit value in reverse order, separated by dots, and appending .ip6.arpa. For prefixes on a nibble boundary (multiple of 4), the zone exactly matches the delegated prefix; for non-nibble-aligned prefixes the zone is computed for the network address and you can see the bit alignment.",
      },
      {
        q: "What extra features does this IPv6 calculator have versus others?",
        a: "(1) Single-subnet compute with compressed + expanded network, first/last, BigInt-exact total address count and /64 count. (2) RFC 5952 canonical compression with correct '::' placement rules. (3) 128-bit binary representation with nibble markers. (4) Subnet divider listing every child prefix (capped at 4096 displayed). (5) ip6.arpa reverse zone generator. (6) Nibble-boundary detection (whether the prefix is on a 4-bit boundary). (7) Embedded IPv4 (::ffff:a.b.c.d) input support. (8) Address validation with clear error messages. (9) CSV and JSON export. (10) History (localStorage, last 20). (11) Shareable URL with full state encoded. 100% client-side, BigInt-exact, no ads, no uploads.",
      },
    ],
  },
  status: "done",
};
