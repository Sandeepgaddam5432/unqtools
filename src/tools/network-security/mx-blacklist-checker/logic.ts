/**
 * MX Blacklist Checker — pure logic.
 *
 * Verifies the *format* of MX records and looks up the supplied
 * mailserver hostname against a curated list of well-known DNSBL
 * (DNS block-list) services. The actual DNS query must be done at
 * runtime by the browser (e.g. via DoH); this module supplies the
 * lookup targets and a validation pipeline.
 */

export interface MxRecord {
  priority: number;
  host: string;
}

export interface BlacklistDb {
  zone: string; // DNS zone to query (e.g. zen.spamhaus.org)
  name: string;
  website: string;
  /** Return codes that indicate a positive listing, with their meaning. */
  returnCodes: Record<string, string>;
}

export interface MxCheckResult {
  domain: string;
  validDomain: boolean;
  mxRecords: MxRecord[];
  validMxFormat: boolean;
  blacklistChecks: { host: string; db: BlacklistDb; lookupTarget: string }[];
  notes: string[];
  warnings: string[];
}

const DOMAIN_RE = /^(?=.{1,253}$)([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

export const BLACKLIST_DBS: BlacklistDb[] = [
  {
    zone: "zen.spamhaus.org",
    name: "Spamhaus ZEN",
    website: "https://www.spamhaus.org/zen/",
    returnCodes: {
      "127.0.0.2": "SBL — Spamhaus Block List (spam sources)",
      "127.0.0.3": "SBL CSS (snowshoe spam)",
      "127.0.0.4": "XBL — Exploits Botnet C&C",
      "127.0.0.5": "NJABL (CWS)",
      "127.0.0.6": "NJABL (CWS)",
      "127.0.0.9": "SBL (deleted)",
      "127.0.0.10": "PBL (ISP-maintained)",
      "127.0.0.11": "PBL (Spamhaus-maintained)",
    },
  },
  {
    zone: "bl.spamcop.net",
    name: "SpamCop",
    website: "https://www.spamcop.net/bl.shtml",
    returnCodes: { "127.0.0.2": "Listed — spam reported within 24h" },
  },
  {
    zone: "b.barracudacentral.org",
    name: "Barracuda",
    website: "https://www.barracudacentral.org/rbl/listing-methodology",
    returnCodes: { "127.0.0.2": "Listed — poor reputation" },
  },
  {
    zone: "dnsbl.sorbs.net",
    name: "SORBS",
    website: "https://www.sorbs.net/",
    returnCodes: { "127.0.0.6": "Listed — open proxy / spam" },
  },
  {
    zone: "spam.dnsbl.sorbs.net",
    name: "SORBS Spam",
    website: "https://www.sorbs.net/",
    returnCodes: { "127.0.0.6": "Listed — spam source" },
  },
];

export function validateDomain(domain: string): boolean {
  return DOMAIN_RE.test(domain.trim());
}

/** Parse an MX record string like "10 mail.example.com" or "mail.example.com". */
export function parseMxRecord(line: string): MxRecord | null {
  const parts = line.trim().split(/\s+/);
  if (parts.length === 2) {
    const priority = Number(parts[0]);
    if (Number.isInteger(priority) && priority >= 0 && DOMAIN_RE.test(parts[1]!)) {
      return { priority, host: parts[1]!.toLowerCase() };
    }
  }
  if (parts.length === 1 && DOMAIN_RE.test(parts[0]!)) {
    return { priority: 10, host: parts[0]!.toLowerCase() };
  }
  return null;
}

/** Build the DNSBL lookup target hostname for a given MX host and DB. */
export function buildLookupTarget(mxHost: string, dbZone: string): string {
  return `${mxHost}.${dbZone}`;
}

/**
 * Validate the inputs and produce a structured checklist of blacklist
 * lookups to perform. Does NOT perform any DNS queries itself.
 */
export function checkMxBlacklist(domain: string, mxInput: string): MxCheckResult | { error: string } {
  const warnings: string[] = [];
  const notes: string[] = [];
  if (!domain || !validateDomain(domain)) return { error: "Domain is not a valid hostname." };

  const mxLines = mxInput.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (mxLines.length === 0) return { error: "At least one MX record is required." };
  const mxRecords: MxRecord[] = [];
  for (const l of mxLines) {
    const rec = parseMxRecord(l);
    if (!rec) {
      warnings.push(`Could not parse MX line: "${l}" — expected "priority host" or "host".`);
      continue;
    }
    mxRecords.push(rec);
  }
  if (mxRecords.length === 0) return { error: "No valid MX records supplied." };

  const blacklistChecks: { host: string; db: BlacklistDb; lookupTarget: string }[] = [];
  for (const mx of mxRecords) {
    for (const db of BLACKLIST_DBS) {
      blacklistChecks.push({ host: mx.host, db, lookupTarget: buildLookupTarget(mx.host, db.zone) });
    }
  }

  notes.push("To run the lookup, query each `lookupTarget` via DNS-over-HTTPS (e.g. https://cloudflare-dns.com/dns-query?name=…&type=A).");
  notes.push("A 127.0.0.x response indicates a listing — match the IP against the returnCodes map.");
  notes.push("NXDOMAIN (no A record) means the host is NOT listed.");
  if (mxRecords.length > 5) warnings.push("Many MX records → many lookups. Consider batching with concurrent DoH requests.");
  if (mxRecords.some((m) => m.host.endsWith(".local"))) warnings.push(".local hostnames cannot be looked up in public DNSBLs.");

  return {
    domain: domain.trim().toLowerCase(),
    validDomain: true,
    mxRecords,
    validMxFormat: true,
    blacklistChecks,
    notes,
    warnings,
  };
}

/** Format the check result as a plain-text report. */
export function resultToText(r: MxCheckResult): string {
  const lines: string[] = [];
  lines.push(`Domain: ${r.domain}`);
  lines.push(`MX records (${r.mxRecords.length}):`);
  for (const m of r.mxRecords) lines.push(`  ${m.priority} ${m.host}`);
  lines.push("");
  lines.push(`Blacklist lookups to perform (${r.blacklistChecks.length}):`);
  for (const c of r.blacklistChecks) lines.push(`  ${c.lookupTarget}  [${c.db.name}]`);
  lines.push("");
  for (const n of r.notes) lines.push(`• ${n}`);
  for (const w of r.warnings) lines.push(`⚠️ ${w}`);
  return lines.join("\n");
}

/** Convert the lookups to CSV. */
export function lookupsToCsv(r: MxCheckResult): string {
  const lines = ["MX host,Blacklist,Lookup target,Website"];
  for (const c of r.blacklistChecks) {
    lines.push(`${c.host},${c.db.name},${c.lookupTarget},${c.db.website}`);
  }
  return lines.join("\n");
}
