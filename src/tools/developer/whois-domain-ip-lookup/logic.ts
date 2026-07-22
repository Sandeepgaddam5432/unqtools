/**
 * WHOIS Domain & IP Lookup — pure logic.
 *
 * Generates WHOIS query commands (whois CLI, RDAP URL, curl), parses raw
 * WHOIS response text into structured fields, explains EPP status codes,
 * detects the RIR for an IP, and builds domain-availability checker
 * commands. 100% client-side — actual lookups require the network.
 *
 * Pure functions only — no DOM, no network, no external deps.
 *
 * PRIVACY: The history feature stores only operation metadata (target +
 * type + action + ts), NEVER any pasted WHOIS text or contact data.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TargetType = "domain" | "ipv4" | "ipv6" | "invalid";

export type Rir = "ARIN" | "RIPE" | "APNIC" | "LACNIC" | "AFRINIC" | "UNKNOWN";

export interface RirPreset {
  id: Rir;
  label: string;
  whoisServer: string;
  rdapUrl: string;
  region: string;
}

export interface WhoisServerEntry {
  tld: string;
  server: string;
  rdap?: string;
}

export type EppCategory = "client" | "server" | "ok" | "other";

export interface EppStatusCode {
  code: string;
  short: string;
  explanation: string;
  category: EppCategory;
}

export interface ParsedWhoisField {
  label: string;
  value: string;
}

export interface ParsedWhois {
  type: TargetType;
  registrar?: string;
  organization?: string;
  createdDate?: string;
  updatedDate?: string;
  expiryDate?: string;
  nameServers: string[];
  statuses: string[];
  cidrRange?: string;
  originAs?: string;
  abuseContact?: string;
  dnssec?: string;
  rawFields: ParsedWhoisField[];
  notes: string[];
}

export type CommandTool = "whois" | "rdap-url" | "curl" | "dig";

export interface GeneratedCommand {
  tool: CommandTool;
  label: string;
  command: string;
  explanation: string;
}

export interface WhoisCommandOptions {
  /** Explicit whois server (whois -h <server>). */
  server?: string;
  /** Hide legal disclaimers with -H flag. */
  hideLegal?: boolean;
}

export interface AvailabilityCheck {
  domain: string;
  commands: GeneratedCommand[];
  notes: string[];
}

export interface HistoryEntry {
  ts: number;
  target: string;
  type: TargetType;
  action: "generate" | "parse" | "availability";
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RDAP_BOOTSTRAP = "https://rdap.org";

/**
 * TLD → authoritative WHOIS server (40+ TLDs).
 * RDAP base URL included where the registry publishes one.
 */
export const TLD_WHOIS_SERVERS: WhoisServerEntry[] = [
  { tld: "com", server: "whois.verisign-grs.com", rdap: "https://rdap.verisign.com/com/v1" },
  { tld: "net", server: "whois.verisign-grs.com", rdap: "https://rdap.verisign.com/net/v1" },
  { tld: "org", server: "whois.publicinterestregistry.org", rdap: "https://rdap.publicinterestregistry.org/rdap/" },
  { tld: "io", server: "whois.nic.io", rdap: "https://rdap.nic.io/" },
  { tld: "co", server: "whois.nic.co", rdap: "https://rdap.nic.co/" },
  { tld: "dev", server: "whois.nic.google", rdap: "https://www.registry.google/rdap/" },
  { tld: "app", server: "whois.nic.google", rdap: "https://www.registry.google/rdap/" },
  { tld: "ai", server: "whois.nic.ai", rdap: "https://rdap.nic.ai/" },
  { tld: "info", server: "whois.afilias.net", rdap: "https://rdap.afilias.net/rdap/" },
  { tld: "biz", server: "whois.nic.biz", rdap: "https://rdap.nic.biz/" },
  { tld: "xyz", server: "whois.nic.xyz", rdap: "https://rdap.centralnic.com/xyz/" },
  { tld: "me", server: "whois.nic.me", rdap: "https://rdap.nic.me/" },
  { tld: "cc", server: "ccwhois.verisign-grs.com", rdap: "https://rdap.verisign.com/cc/v1" },
  { tld: "tv", server: "tvwhois.verisign-grs.com", rdap: "https://rdap.verisign.com/tv/v1" },
  { tld: "uk", server: "whois.nic.uk", rdap: "https://rdap.nominet.uk/rdap/" },
  { tld: "de", server: "whois.denic.de", rdap: "https://rdap.denic.de/" },
  { tld: "fr", server: "whois.nic.fr", rdap: "https://rdap.nic.fr/" },
  { tld: "eu", server: "whois.eu", rdap: "https://rdap.eu.org/" },
  { tld: "ca", server: "whois.cira.ca", rdap: "https://rdap.cira.ca/" },
  { tld: "au", server: "whois.auda.org.au", rdap: "https://rdap.auda.org.au/" },
  { tld: "in", server: "whois.registry.in", rdap: "https://rdap.registry.in/" },
  { tld: "ru", server: "whois.tcinet.ru", rdap: "https://rdap.tcinet.ru/" },
  { tld: "cn", server: "whois.cnnic.cn", rdap: "https://rdap.cnnic.cn/" },
  { tld: "jp", server: "whois.jprs.jp", rdap: "https://rdap.jprs.jp/" },
  { tld: "br", server: "whois.registro.br", rdap: "https://rdap.registro.br/" },
  { tld: "nl", server: "whois.domain-registry.nl", rdap: "https://rdap.domain-registry.nl/" },
  { tld: "es", server: "whois.nic.es", rdap: "https://rdap.nic.es/" },
  { tld: "it", server: "whois.nic.it", rdap: "https://rdap.nic.it/" },
  { tld: "pl", server: "whois.dns.pl", rdap: "https://rdap.dns.pl/" },
  { tld: "se", server: "whois.iis.se", rdap: "https://rdap.iis.se/" },
  { tld: "ch", server: "whois.nic.ch", rdap: "https://rdap.nic.ch/" },
  { tld: "be", server: "whois.dns.be", rdap: "https://rdap.dns.be/" },
  { tld: "at", server: "whois.nic.at", rdap: "https://rdap.nic.at/" },
  { tld: "dk", server: "whois.dk-hostmaster.dk", rdap: "https://rdap.dk-hostmaster.dk/" },
  { tld: "no", server: "whois.norid.no", rdap: "https://rdap.norid.no/" },
  { tld: "fi", server: "whois.fi", rdap: "https://rdap.fi/" },
  { tld: "ie", server: "whois.weare.ie", rdap: "https://rdap.weare.ie/" },
  { tld: "nz", server: "whois.srs.net.nz", rdap: "https://rdap.srs.net.nz/" },
  { tld: "za", server: "whois.registry.net.za", rdap: "https://rdap.registry.net.za/" },
  { tld: "us", server: "whois.nic.us", rdap: "https://rdap.nic.us/" },
  { tld: "edu", server: "whois.educause.edu", rdap: "https://rdap.educause.edu/" },
  { tld: "gov", server: "whois.dotgov.gov", rdap: "https://rdap.dotgov.gov/" },
  { tld: "int", server: "whois.iana.org", rdap: "https://rdap.iana.org/" },
];

/** Regional Internet Registries. */
export const RIR_PRESETS: RirPreset[] = [
  { id: "ARIN", label: "ARIN — North America", whoisServer: "whois.arin.net", rdapUrl: "https://rdap.arin.net/registry/", region: "North America" },
  { id: "RIPE", label: "RIPE NCC — Europe / Middle East / Central Asia", whoisServer: "whois.ripe.net", rdapUrl: "https://rdap.db.ripe.net/", region: "Europe, Middle East, Central Asia" },
  { id: "APNIC", label: "APNIC — Asia-Pacific", whoisServer: "whois.apnic.net", rdapUrl: "https://rdap.apnic.net/", region: "Asia-Pacific" },
  { id: "LACNIC", label: "LACNIC — Latin America / Caribbean", whoisServer: "whois.lacnic.net", rdapUrl: "https://rdap.lacnic.net/rdap/", region: "Latin America, Caribbean" },
  { id: "AFRINIC", label: "AFRINIC — Africa", whoisServer: "whois.afrinic.net", rdapUrl: "https://rdap.afrinic.net/rdap/", region: "Africa" },
];

/**
 * EPP status codes (RFC 5731) with plain-English explanations.
 * Categorized as client-set, server-set, ok, or other.
 */
export const EPP_STATUS_CODES: EppStatusCode[] = [
  { code: "clientDeleteProhibited", short: "No delete (client)", explanation: "The registrar set this — the domain cannot be deleted.", category: "client" },
  { code: "serverDeleteProhibited", short: "No delete (server)", explanation: "The registry set this — the domain cannot be deleted.", category: "server" },
  { code: "clientHold", short: "Held (client)", explanation: "The registrar suspended the domain — DNS is not published.", category: "client" },
  { code: "serverHold", short: "Held (server)", explanation: "The registry suspended the domain — DNS is not published.", category: "server" },
  { code: "clientRenewProhibited", short: "No renew (client)", explanation: "The registrar blocked renewal.", category: "client" },
  { code: "serverRenewProhibited", short: "No renew (server)", explanation: "The registry blocked renewal.", category: "server" },
  { code: "clientTransferProhibited", short: "No transfer (client)", explanation: "The registrar locked transfers — common anti-hijack protection.", category: "client" },
  { code: "serverTransferProhibited", short: "No transfer (server)", explanation: "The registry locked transfers.", category: "server" },
  { code: "clientUpdateProhibited", short: "No update (client)", explanation: "The registrar locked changes to the domain (NS, contacts).", category: "client" },
  { code: "serverUpdateProhibited", short: "No update (server)", explanation: "The registry locked changes to the domain.", category: "server" },
  { code: "inactive", short: "No nameservers", explanation: "The domain has no delegations (no NS records).", category: "other" },
  { code: "ok", short: "Active / no locks", explanation: "The domain is active with no pending operations or prohibitions.", category: "ok" },
  { code: "ok-pendingUpdate", short: "Active, update pending", explanation: "Active but an update is pending.", category: "other" },
  { code: "ok-pendingRenew", short: "Active, renew pending", explanation: "Active but a renewal is pending.", category: "other" },
  { code: "ok-pendingTransfer", short: "Active, transfer pending", explanation: "Active but a transfer is pending.", category: "other" },
  { code: "pendingCreate", short: "Creation pending", explanation: "The domain creation is being processed.", category: "other" },
  { code: "pendingDelete", short: "Deletion pending", explanation: "The domain is in the 5-day deletion grace period.", category: "other" },
  { code: "pendingRenew", short: "Renewal pending", explanation: "A renewal is being processed.", category: "other" },
  { code: "pendingTransfer", short: "Transfer pending", explanation: "A transfer is being processed.", category: "other" },
  { code: "pendingUpdate", short: "Update pending", explanation: "An update is being processed.", category: "other" },
  { code: "addPeriod", short: "Add grace period", explanation: "First 5 days after registration — registrar can delete for refund.", category: "other" },
  { code: "autoRenewPeriod", short: "Auto-renew grace period", explanation: "45 days after auto-renewal — registrar can delete for refund.", category: "other" },
  { code: "renewPeriod", short: "Renew grace period", explanation: "5 days after explicit renewal — registrar can delete for refund.", category: "other" },
  { code: "transferPeriod", short: "Transfer grace period", explanation: "5 days after transfer — registrar can delete for refund.", category: "other" },
  { code: "redemptionPeriod", short: "Redemption grace period", explanation: "30 days after deletion — registrant can restore for a fee.", category: "other" },
  { code: "restorePeriod", short: "Restore pending", explanation: "Restoration is being processed after redemption.", category: "other" },
];

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

export function getWhoisServer(tld: string): WhoisServerEntry | undefined {
  const t = tld.toLowerCase().replace(/^\./, "");
  return TLD_WHOIS_SERVERS.find((e) => e.tld === t);
}

export function getRir(id: Rir): RirPreset | undefined {
  return RIR_PRESETS.find((r) => r.id === id);
}

export function getEppStatus(code: string): EppStatusCode | undefined {
  const c = code.trim().toLowerCase();
  return EPP_STATUS_CODES.find((s) => s.code.toLowerCase() === c);
}

export function explainStatus(code: string): string {
  const s = getEppStatus(code);
  if (!s) return `Unknown EPP status code: ${code}`;
  return `${s.short} — ${s.explanation}`;
}

// ---------------------------------------------------------------------------
// Normalization & detection
// ---------------------------------------------------------------------------

/** Normalize a domain: lowercase, strip protocol/path/whitespace, strip trailing dot. */
export function normalizeDomain(s: string): string {
  let v = (s || "").trim();
  if (!v) return "";
  // Strip protocol
  v = v.replace(/^https?:\/\//i, "");
  // Strip path
  const slash = v.indexOf("/");
  if (slash >= 0) v = v.slice(0, slash);
  // Strip port
  const colon = v.indexOf(":");
  if (colon >= 0) v = v.slice(0, colon);
  // Strip leading www.
  // (kept — some users want www)
  v = v.toLowerCase();
  // Strip trailing dot (FQDN)
  v = v.replace(/\.$/, "");
  return v;
}

/** Convert an IDN domain to punycode (xn--…) via the URL API. */
export function toPunycode(s: string): string {
  const v = (s || "").trim();
  if (!v) return "";
  try {
    // URL.hostname performs IDN-to-ASCII (punycode) conversion.
    const u = new URL(`http://${v}`);
    return u.hostname.toLowerCase();
  } catch {
    return v.toLowerCase();
  }
}

const IPV4_RE = /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;
const IPV6_RE = /^(?:[0-9a-fA-F:]+)$/;

/** Detect whether the input is a domain, IPv4, IPv6, or invalid. */
export function detectTargetType(s: string): TargetType {
  const v = (s || "").trim().toLowerCase();
  if (!v) return "invalid";
  if (IPV4_RE.test(v)) return "ipv4";
  // IPv6 must contain a colon and pass the simple regex.
  if (v.includes(":") && IPV6_RE.test(v)) {
    // Disallow single-colon or empty groups beyond a reasonable length.
    if (v.length >= 2 && v.length <= 39) return "ipv6";
  }
  // Domain must contain a dot, no spaces, and valid chars.
  if (v.includes(".") && !v.includes(" ") && /^[a-z0-9.\-_\u0080-\uffff]+$/.test(v)) {
    // The TLD (last label after the final dot) must not be all-numeric.
    const tld = v.slice(v.lastIndexOf(".") + 1);
    if (tld && !/^\d+$/.test(tld)) {
      return "domain";
    }
  }
  return "invalid";
}

/** Extract the TLD from a domain (last label after the final dot). */
export function extractTld(domain: string): string {
  const d = normalizeDomain(domain);
  if (!d) return "";
  const i = d.lastIndexOf(".");
  return i >= 0 ? d.slice(i + 1) : "";
}

/**
 * Detect the most likely RIR for an IPv4/IPv6 address by first-octet range.
 * This is an approximation — portable space and transfers can violate it.
 * ARIN accepts whois queries for any IP and refers to the correct RIR.
 */
export function detectRir(ip: string): Rir {
  const t = detectTargetType(ip);
  if (t === "invalid") return "UNKNOWN";
  if (t === "ipv6") {
    // Very rough IPv6 RIR detection by 2000::/3 prefix first hex digit.
    const first = ip.trim().toLowerCase().slice(0, 1);
    if (first === "2") {
      const second = ip.trim().toLowerCase().slice(1, 2);
      if (second >= "0" && second <= "3") return "RIPE"; // 2000-23ff
      if (second >= "4" && second <= "7") return "RIPE"; // 2400-27ff (RIPE)
      if (second >= "a" && second <= "b") return "APNIC"; // 2a00-2bff
      if (second >= "c" && second <= "f") return "AFRINIC"; // 2c00-2dff
    }
    return "UNKNOWN";
  }
  // IPv4 — first-octet heuristic
  const firstOctet = parseInt(ip.split(".")[0] ?? "0", 10);
  if (Number.isNaN(firstOctet)) return "UNKNOWN";
  // Documented RIR allocations (subset, approximate)
  const arin = new Set([3, 4, 6, 7, 8, 9, 12, 13, 17, 18, 19, 20, 23, 24, 26, 28, 32, 34, 35, 38, 40, 41, 44, 47, 48, 50, 52, 54, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 96, 97, 98, 99, 100, 104, 107, 108, 128, 129, 130, 131, 132, 134, 135, 136, 137, 138, 140, 142, 143, 144, 146, 147, 148, 149, 152, 155, 156, 157, 158, 159, 160, 161, 162, 164, 165, 166, 167, 168, 169, 170, 172, 173, 174, 184, 192, 198, 199, 204, 205, 206, 207, 208, 209, 214, 215, 216]);
  const ripe = new Set([2, 5, 25, 30, 31, 37, 51, 53, 57, 62, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 141, 145, 151, 176, 178, 185, 188, 193, 194, 195, 212, 213, 217]);
  const apnic = new Set([1, 14, 27, 36, 39, 42, 43, 49, 58, 59, 60, 61, 101, 103, 106, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 133, 150, 153, 163, 171, 175, 180, 182, 183, 202, 203, 210, 211, 218, 219, 220, 221, 222, 223]);
  const lacnic = new Set([177, 179, 181, 186, 187, 189, 190, 191, 200, 201]);
  const afrinic = new Set([41, 102, 105, 197]);
  if (afrinic.has(firstOctet)) return "AFRINIC";
  if (lacnic.has(firstOctet)) return "LACNIC";
  if (apnic.has(firstOctet)) return "APNIC";
  if (ripe.has(firstOctet)) return "RIPE";
  if (arin.has(firstOctet)) return "ARIN";
  return "UNKNOWN";
}

// ---------------------------------------------------------------------------
// Command / URL builders
// ---------------------------------------------------------------------------

/** Build an RDAP URL for a domain or IP via the IANA rdap.org bootstrap. */
export function buildRdapUrl(target: string): string {
  const t = detectTargetType(target);
  const v = target.trim().toLowerCase();
  if (t === "domain") return `${RDAP_BOOTSTRAP}/domain/${encodeURIComponent(v)}`;
  if (t === "ipv4" || t === "ipv6") return `${RDAP_BOOTSTRAP}/ip/${encodeURIComponent(v)}`;
  return "";
}

/** Generate whois CLI + RDAP commands for a domain or IP. */
export function generateWhoisCommands(
  target: string,
  opts: WhoisCommandOptions = {},
): GeneratedCommand[] {
  const t = detectTargetType(target);
  if (t === "invalid") return [];
  const v = t === "domain" ? normalizeDomain(target) : target.trim();
  const cmds: GeneratedCommand[] = [];

  if (t === "domain") {
    const tld = extractTld(v);
    const tldEntry = getWhoisServer(tld);
    // Basic whois
    const flags: string[] = [];
    if (opts.hideLegal) flags.push("-H");
    const flagStr = flags.length > 0 ? `${flags.join(" ")} ` : "";
    cmds.push({
      tool: "whois",
      label: "whois (basic)",
      command: `whois ${flagStr}${v}`,
      explanation: "Query the default whois client. It follows registry referrals automatically.",
    });
    // Explicit -h server
    if (tldEntry) {
      cmds.push({
        tool: "whois",
        label: `whois -h ${tldEntry.server}`,
        command: `whois ${flagStr}-h ${tldEntry.server} ${v}`,
        explanation: `Query the authoritative whois server for .${tld} directly.`,
      });
    }
    // RDAP URL
    cmds.push({
      tool: "rdap-url",
      label: "RDAP URL (browser)",
      command: buildRdapUrl(v),
      explanation: "Open the structured JSON RDAP record in your browser. rdap.org redirects to the authoritative registry.",
    });
    // curl RDAP JSON
    cmds.push({
      tool: "curl",
      label: "curl RDAP JSON",
      command: `curl -sH "Accept: application/rdap+json" ${buildRdapUrl(v)} | jq .`,
      explanation: 'Fetch the RDAP JSON record. The Accept header selects the RDAP content type. Pipe through jq for pretty-printing.',
    });
  } else if (t === "ipv4" || t === "ipv6") {
    const rir = detectRir(v);
    const rirEntry = getRir(rir);
    const flagStr = opts.hideLegal ? "-H " : "";
    cmds.push({
      tool: "whois",
      label: "whois (basic)",
      command: `whois ${flagStr}${v}`,
      explanation: "Query the default whois client. ARIN accepts queries for any IP and refers to the correct RIR.",
    });
    if (rirEntry) {
      cmds.push({
        tool: "whois",
        label: `whois -h ${rirEntry.whoisServer}`,
        command: `whois ${flagStr}-h ${rirEntry.whoisServer} ${v}`,
        explanation: `Query the RIR whois server directly (${rirEntry.label}).`,
      });
    }
    cmds.push({
      tool: "rdap-url",
      label: "RDAP URL (browser)",
      command: buildRdapUrl(v),
      explanation: "Open the structured JSON RDAP record in your browser. rdap.org redirects to the authoritative RIR.",
    });
    cmds.push({
      tool: "curl",
      label: "curl RDAP JSON",
      command: `curl -sH "Accept: application/rdap+json" ${buildRdapUrl(v)} | jq .`,
      explanation: "Fetch the RDAP JSON record for this IP.",
    });
  }
  return cmds;
}

/** Generate domain-availability checker commands. */
export function generateAvailabilityCheck(domain: string): AvailabilityCheck {
  const d = normalizeDomain(domain);
  const notes: string[] = [];
  const cmds: GeneratedCommand[] = [];
  if (!d || detectTargetType(d) !== "domain") {
    return { domain: d, commands: [], notes: ["Enter a valid domain to check availability."] };
  }
  cmds.push({
    tool: "whois",
    label: "whois + grep",
    command: `whois ${d} | grep -iE "no match|not found|no entries found|no data found"`,
    explanation: 'If whois returns "no match" / "not found", the domain is likely available. Empty grep output usually means the domain is registered.',
  });
  cmds.push({
    tool: "whois",
    label: "whois (silent check)",
    command: `whois ${d} >/dev/null 2>&1 && echo "registered" || echo "available"`,
    explanation: "Treats a non-zero exit code as available. Not 100% reliable — some registries return 0 for available domains.",
  });
  cmds.push({
    tool: "dig",
    label: "dig NS +short",
    command: `dig +short NS ${d}`,
    explanation: "If empty, the domain has no NS records (may be unregistered or registered-but-unused). Combine with whois for confirmation.",
  });
  cmds.push({
    tool: "dig",
    label: "dig A +short",
    command: `dig +short A ${d}`,
    explanation: "If empty, no A record is published. Not a reliable availability signal (parked domains may have no A record).",
  });
  cmds.push({
    tool: "curl",
    label: "RDAP HTTP status",
    command: `curl -s -o /dev/null -w "%{http_code}\\n" -H "Accept: application/rdap+json" ${buildRdapUrl(d)}`,
    explanation: "HTTP 404 from RDAP strongly indicates the domain is available. HTTP 200 = registered.",
  });
  notes.push("Tip: RDAP HTTP 404 is the most reliable availability signal. whois 'no match' varies by registry.");
  notes.push("Reserved/blocked domains may return 200 from RDAP but show as 'reserved' in the JSON.");
  return { domain: d, commands: cmds, notes };
}

// ---------------------------------------------------------------------------
// WHOIS text parser
// ---------------------------------------------------------------------------

const FIELD_LABELS = {
  registrar: [
    "registrar", "sponsoring registrar", "registrar name",
    "registration service provider", "owner organization",
  ],
  createdDate: [
    "creation date", "created", "created date", "registered", "registered on",
    "registration date", "domain registration date", "regdate", "created on",
  ],
  updatedDate: [
    "updated date", "updated", "last modified", "last-modified", "last update",
    "modified", "changed", "domain last updated", "last-updated",
  ],
  expiryDate: [
    "expiry date", "expiration date", "registry expiry date", "expire", "expires on",
    "paid-till", "expiry", "renewal date", "domain expiration date",
  ],
  nameServer: [
    "name server", "nserver", "nameserver", "domain nameservers", "ns",
  ],
  status: [
    "status", "domain status", "domainstatus", "state",
  ],
  dnssec: ["dnssec"],
  // IP-specific
  organization: [
    "orgname", "organization", "owner", "netname", "descr", "org-name",
  ],
  cidrRange: [
    "netrange", "cidr", "inetnum", "inet6num", "route", "net range",
  ],
  originAs: ["originas", "origin", "aut-num"],
  abuseContact: ["abuse-mailbox", "abuse mailbox", "abusecontact", "abuse contact"],
} as const;

type FieldKey = keyof typeof FIELD_LABELS;

function matchLabel(line: string): { key: FieldKey; value: string } | null {
  const colon = line.indexOf(":");
  if (colon <= 0) return null;
  const label = line.slice(0, colon).trim().toLowerCase();
  const value = line.slice(colon + 1).trim();
  if (!value) return null;
  for (const key of Object.keys(FIELD_LABELS) as FieldKey[]) {
    for (const alias of FIELD_LABELS[key]) {
      if (label === alias) return { key, value };
    }
  }
  return null;
}

/**
 * Parse raw WHOIS response text into structured fields.
 * Handles both domain and IP WHOIS text. Best-effort — registry formats vary.
 */
export function parseWhoisResponse(raw: string, hint?: TargetType): ParsedWhois {
  const text = (raw || "").trim();
  const lines = text.split(/\r?\n/);
  const out: ParsedWhois = {
    type: hint ?? "domain",
    nameServers: [],
    statuses: [],
    rawFields: [],
    notes: [],
  };

  if (!text) {
    out.notes.push("Empty WHOIS response — the domain or IP may be unregistered, or the lookup failed.");
    return out;
  }

  for (const line of lines) {
    const m = matchLabel(line);
    if (!m) continue;
    out.rawFields.push({ label: m.key, value: m.value });
    switch (m.key) {
      case "registrar":
        if (!out.registrar) out.registrar = m.value;
        break;
      case "organization":
        if (!out.organization) out.organization = m.value;
        break;
      case "createdDate":
        if (!out.createdDate) out.createdDate = m.value;
        break;
      case "updatedDate":
        if (!out.updatedDate) out.updatedDate = m.value;
        break;
      case "expiryDate":
        if (!out.expiryDate) out.expiryDate = m.value;
        break;
      case "nameServer":
        out.nameServers.push(m.value.toLowerCase().replace(/\s+.*$/, "").replace(/\.$/, ""));
        break;
      case "status":
        out.statuses.push(m.value);
        break;
      case "dnssec":
        if (!out.dnssec) out.dnssec = m.value;
        break;
      case "cidrRange":
        // Prefer the explicit CIDR field over NetRange/inetnum. If we already
        // have a CIDR (contains "/") and the new value is a NetRange (contains " - "),
        // keep the existing CIDR.
        if (!out.cidrRange) {
          out.cidrRange = m.value;
        } else if (out.cidrRange.includes(" - ") && m.value.includes("/")) {
          out.cidrRange = m.value;
        }
        break;
      case "originAs":
        if (!out.originAs) out.originAs = m.value;
        break;
      case "abuseContact":
        if (!out.abuseContact) out.abuseContact = m.value;
        break;
    }
  }

  // Detect "no match" patterns
  const lower = text.toLowerCase();
  if (/no match|not found|no entries found|no data found|no object found|no information available/.test(lower)) {
    out.notes.push("Response indicates no match — the target may be available / unallocated.");
  }

  // GDPR / redaction detection
  if (/redacted|redacted for privacy|data protected|gdpr|statutory masking/.test(lower)) {
    out.notes.push("Contact data appears redacted (GDPR / privacy). This is expected for most .com/.net/.org domains since 2018.");
  }

  // Heuristic: if no structured fields detected, note it.
  if (out.rawFields.length === 0) {
    out.notes.push("No structured key:value pairs detected. The registry may use a non-standard WHOIS format — try RDAP for structured JSON.");
  }

  // De-duplicate nameservers (preserve order)
  out.nameServers = Array.from(new Set(out.nameServers));
  return out;
}

// ---------------------------------------------------------------------------
// Expiry countdown
// ---------------------------------------------------------------------------

/**
 * Compute the number of days from now until the given expiry date string.
 * Returns null if the date cannot be parsed.
 */
export function computeExpiryCountdown(expiryDate: string, now: Date = new Date()): number | null {
  if (!expiryDate) return null;
  // Try ISO first, then fall back to common WHOIS date formats.
  const candidates: Date[] = [];
  const iso = new Date(expiryDate);
  if (!Number.isNaN(iso.getTime())) candidates.push(iso);
  // RFC 3339 / RFC 2822 are already covered by Date constructor.
  // Some WHOIS uses "dd-mmm-yyyy" (e.g. "10-jan-2026") which Date parses.
  // Some use "yyyy-mm-ddTHH:mm:ssZ" which Date parses.
  if (candidates.length === 0) return null;
  const ms = candidates[0].getTime() - now.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

// ---------------------------------------------------------------------------
// Bulk parsing
// ---------------------------------------------------------------------------

/** Parse newline-separated targets (domains or IPs). */
export function parseBulk(input: string): string[] {
  if (!input) return [];
  return input
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:whois-domain-ip-lookup:history";
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

export interface ShareState {
  target: string;
  tab?: "commands" | "parse" | "availability";
}

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  if (state.target) params.set("t", state.target);
  if (state.tab) params.set("tab", state.tab);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { target: "" };
  const params = new URLSearchParams(clean);
  const target = params.get("t") ?? "";
  const tabRaw = params.get("tab") ?? "";
  const tab = tabRaw === "commands" || tabRaw === "parse" || tabRaw === "availability" ? tabRaw : undefined;
  return { target, tab };
}
