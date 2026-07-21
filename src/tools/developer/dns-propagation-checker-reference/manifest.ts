/**
 * DNS Propagation Checker Reference — Tool Manifest.
 * Tool #389 — Category 4 (Developer & Code).
 *
 * Pure-JS DNS propagation command generator. Builds ready-to-paste
 * `dig`, `kdig` (DoH), and PowerShell `Resolve-DnsName` commands for
 * checking a record (A, AAAA, CNAME, MX, TXT, NS, SOA, CAA) across 20+
 * global public resolvers (Google, Cloudflare, Quad9, OpenDNS,
 * AdGuard, NextDNS, Comodo, Verisign, Yandex, etc.) with region
 * metadata. Compares expected vs actual answers using exact / contains
 * / regex matchers. Computes a TTL-based propagation ETA, generates a
 * bash / PowerShell batch script, exports the plan as CSV / JSON, and
 * flags anycast / geo-DNS caveats. 100% client-side — actual lookups
 * require the network, so this tool generates commands only; it never
 * sends queries itself.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "dns-propagation-checker-reference",
  name: "DNS Propagation Checker Reference",
  description:
    "Generate dig / kdig (DoH) / PowerShell Resolve-DnsName commands to check DNS propagation of any record (A, AAAA, CNAME, MX, TXT, NS, SOA, CAA) across 20+ global public resolvers (Google, Cloudflare, Quad9, OpenDNS, AdGuard, NextDNS, Comodo, Verisign, Yandex, etc.) with region metadata. Compare expected vs actual answers (exact / contains / regex). Compute a TTL-based propagation ETA. Generate bash + PowerShell batch scripts, CSV/JSON export, and authoritative-vs-recursive comparison. 100% client-side — generates commands only; actual lookups require running them in your terminal.",
  category: "developer",
  keywords: [
    "dns propagation", "dns checker", "global dns lookup",
    "is my dns propagated", "dns propagation checker",
    "dig command batch", "doh propagation", "whatsmydns",
    "dnschecker", "dns propagation status", "ttl propagation eta",
    "dns resolver comparison", "expected dns value",
  ],
  icon: "globe",
  requiresNetwork: false,
  seo: {
    title: "DNS Propagation Checker Reference — dig batch across 20+ global resolvers | UnQTools",
    faq: [
      {
        q: "Does this tool perform live DNS propagation checks?",
        a: "No. DNS propagation checks require the network — and this tool is 100% client-side, so it generates the exact `dig`, `kdig` (DNS-over-HTTPS), and PowerShell `Resolve-DnsName` commands for you to copy and run in your terminal against 20+ global public resolvers (Google, Cloudflare, Quad9, OpenDNS, AdGuard, NextDNS, Comodo, Verisign, Yandex, etc.). The resolver list, region metadata, expected-value matcher, TTL-based ETA, and batch scripts all work offline. \"Location\" reflects the resolver's advertised region — anycast and geo-DNS mean some differences are expected, not failures.",
      },
      {
        q: "How does expected-value matching work?",
        a: "You enter the value you expect every resolver to return (e.g. `93.184.216.34` for an A record) and pick a matcher: exact (the answer must equal your expected value), contains (your expected value must appear in the answer set — useful for round-robin / multi-value records), or regex (the answer is tested against a JavaScript regex). The tool then emits a comparison one-liner per resolver — typically a `dig +short | grep` chain for bash or a `Resolve-DnsName | Where-Object` chain for PowerShell — so you can paste the batch and immediately see which resolvers have propagated and which are stale.",
      },
      {
        q: "How is the propagation ETA computed?",
        a: "Enter the record's TTL (in seconds, e.g. 3600 for 1 hour) and the tool computes the worst-case ETA as the time it takes the slowest caching resolver to expire its old answer. For example, a 3600s TTL means up to 1 hour after the authoritative change for every recursive resolver to refresh. The tool also reports the 50th-percentile ETA (about half the TTL) as a typical propagation time, and a 95th-percentile ETA (about 2× the TTL) for slow stragglers. These are statistical estimates based on RFC 1035 TTL semantics — actual propagation depends on resolver behavior, DNSSEC validation, and anycast routing.",
      },
      {
        q: "Why do some resolvers return different answers and not count as failures?",
        a: "Anycast (the same IP announced from many locations), geo-DNS (different answers per region), and CDN routing (different IPs per resolver's perceived geography) all mean legitimate differences across resolvers. The tool flags every difference from your expected value but separates \"differs\" from \"unreachable\" (NXDOMAIN, SERVFAIL, timeout). When you see a difference, check the resolver's region and consider whether CDN/geo-DNS could legitimately explain it before treating it as a propagation failure.",
      },
      {
        q: "What extra features does this tool have versus other propagation checkers?",
        a: "(1) 20+ global public resolver presets with region metadata (Google, Cloudflare, Quad9, OpenDNS, AdGuard, NextDNS, Comodo, Verisign, Yandex, Control D, Mullvad, etc.). (2) 8 record types (A, AAAA, CNAME, MX, TXT, NS, SOA, CAA). (3) dig / kdig (DoH) / PowerShell Resolve-DnsName command variants. (4) Expected-value matcher (exact / contains / regex). (5) TTL-based propagation ETA (50th/95th/worst case). (6) Authoritative vs recursive comparison command. (7) Bash batch script generator. (8) PowerShell batch script generator. (9) CSV export of the command plan. (10) JSON export of the command plan. (11) Region filter (run only resolvers in selected regions). (12) Add custom resolver. (13) Copy-to-clipboard per command. (14) localStorage history (max 20). (15) Shareable URL. 100% client-side — never sends queries itself.",
      },
    ],
  },
  status: "done",
};
