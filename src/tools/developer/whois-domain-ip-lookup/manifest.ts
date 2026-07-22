/**
 * WHOIS Domain & IP Lookup — Tool Manifest.
 * Tool #390 — Category 4 (Developer & Code).
 *
 * Per blueprint: WHOIS domain & IP lookup. Pure-JS generates WHOIS query
 * commands (whois CLI, RDAP URL), parses raw WHOIS response text into a
 * structured card (registrar, dates, nameservers, EPP statuses, DNSSEC),
 * explains EPP status codes, detects the RIR for an IP, and generates
 * domain-availability checker commands. 100% client-side — actual lookups
 * require the network, so this tool generates commands/URLs and parses
 * pasted output; it never sends queries itself.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "whois-domain-ip-lookup",
  name: "WHOIS Domain & IP Lookup",
  description:
    "Generate WHOIS query commands (whois CLI, RDAP URL) for any domain or IP, parse raw WHOIS response text into a structured card (registrar, created/updated/expiry dates, nameservers, EPP status codes explained, DNSSEC flag), detect the RIR for an IP (ARIN/RIPE/APNIC/LACNIC/AFRINIC), and generate domain-availability checker commands. EPP status code explainer with plain-English descriptions, expiry countdown, IDN/punycode handling, bulk lookup, TLD→WHOIS-server map. 100% client-side — generates commands and parses pasted output only; actual lookups require the network.",
  category: "developer",
  keywords: [
    "whois", "domain whois", "ip whois", "rdap",
    "whois lookup", "domain availability", "epp status",
    "registrar lookup", "rir", "arin", "ripe",
    "apnic", "lacnic", "afrinic", "punycode", "idn",
  ],
  icon: "globe",
  requiresNetwork: false,
  seo: {
    title: "WHOIS Domain & IP Lookup — Command Generator + Parser | UnQTools",
    faq: [
      {
        q: "Does this tool perform live WHOIS lookups?",
        a: "No. WHOIS and RDAP require the network — and this tool is 100% client-side, so it generates the exact `whois` CLI commands and RDAP URLs for you to run in your terminal or open in a browser. When you paste the raw WHOIS text back, the parser extracts registrar, created/updated/expiry dates, nameservers, status codes (with plain-English explanations), and the DNSSEC flag into a clean structured card. The tool never sends queries itself.",
      },
      {
        q: "What is RDAP and how does it differ from WHOIS?",
        a: "RDAP (Registration Data Access Protocol, RFC 7483) is the structured JSON successor to WHOIS. It is the IETF standard for domain and IP registration data, returns machine-readable JSON, and is served by official registry/RIR endpoints. We generate `https://rdap.org/domain/<domain>` and `https://rdap.org/ip/<ip>` URLs — rdap.org is the IANA-operated bootstrap that redirects to the authoritative registry/RIR RDAP server.",
      },
      {
        q: "What EPP status codes are explained?",
        a: "20+ EPP status codes including clientTransferProhibited (anti-hijack transfer lock), serverDeleteProhibited, clientHold (DNS suspended), pendingDelete (5-day deletion grace), redemptionPeriod (30-day restore window), addPeriod, autoRenewPeriod, and ok (active, no locks). Each is shown with a plain-English description and categorized as client-set, server-set, ok, or other.",
      },
      {
        q: "How does IP WHOIS work and what is a RIR?",
        a: "IP addresses are allocated by Regional Internet Registries (RIRs): ARIN (North America), RIPE NCC (Europe/Middle East/Central Asia), APNIC (Asia-Pacific), LACNIC (Latin America/Caribbean), and AFRINIC (Africa). For an IPv4 or IPv6 address the tool detects the most likely RIR by first-octet range, generates `whois <ip>` (ARIN accepts queries for any IP and refers to the right RIR), and the RDAP URL. Pasted WHOIS text is parsed into organization, CIDR range, origin AS, registration date, and abuse contact.",
      },
      {
        q: "What extra features does this tool have compared to other WHOIS sites?",
        a: "(1) whois CLI command generator (basic + explicit -h server + -H hide-legal flag). (2) RDAP URL generator (domain + IP) via rdap.org IANA bootstrap. (3) curl command for RDAP JSON with `Accept: application/rdap+json` header. (4) Raw WHOIS text parser into structured fields (registrar/dates/NS/status/DNSSEC). (5) EPP status code explainer (20+ codes). (6) Expiry date countdown (days until expiry). (7) Domain availability checker commands (whois grep, dig, RDAP HTTP status). (8) TLD→WHOIS-server map for 40+ TLDs (com, net, org, io, dev, app, ai, country codes…). (9) RIR detector for IPv4/IPv6 with server + RDAP URL. (10) IDN/punycode converter. (11) Bulk lookup (newline-separated targets). (12) localStorage history (max 20). (13) Shareable URL. 100% client-side.",
      },
    ],
  },
  status: "done",
};
