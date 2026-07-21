/**
 * DNS Record Lookup Reference — pure logic.
 *
 * Bundled reference for 15+ DNS record types (A, AAAA, CNAME, MX, TXT, NS,
 * SOA, PTR, SRV, CAA, DS, DNSKEY, RRSIG, TLSA, SSHFP, DKIM, DMARC) with
 * format, fields, examples, and use cases. Generates ready-to-paste
 * dig / nslookup / kdig (DoH) / delv (DNSSEC) / host commands for the
 * chosen resolver. Parses example records into field breakdowns.
 *
 * Pure functions only — no DOM, no network, no external deps.
 *
 * PRIVACY: The history feature stores only operation metadata (action +
 * resolver + count + ts), NEVER the queried domain names themselves.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RecordType =
  | "A" | "AAAA" | "CNAME" | "MX" | "TXT" | "NS" | "SOA"
  | "PTR" | "SRV" | "CAA" | "DS" | "DNSKEY" | "RRSIG"
  | "TLSA" | "SSHFP" | "DKIM" | "DMARC" | "ANY";

export type ResolverId =
  | "google"
  | "cloudflare"
  | "quad9"
  | "opendns"
  | "authoritative"
  | "custom";

export interface ResolverPreset {
  id: ResolverId;
  label: string;
  /** IP/hostname used for dig @server. */
  server: string;
  /** DoH endpoint (kdig +https=), empty when N/A. */
  dohUrl: string;
  notes: string;
}

export type CommandTool = "dig" | "nslookup" | "kdig" | "delv" | "host";

export type DigFlag =
  | "short"
  | "answer"
  | "trace"
  | "dnssec"
  | "multi"
  | "cdflag"
  | "reverse"
  | "all";

export interface RecordField {
  /** Position (1-based) or named field label. */
  name: string;
  description: string;
  example: string;
  required: boolean;
}

export interface RecordTypeReference {
  type: RecordType;
  rfc: string;
  /** One-line plain-English description. */
  summary: string;
  /** Full wire-format description (e.g. "name TTL IN A 192.0.2.1"). */
  format: string;
  fields: RecordField[];
  example: string;
  useCases: string[];
  notes: string[];
}

export interface GeneratedCommand {
  tool: CommandTool;
  command: string;
  explanation: string;
}

export interface ParsedRecord {
  type: RecordType;
  fields: { name: string; value: string }[];
  notes: string[];
}

export interface HistoryEntry {
  ts: number;
  action: "generate" | "parse" | "reference";
  resolver: ResolverId;
  count: number;
}

// ---------------------------------------------------------------------------
// Resolver presets
// ---------------------------------------------------------------------------

export const RESOLVERS: ResolverPreset[] = [
  {
    id: "google",
    label: "Google Public DNS",
    server: "8.8.8.8",
    dohUrl: "https://dns.google/dns-query",
    notes: "8.8.8.8 / 8.8.4.4. DoH at dns.google. Logs limited TTL info; supports DNSSEC.",
  },
  {
    id: "cloudflare",
    label: "Cloudflare DNS",
    server: "1.1.1.1",
    dohUrl: "https://cloudflare-dns.com/dns-query",
    notes: "1.1.1.1 / 1.0.0.1. Privacy-first resolver; DoH/DoT supported; DNSSEC validation on.",
  },
  {
    id: "quad9",
    label: "Quad9",
    server: "9.9.9.9",
    dohUrl: "https://dns.quad9.net/dns-query",
    notes: "9.9.9.9 / 149.112.112.112. Security-focused (malware blocking); DNSSEC on.",
  },
  {
    id: "opendns",
    label: "OpenDNS (Cisco)",
    server: "208.67.222.222",
    dohUrl: "https://doh.opendns.com/dns-query",
    notes: "208.67.222.222 / 208.67.220.220. Cisco Umbrella backend; phishing protection.",
  },
  {
    id: "authoritative",
    label: "Authoritative NS (no @server)",
    server: "",
    dohUrl: "",
    notes: "No @server. dig walks the root hint chain. Use +trace for iterative traversal.",
  },
  {
    id: "custom",
    label: "Custom resolver",
    server: "",
    dohUrl: "",
    notes: "Provide a custom IP or hostname in the @server field.",
  },
];

export function getResolver(id: ResolverId): ResolverPreset {
  return RESOLVERS.find((r) => r.id === id) ?? RESOLVERS[0];
}

// ---------------------------------------------------------------------------
// Record type reference database (15+ types)
// ---------------------------------------------------------------------------

export const RECORD_TYPES: RecordTypeReference[] = [
  {
    type: "A",
    rfc: "RFC 1035",
    summary: "Maps a hostname to a 32-bit IPv4 address.",
    format: "name TTL IN A ipv4-address",
    fields: [
      { name: "name", description: "Owner hostname (e.g. example.com.)", example: "example.com.", required: true },
      { name: "TTL", description: "Time-to-live in seconds", example: "3600", required: true },
      { name: "IN", description: "Class (always IN for Internet)", example: "IN", required: true },
      { name: "A", description: "Record type", example: "A", required: true },
      { name: "address", description: "32-bit IPv4 dotted-quad", example: "93.184.216.34", required: true },
    ],
    example: "example.com.  3600  IN  A  93.184.216.34",
    useCases: [
      "Point a domain or subdomain to an IPv4 web server.",
      "Round-robin DNS by listing multiple A records.",
      "Split-horizon DNS — different answers on internal vs external resolvers.",
    ],
    notes: ["A is the most-queried record type. TTL of 3600s = 1 hour."],
  },
  {
    type: "AAAA",
    rfc: "RFC 3596",
    summary: "Maps a hostname to a 128-bit IPv6 address.",
    format: "name TTL IN AAAA ipv6-address",
    fields: [
      { name: "name", description: "Owner hostname", example: "example.com.", required: true },
      { name: "TTL", description: "Time-to-live in seconds", example: "3600", required: true },
      { name: "IN", description: "Class (IN = Internet)", example: "IN", required: true },
      { name: "AAAA", description: "Record type (4×A = 4×32 = 128 bits)", example: "AAAA", required: true },
      { name: "address", description: "128-bit IPv6 address (RFC 5952 canonical form preferred)", example: "2606:2800:220:1:248:1893:25c8:1946", required: true },
    ],
    example: "example.com.  3600  IN  AAAA  2606:2800:220:1:248:1893:25c8:1946",
    useCases: [
      "Dual-stack hosting (publish both A and AAAA for IPv4+IPv6 reachability).",
      "Mobile-first networks where IPv6 is preferred.",
    ],
    notes: ["Use RFC 5952 compressed form (e.g. ::1, not 0:0:0:0:0:0:0:1)."],
  },
  {
    type: "CNAME",
    rfc: "RFC 1035",
    summary: "Alias of one name to another (canonical name).",
    format: "alias TTL IN CNAME canonical-name",
    fields: [
      { name: "alias", description: "The alias hostname", example: "www.example.com.", required: true },
      { name: "TTL", description: "Time-to-live in seconds", example: "3600", required: true },
      { name: "IN", description: "Class", example: "IN", required: true },
      { name: "CNAME", description: "Record type", example: "CNAME", required: true },
      { name: "canonical", description: "Target canonical hostname (must be a fully-qualified name)", example: "example.com.", required: true },
    ],
    example: "www.example.com.  3600  IN  CNAME  example.com.",
    useCases: [
      "www → apex alias (note: apex cannot be a CNAME per RFC 1034 — use ALIAS/ANAME at the registrar).",
      "CDN integration (point subdomains to provider's hostname).",
      "Service aliasing (blog.example.com → ghost.io).",
    ],
    notes: ["CNAME cannot coexist with other types at the same name (no SOA/NS/MX alongside).", "MX/NS targets must not be CNAMEs."],
  },
  {
    type: "MX",
    rfc: "RFC 1035",
    summary: "Mail exchange — where to deliver email for the domain.",
    format: "name TTL IN MX priority mail-exchanger",
    fields: [
      { name: "name", description: "Domain name receiving mail", example: "example.com.", required: true },
      { name: "TTL", description: "Time-to-live in seconds", example: "3600", required: true },
      { name: "IN", description: "Class", example: "IN", required: true },
      { name: "MX", description: "Record type", example: "MX", required: true },
      { name: "priority", description: "Preference (lower = preferred). 0-65535.", example: "10", required: true },
      { name: "exchanger", description: "Mail server hostname (must have its own A/AAAA)", example: "mail.example.com.", required: true },
    ],
    example: "example.com.  3600  IN  MX  10  mail.example.com.",
    useCases: [
      "Primary/backup mail setup with multiple MX records (priority 10, 20).",
      "Google Workspace: ASPMX.L.GOOGLE.COM priority 1, alt1 priority 5, etc.",
      "Microsoft 365: <tenant>.mail.protection.outlook.com priority 0.",
    ],
    notes: ["Lower priority value = higher preference.", "Backup MX receives mail when primary is unreachable (queue + retry)."],
  },
  {
    type: "TXT",
    rfc: "RFC 1035",
    summary: "Arbitrary text — SPF, DKIM, DMARC, domain verification.",
    format: "name TTL IN TXT \"string1\" \"string2\" ...",
    fields: [
      { name: "name", description: "Owner name", example: "example.com.", required: true },
      { name: "TTL", description: "Time-to-live in seconds", example: "3600", required: true },
      { name: "IN", description: "Class", example: "IN", required: true },
      { name: "TXT", description: "Record type", example: "TXT", required: true },
      { name: "strings", description: "One or more quoted strings (each ≤255 chars; concatenated logically)", example: "\"v=spf1 -all\"", required: true },
    ],
    example: "example.com.  3600  IN  TXT  \"v=spf1 include:_spf.google.com -all\"",
    useCases: [
      "SPF — authorized mail senders (v=spf1 ...).",
      "DKIM public key (stored under selector._domainkey).",
      "DMARC policy (stored under _dmarc).",
      "Domain verification (Google Search Console, Microsoft 365, Atlassian, etc.).",
      "MTA-STS, BIMI, branding tokens.",
    ],
    notes: ["Strings >255 chars must be split into multiple quoted segments per RFC 7208.", "Common source of DNS lookup failures when too long (UDP 512-byte truncation)."],
  },
  {
    type: "NS",
    rfc: "RFC 1035",
    summary: "Authoritative nameservers for the zone.",
    format: "name TTL IN NS nameserver",
    fields: [
      { name: "name", description: "Zone apex (delegated domain)", example: "example.com.", required: true },
      { name: "TTL", description: "Time-to-live in seconds", example: "86400", required: true },
      { name: "IN", description: "Class", example: "IN", required: true },
      { name: "NS", description: "Record type", example: "NS", required: true },
      { name: "nameserver", description: "Authoritative nameserver hostname (must have A/AAAA)", example: "ns1.example.com.", required: true },
    ],
    example: "example.com.  86400  IN  NS  ns1.iana.org.",
    useCases: [
      "Delegate a subdomain (e.g. dev.example.com NS to ns.dev.example.com).",
      "List a zone's authoritative servers at the apex.",
      "Verify delegation after a registrar transfer.",
    ],
    notes: ["NS records at the apex are authoritative (not glue).", "Glue records (A/AAAA for the NS) are needed when the NS hostname is inside the zone being delegated."],
  },
  {
    type: "SOA",
    rfc: "RFC 1035",
    summary: "Start of authority — zone metadata + serial + timers.",
    format: "name TTL IN SOA mname rname serial refresh retry expire minimum",
    fields: [
      { name: "name", description: "Zone apex", example: "example.com.", required: true },
      { name: "TTL", description: "Time-to-live in seconds", example: "86400", required: true },
      { name: "IN", description: "Class", example: "IN", required: true },
      { name: "SOA", description: "Record type", example: "SOA", required: true },
      { name: "mname", description: "Primary master nameserver", example: "ns.icann.org.", required: true },
      { name: "rname", description: "Admin email (with '.' instead of '@')", example: "noc.dns.icann.org.", required: true },
      { name: "serial", description: "Zone serial number (YYYYMMDDNN recommended)", example: "2025010101", required: true },
      { name: "refresh", description: "Seconds before secondary checks for changes", example: "7200", required: true },
      { name: "retry", description: "Seconds before retry after failed refresh", example: "3600", required: true },
      { name: "expire", description: "Seconds before secondary discards zone if unreachable", example: "1209600", required: true },
      { name: "minimum", description: "Negative-caching TTL (RFC 2308)", example: "3600", required: true },
    ],
    example: "example.com.  86400  IN  SOA  ns.icann.org.  noc.dns.icann.org.  2025010101  7200  3600  1209600  3600",
    useCases: [
      "Zone transfer (AXFR/IXFR) coordination between primary and secondary.",
      "Negative caching (NXDOMAIN TTL = minimum field).",
      "Serial-number tracking for change detection.",
    ],
    notes: ["RFC 2308 redefined the minimum field as the negative-cache TTL (was the default TTL pre-2308)."],
  },
  {
    type: "PTR",
    rfc: "RFC 1035",
    summary: "Reverse DNS — IP address to hostname.",
    format: "in-addr-name TTL IN PTR hostname",
    fields: [
      { name: "name", description: "Reversed-IP in-addr.arpa name (IPv4) or ip6.arpa (IPv6)", example: "34.216.184.93.in-addr.arpa.", required: true },
      { name: "TTL", description: "Time-to-live in seconds", example: "3600", required: true },
      { name: "IN", description: "Class", example: "IN", required: true },
      { name: "PTR", description: "Record type", example: "PTR", required: true },
      { name: "hostname", description: "Forward hostname for the IP", example: "example.com.", required: true },
    ],
    example: "34.216.184.93.in-addr.arpa.  3600  IN  PTR  example.com.",
    useCases: [
      "Mail server reverse DNS (many MTAs reject if PTR/A mismatch).",
      "Log enrichment (IP → hostname in security/event logs).",
      "Anti-spam checks (HELO forward-confirmed reverse DNS).",
    ],
    notes: ["For IPv4 reverse the octets: 93.184.216.34 → 34.216.184.93.in-addr.arpa.", "For IPv6 reverse each nibble: 2001:db8::1 → 1.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.8.b.d.0.1.0.0.2.ip6.arpa."],
  },
  {
    type: "SRV",
    rfc: "RFC 2782",
    summary: "Service locator — priority/weight/port/target.",
    format: "_service._proto.name TTL IN SRV priority weight port target",
    fields: [
      { name: "_service", description: "Service name (underscore-prefixed)", example: "_sip", required: true },
      { name: "_proto", description: "Protocol (_tcp or _udp)", example: "_tcp", required: true },
      { name: "name", description: "Domain the service belongs to", example: "example.com.", required: true },
      { name: "TTL", description: "Time-to-live in seconds", example: "3600", required: true },
      { name: "IN", description: "Class", example: "IN", required: true },
      { name: "SRV", description: "Record type", example: "SRV", required: true },
      { name: "priority", description: "Lower = preferred (like MX)", example: "10", required: true },
      { name: "weight", description: "Relative weight within same priority (0-65535)", example: "60", required: true },
      { name: "port", description: "TCP/UDP port (0-65535)", example: "5060", required: true },
      { name: "target", description: "Hostname providing the service (must have A/AAAA)", example: "sipserver.example.com.", required: true },
    ],
    example: "_sip._tcp.example.com.  3600  IN  SRV  10  60  5060  sipserver.example.com.",
    useCases: [
      "SIP/VoIP service discovery.",
      "XMPP federation (_xmpp-server._tcp).",
      "Active Directory domain controllers (_ldap._tcp.dc._msdcs).",
      "Kerberos (_kerberos._tcp).",
      "Minecraft & other game servers.",
    ],
    notes: ["Weight 0 disables weighted selection among same-priority targets."],
  },
  {
    type: "CAA",
    rfc: "RFC 8659",
    summary: "Certificate Authority Authorization — who may issue TLS certs.",
    format: "name TTL IN CAA flags tag \"value\"",
    fields: [
      { name: "name", description: "Domain name", example: "example.com.", required: true },
      { name: "TTL", description: "Time-to-live in seconds", example: "3600", required: true },
      { name: "IN", description: "Class", example: "IN", required: true },
      { name: "CAA", description: "Record type", example: "CAA", required: true },
      { name: "flags", description: "Issuer-critical flag byte (typically 0; 128 = critical)", example: "0", required: true },
      { name: "tag", description: "Property tag (issue | issuewild | iodef)", example: "issue", required: true },
      { name: "value", description: "CA domain or report URI (quoted)", example: "\"letsencrypt.org\"", required: true },
    ],
    example: "example.com.  3600  IN  CAA  0  issue  \"letsencrypt.org\"",
    useCases: [
      "Lock TLS issuance to a specific CA (Let's Encrypt, DigiCert, etc.).",
      "Block all issuance with `0 issue \";\"`.",
      "Receive violation reports via `iodef` tag (mailto: or https: URI).",
      "Wildcard-specific rules with `issuewild`.",
    ],
    notes: ["CAs MUST check CAA before issuing (RFC 8659 mandatory-to-implement).", "Flag 128 (issuer-critical) tells CAs that don't understand the tag to refuse issuance."],
  },
  {
    type: "DS",
    rfc: "RFC 4034",
    summary: "DNSSEC delegation signer — hash of child's KSK.",
    format: "name TTL IN DS keytag algorithm digesttype digest",
    fields: [
      { name: "name", description: "Delegated child zone apex", example: "example.com.", required: true },
      { name: "TTL", description: "Time-to-live in seconds", example: "86400", required: true },
      { name: "IN", description: "Class", example: "IN", required: true },
      { name: "DS", description: "Record type", example: "DS", required: true },
      { name: "keytag", description: "Key tag (16-bit short for the DNSKEY)", example: "31560", required: true },
      { name: "algorithm", description: "DNSSEC algorithm (8 = RSASHA256, 13 = ECDSAP256SHA256)", example: "13", required: true },
      { name: "digesttype", description: "Digest type (2 = SHA-256, 4 = SHA-384)", example: "2", required: true },
      { name: "digest", description: "Hex digest of the DNSKEY", example: "E2D3C916F6DEEAC73294E8268FB5885044A833FC5459588F4A9184CFC41A5766", required: true },
    ],
    example: "example.com.  86400  IN  DS  31560  13  2  E2D3C916F6DEEAC73294E8268FB5885044A833FC5459588F4A9184CFC41A5766",
    useCases: [
      "Establish the DNSSEC chain of trust from parent to child zone.",
      "Required at the registrar for the zone to be DNSSEC-signed and validated.",
      "Algorithm rollover uses double-DS publishing.",
    ],
    notes: ["DS lives in the PARENT zone (e.g. com. holds example.com's DS).", "DNSKEY lives in the CHILD zone. The DS is the SHA digest of the DNSKEY."],
  },
  {
    type: "DNSKEY",
    rfc: "RFC 4034",
    summary: "DNSSEC public key for the zone.",
    format: "name TTL IN DNSKEY flags protocol algorithm publickey",
    fields: [
      { name: "name", description: "Zone apex", example: "example.com.", required: true },
      { name: "TTL", description: "Time-to-live in seconds", example: "3600", required: true },
      { name: "IN", description: "Class", example: "IN", required: true },
      { name: "DNSKEY", description: "Record type", example: "DNSKEY", required: true },
      { name: "flags", description: "256 = ZSK, 257 = KSK (SEP bit set)", example: "257", required: true },
      { name: "protocol", description: "Always 3 (DNSSEC)", example: "3", required: true },
      { name: "algorithm", description: "Algorithm (8 = RSASHA256, 13 = ECDSAP256SHA256, 15 = ED25519)", example: "13", required: true },
      { name: "publickey", description: "Base64-encoded public key", example: "x9AeT9...==", required: true },
    ],
    example: "example.com.  3600  IN  DNSKEY  257  3  13  x9AeT9pJzpM1y3LnVBj9Kq6gkNAo5n3lqgq1n3L9q2Q0=",
    useCases: [
      "Publish the zone's signing key so validators can verify RRSIG records.",
      "KSK/ZSK split — KSK signs DNSKEY RRset, ZSK signs everything else.",
      "Key rollover (pre-publish, double-signature, RFC 6781).",
    ],
    notes: ["The DS record in the parent zone is the SHA digest of the KSK DNSKEY."],
  },
  {
    type: "RRSIG",
    rfc: "RFC 4034",
    summary: "DNSSEC signature covering an RRset.",
    format: "name TTL IN RRSIG typecovered algorithm labels origttl expiration inception keytag signer signature",
    fields: [
      { name: "name", description: "Owner name of the signed RRset", example: "example.com.", required: true },
      { name: "TTL", description: "Same TTL as the covered RRset", example: "3600", required: true },
      { name: "IN", description: "Class", example: "IN", required: true },
      { name: "RRSIG", description: "Record type", example: "RRSIG", required: true },
      { name: "typecovered", description: "Type of the covered RRset (e.g. A, MX)", example: "A", required: true },
      { name: "algorithm", description: "DNSSEC algorithm", example: "13", required: true },
      { name: "labels", description: "Number of labels in owner name (root = 0)", example: "2", required: true },
      { name: "origttl", description: "Original TTL of the covered RRset", example: "3600", required: true },
      { name: "expiration", description: "Signature expiration (Unix timestamp)", example: "20250201000000", required: true },
      { name: "inception", description: "Signature inception (Unix timestamp)", example: "20250101000000", required: true },
      { name: "keytag", description: "Key tag of the signing DNSKEY", example: "31560", required: true },
      { name: "signer", description: "Signer's name (zone apex)", example: "example.com.", required: true },
      { name: "signature", description: "Base64 signature", example: "y9...==", required: true },
    ],
    example: "example.com.  3600  IN  RRSIG  A  13  2  3600  20250201000000  20250101000000  31560  example.com.  y9AeT9...==",
    useCases: [
      "Validates that an RRset was signed by the zone's key and has not been tampered with.",
      "Required for DNSSEC validation; absent RRSIG = insecure response.",
    ],
    notes: ["RRSIGs are returned alongside the records they cover when the DO bit is set.", "Validation requires the chain of trust: DS at parent → DNSKEY → RRSIG."],
  },
  {
    type: "TLSA",
    rfc: "RFC 6698",
    summary: "TLS Authentication record (DANE) — bind TLS cert to DNS.",
    format: "_port._proto.name TTL IN TLSA usage selector matchingtype certificate",
    fields: [
      { name: "_port", description: "Port (underscore-prefixed)", example: "_443", required: true },
      { name: "_proto", description: "Protocol (_tcp / _udp / _sctp)", example: "_tcp", required: true },
      { name: "name", description: "Domain", example: "example.com.", required: true },
      { name: "TTL", description: "Time-to-live in seconds", example: "3600", required: true },
      { name: "IN", description: "Class", example: "IN", required: true },
      { name: "TLSA", description: "Record type", example: "TLSA", required: true },
      { name: "usage", description: "0=PKIX-TA, 1=PKIX-EE, 2=DANE-TA, 3=DANE-EE", example: "3", required: true },
      { name: "selector", description: "0=full cert, 1=subjectPublicKeyInfo", example: "1", required: true },
      { name: "matchingtype", description: "0=full, 1=SHA-256, 2=SHA-512", example: "1", required: true },
      { name: "certificate", description: "Hex of the cert / hash", example: "9c1f5e0d...", required: true },
    ],
    example: "_443._tcp.example.com.  3600  IN  TLSA  3  1  1  9c1f5e0d8e7b6a5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1",
    useCases: [
      "DANE — pin TLS certificates via DNS (with DNSSEC).",
      "MTA-to-MTA SMTP TLS (DANE-SMTP, RFC 7672).",
      "Bypass CA system for high-security internal services.",
    ],
    notes: ["Requires DNSSEC validation to be trustworthy.", "Usage 3 (DANE-EE) is most common — pin the leaf cert hash directly."],
  },
  {
    type: "SSHFP",
    rfc: "RFC 4255",
    summary: "SSH fingerprint — verify SSH host keys via DNS.",
    format: "name TTL IN SSHFP algorithm fingerprinttype fingerprint",
    fields: [
      { name: "name", description: "Host name", example: "host.example.com.", required: true },
      { name: "TTL", description: "Time-to-live in seconds", example: "3600", required: true },
      { name: "IN", description: "Class", example: "IN", required: true },
      { name: "SSHFP", description: "Record type", example: "SSHFP", required: true },
      { name: "algorithm", description: "1=RSA, 2=DSA, 3=ECDSA, 4=Ed25519, 6=Ed448", example: "4", required: true },
      { name: "fingerprinttype", description: "1=SHA-1 (deprecated), 2=SHA-256", example: "2", required: true },
      { name: "fingerprint", description: "Hex fingerprint of the host key", example: "a4b3c2d1...", required: true },
    ],
    example: "host.example.com.  3600  IN  SSHFP  4  2  a4b3c2d1e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90",
    useCases: [
      "Verify SSH host keys via DNSSEC-validated SSHFP records.",
      "Avoid TOFU (trust-on-first-use) warnings on first connect.",
      "Use with `ssh -o VerifyHostKeyDNS=yes`.",
    ],
    notes: ["Trusted only with DNSSEC validation.", "Ed25519 (algorithm 4) is the modern recommendation."],
  },
  {
    type: "DKIM",
    rfc: "RFC 6376 (via TXT)",
    summary: "Email signing public key (stored as TXT under selector._domainkey).",
    format: "<selector>._domainkey.name TTL IN TXT \"v=DKIM1; k=rsa; p=<base64-key>\"",
    fields: [
      { name: "selector", description: "DKIM selector (chosen by sender)", example: "default", required: true },
      { name: "name", description: "Domain (combined: selector._domainkey.domain)", example: "_domainkey.example.com.", required: true },
      { name: "TTL", description: "Time-to-live in seconds", example: "3600", required: true },
      { name: "TXT", description: "Record type (DKIM lives inside TXT)", example: "TXT", required: true },
      { name: "v", description: "Version tag — v=DKIM1", example: "v=DKIM1", required: true },
      { name: "k", description: "Key type — k=rsa, k=ed25519", example: "k=rsa", required: true },
      { name: "p", description: "Base64 public key (or empty to revoke)", example: "p=MIGfMA0GCS...", required: true },
    ],
    example: "default._domainkey.example.com.  3600  IN  TXT  \"v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQ...\"",
    useCases: [
      "Publish the public key for receivers to verify DKIM-signed email.",
      "Rotate keys by publishing under a new selector and removing the old.",
      "Revoke a key with empty p= tag.",
    ],
    notes: ["DKIM is technically a TXT record convention — there is no DKIM wire type.", "Common selectors: default, google, s1, selector1, k1."],
  },
  {
    type: "DMARC",
    rfc: "RFC 7489 (via TXT)",
    summary: "Domain-based Message Authentication policy (TXT under _dmarc).",
    format: "_dmarc.name TTL IN TXT \"v=DMARC1; p=policy; rua=mailto:...; ruf=mailto:...;\"",
    fields: [
      { name: "name", description: "Domain (prefixed with _dmarc)", example: "_dmarc.example.com.", required: true },
      { name: "TTL", description: "Time-to-live in seconds", example: "3600", required: true },
      { name: "TXT", description: "Record type (DMARC lives inside TXT)", example: "TXT", required: true },
      { name: "v", description: "Version — v=DMARC1", example: "v=DMARC1", required: true },
      { name: "p", description: "Policy: none | quarantine | reject", example: "p=reject", required: true },
      { name: "rua", description: "Aggregate report destination (mailto: URI)", example: "rua=mailto:dmarc@example.com", required: false },
      { name: "ruf", description: "Forensic report destination (mailto: URI)", example: "ruf=mailto:dmarc@example.com", required: false },
      { name: "pct", description: "Percent of mail the policy applies to (0-100)", example: "pct=100", required: false },
      { name: "adkim", description: "DKIM alignment: r (relaxed) | s (strict)", example: "adkim=r", required: false },
      { name: "aspf", description: "SPF alignment: r (relaxed) | s (strict)", example: "aspf=r", required: false },
    ],
    example: "_dmarc.example.com.  3600  IN  TXT  \"v=DMARC1; p=reject; rua=mailto:dmarc-agg@example.com; ruf=mailto:dmarc-forensic@example.com; pct=100; adkim=r; aspf=r\"",
    useCases: [
      "Tell receivers to reject (p=reject) or quarantine (p=quarantine) failing mail.",
      "Receive aggregate (rua) and forensic (ruf) reports for monitoring.",
      "Gradual rollout: p=none → p=quarantine with pct=10 → pct=100 → p=reject.",
    ],
    notes: ["DMARC requires SPF and/or DKIM to be set up first.", "DMARC is technically a TXT record convention — there is no DMARC wire type."],
  },
  {
    type: "ANY",
    rfc: "RFC 1035 (historical)",
    summary: "Pseudo-type 'all records' — often returns minimal data due to DNSSEC/ANY suppression.",
    format: "dig domain ANY",
    fields: [
      { name: "name", description: "Domain to query", example: "example.com.", required: true },
      { name: "ANY", description: "Pseudo-type — ask for all records", example: "ANY", required: true },
    ],
    example: "dig example.com ANY",
    useCases: [
      "Quick reconnaissance — see what records exist at a name.",
      "Many modern resolvers (Cloudflare, etc.) return HINFO or minimal data instead of all records.",
    ],
    notes: ["RFC 8482 deprecates ANY; many resolvers return a single HINFO placeholder.", "Better: query each type individually."],
  },
];

export function getRecordType(type: RecordType): RecordTypeReference | null {
  return RECORD_TYPES.find((r) => r.type === type) ?? null;
}

// ---------------------------------------------------------------------------
// Domain normalization & query target builder
// ---------------------------------------------------------------------------

/** Normalize a domain (trim, lowercase, strip trailing dot, IDN→punycode best-effort). */
export function normalizeDomain(domain: string): string {
  let d = (domain || "").trim().toLowerCase();
  // Strip protocol prefix
  d = d.replace(/^[a-z]+:\/\//, "");
  // Strip path
  d = d.split("/")[0] ?? "";
  // Strip port
  d = d.split(":")[0] ?? "";
  // Strip trailing dot
  d = d.replace(/\.+$/, "");
  return d;
}

/** Build the actual query name for a record type (handles DKIM/DMARC/PTR). */
export function buildQueryName(domain: string, type: RecordType, dkimSelector: string = "default"): string {
  const d = normalizeDomain(domain);
  if (!d) return "";
  switch (type) {
    case "DKIM":
      return `${dkimSelector || "default"}._domainkey.${d}`;
    case "DMARC":
      return `_dmarc.${d}`;
    default:
      return d;
  }
}

// ---------------------------------------------------------------------------
// Command generator
// ---------------------------------------------------------------------------

export interface CommandOptions {
  tool: CommandTool;
  domain: string;
  type: RecordType;
  resolver: ResolverId;
  /** For custom resolver — IP/hostname to use as @server. */
  customServer: string;
  /** DKIM selector (used only when type === "DKIM"). */
  dkimSelector: string;
  /** Dig flags to apply. */
  flags: DigFlag[];
}

export function generateCommands(opts: CommandOptions): GeneratedCommand[] {
  const qname = buildQueryName(opts.domain, opts.type, opts.dkimSelector);
  if (!qname) return [];
  const resolver = getResolver(opts.resolver);
  const server = opts.resolver === "custom" ? opts.customServer : resolver.server;
  const serverPart = server ? `@${server}` : "";
  const typeStr = opts.type === "DKIM" || opts.type === "DMARC" ? "TXT" : opts.type === "ANY" ? "ANY" : opts.type;

  const out: GeneratedCommand[] = [];

  // dig
  const digParts = ["dig"];
  if (serverPart) digParts.push(serverPart);
  digParts.push(qname, typeStr);
  for (const f of opts.flags) {
    digParts.push(...digFlagArgs(f));
  }
  out.push({
    tool: "dig",
    command: digParts.join(" "),
    explanation: `Standard dig query for ${opts.type} records on ${qname}${server ? ` via ${server}` : ""}.`,
  });

  // nslookup (no flags support — use server + type + name)
  const nslookupParts = ["nslookup"];
  nslookupParts.push("-type=" + typeStr, qname);
  if (server) nslookupParts.push(server);
  out.push({
    tool: "nslookup",
    command: nslookupParts.join(" "),
    explanation: `nslookup (interactive-style one-shot) for ${opts.type} on ${qname}${server ? ` via ${server}` : ""}.`,
  });

  // kdig (DoH) — only when resolver supports DoH
  if (resolver.dohUrl && opts.tool !== "delv") {
    const kdigParts = ["kdig"];
    if (serverPart) kdigParts.push(serverPart);
    kdigParts.push(qname, typeStr, `+https=${resolver.dohUrl}`);
    if (opts.flags.includes("short")) kdigParts.push("+short");
    if (opts.flags.includes("dnssec")) kdigParts.push("+dnssec");
    out.push({
      tool: "kdig",
      command: kdigParts.join(" "),
      explanation: `DNS-over-HTTPS query (kdig) — encrypted transport to ${resolver.label}.`,
    });
  }

  // delv (DNSSEC validation)
  if (opts.type === "DS" || opts.type === "DNSKEY" || opts.type === "RRSIG" || opts.flags.includes("dnssec")) {
    const delvParts = ["delv"];
    if (serverPart) delvParts.push(serverPart);
    delvParts.push(qname, typeStr);
    out.push({
      tool: "delv",
      command: delvParts.join(" "),
      explanation: `DNSSEC chain validation with delv — shows the validated RRset + trust chain.`,
    });
  }

  // host (simple)
  const hostParts = ["host"];
  hostParts.push("-t", typeStr.toLowerCase(), qname);
  if (server) hostParts.push(server);
  out.push({
    tool: "host",
    command: hostParts.join(" "),
    explanation: `Simple host lookup for ${opts.type} on ${qname}${server ? ` via ${server}` : ""}.`,
  });

  return out;
}

export function digFlagArgs(flag: DigFlag): string[] {
  switch (flag) {
    case "short": return ["+short"];
    case "answer": return ["+noall", "+answer"];
    case "trace": return ["+trace"];
    case "dnssec": return ["+dnssec"];
    case "multi": return ["+multi"];
    case "cdflag": return ["+cdflag"];
    case "reverse": return ["-x"];
    case "all": return ["+all"];
  }
}

// ---------------------------------------------------------------------------
// Reverse-DNS name builder (for PTR)
// ---------------------------------------------------------------------------

export function ipv4ToPtrName(ip: string): string | null {
  const parts = (ip || "").trim().split(".").filter(Boolean);
  if (parts.length !== 4) return null;
  for (const p of parts) {
    if (!/^\d+$/.test(p)) return null;
    const n = parseInt(p, 10);
    if (n < 0 || n > 255) return null;
  }
  return `${parts[3]}.${parts[2]}.${parts[1]}.${parts[0]}.in-addr.arpa`;
}

export function ipv6ToPtrName(ip: string): string | null {
  // Best-effort: expand :: and validate 8 groups of 1-4 hex chars
  const clean = (ip || "").trim().toLowerCase();
  if (!clean) return null;
  // Reject if multiple "::" sequences (invalid per RFC 5952)
  const doubleColonMatches = clean.match(/::/g);
  if (doubleColonMatches && doubleColonMatches.length > 1) return null;
  let expanded: string;
  if (clean.includes("::")) {
    const [head, tail] = clean.split("::");
    const headParts = head ? head.split(":") : [];
    const tailParts = tail ? tail.split(":") : [];
    const missing = 8 - headParts.length - tailParts.length;
    if (missing < 0) return null;
    expanded = [...headParts, ...Array(missing).fill("0"), ...tailParts].join(":");
  } else {
    expanded = clean;
  }
  const groups = expanded.split(":");
  if (groups.length !== 8) return null;
  // Collect all nibbles in order, then reverse the whole array for PTR.
  const allNibbles: string[] = [];
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
    const padded = g.padStart(4, "0");
    for (let i = 0; i < 4; i++) {
      allNibbles.push(padded[i]!);
    }
  }
  const reversed = allNibbles.reverse();
  return `${reversed.join(".")}.ip6.arpa`;
}

// ---------------------------------------------------------------------------
// Example record parsers
// ---------------------------------------------------------------------------

/** Parse a TXT record example into reassembled string (RFC 7208 multi-string). */
export function parseTxtRecord(rdata: string): { reassembled: string; parts: string[] } {
  // Match quoted segments
  const parts: string[] = [];
  const re = /"([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rdata)) !== null) {
    parts.push(m[1] ?? "");
  }
  if (parts.length === 0) {
    // Unquoted single-token fallback
    return { reassembled: rdata.trim(), parts: [rdata.trim()] };
  }
  return { reassembled: parts.join(""), parts };
}

/** Parse an SOA rdata into named fields. */
export function parseSoaRecord(rdata: string): ParsedRecord {
  const tokens = (rdata || "").trim().split(/\s+/);
  const fields: { name: string; value: string }[] = [];
  const names = ["mname", "rname", "serial", "refresh", "retry", "expire", "minimum"];
  for (let i = 0; i < Math.min(tokens.length, 7); i++) {
    fields.push({ name: names[i] ?? `field${i}`, value: tokens[i] ?? "" });
  }
  const notes: string[] = [];
  if (fields.length >= 3) {
    const serial = parseInt(fields[2]!.value, 10);
    if (!Number.isNaN(serial) && serial >= 20000101) {
      notes.push(`Serial ${serial} appears to use YYYYMMDDNN convention.`);
    }
  }
  if (fields.length >= 4) {
    const refresh = parseInt(fields[3]!.value, 10);
    if (!Number.isNaN(refresh)) notes.push(`Refresh ${refresh}s = ${(refresh / 3600).toFixed(1)}h.`);
  }
  return { type: "SOA", fields, notes };
}

/** Parse an MX rdata into priority + exchanger. */
export function parseMxRecord(rdata: string): ParsedRecord {
  const tokens = (rdata || "").trim().split(/\s+/);
  if (tokens.length < 2) return { type: "MX", fields: [], notes: ["insufficient tokens"] };
  const priority = parseInt(tokens[0] ?? "", 10);
  const exchanger = tokens[1] ?? "";
  const notes: string[] = [];
  if (!Number.isNaN(priority)) notes.push(`Priority ${priority} — lower is preferred.`);
  if (exchanger) notes.push(`Mail exchanger: ${exchanger}`);
  return {
    type: "MX",
    fields: [
      { name: "priority", value: tokens[0] ?? "" },
      { name: "exchanger", value: exchanger },
    ],
    notes,
  };
}

/** Parse an SRV rdata into priority/weight/port/target. */
export function parseSrvRecord(rdata: string): ParsedRecord {
  const tokens = (rdata || "").trim().split(/\s+/);
  if (tokens.length < 4) return { type: "SRV", fields: [], notes: ["insufficient tokens"] };
  const [priority, weight, port, ...targetParts] = tokens;
  const target = targetParts.join(" ");
  return {
    type: "SRV",
    fields: [
      { name: "priority", value: priority ?? "" },
      { name: "weight", value: weight ?? "" },
      { name: "port", value: port ?? "" },
      { name: "target", value: target },
    ],
    notes: [
      `Priority ${priority} (lower = preferred)`,
      `Weight ${weight} (relative within same priority)`,
      `Port ${port}`,
      `Target ${target}`,
    ],
  };
}

/** Parse a CAA rdata into flags/tag/value. */
export function parseCaaRecord(rdata: string): ParsedRecord {
  const tokens: string[] = [];
  let m: RegExpExecArray | null;
  const re = /"([^"]*)"|(\S+)/g;
  while ((m = re.exec(rdata || "")) !== null) {
    tokens.push(m[1] ?? m[2] ?? "");
  }
  if (tokens.length < 3) return { type: "CAA", fields: [], notes: ["insufficient tokens"] };
  const flags = tokens[0] ?? "";
  const tag = tokens[1] ?? "";
  const value = tokens.slice(2).join(" ");
  const notes: string[] = [];
  const flagNum = parseInt(flags, 10);
  if (!Number.isNaN(flagNum)) {
    notes.push(flagNum === 128 ? "Issuer-critical flag set (128) — CAs must refuse if tag unknown." : "Flags = 0 (non-critical).");
  }
  if (tag === "issue" || tag === "issuewild") notes.push(`Tag "${tag}" — authorizes a CA to issue certificates.`);
  if (tag === "iodef") notes.push("Tag \"iodef\" — violation reports sent to the URI in value.");
  if (value === ";") notes.push("Value \";\" — blocks ALL certificate issuance.");
  return {
    type: "CAA",
    fields: [
      { name: "flags", value: flags },
      { name: "tag", value: tag },
      { name: "value", value: value },
    ],
    notes,
  };
}

/** Parse a DS rdata into keytag/algorithm/digesttype/digest. */
export function parseDsRecord(rdata: string): ParsedRecord {
  const tokens = (rdata || "").trim().split(/\s+/);
  if (tokens.length < 4) return { type: "DS", fields: [], notes: ["insufficient tokens"] };
  const [keytag, algorithm, digesttype, ...digestParts] = tokens;
  const digest = digestParts.join("");
  const algNames: Record<string, string> = {
    "8": "RSASHA256", "10": "RSASHA512", "13": "ECDSAP256SHA256", "14": "ECDSAP384SHA384", "15": "ED25519", "16": "ED448",
  };
  const digestNames: Record<string, string> = { "1": "SHA-1", "2": "SHA-256", "3": "GOST R 34.11-94", "4": "SHA-384" };
  return {
    type: "DS",
    fields: [
      { name: "keytag", value: keytag ?? "" },
      { name: "algorithm", value: algorithm ?? "" },
      { name: "digesttype", value: digesttype ?? "" },
      { name: "digest", value: digest },
    ],
    notes: [
      `Key tag ${keytag}`,
      `Algorithm ${algorithm} (${algNames[algorithm ?? ""] ?? "unknown"})`,
      `Digest type ${digesttype} (${digestNames[digesttype ?? ""] ?? "unknown"})`,
    ],
  };
}

/** Dispatch parser by record type. */
export function parseRecord(type: RecordType, rdata: string): ParsedRecord {
  switch (type) {
    case "SOA": return parseSoaRecord(rdata);
    case "MX": return parseMxRecord(rdata);
    case "SRV": return parseSrvRecord(rdata);
    case "CAA": return parseCaaRecord(rdata);
    case "DS": return parseDsRecord(rdata);
    case "TXT":
    case "DKIM":
    case "DMARC": {
      const p = parseTxtRecord(rdata);
      return {
        type: "TXT",
        fields: p.parts.map((s, i) => ({ name: `string${i + 1}`, value: s })),
        notes: [`Reassembled (${p.reassembled.length} chars): ${p.reassembled}`],
      };
    }
    default:
      return { type, fields: [{ name: "rdata", value: rdata }], notes: ["No structured parser for this type — raw rdata shown."] };
  }
}

// ---------------------------------------------------------------------------
// History (localStorage, max 20)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:dns-record-reference:history";
const HISTORY_MAX = 20;

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, HISTORY_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Shareable URL
// ---------------------------------------------------------------------------

export function buildShareUrl(params: Record<string, string>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") sp.set(k, v);
  }
  if (typeof window === "undefined") return `?${sp.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${sp.toString()}`;
}

export function parseShareUrl(hash: string): Record<string, string> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const sp = new URLSearchParams(clean);
  const out: Record<string, string> = {};
  sp.forEach((v, k) => { out[k] = v; });
  return out;
}
