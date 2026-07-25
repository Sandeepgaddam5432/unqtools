/**
 * DNS Record Validator — regex validators for common record types.
 */
export type DnsRecordType = "A" | "AAAA" | "CNAME" | "MX" | "TXT" | "SRV" | "CAA";

const IPV4_RE = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const IPV6_RE = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$/i;
const HOSTNAME_RE = /^(?=.{1,253}$)([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidIpv4(s: string): boolean { return IPV4_RE.test(s.trim()); }
export function isValidIpv6(s: string): boolean { return IPV6_RE.test(s.trim()); }
export function isValidHostname(s: string): boolean { return HOSTNAME_RE.test(s.trim()); }
export function isValidEmail(s: string): boolean { return EMAIL_RE.test(s.trim()); }

export interface DnsRecord {
  type: DnsRecordType;
  value: string;
  priority?: number; // for MX, SRV
  weight?: number;   // for SRV
  port?: number;     // for SRV
  target?: string;   // for SRV
}

/** Validate a DNS record's value for the given type. */
export function validateRecord(rec: DnsRecord): { ok: true } | { error: string } {
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
      if (rec.priority == null || rec.priority < 0 || rec.priority > 65535) return { error: "MX priority must be 0-65535" };
      if (!isValidHostname(v)) return { error: "MX target must be a valid hostname" };
      return { ok: true };
    case "TXT":
      if (v.length === 0) return { error: "TXT record cannot be empty" };
      if (v.length > 255) return { error: "TXT record too long (max 255 chars)" };
      return { ok: true };
    case "SRV":
      if (rec.priority == null || rec.weight == null || rec.port == null || !rec.target) return { error: "SRV needs priority, weight, port, target" };
      if (rec.port < 0 || rec.port > 65535) return { error: "Port must be 0-65535" };
      if (!isValidHostname(rec.target)) return { error: "SRV target must be a valid hostname" };
      return { ok: true };
    case "CAA":
      // CAA format: flags tag "value"
      if (!/^\d+\s+(issue|issuewild|iodef)\s+".*"$/.test(v)) return { error: 'CAA format: <flags> <tag> "<value>"' };
      return { ok: true };
    default:
      return { error: "Unknown record type" };
  }
}
