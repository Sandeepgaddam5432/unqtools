/**
 * NSLookup Reference — pure logic.
 *
 * Static reference data for DNS record types (A, AAAA, MX, TXT, CNAME, NS,
 * SOA, PTR, CAA, SRV), query builder helpers, response format reference,
 * TTL reference, DNSSEC and EDNS reference, batch lookup stats, and a
 * download helper.
 *
 * Pure only — no DOM, no network. Designed as an offline cheat-sheet.
 */

export type QueryType =
  | "A" | "AAAA" | "MX" | "TXT" | "CNAME" | "NS" | "SOA" | "PTR" | "CAA" | "SRV";

export interface QueryTypeInfo {
  type: QueryType;
  name: string;
  description: string;
  /** Typical use case in plain language. */
  useCase: string;
  /** Example record value. */
  example: string;
  /** Output format expected from dig/nslookup. */
  responseFormat: string;
  /** Common fields returned. */
  fields: string[];
  /** Whether this query type is commonly used. */
  common: boolean;
}

export const QUERY_TYPES: QueryTypeInfo[] = [
  {
    type: "A", name: "Address (IPv4)",
    description: "Maps a hostname to an IPv4 address.",
    useCase: "Find the IPv4 address of a domain.",
    example: "example.com.  3600  IN  A  93.184.216.34",
    responseFormat: "ANSWER SECTION: <name> <ttl> IN A <ip>",
    fields: ["name", "ttl", "class", "type", "address"],
    common: true,
  },
  {
    type: "AAAA", name: "Address (IPv6)",
    description: "Maps a hostname to an IPv6 address.",
    useCase: "Find the IPv6 address of a domain.",
    example: "example.com.  3600  IN  AAAA  2606:2800:220:1:248:1893:25c8:1946",
    responseFormat: "ANSWER SECTION: <name> <ttl> IN AAAA <ip6>",
    fields: ["name", "ttl", "class", "type", "address"],
    common: true,
  },
  {
    type: "MX", name: "Mail Exchange",
    description: "Lists mail exchange servers for a domain.",
    useCase: "Find which servers receive email for a domain.",
    example: "example.com.  3600  IN  MX  10 mail.example.com.",
    responseFormat: "ANSWER SECTION: <name> <ttl> IN MX <preference> <exchange>",
    fields: ["name", "ttl", "class", "type", "preference", "exchange"],
    common: true,
  },
  {
    type: "TXT", name: "Text",
    description: "Arbitrary text records (SPF, DKIM, verification).",
    useCase: "Look up SPF, DKIM, domain verification tokens.",
    example: 'example.com.  3600  IN  TXT  "v=spf1 include:_spf.example.com ~all"',
    responseFormat: "ANSWER SECTION: <name> <ttl> IN TXT \"<string>\"",
    fields: ["name", "ttl", "class", "type", "text"],
    common: true,
  },
  {
    type: "CNAME", name: "Canonical Name",
    description: "Aliases one name to another.",
    useCase: "Alias www.example.com to example.com.",
    example: "www.example.com.  3600  IN  CNAME  example.com.",
    responseFormat: "ANSWER SECTION: <name> <ttl> IN CNAME <target>",
    fields: ["name", "ttl", "class", "type", "target"],
    common: true,
  },
  {
    type: "NS", name: "Name Server",
    description: "Lists authoritative name servers for a zone.",
    useCase: "Find authoritative NS for a domain.",
    example: "example.com.  86400  IN  NS  a.iana-servers.net.",
    responseFormat: "AUTHORITY SECTION: <name> <ttl> IN NS <ns>",
    fields: ["name", "ttl", "class", "type", "nameserver"],
    common: true,
  },
  {
    type: "SOA", name: "Start of Authority",
    description: "Authoritative information about a DNS zone.",
    useCase: "Inspect zone serial, refresh, retry, expiry, and minimum TTL.",
    example: "example.com. 3600 IN SOA ns.icann.org. noc.dns.icann.org. 2024010101 7200 3600 1209600 3600",
    responseFormat: "ANSWER SECTION: <name> <ttl> IN SOA <mname> <rname> <serial> <refresh> <retry> <expire> <minimum>",
    fields: ["mname", "rname", "serial", "refresh", "retry", "expire", "minimum"],
    common: false,
  },
  {
    type: "PTR", name: "Pointer (reverse DNS)",
    description: "Maps an IP address to a hostname (reverse lookup).",
    useCase: "Find the hostname associated with an IP address.",
    example: "34.216.184.93.in-addr.arpa. 3600 IN PTR example.com.",
    responseFormat: "ANSWER SECTION: <reverse-name> <ttl> IN PTR <hostname>",
    fields: ["name", "ttl", "class", "type", "hostname"],
    common: false,
  },
  {
    type: "CAA", name: "Certification Authority Authorization",
    description: "Restricts which CAs may issue certificates for a domain.",
    useCase: "Prevent unauthorized certificate issuance.",
    example: "example.com. 3600 IN CAA 0 issue \"letsencrypt.org\"",
    responseFormat: "ANSWER SECTION: <name> <ttl> IN CAA <flags> <tag> \"<value>\"",
    fields: ["flags", "tag", "value"],
    common: false,
  },
  {
    type: "SRV", name: "Service Record",
    description: "Defines host/port/weight for a service.",
    useCase: "Discover SIP, XMPP, AD domain controllers.",
    example: "_sip._tcp.example.com. 3600 IN SRV 10 60 5060 sip.example.com.",
    responseFormat: "ANSWER SECTION: <name> <ttl> IN SRV <priority> <weight> <port> <target>",
    fields: ["priority", "weight", "port", "target"],
    common: false,
  },
];

/** Look up info for a specific query type. */
export function lookupQueryType(type: QueryType): QueryTypeInfo | undefined {
  return QUERY_TYPES.find((q) => q.type === type);
}

/** Filter query types by common-ness. */
export function commonQueryTypes(): QueryTypeInfo[] {
  return QUERY_TYPES.filter((q) => q.common);
}

export interface QueryBuilderInput {
  domain: string;
  type: QueryType;
  server?: string;
  port?: number;
  /** Use TCP instead of UDP. */
  tcp?: boolean;
  /** Show verbose output. */
  verbose?: boolean;
}

/** Build a `dig` command from input. Pure. */
export function buildDigCommand(input: QueryBuilderInput): string {
  const parts = ["dig"];
  if (input.server) parts.push(`@${input.server}`);
  parts.push(input.domain);
  parts.push(input.type);
  if (input.port && input.port !== 53) parts.push(`-p ${input.port}`);
  if (input.tcp) parts.push("+tcp");
  if (input.verbose) parts.push("+trace");
  return parts.join(" ");
}

/** Build an `nslookup` command from input. Pure. */
export function buildNslookupCommand(input: QueryBuilderInput): string {
  const parts = ["nslookup"];
  if (input.server) parts.push(input.server);
  parts.push("-type=" + input.type);
  parts.push(input.domain);
  if (input.port && input.port !== 53) parts.push("-port=" + input.port);
  return parts.join(" ");
}

export interface TtlBucket {
  range: string;
  seconds: [number, number];
  description: string;
}

/** Reference table of common TTL values. */
export const TTL_REFERENCE: TtlBucket[] = [
  { range: "0–60s", seconds: [0, 60], description: "Near real-time; for fast-changing records (CDN failover)." },
  { range: "1–5m", seconds: [61, 300], description: "Short; for records that may change on deploy." },
  { range: "5–30m", seconds: [301, 1800], description: "Medium-short; balance between caching and agility." },
  { range: "30m–1h", seconds: [1801, 3600], description: "Medium; common default for A records." },
  { range: "1–6h", seconds: [3601, 21600], description: "Long; for stable records like MX or TXT." },
  { range: "6h–1d", seconds: [21601, 86400], description: "Long; for NS records and SOA minimums." },
  { range: "1d+", seconds: [86401, Number.MAX_SAFE_INTEGER], description: "Very long; for rarely-changing records." },
];

/** Classify a TTL value into a bucket. */
export function classifyTtl(ttl: number): TtlBucket | undefined {
  return TTL_REFERENCE.find((b) => ttl >= b.seconds[0] && ttl <= b.seconds[1]);
}

/** Reference for DNSSEC concepts. */
export const DNSSEC_REFERENCE = {
  description: "DNS Security Extensions — adds cryptographic signatures to DNS records.",
  recordTypes: ["DNSKEY", "RRSIG", "DS", "NSEC", "NSEC3"] as const,
  benefits: [
    "Authenticity — proves records came from the zone owner.",
    "Integrity — detects in-transit modification.",
    "Authenticated denial of existence — proves a record does not exist.",
  ],
  drawbacks: [
    "Larger response sizes (may require EDNS0 / TCP fallback).",
    "More complex to deploy and maintain.",
    "Key rollover must be carefully scheduled.",
  ],
};

/** Reference for EDNS (Extension Mechanisms for DNS). */
export const EDNS_REFERENCE = {
  description: "EDNS0 adds an OPT pseudo-record to extend DNS without protocol changes.",
  optRecordName: "OPT",
  version: 0,
  flags: ["DO (DNSSEC OK)", "Z (reserved)"] as const,
  extensions: ["Cookies", "Client Subnet (ECS)", "Padding", "TCP Keepalive"] as const,
  defaultUdpSize: 4096,
};

export interface BatchLookup {
  domain: string;
  type: QueryType;
}

export interface BatchResult {
  lookups: BatchLookup[];
  digCommands: string[];
  nslookupCommands: string[];
  stats: BatchStats;
}

export interface BatchStats {
  count: number;
  byType: Record<QueryType, number>;
  uniqueDomains: number;
}

/** Build commands for a batch of lookups. */
export function planBatch(lookups: BatchLookup[]): BatchResult {
  const digCommands = lookups.map((l) => buildDigCommand({ domain: l.domain, type: l.type }));
  const nslookupCommands = lookups.map((l) => buildNslookupCommand({ domain: l.domain, type: l.type }));
  const byType = QUERY_TYPES.reduce((acc, t) => {
    acc[t.type] = 0;
    return acc;
  }, {} as Record<QueryType, number>);
  for (const l of lookups) byType[l.type]++;
  const uniqueDomains = new Set(lookups.map((l) => l.domain)).size;
  return { lookups, digCommands, nslookupCommands, stats: { count: lookups.length, byType, uniqueDomains } };
}

/** Render a plain-text reference document for a query type. */
export function renderQueryTypeReport(info: QueryTypeInfo): string {
  const lines: string[] = [];
  lines.push(`DNS Query Type: ${info.type} (${info.name})`);
  lines.push("=".repeat(40));
  lines.push(`Description:  ${info.description}`);
  lines.push(`Use case:     ${info.useCase}`);
  lines.push(`Example:      ${info.example}`);
  lines.push(`Response:     ${info.responseFormat}`);
  lines.push(`Fields:       ${info.fields.join(", ")}`);
  lines.push(`Common:       ${info.common ? "yes" : "no"}`);
  return lines.join("\n");
}

/** Render a CSV export of all query types. */
export function renderQueryTypesCsv(): string {
  const lines = ["type,name,description,common"];
  for (const q of QUERY_TYPES) {
    lines.push([q.type, q.name, `"${q.description.replace(/"/g, '""')}"`, String(q.common)].join(","));
  }
  return lines.join("\n");
}

/** Render a full markdown cheat-sheet. */
export function renderCheatSheet(): string {
  const lines: string[] = [];
  lines.push("# DNS / NSLookup Cheat Sheet");
  lines.push("");
  lines.push("## Query types");
  for (const q of QUERY_TYPES) {
    lines.push(`### ${q.type} — ${q.name}`);
    lines.push(`- ${q.description}`);
    lines.push(`- Use case: ${q.useCase}`);
    lines.push(`- Example: \`${q.example}\``);
    lines.push("");
  }
  lines.push("## TTL reference");
  for (const t of TTL_REFERENCE) {
    lines.push(`- ${t.range}: ${t.description}`);
  }
  lines.push("");
  lines.push("## DNSSEC");
  lines.push(`- ${DNSSEC_REFERENCE.description}`);
  lines.push(`- Record types: ${DNSSEC_REFERENCE.recordTypes.join(", ")}`);
  lines.push("");
  lines.push("## EDNS");
  lines.push(`- ${EDNS_REFERENCE.description}`);
  lines.push(`- Default UDP size: ${EDNS_REFERENCE.defaultUdpSize}`);
  return lines.join("\n");
}

export function getQueryTypes() { return [...QUERY_TYPES]; }
export function getTtlReference() { return [...TTL_REFERENCE]; }
