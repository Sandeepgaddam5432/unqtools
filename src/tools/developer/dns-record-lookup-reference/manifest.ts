/**
 * DNS Record Lookup Reference — Tool Manifest.
 * Tool #387 — Category 4 (Developer & Code).
 *
 * Pure-JS DNS record type reference covering A, AAAA, CNAME, MX, TXT, NS,
 * SOA, PTR, SRV, CAA, DS, DNSKEY, RRSIG, DKIM, DMARC and more. Per-type
 * format, fields, example, common use cases. Generates ready-to-paste
 * `dig`, `nslookup`, `kdig` (DoH), `delv` (DNSSEC), and `host` commands
 * with the chosen resolver (Google, Cloudflare, Quad9, OpenDNS,
 * authoritative, custom). Parses example records into field breakdowns.
 * 100% client-side — actual lookups require the network, so this tool
 * generates commands only; it never sends queries itself.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "dns-record-lookup-reference",
  name: "DNS Record Lookup Reference",
  description:
    "Reference every common DNS record type (A, AAAA, CNAME, MX, TXT, NS, SOA, PTR, SRV, CAA, DS, DNSKEY, RRSIG, DKIM, DMARC, etc.) with format, fields, examples, and use cases. Generate ready-to-paste dig / nslookup / kdig (DoH) / delv (DNSSEC) / host commands for the resolver of your choice (Google, Cloudflare, Quad9, OpenDNS, authoritative, custom). Parse example records into field breakdowns. 100% client-side — generates commands only; actual lookups require running them in your terminal.",
  category: "developer",
  keywords: [
    "dns lookup", "dns record", "dig command", "nslookup",
    "mx lookup", "txt record", "soa record", "caa record",
    "srv record", "ptr record", "dnssec", "ds record",
    "dnskey record", "dkim", "dmarc", "dns reference",
  ],
  icon: "globe",
  requiresNetwork: false,
  seo: {
    title: "DNS Record Lookup Reference — dig / nslookup Command Generator | UnQTools",
    faq: [
      {
        q: "Does this tool perform live DNS lookups?",
        a: "No. DNS lookups require the network — and this tool is 100% client-side, so it generates the exact `dig`, `nslookup`, `kdig` (DNS-over-HTTPS), `delv` (DNSSEC validation), and `host` commands for you to copy and run in your terminal or against your chosen resolver (Google 8.8.8.8, Cloudflare 1.1.1.1, Quad9 9.9.9.9, OpenDNS, authoritative, or a custom IP). The record-type reference (A, AAAA, CNAME, MX, TXT, NS, SOA, PTR, SRV, CAA, DS, DNSKEY, RRSIG, DKIM, DMARC, etc.) is bundled and works offline.",
      },
      {
        q: "What record types are covered?",
        a: "15+ types: A (IPv4), AAAA (IPv6), CNAME (alias), MX (mail exchange with priority), TXT (text — SPF/DKIM/DMARC/verification), NS (nameservers), SOA (start of authority — serial/refresh/retry/expire/minttl), PTR (reverse DNS), SRV (service locator with priority/weight/port/target), CAA (certificate authority authorization), DS (DNSSEC delegation signer), DNSKEY (DNSSEC public key), RRSIG (DNSSEC signature), TLSA (DANE), SSHFP (SSH fingerprint), and DKIM/DMARC (which are TXT-record-based conventions). Each entry lists the wire format, fields, an example record, and common use cases.",
      },
      {
        q: "How are the generated commands different from typing dig myself?",
        a: "The generator pre-fills the record type, the domain, and the resolver `@server`, plus the flags you actually need: `+short` for terse output, `+noall +answer` for clean answer sections, `+trace` for iterative root→authoritative traversal, `+dnssec` (sets the DO bit and requests DNSSEC records), `+multi` (human-readable line wrapping), and `+cdflag` (disable DNSSEC validation). For DoH it switches to `kdig` with `+https`, and for DNSSEC chain validation it uses `delv`.",
      },
      {
        q: "How do DKIM and DMARC lookups work?",
        a: "DKIM public keys and DMARC policies are stored as TXT records under special subdomains. For DKIM, you query `<selector>._domainkey.<domain>` — common selectors are `default`, `google`, `s1`, `selector1`, `k1`. For DMARC, you query `_dmarc.<domain>`. The tool auto-builds these special subdomains when you pick the DKIM or DMARC record type, so you can copy the `dig` command and inspect the TXT record directly.",
      },
      {
        q: "What extra features does this tool have versus other DNS lookup sites?",
        a: "(1) Bundled reference for 15+ record types with format, fields, examples, and use cases. (2) dig / nslookup / kdig (DoH) / delv / host command generator. (3) 6 resolver presets (Google, Cloudflare, Quad9, OpenDNS, authoritative, custom IP). (4) Smart flag presets (+short, +trace, +dnssec, +multi, +cdflag, +noall+answer). (5) DKIM selector → _domainkey subdomain builder. (6) DMARC _dmarc subdomain builder. (7) SOA field parser (serial/refresh/retry/expire/minttl). (8) MX field parser (priority/exchanger). (9) SRV field parser (priority/weight/port/target). (10) CAA field parser (flags/tag/value). (11) TXT-record long-string reassembly (RFC 7208 split). (12) IDN/punycode domain normalizer. (13) Copy-to-clipboard per command. (14) localStorage history (max 20). (15) Shareable URL. 100% client-side — never sends queries itself.",
      },
    ],
  },
  status: "done",
};
