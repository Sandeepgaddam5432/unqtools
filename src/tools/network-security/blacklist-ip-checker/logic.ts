/**
 * Blacklist IP Checker — pure logic.
 *
 * Validates an IPv4 / IPv6 address and builds the list of DNSBL
 * lookup targets (reverse-octet + zone). As with the MX checker, the
 * actual DNS query must be done at runtime via DoH — this module
 * supplies the targets and reference data.
 */

export interface BlacklistDb {
  zone: string;
  name: string;
  website: string;
  returnCodes: Record<string, string>;
}

export interface IpCheckResult {
  ip: string;
  ipType: "ipv4" | "ipv6" | "invalid";
  reverseName: string;
  blacklistChecks: { db: BlacklistDb; lookupTarget: string }[];
  notes: string[];
  warnings: string[];
}

const IPV4 = /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/;
const IPV6 = /^[0-9a-fA-F:]+$/;

export const BLACKLIST_DBS: BlacklistDb[] = [
  {
    zone: "zen.spamhaus.org",
    name: "Spamhaus ZEN",
    website: "https://www.spamhaus.org/zen/",
    returnCodes: {
      "127.0.0.2": "SBL — spam sources",
      "127.0.0.4": "XBL — exploits / C&C",
      "127.0.0.10": "PBL — ISP-maintained dynamic",
      "127.0.0.11": "PBL — Spamhaus-maintained",
    },
  },
  {
    zone: "bl.spamcop.net",
    name: "SpamCop",
    website: "https://www.spamcop.net/bl.shtml",
    returnCodes: { "127.0.0.2": "Listed — recent spam" },
  },
  {
    zone: "dnsbl.sorbs.net",
    name: "SORBS",
    website: "https://www.sorbs.net/",
    returnCodes: { "127.0.0.6": "Listed" },
  },
  {
    zone: "b.barracudacentral.org",
    name: "Barracuda",
    website: "https://www.barracudacentral.org/",
    returnCodes: { "127.0.0.2": "Poor reputation" },
  },
  {
    zone: "all.s5h.net",
    name: "S5H",
    website: "https://www.s5h.net/",
    returnCodes: { "127.0.0.2": "Listed" },
  },
];

export function classifyIp(ip: string): "ipv4" | "ipv6" | "invalid" {
  if (IPV4.test(ip)) return "ipv4";
  if (IPV6.test(ip) && ip.includes(":")) return "ipv6";
  return "invalid";
}

/** Reverse the octets of an IPv4 (e.g. 1.2.3.4 → 4.3.2.1). */
export function reverseIpv4(ip: string): string {
  return ip.split(".").reverse().join(".");
}

/** Build the nibble-reverse name for an IPv6 (RFC 3596). */
export function reverseIpv6(ip: string): string {
  // Expand :: shorthand
  const parts = ip.split("::");
  let head = parts[0] ? parts[0].split(":") : [];
  let tail = parts[1] ? parts[1].split(":") : [];
  const missing = 8 - (head.length + tail.length);
  const full = [...head, ...Array(missing).fill("0"), ...tail];
  const nibbles = full.map((g) => g.padStart(4, "0")).join("");
  return nibbles.split("").reverse().join(".");
}

export function buildLookupTarget(reverseName: string, zone: string): string {
  return `${reverseName}.${zone}`;
}

export function checkIpBlacklist(ip: string): IpCheckResult | { error: string } {
  const trimmed = (ip ?? "").trim();
  if (!trimmed) return { error: "IP address is required." };
  const ipType = classifyIp(trimmed);
  if (ipType === "invalid") return { error: "Not a valid IPv4 or IPv6 address." };

  const reverseName = ipType === "ipv4" ? reverseIpv4(trimmed) : reverseIpv6(trimmed);
  const blacklistChecks = BLACKLIST_DBS.map((db) => ({
    db,
    lookupTarget: buildLookupTarget(reverseName, db.zone),
  }));

  const warnings: string[] = [];
  const notes: string[] = [];
  notes.push("Query each `lookupTarget` for an A record (e.g. via https://cloudflare-dns.com/dns-query?name=…&type=A).");
  notes.push("A 127.0.0.x response indicates a listing — match against the returnCodes map.");
  notes.push("NXDOMAIN (no A record) means the IP is NOT listed.");
  if (ipType === "ipv4" && trimmed.startsWith("10.")) warnings.push("10.0.0.0/8 is private — public DNSBLs won't list it.");
  if (ipType === "ipv4" && trimmed.startsWith("192.168.")) warnings.push("192.168.0.0/16 is private — public DNSBLs won't list it.");
  if (ipType === "ipv4" && /^127\./.test(trimmed)) warnings.push("127.0.0.0/8 is loopback — public DNSBLs won't list it.");
  if (ipType === "ipv6" && trimmed === "::1") warnings.push("::1 is loopback — public DNSBLs won't list it.");

  return { ip: trimmed, ipType, reverseName, blacklistChecks, notes, warnings };
}

/** Convert result to plain-text report. */
export function resultToText(r: IpCheckResult): string {
  const lines: string[] = [];
  lines.push(`IP: ${r.ip} (${r.ipType})`);
  lines.push(`Reverse name: ${r.reverseName}`);
  lines.push("");
  lines.push(`Lookups to perform (${r.blacklistChecks.length}):`);
  for (const c of r.blacklistChecks) lines.push(`  ${c.lookupTarget}  [${c.db.name}]`);
  lines.push("");
  for (const n of r.notes) lines.push(`• ${n}`);
  for (const w of r.warnings) lines.push(`⚠️ ${w}`);
  return lines.join("\n");
}

/** Convert lookups to CSV. */
export function lookupsToCsv(r: IpCheckResult): string {
  const lines = ["Blacklist,Lookup target,Website"];
  for (const c of r.blacklistChecks) {
    lines.push(`${c.db.name},${c.lookupTarget},${c.db.website}`);
  }
  return lines.join("\n");
}
