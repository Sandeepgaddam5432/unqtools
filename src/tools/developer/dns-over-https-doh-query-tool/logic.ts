/**
 * DNS-over-HTTPS (DoH) Query Tool — pure logic.
 *
 * Generate DoH query URLs and curl/wget/httpie/fetch commands for
 * Cloudflare (1.1.1.1), Google (dns.google), Quad9, and custom resolvers.
 * Support JSON mode (?name=&type=) and wire-format mode (application/dns-message,
 * base64url). Encode DNS wire-format messages in pure JS. Parse pasted DoH
 * JSON responses.
 *
 * Pure functions only — no DOM, no network, no external deps.
 *
 * PRIVACY: The history feature stores only operation metadata (name + type +
 * resolver + ts), NEVER any DNS response data.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ResolverId = "cloudflare" | "google" | "quad9" | "custom";

export type DoHMode = "json" | "wire";

export type HttpMethod = "GET" | "POST";

export type CommandTool = "curl" | "wget" | "httpie" | "fetch";

export interface ResolverPreset {
  id: ResolverId;
  label: string;
  /** JSON endpoint (RFC 8484 §4.2 — returns application/dns-json). */
  jsonUrl: string;
  /** Wire-format endpoint (RFC 8484 §4.1 — accepts application/dns-message). */
  wireUrl: string;
  /** Operator/notes. */
  notes: string;
  /** Whether the JSON endpoint typically allows CORS from browsers. */
  corsJson: boolean;
  /** Whether the wire endpoint typically allows CORS from browsers. */
  corsWire: boolean;
}

export interface DohQueryOptions {
  resolver: ResolverId;
  /** Custom DoH URL — used when resolver === "custom". For JSON mode this is the JSON endpoint; for wire mode this is the wire endpoint. */
  customUrl?: string;
  mode: DoHMode;
  method: HttpMethod;
  /** DNSSEC OK flag (EDNS0 DO bit). */
  doFlag: boolean;
  /** Checking Disabled flag (CD bit). */
  cdFlag: boolean;
  /** Random padding to avoid amplification (Cloudflare ignores; Google accepts name padding). */
  pad?: boolean;
}

export interface GeneratedCommand {
  tool: CommandTool;
  label: string;
  command: string;
  explanation: string;
}

export interface DnsAnswer {
  name: string;
  type: number;
  TTL: number;
  data: string;
}

export interface ParsedDohJson {
  status: number;
  statusText: string;
  truncated: boolean;
  recursionDesired: boolean;
  recursionAvailable: boolean;
  authenticatedData: boolean;
  checkingDisabled: boolean;
  answer: DnsAnswer[];
  authority: DnsAnswer[];
  additional: DnsAnswer[];
  question?: { name: string; type: number }[];
  comment?: string;
  notes: string[];
}

export interface HistoryEntry {
  ts: number;
  name: string;
  type: DnsRecordType;
  resolver: ResolverId;
  mode: DoHMode;
}

export type DnsRecordType =
  | "A" | "AAAA" | "AFSDB" | "APL" | "AXFR" | "CAA" | "CDNSKEY" | "CDS"
  | "CERT" | "CNAME" | "CSYNC" | "DHCID" | "DMARC" | "DNSKEY" | "DS"
  | "EUI48" | "EUI64" | "HINFO" | "HIP" | "HTTPS" | "IPSECKEY" | "KEY"
  | "KX" | "LOC" | "MX" | "NAPTR" | "NS" | "NSEC" | "NSEC3" | "NSEC3PARAM"
  | "OPENPGPKEY" | "PTR" | "RP" | "RRSIG" | "SIG" | "SMIMEA" | "SOA"
  | "SRV" | "SSHFP" | "SVCB" | "TA" | "TLSA" | "TXT" | "URI" | "ZONEMD"
  | "ANY" | "*";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const RESOLVERS: ResolverPreset[] = [
  {
    id: "cloudflare",
    label: "Cloudflare (1.1.1.1)",
    jsonUrl: "https://cloudflare-dns.com/dns-query",
    wireUrl: "https://cloudflare-dns.com/dns-query",
    notes: "Cloudflare 1.1.1.1. CORS-friendly for both JSON and wire. Use ?name=&type= for JSON (Accept: application/dns-json) and ?dns=<base64url> for wire (Accept: application/dns-message).",
    corsJson: true,
    corsWire: true,
  },
  {
    id: "google",
    label: "Google (dns.google)",
    jsonUrl: "https://dns.google/resolve",
    wireUrl: "https://dns.google/dns-query",
    notes: "Google Public DNS. JSON endpoint /resolve supports CORS for browser fetches. Wire endpoint /dns-query requires curl from a terminal in most cases.",
    corsJson: true,
    corsWire: false,
  },
  {
    id: "quad9",
    label: "Quad9 (9.9.9.9)",
    jsonUrl: "https://dns.quad9.net:5053/dns-query",
    wireUrl: "https://dns.quad9.net:5053/dns-query",
    notes: "Quad9 — security-focused, DNSSEC-validating by default. Same /dns-query endpoint for JSON (?name=) and wire (?dns=). Browser CORS support is variable — use curl in terminal.",
    corsJson: false,
    corsWire: false,
  },
  {
    id: "custom",
    label: "Custom DoH URL",
    jsonUrl: "",
    wireUrl: "",
    notes: "Enter any DoH endpoint URL. Common alternatives: NextDNS, AdGuard (https://dns.adguard-dns.com/dns-query), Mullvad (https://doh.mullvad.net/dns-query), Contabo (https://doh.contabo.net/dns-query).",
    corsJson: false,
    corsWire: false,
  },
];

export const RESOLVER_LABELS: Record<ResolverId, string> = {
  cloudflare: "Cloudflare (1.1.1.1)",
  google: "Google (dns.google)",
  quad9: "Quad9 (9.9.9.9)",
  custom: "Custom DoH URL",
};

export const RECORD_TYPES: DnsRecordType[] = [
  "A", "AAAA", "CAA", "CDNSKEY", "CDS", "CNAME", "DHCID",
  "DMARC", "DNSKEY", "DS", "EUI48", "EUI64", "HINFO", "HTTPS",
  "IPSECKEY", "KX", "LOC", "MX", "NAPTR", "NS", "NSEC", "NSEC3",
  "NSEC3PARAM", "OPENPGPKEY", "PTR", "RP", "RRSIG", "SIG", "SMIMEA",
  "SOA", "SRV", "SSHFP", "SVCB", "TLSA", "TXT", "URI", "ZONEMD",
  "ANY",
];

/** Map of record-type names to their numeric codes (RFC 1035 + extensions). */
export const RECORD_TYPE_CODES: Record<string, number> = {
  A: 1, NS: 2, CNAME: 5, SOA: 6, PTR: 12, HINFO: 13, MX: 15, TXT: 16,
  RP: 17, AFSDB: 18, SIG: 24, KEY: 25, PX: 26, GPOS: 27, AAAA: 28,
  LOC: 29, NXT: 30, SRV: 33, NAPTR: 35, KX: 36, CERT: 37, A6: 38,
  DNAME: 39, OPT: 41, APL: 42, DS: 43, SSHFP: 44, IPSECKEY: 45,
  RRSIG: 46, NSEC: 47, DNSKEY: 48, DHCID: 49, NSEC3: 50, NSEC3PARAM: 51,
  TLSA: 52, SMIMEA: 53, HIP: 55, CDS: 59, CDNSKEY: 60, OPENPGPKEY: 61,
  CSYNC: 62, ZONEMD: 63, SVCB: 64, HTTPS: 65, EUI48: 108, EUI64: 109,
  URI: 256, CAA: 257, AVC: 258, TA: 32768, DLV: 32769, AXFR: 252,
  IXFR: 251, ANY: 255, "*": 255,
};

/** Reverse map: numeric code → uppercase name. */
export const RECORD_CODE_TO_NAME: Record<number, string> = (() => {
  const out: Record<number, string> = {};
  for (const [k, v] of Object.entries(RECORD_TYPE_CODES)) {
    if (!(v in out)) out[v] = k;
  }
  return out;
})();

/** DNS RCODE values (RFC 1035 §6, plus extensions). */
export const RCODES: Record<number, string> = {
  0: "NOERROR",
  1: "FORMERR",
  2: "SERVFAIL",
  3: "NXDOMAIN",
  4: "NOTIMP",
  5: "REFUSED",
  6: "YXDOMAIN",
  7: "YXRRSET",
  8: "NXRRSET",
  9: "NOTAUTH",
  10: "NOTZONE",
  11: "DSOTYPENI",
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const DOMAIN_RE = /^(?=.{1,253}$)([a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9_])?\.)+[a-z]{2,}$/i;
const DNS_NAME_RE = /^([a-z0-9_-]+\.)*[a-z0-9_-]+\.?$/i;

/** Validate a DNS name (allows trailing dot, single-label, underscore prefixes for DMARC/_dmarc). */
export function validateDnsName(s: string): boolean {
  const v = (s || "").trim().toLowerCase();
  if (!v) return false;
  if (v.length > 253) return false;
  return DNS_NAME_RE.test(v);
}

/** Validate a domain (strict — at least one dot or TLD). */
export function validateDomain(s: string): boolean {
  return DOMAIN_RE.test((s || "").trim());
}

/** Normalize a DNS name — lowercase, strip leading/trailing whitespace, ensure trailing dot optional. */
export function normalizeDnsName(s: string): string {
  const v = (s || "").trim().toLowerCase();
  return v;
}

/** Validate a record type (case-insensitive). */
export function validateRecordType(s: string): s is DnsRecordType {
  const v = (s || "").trim().toUpperCase();
  return (RECORD_TYPES as string[]).includes(v);
}

/** Normalize a record type to its canonical uppercase form. Returns "" if invalid. */
export function normalizeRecordType(s: string): DnsRecordType | "" {
  const v = (s || "").trim().toUpperCase();
  return validateRecordType(v) ? (v as DnsRecordType) : "";
}

// ---------------------------------------------------------------------------
// Base64url helpers
// ---------------------------------------------------------------------------

/** Encode bytes (Uint8Array) to base64url string (no padding). */
export function base64UrlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const b64 = btoa(bin);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Decode a base64url (or base64) string to bytes (Uint8Array). */
export function base64UrlDecode(s: string): Uint8Array {
  if (!s) return new Uint8Array(0);
  let v = s.replace(/-/g, "+").replace(/_/g, "/");
  while (v.length % 4 !== 0) v += "=";
  const bin = atob(v);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Encode a regular string to base64url. */
export function base64UrlEncodeStr(s: string): string {
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i) & 0xff;
  return base64UrlEncode(bytes);
}

/** Decode a base64url string to a regular string (UTF-8 bytes). */
export function base64UrlDecodeStr(s: string): string {
  const bytes = base64UrlDecode(s);
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
  return out;
}

// ---------------------------------------------------------------------------
// DNS message encoding (wire format — RFC 1035 §4.1)
// ---------------------------------------------------------------------------

export interface DnsMessage {
  /** Transaction ID (random 16-bit). */
  id: number;
  flags: number;
  questions: DnsQuestion[];
  /** Optional EDNS0 OPT record (used for DO flag). */
  opt?: DnsOptRecord;
}

export interface DnsQuestion {
  name: string;
  type: number;
  klass: number;
}

export interface DnsOptRecord {
  name: string; // always "." (root)
  type: number; // 41 (OPT)
  udpPayloadSize: number; // typically 4096
  extendedRcode: number; // 0
  version: number; // 0
  flags: number; // DO bit = 0x8000
  data: Uint8Array; // empty for our use
}

/** Build a DNS query header. */
export function buildDnsHeader(id: number, rd: boolean, cd: boolean): number {
  // QR=0 (query), OPCODE=0 (standard query), AA=0, TC=0, RD bit, RA=0, Z=0, CD bit, RCODE=0
  let flags = 0;
  if (rd) flags |= 0x0100; // RD bit
  if (cd) flags |= 0x0010; // CD bit
  return ((id & 0xffff) << 16) | (flags & 0xffff);
}

/** Encode a DNS name into wire format (length-prefixed labels, terminated by 0). */
export function encodeDnsName(name: string): Uint8Array {
  const v = (name || "").trim().replace(/\.$/, "").toLowerCase();
  if (!v) return new Uint8Array([0]);
  const labels = v.split(".");
  const chunks: number[] = [];
  for (const label of labels) {
    if (label.length === 0) continue;
    if (label.length > 63) throw new Error(`DNS label too long: ${label}`);
    chunks.push(label.length);
    for (let i = 0; i < label.length; i++) chunks.push(label.charCodeAt(i) & 0xff);
  }
  chunks.push(0); // root terminator
  return new Uint8Array(chunks);
}

/** Encode an EDNS0 OPT record (RFC 6891). */
export function encodeOptRecord(opt: DnsOptRecord): Uint8Array {
  const name = encodeDnsName(opt.name); // root → [0]
  // Layout after name: TYPE(2) + CLASS(2) + ext-rcode(1) + version(1) + flags(2) + RDLENGTH(2) = 10 bytes
  const buf = new Uint8Array(name.length + 10);
  let i = 0;
  for (const b of name) buf[i++] = b;
  // TYPE = 41 (OPT)
  buf[i++] = 0; buf[i++] = 41;
  // CLASS = UDP payload size
  buf[i++] = (opt.udpPayloadSize >> 8) & 0xff;
  buf[i++] = opt.udpPayloadSize & 0xff;
  // extended-rcode (1 byte) + version (1 byte)
  buf[i++] = opt.extendedRcode & 0xff;
  buf[i++] = opt.version & 0xff;
  // flags (2 bytes) — DO bit is 0x8000
  buf[i++] = (opt.flags >> 8) & 0xff;
  buf[i++] = opt.flags & 0xff;
  // RDLENGTH
  const rdlen = opt.data.length;
  buf[i++] = (rdlen >> 8) & 0xff;
  buf[i++] = rdlen & 0xff;
  return buf;
}

/** Encode a complete DNS query message into wire format. */
export function encodeDnsMessage(msg: DnsMessage): Uint8Array {
  // Calculate total length
  const idBuf = new Uint8Array(2);
  idBuf[0] = (msg.id >> 8) & 0xff;
  idBuf[1] = msg.id & 0xff;
  const qdCount = msg.questions.length;
  const anCount = 0;
  const nsCount = 0;
  const arCount = msg.opt ? 1 : 0;
  const counts = new Uint8Array(8);
  counts[0] = (qdCount >> 8) & 0xff; counts[1] = qdCount & 0xff;
  counts[2] = (anCount >> 8) & 0xff; counts[3] = anCount & 0xff;
  counts[4] = (nsCount >> 8) & 0xff; counts[5] = nsCount & 0xff;
  counts[6] = (arCount >> 8) & 0xff; counts[7] = arCount & 0xff;
  const flags = new Uint8Array(2);
  flags[0] = (msg.flags >> 8) & 0xff;
  flags[1] = msg.flags & 0xff;
  // Encode questions
  const qBufs: Uint8Array[] = [];
  for (const q of msg.questions) {
    const name = encodeDnsName(q.name);
    const qbuf = new Uint8Array(name.length + 4);
    let i = 0;
    for (const b of name) qbuf[i++] = b;
    qbuf[i++] = (q.type >> 8) & 0xff;
    qbuf[i++] = q.type & 0xff;
    qbuf[i++] = (q.klass >> 8) & 0xff;
    qbuf[i++] = q.klass & 0xff;
    qBufs.push(qbuf);
  }
  const optBuf = msg.opt ? encodeOptRecord(msg.opt) : new Uint8Array(0);
  // Assemble
  const total = idBuf.length + flags.length + counts.length + qBufs.reduce((a, b) => a + b.length, 0) + optBuf.length;
  const out = new Uint8Array(total);
  let offset = 0;
  out.set(idBuf, offset); offset += idBuf.length;
  out.set(flags, offset); offset += flags.length;
  out.set(counts, offset); offset += counts.length;
  for (const qb of qBufs) { out.set(qb, offset); offset += qb.length; }
  if (optBuf.length > 0) { out.set(optBuf, offset); offset += optBuf.length; }
  return out;
}

/** Build a DNS query message for a name + type with optional DNSSEC DO/CD flags. */
export function buildDnsQueryMessage(
  name: string,
  type: DnsRecordType,
  opts: { doFlag?: boolean; cdFlag?: boolean; id?: number } = {},
): DnsMessage {
  const typeId = RECORD_TYPE_CODES[type] ?? 1;
  const id = opts.id ?? Math.floor(Math.random() * 0xffff);
  const rd = true; // always set RD for queries
  const cd = opts.cdFlag ?? false;
  const headerFlags = buildDnsHeader(id, rd, cd) & 0xffff;
  const msg: DnsMessage = {
    id,
    flags: headerFlags,
    questions: [{ name: normalizeDnsName(name), type: typeId, klass: 1 /* IN */ }],
  };
  if (opts.doFlag) {
    msg.opt = {
      name: ".",
      type: 41,
      udpPayloadSize: 4096,
      extendedRcode: 0,
      version: 0,
      flags: 0x8000, // DO bit
      data: new Uint8Array(0),
    };
  }
  return msg;
}

/** Encode a query message to base64url (for the ?dns= parameter). */
export function encodeDnsQueryBase64Url(
  name: string,
  type: DnsRecordType,
  opts: { doFlag?: boolean; cdFlag?: boolean; id?: number } = {},
): string {
  const msg = buildDnsQueryMessage(name, type, opts);
  const bytes = encodeDnsMessage(msg);
  return base64UrlEncode(bytes);
}

// ---------------------------------------------------------------------------
// DNS message decoding (minimal — header + questions for round-trip display)
// ---------------------------------------------------------------------------

export interface DecodedDnsHeader {
  id: number;
  flags: number;
  qr: boolean;
  opcode: number;
  aa: boolean;
  tc: boolean;
  rd: boolean;
  ra: boolean;
  z: number;
  ad: boolean;
  cd: boolean;
  rcode: number;
  rcodeText: string;
  qdCount: number;
  anCount: number;
  nsCount: number;
  arCount: number;
}

/** Decode a DNS message header from a wire-format byte array. */
export function decodeDnsHeader(bytes: Uint8Array): DecodedDnsHeader | null {
  if (bytes.length < 12) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const id = view.getUint16(0);
  const flags = view.getUint16(2);
  const qdCount = view.getUint16(4);
  const anCount = view.getUint16(6);
  const nsCount = view.getUint16(8);
  const arCount = view.getUint16(10);
  const qr = (flags & 0x8000) !== 0;
  const opcode = (flags >> 11) & 0x0f;
  const aa = (flags & 0x0400) !== 0;
  const tc = (flags & 0x0200) !== 0;
  const rd = (flags & 0x0100) !== 0;
  const ra = (flags & 0x0080) !== 0;
  const z = (flags >> 4) & 0x07;
  const ad = (flags & 0x0020) !== 0;
  const cd = (flags & 0x0010) !== 0;
  const rcode = flags & 0x000f;
  return {
    id, flags, qr, opcode, aa, tc, rd, ra, z, ad, cd, rcode,
    rcodeText: RCODES[rcode] ?? `UNKNOWN(${rcode})`,
    qdCount, anCount, nsCount, arCount,
  };
}

/** Decode a DNS name at a given offset, following pointers. Returns {name, nextOffset}. */
export function decodeDnsName(bytes: Uint8Array, offset: number): { name: string; nextOffset: number } {
  const labels: string[] = [];
  let pos = offset;
  let jumped = false;
  let jumpPos = 0;
  let safety = 0;
  while (safety++ < 256) {
    if (pos >= bytes.length) break;
    const len = bytes[pos];
    if (len === 0) {
      pos++;
      if (!jumped) jumpPos = pos;
      break;
    }
    if ((len & 0xc0) === 0xc0) {
      // pointer
      if (pos + 1 >= bytes.length) break;
      const pointer = ((len & 0x3f) << 8) | bytes[pos + 1];
      if (!jumped) {
        jumpPos = pos + 2;
        jumped = true;
      }
      pos = pointer;
      continue;
    }
    pos++;
    let label = "";
    for (let i = 0; i < len && pos < bytes.length; i++) {
      label += String.fromCharCode(bytes[pos++]);
    }
    labels.push(label);
  }
  return { name: labels.join(".") + (labels.length > 0 ? "." : ""), nextOffset: jumped ? jumpPos : pos };
}

// ---------------------------------------------------------------------------
// DoH URL building
// ---------------------------------------------------------------------------

function getResolver(id: ResolverId): ResolverPreset {
  const r = RESOLVERS.find((x) => x.id === id);
  if (!r) throw new Error(`Unknown resolver: ${id}`);
  return r;
}

/** Get the JSON endpoint URL for a resolver (uses customUrl when resolver is "custom"). */
export function getJsonEndpoint(resolver: ResolverId, customUrl?: string): string {
  if (resolver === "custom") return (customUrl ?? "").trim();
  return getResolver(resolver).jsonUrl;
}

/** Get the wire-format endpoint URL for a resolver (uses customUrl when resolver is "custom"). */
export function getWireEndpoint(resolver: ResolverId, customUrl?: string): string {
  if (resolver === "custom") return (customUrl ?? "").trim();
  return getResolver(resolver).wireUrl;
}

/** Build a DoH JSON URL (?name=&type=&do=&cd=). */
export function buildDohJsonUrl(
  name: string,
  type: DnsRecordType,
  opts: { resolver: ResolverId; customUrl?: string; doFlag?: boolean; cdFlag?: boolean; pad?: boolean },
): string {
  const endpoint = getJsonEndpoint(opts.resolver, opts.customUrl);
  if (!endpoint) return "";
  const n = normalizeDnsName(name);
  const t = type.toUpperCase();
  const params = new URLSearchParams();
  params.set("name", n);
  params.set("type", t);
  if (opts.doFlag) params.set("do", "1");
  if (opts.cdFlag) params.set("cd", "1");
  if (opts.pad) params.set("random_padding", randomPadding());
  const sep = endpoint.includes("?") ? "&" : "?";
  return `${endpoint}${sep}${params.toString()}`;
}

/** Build a DoH wire-format URL (?dns=<base64url>). */
export function buildDohWireUrl(
  name: string,
  type: DnsRecordType,
  opts: { resolver: ResolverId; customUrl?: string; doFlag?: boolean; cdFlag?: boolean; pad?: boolean },
): string {
  const endpoint = getWireEndpoint(opts.resolver, opts.customUrl);
  if (!endpoint) return "";
  const dnsB64 = encodeDnsQueryBase64Url(name, type, {
    doFlag: opts.doFlag,
    cdFlag: opts.cdFlag,
  });
  const params = new URLSearchParams();
  params.set("dns", dnsB64);
  if (opts.pad) params.set("random_padding", randomPadding());
  const sep = endpoint.includes("?") ? "&" : "?";
  return `${endpoint}${sep}${params.toString()}`;
}

/** Build the right URL for the given options. */
export function buildDohUrl(name: string, type: DnsRecordType, opts: DohQueryOptions): string {
  return opts.mode === "json"
    ? buildDohJsonUrl(name, type, opts)
    : buildDohWireUrl(name, type, opts);
}

/** Generate a random padding string (80 chars of [a-z0-9]). */
export function randomPadding(length = 80): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// ---------------------------------------------------------------------------
// Command generation
// ---------------------------------------------------------------------------

export function curlJsonCommand(url: string): string {
  return [
    "curl",
    "-sS",
    "-H 'Accept: application/dns-json'",
    `'${url}'`,
  ].join(" \\\n  ");
}

export function curlWireGetCommand(url: string): string {
  return [
    "curl",
    "-sS",
    "-H 'Accept: application/dns-message'",
    `'${url}'`,
    "--output response.dns",
  ].join(" \\\n  ");
}

export function curlWirePostCommand(url: string, dnsB64: string): string {
  // For POST, the body is the raw wire bytes — easiest to send base64 via a temporary file.
  return [
    "# Decode the base64url query to a binary file, then POST it:",
    `echo '${dnsB64}' | tr '\\-_' '\\+/' | base64 -d > query.dns`,
    "curl",
    "-sS",
    "-H 'Content-Type: application/dns-message'",
    "-H 'Accept: application/dns-message'",
    "--data-binary @query.dns",
    `'${url}'`,
    "--output response.dns",
  ].join(" \\\n  ");
}

export function wgetJsonCommand(url: string): string {
  return `wget -qO- --header='Accept: application/dns-json' '${url}'`;
}

export function wgetWireCommand(url: string): string {
  return `wget -qO response.dns --header='Accept: application/dns-message' '${url}'`;
}

export function httpieJsonCommand(url: string): string {
  return `http '${url}' Accept:application/dns-json`;
}

export function httpieWireCommand(url: string): string {
  return `http '${url}' Accept:application/dns-message --download --output response.dns`;
}

export function fetchJsonCommand(url: string): string {
  return [
    `fetch('${url}', { headers: { 'Accept': 'application/dns-json' } })`,
    `  .then(r => r.json())`,
    `  .then(data => console.log(JSON.stringify(data, null, 2)))`,
    `  .catch(err => console.error(err));`,
  ].join("\n");
}

export function fetchWireCommand(url: string): string {
  return [
    `fetch('${url}', { headers: { 'Accept': 'application/dns-message' } })`,
    `  .then(r => r.arrayBuffer())`,
    `  .then(buf => console.log('wire bytes:', new Uint8Array(buf)))`,
    `  .catch(err => console.error(err));`,
  ].join("\n");
}

/** Generate all command snippets for a DoH query. */
export function generateCommands(
  name: string,
  type: DnsRecordType,
  opts: DohQueryOptions,
): GeneratedCommand[] {
  const url = buildDohUrl(name, type, opts);
  if (!url) {
    return [{
      tool: "curl",
      label: "Missing endpoint URL",
      command: `# No endpoint URL configured — set a custom DoH URL for the "${opts.resolver}" resolver.`,
      explanation: `The "${RESOLVER_LABELS[opts.resolver]}" resolver requires a custom URL. Enter it in the input above.`,
    }];
  }
  const n = normalizeDnsName(name);
  const out: GeneratedCommand[] = [];
  if (opts.mode === "json") {
    out.push({
      tool: "curl",
      label: `curl — DoH JSON query for ${n} ${type}`,
      command: curlJsonCommand(url),
      explanation: `Sends a DoH GET with Accept: application/dns-json. Returns a JSON object with Status, Answer, Authority, Additional. RFC 8484 §4.2.`,
    });
    out.push({
      tool: "wget",
      label: `wget — DoH JSON query for ${n} ${type}`,
      command: wgetJsonCommand(url),
      explanation: `wget equivalent — useful on systems without curl.`,
    });
    out.push({
      tool: "httpie",
      label: `httpie — DoH JSON query for ${n} ${type}`,
      command: httpieJsonCommand(url),
      explanation: `httpie prints the JSON response with syntax highlighting. Install with: pip install httpie.`,
    });
    out.push({
      tool: "fetch",
      label: `fetch() — DoH JSON query for ${n} ${type}`,
      command: fetchJsonCommand(url),
      explanation: `Browser fetch() snippet. CORS support depends on the resolver — Cloudflare and Google's /resolve endpoint allow browser fetches; Quad9 and others may block.`,
    });
  } else {
    // Wire-format mode
    const dnsB64 = encodeDnsQueryBase64Url(name, type, { doFlag: opts.doFlag, cdFlag: opts.cdFlag });
    if (opts.method === "GET") {
      out.push({
        tool: "curl",
        label: `curl — DoH wire GET for ${n} ${type}`,
        command: curlWireGetCommand(url),
        explanation: `Sends a DoH GET with the wire-format query base64url-encoded in ?dns=. Accept: application/dns-message. The response is binary — save to a file and decode separately. RFC 8484 §4.1.1.`,
      });
      out.push({
        tool: "wget",
        label: `wget — DoH wire GET for ${n} ${type}`,
        command: wgetWireCommand(url),
        explanation: `wget equivalent — saves the binary response to response.dns.`,
      });
      out.push({
        tool: "httpie",
        label: `httpie — DoH wire GET for ${n} ${type}`,
        command: httpieWireCommand(url),
        explanation: `httpie — saves the binary response to response.dns. Use --print=Hh to inspect headers.`,
      });
      out.push({
        tool: "fetch",
        label: `fetch() — DoH wire GET for ${n} ${type}`,
        command: fetchWireCommand(url),
        explanation: `Browser fetch() snippet. The response is an ArrayBuffer of DNS wire bytes. CORS support varies by resolver.`,
      });
      out.push({
        tool: "curl",
        label: "Wire-format query (base64url)",
        command: `# base64url wire-format query (already in the URL above):\n${dnsB64}`,
        explanation: `This is the base64url-encoded DNS wire message in the ?dns= parameter. It encodes the header + question section (+ EDNS0 OPT record if DO=1). RFC 8484 §4.1.`,
      });
    } else {
      // POST
      out.push({
        tool: "curl",
        label: `curl — DoH wire POST for ${n} ${type}`,
        command: curlWirePostCommand(url, dnsB64),
        explanation: `DoH POST with the wire-format query as the body. Content-Type: application/dns-message. Useful when the query is too long for a URL or when you want cache-bypassing semantics. RFC 8484 §4.1.2.`,
      });
      out.push({
        tool: "fetch",
        label: `fetch() — DoH wire POST for ${n} ${type}`,
        command: [
          `// Decode the base64url query string into bytes first:`,
          `const b64 = '${dnsB64}';`,
          `const bin = atob(b64.replace(/-/g,'+').replace(/_/g,'/'));`,
          `const bytes = new Uint8Array(bin.length);`,
          `for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);`,
          ``,
          `fetch('${url}', {`,
          `  method: 'POST',`,
          `  headers: { 'Content-Type': 'application/dns-message', 'Accept': 'application/dns-message' },`,
          `  body: bytes,`,
          `})`,
          `  .then(r => r.arrayBuffer())`,
          `  .then(buf => console.log('wire bytes:', new Uint8Array(buf)))`,
          `  .catch(err => console.error(err));`,
        ].join("\n"),
        explanation: `Browser fetch() POST snippet. Sends the wire-format query as the request body.`,
      });
    }
  }
  return out;
}

/** Generate side-by-side comparison — same query, all preset resolvers. */
export function generateComparisonCommands(
  name: string,
  type: DnsRecordType,
  mode: DoHMode,
  opts: { doFlag?: boolean; cdFlag?: boolean } = {},
): GeneratedCommand[] {
  const out: GeneratedCommand[] = [];
  for (const r of RESOLVERS) {
    if (r.id === "custom") continue;
    const url = mode === "json"
      ? buildDohJsonUrl(name, type, { resolver: r.id, doFlag: opts.doFlag, cdFlag: opts.cdFlag })
      : buildDohWireUrl(name, type, { resolver: r.id, doFlag: opts.doFlag, cdFlag: opts.cdFlag });
    if (!url) continue;
    out.push({
      tool: "curl",
      label: r.label,
      command: mode === "json" ? curlJsonCommand(url) : curlWireGetCommand(url),
      explanation: r.notes,
    });
  }
  return out;
}

/** Build a PTR query name from an IPv4/IPv6 address (in-addr.arpa / ip6.arpa). */
export function buildPtrName(ip: string): string {
  const v = (ip || "").trim();
  // IPv4
  const v4 = v.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    return `${v4[4]}.${v4[3]}.${v4[2]}.${v4[1]}.in-addr.arpa.`;
  }
  // IPv6 — naive expand
  if (/^[0-9a-f:]+$/i.test(v) && v.includes(":")) {
    const expanded = expandIpv6(v);
    if (!expanded) return "";
    const nibbles = expanded.replace(/:/g, "").split("").reverse().join(".");
    return `${nibbles}.ip6.arpa.`;
  }
  return "";
}

/** Expand an IPv6 address to full 8-group form. Returns "" if invalid. */
export function expandIpv6(s: string): string {
  const v = (s || "").trim().toLowerCase();
  if (!v) return "";
  if (v === "::") return "0000:0000:0000:0000:0000:0000:0000:0000";
  let left: string[];
  let right: string[];
  if (v.includes("::")) {
    const parts = v.split("::");
    if (parts.length !== 2) return "";
    left = parts[0] ? parts[0].split(":") : [];
    right = parts[1] ? parts[1].split(":") : [];
  } else {
    left = v.split(":");
    right = [];
  }
  if (left.some((g) => g.length === 0 || g.length > 4 || !/^[0-9a-f]{1,4}$/.test(g))) return "";
  if (right.some((g) => g.length === 0 || g.length > 4 || !/^[0-9a-f]{1,4}$/.test(g))) return "";
  const missing = 8 - (left.length + right.length);
  if (missing < 0) return "";
  const groups = [...left, ...Array(missing).fill("0"), ...right];
  if (groups.length !== 8) return "";
  return groups.map((g) => g.padStart(4, "0")).join(":");
}

// ---------------------------------------------------------------------------
// DoH JSON response parsing
// ---------------------------------------------------------------------------

/** Parse a DoH JSON response (RFC 8484 §4.2 shape, used by Google & Cloudflare JSON endpoints). */
export function parseDohJsonResponse(raw: string): ParsedDohJson {
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(raw);
  } catch {
    return {
      status: -1,
      statusText: "PARSE_ERROR",
      truncated: false,
      recursionDesired: false,
      recursionAvailable: false,
      authenticatedData: false,
      checkingDisabled: false,
      answer: [],
      authority: [],
      additional: [],
      notes: ["Invalid JSON — could not parse the response. Make sure you copied the full JSON body."],
    };
  }
  if (typeof json !== "object" || json === null || Array.isArray(json)) {
    return {
      status: -1,
      statusText: "INVALID_SHAPE",
      truncated: false,
      recursionDesired: false,
      recursionAvailable: false,
      authenticatedData: false,
      checkingDisabled: false,
      answer: [],
      authority: [],
      additional: [],
      notes: ["Response is not a JSON object. Expected a DoH JSON response with Status, Answer, etc."],
    };
  }
  const status = typeof json.Status === "number" ? json.Status : -1;
  const statusText = RCODES[status] ?? (status === -1 ? "MISSING_STATUS" : `UNKNOWN(${status})`);
  const answer = (json.Answer as DnsAnswer[] | undefined) ?? [];
  const authority = (json.Authority as DnsAnswer[] | undefined) ?? [];
  const additional = (json.Additional as DnsAnswer[] | undefined) ?? [];
  const question = (json.Question as { name: string; type: number }[] | undefined);
  const comment = typeof json.Comment === "string" ? json.Comment : undefined;
  const notes: string[] = [];
  if (status === 3) notes.push("NXDOMAIN — the domain does not exist.");
  if (status === 2) notes.push("SERVFAIL — the resolver could not process the query (often DNSSEC validation failure).");
  if (status === 5) notes.push("REFUSED — the resolver refused to answer (often policy/rate-limit).");
  if (status === 0 && answer.length === 0) notes.push("NOERROR but no answers — the domain exists but has no records of this type.");
  return {
    status,
    statusText,
    truncated: typeof json.TC === "boolean" ? json.TC : false,
    recursionDesired: typeof json.RD === "boolean" ? json.RD : false,
    recursionAvailable: typeof json.RA === "boolean" ? json.RA : false,
    authenticatedData: typeof json.AD === "boolean" ? json.AD : false,
    checkingDisabled: typeof json.CD === "boolean" ? json.CD : false,
    answer,
    authority,
    additional,
    question,
    comment,
    notes,
  };
}

/** Map a record-type numeric code to its uppercase name. Returns "?" if unknown. */
export function recordTypeName(code: number): string {
  return RECORD_CODE_TO_NAME[code] ?? `TYPE${code}`;
}

/** Format a parsed DoH JSON response as a markdown table. */
export function renderMarkdown(parsed: ParsedDohJson): string {
  const lines: string[] = [];
  lines.push(`| Field | Value |`);
  lines.push(`| --- | --- |`);
  lines.push(`| Status | ${parsed.status} (${parsed.statusText}) |`);
  lines.push(`| Truncated (TC) | ${parsed.truncated} |`);
  lines.push(`| Recursion Desired (RD) | ${parsed.recursionDesired} |`);
  lines.push(`| Recursion Available (RA) | ${parsed.recursionAvailable} |`);
  lines.push(`| Authenticated Data (AD) | ${parsed.authenticatedData} |`);
  lines.push(`| Checking Disabled (CD) | ${parsed.checkingDisabled} |`);
  if (parsed.comment) lines.push(`| Comment | ${parsed.comment} |`);
  if (parsed.answer.length > 0) {
    lines.push("");
    lines.push(`### Answer (${parsed.answer.length})`);
    lines.push(`| Name | Type | TTL | Data |`);
    lines.push(`| --- | --- | --- | --- |`);
    for (const a of parsed.answer) {
      lines.push(`| ${a.name} | ${recordTypeName(a.type)} | ${a.TTL} | ${escapeMd(a.data)} |`);
    }
  }
  if (parsed.authority.length > 0) {
    lines.push("");
    lines.push(`### Authority (${parsed.authority.length})`);
    lines.push(`| Name | Type | TTL | Data |`);
    lines.push(`| --- | --- | --- | --- |`);
    for (const a of parsed.authority) {
      lines.push(`| ${a.name} | ${recordTypeName(a.type)} | ${a.TTL} | ${escapeMd(a.data)} |`);
    }
  }
  if (parsed.additional.length > 0) {
    lines.push("");
    lines.push(`### Additional (${parsed.additional.length})`);
    lines.push(`| Name | Type | TTL | Data |`);
    lines.push(`| --- | --- | --- | --- |`);
    for (const a of parsed.additional) {
      lines.push(`| ${a.name} | ${recordTypeName(a.type)} | ${a.TTL} | ${escapeMd(a.data)} |`);
    }
  }
  return lines.join("\n");
}

function escapeMd(s: string): string {
  return String(s).replace(/\|/g, "\\|");
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:dns-over-https-doh-query-tool:history";
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

export function buildShareUrl(
  name: string,
  type: DnsRecordType,
  opts: DohQueryOptions,
): string {
  const params = new URLSearchParams();
  if (name) params.set("name", name);
  if (type) params.set("type", type);
  if (opts.resolver) params.set("resolver", opts.resolver);
  if (opts.customUrl) params.set("customUrl", opts.customUrl);
  if (opts.mode) params.set("mode", opts.mode);
  if (opts.method) params.set("method", opts.method);
  if (opts.doFlag) params.set("do", "1");
  if (opts.cdFlag) params.set("cd", "1");
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): {
  name: string;
  type: DnsRecordType;
  opts: DohQueryOptions;
} {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  const fallbackType: DnsRecordType = "A";
  const fallback: { name: string; type: DnsRecordType; opts: DohQueryOptions } = {
    name: "",
    type: fallbackType,
    opts: {
      resolver: "cloudflare",
      customUrl: "",
      mode: "json",
      method: "GET",
      doFlag: false,
      cdFlag: false,
    },
  };
  if (!clean) return fallback;
  const params = new URLSearchParams(clean);
  const resolverRaw = params.get("resolver") ?? "cloudflare";
  const resolver = (RESOLVERS.find((r) => r.id === resolverRaw)?.id ?? "cloudflare") as ResolverId;
  const modeRaw = params.get("mode") ?? "json";
  const mode = modeRaw === "wire" ? "wire" : "json";
  const methodRaw = params.get("method") ?? "GET";
  const method = methodRaw === "POST" ? "POST" : "GET";
  const typeRaw = (params.get("type") ?? "A").toUpperCase();
  const type = validateRecordType(typeRaw) ? (typeRaw as DnsRecordType) : fallbackType;
  return {
    name: params.get("name") ?? "",
    type,
    opts: {
      resolver,
      customUrl: params.get("customUrl") ?? "",
      mode,
      method,
      doFlag: params.get("do") === "1",
      cdFlag: params.get("cd") === "1",
    },
  };
}
