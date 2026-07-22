/**
 * DNS-over-HTTPS (DoH) Query Tool — Tool Manifest.
 * Tool #399 — Category 4 (Developer & Code).
 *
 * Per blueprint: DNS-over-HTTPS (DoH) query tool. Pure-JS generates DoH query
 * URLs for Cloudflare (1.1.1.1), Google (8.8.8.8 / dns.google), Quad9, and a
 * custom DoH URL. Supports JSON (RFC 8484 §4.2) and wire-format
 * (application/dns-message, base64url) queries. Generates curl, wget, httpie,
 * and fetch() commands. Parses DoH JSON responses (Answer, Authority,
 * Additional, Status, Comment, flags). Encodes/decodes minimal DNS wire
 * messages. 100% client-side — actual queries require the network, so the
 * tool generates URLs/commands and parses pasted JSON; it never sends
 * queries itself.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "dns-over-https-doh-query-tool",
  name: "DNS-over-HTTPS (DoH) Query Tool",
  description:
    "Generate DNS-over-HTTPS (RFC 8484) query URLs and curl/wget/httpie/fetch commands for Cloudflare (1.1.1.1), Google (dns.google), Quad9 (9.9.9.9), and custom DoH resolvers. Both JSON mode (?type=A) and wire-format mode (application/dns-message, base64url-encoded query). Pure-JS DNS message encoder builds the wire-format query from name + type + flags. Parse pasted DoH JSON responses into structured tables (Status, Answer, Authority, Additional, flags AD/RA/RD, Comment). DNSSEC flags (do/cd) toggle, side-by-side resolver comparison, history (localStorage), shareable URL. 100% client-side — generates URLs/commands and parses output only; actual DoH queries require the network.",
  category: "developer",
  keywords: [
    "dns over https", "doh", "doh query", "rfc 8484",
    "cloudflare dns", "1.1.1.1", "google dns", "dns.google",
    "quad9", "9.9.9.9", "dns json api", "application/dns-message",
    "base64url", "dnssec", "ad flag", "cd flag",
    "curl doh", "fetch doh", "dns wire format",
  ],
  icon: "globe",
  requiresNetwork: false,
  seo: {
    title: "DNS-over-HTTPS (DoH) Query Tool — RFC 8484 URL + curl Generator | UnQTools",
    faq: [
      {
        q: "Does this tool perform live DoH queries?",
        a: "No. DoH queries require the network — and this tool is 100% client-side, so it generates the exact DoH query URLs (JSON and wire-format) plus curl, wget, httpie, and fetch() snippets for you to run. When you paste the JSON response back, the parser extracts Status, Answer, Authority, Additional, and the AD/RA/RD flag chips. The tool never sends queries itself — some resolvers (notably Google) block cross-origin browser fetches, in which case curl in a terminal is the recommended path.",
      },
      {
        q: "What is the difference between JSON mode and wire-format mode?",
        a: "JSON mode (RFC 8484 §4.2, used by dns.google/resolve and cloudflare-dns.com/dns-query?name=) returns a JSON object with Status, Answer, Authority, and Additional arrays — easy to read and parse. Wire-format mode (application/dns-message, RFC 8484 §4.1) exchanges raw DNS messages: the query is base64url-encoded in a ?dns= parameter (GET) or sent as the body (POST), and the response is binary application/dns-message. We build the wire-format query purely in JS from your name + type + flags using a minimal DNS message encoder.",
      },
      {
        q: "Which DoH resolvers are supported?",
        a: "Three presets plus a custom URL: Cloudflare (https://cloudflare-dns.com/dns-query), Google (https://dns.google/resolve JSON and /dns-query wire), and Quad9 (https://dns.quad9.net:5053/dns-query). For each, you can switch between JSON and wire-format modes, toggle the DNSSEC do (DNSSEC OK) and cd (Checking Disabled) flags, and choose GET or POST. The custom resolver field accepts any DoH URL — common alternatives include NextDNS, AdGuard, OpenAI, Mullvad, and Contabo.",
      },
      {
        q: "How are DNSSEC flags handled?",
        a: "Two flags matter: do (DNSSEC OK, requesting DNSSEC records) and cd (Checking Disabled, asking the resolver to skip DNSSEC validation and return whatever it has). In wire-format mode these go into the OPT record (EDNS0). In JSON mode they go as ?do=1 or ?cd=1 query parameters. The response Status field carries RCODE (0 = NOERROR, 3 = NXDOMAIN, etc.) and the AD flag indicates the data was DNSSEC-validated.",
      },
      {
        q: "What extra features does this tool have compared to other DoH consoles?",
        a: "(1) Three resolver presets + custom DoH URL. (2) JSON and wire-format modes with full RFC 8484 base64url encoding. (3) Pure-JS DNS message encoder for the wire-format query (header + question + EDNS0 OPT). (4) Pure-JS base64url encoder/decoder. (5) curl, wget, httpie, and fetch() snippets with correct Accept and Content-Type headers. (6) DoH JSON response parser with Status, Answer, Authority, Additional, and AD/RA/RD flag chips. (7) DNSSEC do/cd toggles. (8) All 30+ record types (A, AAAA, CNAME, MX, NS, TXT, SOA, PTR, SRV, CAA, DNSKEY, DS, etc.). (9) Side-by-side resolver comparison (same query, all resolvers). (10) GET vs POST wire-format toggle. (11) Reverse-DNS helper (builds a PTR query from an IP). (12) localStorage history (max 20). (13) Shareable URL. 100% client-side.",
      },
    ],
  },
  status: "done",
};
