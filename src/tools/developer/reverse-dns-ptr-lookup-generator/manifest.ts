/**
 * Reverse DNS (PTR) Lookup Generator — Tool Manifest.
 * Tool #388 — Category 4 (Developer & Code).
 *
 * Pure-JS reverse DNS (PTR) lookup command generator. Builds the correct
 * in-addr.arpa / ip6.arpa reverse-zone query name from any IPv4 or IPv6
 * address (including CIDR ranges), generates ready-to-paste `dig`,
 * `nslookup`, `kdig` (DoH), and `host` commands against the resolver of
 * your choice (Google, Cloudflare, Quad9, OpenDNS, custom), parses PTR
 * zone-file records, builds a forward-confirmed reverse DNS (FCrDNS)
 * verification chain, and flags private/loopback/link-local addresses
 * that have no public PTR. 100% client-side — actual lookups require the
 * network, so this tool generates commands only; it never sends queries.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "reverse-dns-ptr-lookup-generator",
  name: "Reverse DNS (PTR) Lookup Generator",
  description:
    "Generate reverse DNS (PTR) lookup commands for any IPv4 or IPv6 address or CIDR. Builds the exact in-addr.arpa / ip6.arpa reverse-zone query name, plus ready-to-paste dig / nslookup / kdig (DoH) / host commands against Google, Cloudflare, Quad9, OpenDNS, or a custom resolver. Parses PTR zone records, builds a forward-confirmed reverse DNS (FCrDNS) chain, flags private/loopback/link-local IPs, and generates batch scripts. 100% client-side — generates commands only; actual lookups require running them in your terminal.",
  category: "developer",
  keywords: [
    "reverse dns", "ptr record", "ptr lookup", "in-addr.arpa",
    "ip6.arpa", "reverse ip", "ip to hostname", "fcrdns",
    "forward-confirmed reverse dns", "dig -x", "nslookup pointer",
    "reverse lookup cidr", "mail deliverability", "reverse dns checker",
  ],
  icon: "arrow-left-right",
  requiresNetwork: false,
  seo: {
    title: "Reverse DNS (PTR) Lookup Generator — in-addr.arpa / ip6.arpa + dig -x | UnQTools",
    faq: [
      {
        q: "Does this tool perform live reverse DNS lookups?",
        a: "No. Reverse DNS lookups require the network — and this tool is 100% client-side, so it generates the exact `dig -x`, `nslookup -type=PTR`, `kdig` (DoH), and `host` commands for you to copy and run in your terminal against your chosen resolver (Google 8.8.8.8, Cloudflare 1.1.1.1, Quad9 9.9.9.9, OpenDNS, or a custom IP/host). The reverse-zone name (in-addr.arpa / ip6.arpa) is constructed locally and works offline. PTR records are maintained by the IP owner/ISP, so many addresses legitimately have no PTR.",
      },
      {
        q: "How is the in-addr.arpa / ip6.arpa name built?",
        a: "For IPv4, the four octets are reversed and appended to `.in-addr.arpa` — e.g. `192.0.2.1` → `1.2.0.192.in-addr.arpa`. For IPv6, the address is first fully expanded to 32 hex nibbles, each nibble is reversed, and the result is appended to `.ip6.arpa` — e.g. `2001:db8::1` → `1.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.8.b.d.0.1.0.0.2.ip6.arpa`. The tool always shows the generated zone name alongside every command so you can verify the lookup target.",
      },
      {
        q: "What is FCrDNS and how does this tool help with it?",
        a: "FCrDNS (Forward-Confirmed Reverse DNS) is a two-step check mail servers run: (1) query the PTR for the IP → hostname; (2) query A/AAAA for that hostname → IP set; (3) verify the original IP is in that set. It is the PTR check that actually matters for email deliverability. The tool generates the full chain (PTR query + A/AAAA query for the returned hostname) so you can run both halves in your terminal and compare answers manually. When the chain fails, you get a deliverability explanation to share with the IP owner.",
      },
      {
        q: "How are CIDR ranges handled?",
        a: "Enter a CIDR like `192.0.2.0/30` and the tool enumerates every host IP in the range (capped at 256 to keep command output sane — `/24` for IPv4 and `/120` for IPv6 are the practical limits), then generates a PTR query per address. Larger CIDRs are rejected with a clear error message and a suggestion to narrow the range. Each generated address has its own reverse-zone name, dig/nslookup/kdig/host command, and copy button.",
      },
      {
        q: "What extra features does this tool have versus other reverse DNS sites?",
        a: "(1) Correct IPv4 in-addr.arpa construction. (2) Correct IPv6 ip6.arpa (nibble-reversed) construction with full expansion. (3) CIDR range enumeration with a 256-address cap. (4) FCrDNS chain builder (PTR + A/AAAA). (5) Private/loopback/link-local/reserved IP detection — flagged so you don't waste queries. (6) dig / nslookup / kdig (DoH) / host command variants. (7) 5 resolver presets (Google, Cloudflare, Quad9, OpenDNS, custom). (8) PTR zone-record parser (name TTL IN PTR target). (9) Batch .sh script generator for ranges. (10) Hostname → IP → PTR convenience chain. (11) Copy-to-clipboard per command. (12) localStorage history (max 20). (13) Shareable URL. 100% client-side — never sends queries itself.",
      },
    ],
  },
  status: "done",
};
