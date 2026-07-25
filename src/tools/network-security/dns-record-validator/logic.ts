/**
 * DNS Record Validator — regex validators for common record types.
 *
 * Features:
 *  - Validates A, AAAA, CNAME, NS, MX, TXT, SRV, CAA records
 *  - IPv4 / IPv6 / hostname / email format checks
 *  - Priority, weight, port range validation
 *  - Batch mode (multiple records at once)
 *  - Zone-file formatted output
 *  - Reference table of record types
 *  - CSV export
 */

export type DnsRecordType = "A" | "AAAA" | "CNAME" | "NS" | "MX" | "TXT" | "SRV" | "CAA";

const IPV4_RE = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const IPV6_RE = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$/i;
const HOSTNAME_RE = /^(?=.{1,253}$)([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidIpv4(s: string): boolean { return IPV4_RE.test(s.trim()); }
export function isValidIpv6(s: string): boolean { return IPV6_RE.test(s.trim()); }
export function isValidHostname(s: string): boolean { return HOSTNAME_RE.test(s.trim()); }
export function isValidEmail(s: string): boolean { return EMAIL_RE.test(s.trim()); }

/** True if value is in 0-65535 range. */
export function isValidUint16(n: number | undefined | null): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 65535;
}

export interface DnsRecord {
  type: DnsRecordType;
  value: string;
  /** MX priority or SRV priority. */
  priority?: number;
  /** SRV weight. */
  weight?: number;
  /** SRV port. */
  port?: number;
  /** SRV target hostname. */
  target?: string;
  /** Optional name (owner) for zone-file rendering. */
  name?: string;
  /** Optional TTL for zone-file rendering. */
  ttl?: number;
}

export type ValidationResult = { ok: true } | { error: string };

/** Validate a DNS record's value for the given type. */
export function validateRecord(rec: DnsRecord): ValidationResult {
  const v = rec.value.trim();
  switch (rec.type) {
    case "A":
      if (!isValidIpv4(v)) return { error: "A record must be a valid IPv4 address" };
      return { ok: true };
    case "AAAA":
      if (!isValidIpv6(v)) return { error: "AAAA record must be a valid IPv6 address" };
      return { ok: true };
    case "CNAME":
    case "NS":
      if (!isValidHostname(v)) return { error: `${rec.type} record must be a valid hostname` };
      return { ok: true };
    case "MX":
      if (!isValidUint16(rec.priority)) return { error: "MX priority must be an integer 0-65535" };
      if (!isValidHostname(v)) return { error: "MX target must be a valid hostname" };
      return { ok: true };
    case "TXT":
      if (v.length === 0) return { error: "TXT record cannot be empty" };
      if (v.length > 255) return { error: "TXT record too long (max 255 chars)" };
      return { ok: true };
    case "SRV": {
      if (!isValidUint16(rec.priority)) return { error: "SRV priority must be an integer 0-65535" };
      if (!isValidUint16(rec.weight)) return { error: "SRV weight must be an integer 0-65535" };
      if (!isValidUint16(rec.port)) return { error: "SRV port must be an integer 0-65535" };
      if (!rec.target || !rec.target.trim()) return { error: "SRV needs a target hostname" };
      if (!isValidHostname(rec.target)) return { error: "SRV target must be a valid hostname" };
      return { ok: true };
    }
    case "CAA":
      // CAA format: flags tag "value"
      if (!/^\d+\s+(issue|issuewild|iodef)\s+".*"$/i.test(v)) return { error: 'CAA format: <flags> <tag> "<value>"' };
      return { ok: true };
    default:
      return { error: "Unknown record type" };
  }
}

/** Render a record as a single zone-file line. */
export function formatZoneLine(rec: DnsRecord): string {
  const name = rec.name && rec.name.trim() ? rec.name : "@";
  const ttl = rec.ttl && rec.ttl > 0 ? ` ${rec.ttl}` : "";
  switch (rec.type) {
    case "MX":
      return `${name}${ttl} IN MX ${rec.priority ?? 0} ${rec.value}`.trim();
    case "SRV":
      return `${name}${ttl} IN SRV ${rec.priority ?? 0} ${rec.weight ?? 0} ${rec.port ?? 0} ${rec.target ?? ""}`.trim();
    case "CAA":
      return `${name}${ttl} IN CAA ${rec.value}`.trim();
    default:
      return `${name}${ttl} IN ${rec.type} ${rec.value}`.trim();
  }
}

export interface BatchResult {
  record: DnsRecord;
  result: ValidationResult;
  zoneLine?: string;
}

/** Validate a list of records and attach zone-file lines for the valid ones. */
export function validateBatch(records: DnsRecord[]): BatchResult[] {
  return records.map((rec) => {
    const result = validateRecord(rec);
    return { record: rec, result, zoneLine: "ok" in result ? formatZoneLine(rec) : undefined };
  });
}

/** Aggregate counts for a batch result. */
export function batchStats(results: BatchResult[]): { total: number; ok: number; errors: number; byType: Record<string, number> } {
  let ok = 0;
  let errors = 0;
  const byType: Record<string, number> = {};
  for (const r of results) {
    byType[r.record.type] = (byType[r.record.type] ?? 0) + 1;
    if ("ok" in r.result) ok += 1;
    else errors += 1;
  }
  return { total: results.length, ok, errors, byType };
}

/** Reference table of DNS record types and their purpose. */
export function referenceTable(): { type: DnsRecordType; purpose: string; example: string }[] {
  return [
    { type: "A", purpose: "Maps a hostname to an IPv4 address.", example: "example.com. IN A 192.0.2.1" },
    { type: "AAAA", purpose: "Maps a hostname to an IPv6 address.", example: "example.com. IN AAAA 2001:db8::1" },
    { type: "CNAME", purpose: "Canonical name — alias of one name to another.", example: "www IN CNAME example.com." },
    { type: "NS", purpose: "Delegates a zone to a nameserver.", example: "example.com. IN NS ns1.example.com." },
    { type: "MX", purpose: "Mail exchange — mail server for the domain.", example: "example.com. IN MX 10 mail.example.com." },
    { type: "TXT", purpose: "Arbitrary text (SPF, DKIM, verification).", example: 'example.com. IN TXT "v=spf1 -all"' },
    { type: "SRV", purpose: "Service locator (priority/weight/port/target).", example: "_sip._tcp IN SRV 10 20 5060 sip.example.com." },
    { type: "CAA", purpose: "Certification Authority Authorization.", example: 'example.com. IN CAA 0 issue "letsencrypt.org"' },
  ];
}

/** Serialize a batch result to CSV. */
export function batchToCsv(results: BatchResult[]): string {
  const lines = ["Type,Value,Valid,Error,ZoneLine"];
  for (const r of results) {
    const type = r.record.type;
    const value = r.record.value || r.record.target || "";
    const valid = "ok" in r.result ? "yes" : "no";
    const err = "ok" in r.result ? "" : r.result.error.replace(/"/g, '""');
    const zone = (r.zoneLine ?? "").replace(/"/g, '""');
    lines.push(`${type},"${value.replace(/"/g, '""')}",${valid},"${err}","${zone}"`);
  }
  return lines.join("\n");
}

/** Parse a multi-line text input where each line is "<type> <value>" or "<type>|<value>". */
export function parseBatchInput(text: string): DnsRecord[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out: DnsRecord[] = [];
  for (const line of lines) {
    const parts = line.split(/[|\s]+/);
    const type = parts[0]?.toUpperCase() as DnsRecordType;
    const value = parts.slice(1).join(" ");
    if (!type) continue;
    out.push({ type, value });
  }
  return out;
}
