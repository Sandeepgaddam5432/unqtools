/**
 * DNS Propagation Checker Reference — pure logic.
 *
 * Builds ready-to-paste dig / kdig (DoH) / PowerShell Resolve-DnsName
 * commands for checking DNS propagation of any record across 20+ global
 * public resolvers. Compares expected vs actual answers using
 * exact / contains / regex matchers. Computes a TTL-based propagation
 * ETA. Generates bash + PowerShell batch scripts and CSV / JSON export.
 *
 * Pure functions only — no DOM, no network, no external deps.
 *
 * PRIVACY: The history feature stores only operation metadata (action +
 * record type + count + ts), NEVER the queried domain names themselves.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RecordType =
  | "A" | "AAAA" | "CNAME" | "MX" | "TXT" | "NS" | "SOA" | "CAA";

export type Region =
  | "global"
  | "north-america"
  | "europe"
  | "asia-pacific"
  | "south-america"
  | "africa"
  | "middle-east";

export type CommandShell = "bash" | "powershell";

export type CommandTool = "dig" | "kdig" | "resolve-dnsname";

export type MatchMode = "exact" | "contains" | "regex";

export interface ResolverPreset {
  id: string;
  label: string;
  /** IP/hostname used for dig @server. */
  server: string;
  /** DoH endpoint (kdig +https=), empty when N/A. */
  dohUrl: string;
  region: Region;
  country: string;
  notes: string;
}

export interface GeneratedCommand {
  tool: CommandTool;
  resolverId: string;
  resolverLabel: string;
  region: Region;
  command: string;
  explanation: string;
  /** Comparison one-liner using the chosen matcher, or empty when no expected value. */
  compareCommand: string;
}

export interface CommandOptions {
  domain: string;
  recordType: RecordType;
  tool: CommandTool;
  matchMode: MatchMode;
  expected: string;
  flags?: DigFlag[];
}

export interface DigFlag {
  id: "short" | "answer" | "dnssec" | "multi" | "trace";
}

export interface PropagationEta {
  ttlSeconds: number;
  p50Seconds: number;
  p95Seconds: number;
  worstCaseSeconds: number;
  p50Human: string;
  p95Human: string;
  worstHuman: string;
  explanation: string;
}

export interface HistoryEntry {
  ts: number;
  action: "generate" | "batch" | "eta";
  recordType: RecordType;
  count: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const HISTORY_MAX = 20;

/** Default expected-value matching regex (permissive — any answer). */
export const DEFAULT_EXPECTED = "";

export const RECORD_TYPES: { type: RecordType; summary: string }[] = [
  { type: "A", summary: "IPv4 address" },
  { type: "AAAA", summary: "IPv6 address" },
  { type: "CNAME", summary: "Canonical name (alias)" },
  { type: "MX", summary: "Mail exchange (priority + host)" },
  { type: "TXT", summary: "Text (SPF / DKIM / DMARC / verification)" },
  { type: "NS", summary: "Nameserver" },
  { type: "SOA", summary: "Start of authority" },
  { type: "CAA", summary: "Certificate authority authorization" },
];

export const REGIONS: { id: Region; label: string }[] = [
  { id: "global", label: "Global (anycast)" },
  { id: "north-america", label: "North America" },
  { id: "europe", label: "Europe" },
  { id: "asia-pacific", label: "Asia-Pacific" },
  { id: "south-america", label: "South America" },
  { id: "africa", label: "Africa" },
  { id: "middle-east", label: "Middle East" },
];

export const REGION_LABELS: Record<Region, string> = {
  "global": "Global (anycast)",
  "north-america": "North America",
  "europe": "Europe",
  "asia-pacific": "Asia-Pacific",
  "south-america": "South America",
  "africa": "Africa",
  "middle-east": "Middle East",
};

export const RESOLVERS: ResolverPreset[] = [
  {
    id: "google",
    label: "Google Public DNS",
    server: "8.8.8.8",
    dohUrl: "https://dns.google/dns-query",
    region: "global",
    country: "US (anycast)",
    notes: "8.8.8.8 / 8.8.4.4. DoH at dns.google. World's largest public resolver; DNSSEC on.",
  },
  {
    id: "cloudflare",
    label: "Cloudflare DNS",
    server: "1.1.1.1",
    dohUrl: "https://cloudflare-dns.com/dns-query",
    region: "global",
    country: "US (anycast)",
    notes: "1.1.1.1 / 1.0.0.1. Privacy-first; DNSSEC on; fast anycast footprint.",
  },
  {
    id: "quad9",
    label: "Quad9",
    server: "9.9.9.9",
    dohUrl: "https://dns.quad9.net/dns-query",
    region: "global",
    country: "CH (anycast)",
    notes: "9.9.9.9 / 149.112.112.112. Swiss-based; malware blocking; DNSSEC on.",
  },
  {
    id: "opendns",
    label: "OpenDNS (Cisco)",
    server: "208.67.222.222",
    dohUrl: "https://doh.opendns.com/dns-query",
    region: "global",
    country: "US (anycast)",
    notes: "208.67.222.222 / 208.67.220.220. Cisco Umbrella backend; phishing protection.",
  },
  {
    id: "adguard",
    label: "AdGuard DNS",
    server: "94.140.14.14",
    dohUrl: "https://dns.adguard-dns.com/dns-query",
    region: "global",
    country: "CY (anycast)",
    notes: "94.140.14.14 / 94.140.15.15. Ad/tracker blocking; DoH/DoT supported.",
  },
  {
    id: "nextdns",
    label: "NextDNS",
    server: "45.90.28.0",
    dohUrl: "https://dns.nextdns.io/dns-query",
    region: "global",
    country: "US (anycast)",
    notes: "45.90.28.0 / 45.90.30.0. Configurable filtering; many PoPs.",
  },
  {
    id: "controld",
    label: "Control D",
    server: "76.76.2.0",
    dohUrl: "https://freedns.controld.com/p0/dns-query",
    region: "global",
    country: "CA (anycast)",
    notes: "76.76.2.0 / 76.76.10.0. Free unfiltered tier; DoH/DoT/DoQ supported.",
  },
  {
    id: "mullvad",
    label: "Mullvad DNS",
    server: "194.242.2.2",
    dohUrl: "https://doh.mullvad.net/dns-query",
    region: "europe",
    country: "SE (anycast)",
    notes: "194.242.2.2 / 194.242.2.3. Privacy-focused; no logging.",
  },
  {
    id: "comodo",
    label: "Comodo Secure DNS",
    server: "8.26.56.26",
    dohUrl: "",
    region: "north-america",
    country: "US",
    notes: "8.26.56.26 / 8.20.247.20. Malware blocking; no DoH endpoint.",
  },
  {
    id: "verisign",
    label: "Verisign Public DNS",
    server: "64.6.64.6",
    dohUrl: "",
    region: "north-america",
    country: "US",
    notes: "64.6.64.6 / 64.6.65.6. Operated by .com/.net registry; no filtering; DNSSEC on.",
  },
  {
    id: "yandex",
    label: "Yandex DNS",
    server: "77.88.8.8",
    dohUrl: "",
    region: "europe",
    country: "RU",
    notes: "77.88.8.8 / 77.88.8.1. Russia-focused; 3 tiers (basic / safe / family).",
  },
  {
    id: "dnsforge",
    label: "DNSForge",
    server: "176.9.93.198",
    dohUrl: "https://dnsforge.de/dns-query",
    region: "europe",
    country: "DE",
    notes: "176.9.93.198 / 176.9.1.117. German; ad-blocking optional; DNSSEC on.",
  },
  {
    id: "quad101",
    label: "TWNIC Quad101",
    server: "101.101.101.101",
    dohUrl: "https://dns.twnic.tw/dns-query",
    region: "asia-pacific",
    country: "TW",
    notes: "101.101.101.101 / 101.102.103.104. Taiwan; DoH/DoT; DNSSEC on.",
  },
  {
    id: "aliyun",
    label: "AliDNS",
    server: "223.5.5.5",
    dohUrl: "https://dns.alidns.com/dns-query",
    region: "asia-pacific",
    country: "CN",
    notes: "223.5.5.5 / 223.6.6.6. China; Alibaba-operated; DoH supported.",
  },
  {
    id: "dnspod",
    label: "DNSPod (Tencent)",
    server: "119.29.29.29",
    dohUrl: "https://doh.pub/dns-query",
    region: "asia-pacific",
    country: "CN",
    notes: "119.29.29.29 / 182.254.116.116. Tencent-operated; China-focused.",
  },
  {
    id: "naver",
    label: "Naver DNS",
    server: "119.205.220.3",
    dohUrl: "",
    region: "asia-pacific",
    country: "KR",
    notes: "119.205.220.3 / 119.205.220.7. Korea; no DoH.",
  },
  {
    id: "onelife",
    label: "OneDNS",
    server: "117.50.10.10",
    dohUrl: "",
    region: "asia-pacific",
    country: "CN",
    notes: "117.50.10.10 / 117.50.20.20. China; security-focused.",
  },
  {
    id: "freenom",
    label: "Freenom World DNS",
    server: "80.80.80.80",
    dohUrl: "",
    region: "europe",
    country: "NL",
    notes: "80.80.80.80 / 80.80.81.81. Free; minimal filtering.",
  },
  {
    id: "cleanbrowsing",
    label: "CleanBrowsing",
    server: "185.228.168.9",
    dohUrl: "https://doh.cleanbrowsing.org/doh/family-filter/dns-query",
    region: "global",
    country: "CA (anycast)",
    notes: "185.228.168.9 / 185.228.169.9. Family/safe/adult filters; DoH supported.",
  },
  {
    id: "libredns",
    label: "LibreDNS",
    server: "116.202.176.26",
    dohUrl: "https://doh.libredns.gr/dns-query",
    region: "europe",
    country: "DE",
    notes: "116.202.176.26. German; no logging; DoH-only (no plain UDP).",
  },
  {
    id: "dns.sb",
    label: "DNS.SB",
    server: "185.222.222.222",
    dohUrl: "https://doh.dns.sb/dns-query",
    region: "global",
    country: "DE (anycast)",
    notes: "185.222.222.222 / 45.11.45.11. Any-cast; DoH/DoT/DoQ; no logging.",
  },
  {
    id: "appliedprivacy",
    label: "Applied Privacy DNS",
    server: "2a02:1b8:10:234::6",
    dohUrl: "https://doh.applied-privacy.net/query",
    region: "europe",
    country: "AT",
    notes: "IPv6-preferred (2a02:1b8:10:234::6); Austrian; DoT/DoH only.",
  },
];

export function getResolver(id: string): ResolverPreset | undefined {
  return RESOLVERS.find((r) => r.id === id);
}

export function resolversByRegion(regions: Region[]): ResolverPreset[] {
  if (regions.length === 0) return RESOLVERS;
  return RESOLVERS.filter((r) => regions.includes(r.region));
}

// ---------------------------------------------------------------------------
// Domain normalization
// ---------------------------------------------------------------------------

/** Normalize a domain: trim, lowercase, strip protocol/path, ensure no trailing dot. */
export function normalizeDomain(input: string): string {
  let s = (input || "").trim().toLowerCase();
  if (!s) return "";
  s = s.replace(/^[a-z]+:\/\//, ""); // strip http(s)://
  s = s.split("/")[0]; // strip path
  s = s.split(":")[0]; // strip port
  while (s.endsWith(".")) s = s.slice(0, -1);
  return s;
}

/** Validate that a domain looks syntactically plausible. */
export function isValidDomain(input: string): boolean {
  const d = normalizeDomain(input);
  if (!d) return false;
  if (d.length > 253) return false;
  // Each label: 1-63 chars, [a-z0-9-], no leading/trailing hyphen
  const labels = d.split(".");
  if (labels.length < 2) return false;
  return labels.every((l) =>
    l.length >= 1 && l.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(l),
  );
}

// ---------------------------------------------------------------------------
// Command generation
// ---------------------------------------------------------------------------

function buildFlags(flags?: DigFlag[]): string {
  if (!flags || flags.length === 0) return "";
  const map: Record<DigFlag["id"], string> = {
    short: "+short",
    answer: "+noall +answer",
    dnssec: "+dnssec",
    multi: "+multi",
    trace: "+trace",
  };
  return " " + flags.map((f) => map[f.id]).join(" ");
}

/** Build a single dig / kdig / Resolve-DnsName command for one resolver. */
export function generateCommand(
  resolver: ResolverPreset,
  opts: CommandOptions,
): GeneratedCommand {
  const domain = normalizeDomain(opts.domain);
  const flagsStr = buildFlags(opts.flags);
  let command = "";
  let explanation = "";
  let compareCommand = "";

  switch (opts.tool) {
    case "dig": {
      const atPart = resolver.server ? ` @${resolver.server}` : "";
      command = `dig${atPart} ${opts.recordType} ${domain}${flagsStr}`;
      explanation = `Query ${opts.recordType} for ${domain} via ${resolver.label} (${resolver.server}). ${resolver.notes}`;
      break;
    }
    case "kdig": {
      if (!resolver.dohUrl) {
        // Fall back to plain kdig (still works against the resolver IP)
        const atPart = resolver.server ? ` @${resolver.server}` : "";
        command = `kdig${atPart} ${opts.recordType} ${domain}${flagsStr}`;
        explanation = `DNS-over-HTTPS not available for ${resolver.label}; falling back to plain UDP/TCP kdig against ${resolver.server}. ${resolver.notes}`;
      } else {
        const dohHost = resolver.dohUrl.replace(/^https?:\/\//, "").split("/")[0];
        command = `kdig @${dohHost} +https=${resolver.dohUrl} ${opts.recordType} ${domain}${flagsStr}`;
        explanation = `DNS-over-HTTPS (DoH) query for ${opts.recordType} ${domain} via ${resolver.label} (${resolver.dohUrl}). Bypasses plain-UDP interception. ${resolver.notes}`;
      }
      break;
    }
    case "resolve-dnsname": {
      const serverPart = resolver.server ? ` -Server ${resolver.server}` : "";
      command = `Resolve-DnsName -Name '${domain}' -Type ${opts.recordType}${serverPart} -DnsOnly`;
      explanation = `PowerShell Resolve-DnsName for ${opts.recordType} ${domain} via ${resolver.label} (${resolver.server}). -DnsOnly skips NetBIOS / hosts-file fallback so the answer reflects the actual DNS lookup. ${resolver.notes}`;
      break;
    }
  }

  if (opts.expected && opts.expected.trim()) {
    compareCommand = buildCompareCommand(resolver, opts, command);
  }

  return {
    tool: opts.tool,
    resolverId: resolver.id,
    resolverLabel: resolver.label,
    region: resolver.region,
    command,
    explanation,
    compareCommand,
  };
}

/** Build a comparison one-liner that flags mismatched answers. */
export function buildCompareCommand(
  resolver: ResolverPreset,
  opts: CommandOptions,
  baseCommand: string,
): string {
  const expected = opts.expected.trim();
  if (!expected) return "";
  const domain = normalizeDomain(opts.domain);

  switch (opts.tool) {
    case "dig":
    case "kdig": {
      // Always use +short so we get a clean answer set, then test with grep -F (exact/contains) or grep -E (regex).
      const flagsShort = buildFlags([{ id: "short" }]);
      const atPart = opts.tool === "dig"
        ? (resolver.server ? ` @${resolver.server}` : "")
        : (resolver.dohUrl
          ? ` @${resolver.dohUrl.replace(/^https?:\/\//, "").split("/")[0]} +https=${resolver.dohUrl}`
          : (resolver.server ? ` @${resolver.server}` : ""));
      const baseCmd = opts.tool === "dig"
        ? `dig${atPart} ${opts.recordType} ${domain}${flagsShort}`
        : `kdig${atPart} ${opts.recordType} ${domain}${flagsShort}`;

      if (opts.matchMode === "regex") {
        // Validate the regex — if it fails, fall back to literal grep -F
        try {
          // eslint-disable-next-line no-new
          new RegExp(expected);
          return `${baseCmd} | grep -E '${expected}' >/dev/null && echo "${resolver.id}: OK" || echo "${resolver.id}: DIFFERS"`;
        } catch {
          return `${baseCmd} | grep -F '${expected.replace(/'/g, "'\\''")}' >/dev/null && echo "${resolver.id}: OK" || echo "${resolver.id}: DIFFERS"`;
        }
      }
      if (opts.matchMode === "exact") {
        return `${baseCmd} | grep -Fx '${expected.replace(/'/g, "'\\''")}' >/dev/null && echo "${resolver.id}: OK" || echo "${resolver.id}: DIFFERS"`;
      }
      // contains
      return `${baseCmd} | grep -F '${expected.replace(/'/g, "'\\''")}' >/dev/null && echo "${resolver.id}: OK" || echo "${resolver.id}: DIFFERS"`;
    }
    case "resolve-dnsname": {
      const serverPart = resolver.server ? ` -Server ${resolver.server}` : "";
      // PowerShell's Resolve-DnsName returns objects; we project the most relevant property per record type
      const propMap: Record<RecordType, string> = {
        A: "IPAddress",
        AAAA: "IPAddress",
        CNAME: "NameHost",
        MX: "NameExchange",
        TXT: "Strings",
        NS: "NameHost",
        SOA: "PrimaryServer",
        CAA: "Value",
      };
      const prop = propMap[opts.recordType];
      const escapedExpected = expected.replace(/'/g, "''");
      if (opts.matchMode === "regex") {
        return `Resolve-DnsName -Name '${domain}' -Type ${opts.recordType}${serverPart} -DnsOnly | Where-Object { $_.${prop} -match '${escapedExpected}' } | Measure-Object | ForEach-Object { if ($_.Count -gt 0) { '${resolver.id}: OK' } else { '${resolver.id}: DIFFERS' } }`;
      }
      if (opts.matchMode === "exact") {
        return `Resolve-DnsName -Name '${domain}' -Type ${opts.recordType}${serverPart} -DnsOnly | Where-Object { $_.${prop} -eq '${escapedExpected}' } | Measure-Object | ForEach-Object { if ($_.Count -gt 0) { '${resolver.id}: OK' } else { '${resolver.id}: DIFFERS' } }`;
      }
      return `Resolve-DnsName -Name '${domain}' -Type ${opts.recordType}${serverPart} -DnsOnly | Where-Object { "$_".Contains('${escapedExpected}') } | Measure-Object | ForEach-Object { if ($_.Count -gt 0) { '${resolver.id}: OK' } else { '${resolver.id}: DIFFERS' } }`;
    }
  }
}

/** Generate commands for a list of resolvers. */
export function generateCommands(
  resolvers: ResolverPreset[],
  opts: CommandOptions,
): GeneratedCommand[] {
  return resolvers.map((r) => generateCommand(r, opts));
}

// ---------------------------------------------------------------------------
// Authoritative vs recursive comparison
// ---------------------------------------------------------------------------

/** Generate a command that queries the domain's authoritative NS first, then a recursive resolver. */
export function generateAuthoritativeCompare(
  domain: string,
  recordType: RecordType,
  resolver: ResolverPreset,
): GeneratedCommand[] {
  const d = normalizeDomain(domain);
  const out: GeneratedCommand[] = [];
  // Step 1: get the NS for the domain
  out.push({
    tool: "dig",
    resolverId: resolver.id,
    resolverLabel: resolver.label,
    region: resolver.region,
    command: `dig ${resolver.server ? `@${resolver.server} ` : ""}NS ${d} +short`,
    explanation: `Step 1: get the authoritative nameservers for ${d} (via ${resolver.label}).`,
    compareCommand: "",
  });
  // Step 2: query the authoritative NS directly
  out.push({
    tool: "dig",
    resolverId: resolver.id,
    resolverLabel: resolver.label,
    region: resolver.region,
    command: `dig @<NS-FROM-STEP-1> ${recordType} ${d} +short`,
    explanation: `Step 2: query one of the authoritative NS directly — this is the "source of truth" answer.`,
    compareCommand: "",
  });
  // Step 3: query the recursive resolver
  out.push({
    tool: "dig",
    resolverId: resolver.id,
    resolverLabel: resolver.label,
    region: resolver.region,
    command: `dig ${resolver.server ? `@${resolver.server} ` : ""}${recordType} ${d} +short`,
    explanation: `Step 3: query the recursive resolver (${resolver.label}). Compare against step 2 — if they match, propagation has reached this resolver; if not, it's still serving a cached (stale) answer.`,
    compareCommand: "",
  });
  return out;
}

// ---------------------------------------------------------------------------
// Propagation ETA
// ---------------------------------------------------------------------------

/** Compute a TTL-based propagation ETA. */
export function computeEta(ttlSeconds: number): PropagationEta {
  const ttl = Math.max(0, Math.floor(ttlSeconds));
  // Heuristic:
  // - p50 ≈ TTL / 2 (half of resolvers refresh in the first half of the TTL window)
  // - p95 ≈ TTL * 2 (slow stragglers and DNSSEC validation delays)
  // - worst case ≈ TTL * 3 (conservative upper bound for very stale caches)
  const p50 = Math.floor(ttl / 2);
  const p95 = ttl * 2;
  const worst = ttl * 3;

  return {
    ttlSeconds: ttl,
    p50Seconds: p50,
    p95Seconds: p95,
    worstCaseSeconds: worst,
    p50Human: humanizeSeconds(p50),
    p95Human: humanizeSeconds(p95),
    worstHuman: humanizeSeconds(worst),
    explanation: `TTL ${ttl}s = ${humanizeSeconds(ttl)}. After the authoritative change, recursive resolvers keep serving the old cached answer until the TTL expires. Statistical estimate: ~50% of resolvers will see the new value within ${humanizeSeconds(p50)}, ~95% within ${humanizeSeconds(p95)}, and the slowest stragglers (with DNSSEC validation delays or stale upstream caches) may take up to ${humanizeSeconds(worst)}. Actual propagation depends on resolver behavior, anycast routing, and DNSSEC chain length.`,
  };
}

function humanizeSeconds(s: number): string {
  if (s < 60) return `${s}s`;
  if (s < 3600) {
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return rem ? `${m}m ${rem}s` : `${m}m`;
  }
  if (s < 86400) {
    const h = Math.floor(s / 3600);
    const rem = s % 3600;
    const m = Math.floor(rem / 60);
    return m ? `${h}h ${m}m` : `${h}h`;
  }
  const d = Math.floor(s / 86400);
  const rem = s % 86400;
  const h = Math.floor(rem / 3600);
  return h ? `${d}d ${h}h` : `${d}d`;
}

// ---------------------------------------------------------------------------
// Batch script generator
// ---------------------------------------------------------------------------

/** Generate a bash batch script that runs one command per resolver. */
export function generateBashScript(
  commands: GeneratedCommand[],
  domain: string,
  recordType: RecordType,
): string {
  const d = normalizeDomain(domain);
  const lines: string[] = [
    "#!/usr/bin/env bash",
    "# Generated by UnQTools — DNS Propagation Checker Reference",
    "# 100% client-side tool. This script runs the actual queries from your shell.",
    'set -euo pipefail',
    "",
    `# Domain: ${d}`,
    `# Record type: ${recordType}`,
    `# Resolvers: ${commands.length}`,
    "",
    'echo "=== DNS propagation check for ${d} (${recordType}) ==="',
    'echo "Started at: $(date -u +%Y-%m-%dT%H:%M:%SZ)"',
    'echo',
    "",
  ];
  for (const c of commands) {
    lines.push(`echo "--- ${c.resolverLabel} (${REGION_LABELS[c.region]}) ---"`);
    if (c.compareCommand) {
      lines.push(`${c.compareCommand} || echo "  (lookup failed for ${c.resolverId})"`);
    } else {
      lines.push(`${c.command} || echo "  (lookup failed for ${c.resolverId})"`);
    }
    lines.push('echo');
  }
  lines.push('echo "=== Done ==="');
  return lines.join("\n");
}

/** Generate a PowerShell batch script. */
export function generatePowershellScript(
  commands: GeneratedCommand[],
  domain: string,
  recordType: RecordType,
): string {
  const d = normalizeDomain(domain);
  const lines: string[] = [
    "# Generated by UnQTools — DNS Propagation Checker Reference",
    "# 100% client-side tool. This script runs the actual queries from your shell.",
    "$ErrorActionPreference = 'Continue'",
    "",
    `$Domain = '${d}'`,
    `$RecordType = '${recordType}'`,
    `$Resolvers = ${commands.length}`,
    "",
    `Write-Host "=== DNS propagation check for $Domain ($RecordType) ==="`,
    `Write-Host ("Started at: " + (Get-Date).ToUniversalTime().ToString('o'))`,
    `Write-Host`,
    "",
  ];
  for (const c of commands) {
    lines.push(`Write-Host "--- ${c.resolverLabel} (${REGION_LABELS[c.region]}) ---"`);
    // For PowerShell tool, use the compareCommand if present, else the base command
    if (c.tool === "resolve-dnsname") {
      lines.push(c.compareCommand || c.command);
    } else {
      // For dig/kdig commands on Windows PowerShell, fall back to a Resolve-DnsName equivalent
      // — but since we already have the command, just run it via the dig.exe if available
      lines.push(c.compareCommand || c.command);
    }
    lines.push("Write-Host");
  }
  lines.push('Write-Host "=== Done ==="');
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// CSV / JSON export
// ---------------------------------------------------------------------------

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Render the command plan as CSV. */
export function renderCsv(commands: GeneratedCommand[]): string {
  const lines = ["resolver_id,resolver_label,region,tool,command,compare_command,explanation"];
  for (const c of commands) {
    lines.push([
      c.resolverId,
      escapeCsv(c.resolverLabel),
      c.region,
      c.tool,
      escapeCsv(c.command),
      escapeCsv(c.compareCommand),
      escapeCsv(c.explanation),
    ].join(","));
  }
  return lines.join("\n");
}

/** Render the command plan as JSON. */
export function renderJson(commands: GeneratedCommand[]): string {
  return JSON.stringify(
    commands.map((c) => ({
      resolverId: c.resolverId,
      resolverLabel: c.resolverLabel,
      region: c.region,
      tool: c.tool,
      command: c.command,
      compareCommand: c.compareCommand,
      explanation: c.explanation,
    })),
    null,
    2,
  );
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:dns-propagation-checker-reference:history";

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

export interface ShareParams {
  domain: string;
  recordType: RecordType;
  tool: CommandTool;
  matchMode: MatchMode;
  expected: string;
  regions?: Region[];
  flags?: DigFlag["id"][];
}

export function buildShareUrl(params: ShareParams): string {
  const p = new URLSearchParams();
  if (params.domain) p.set("domain", params.domain);
  if (params.recordType) p.set("type", params.recordType);
  if (params.tool) p.set("tool", params.tool);
  if (params.matchMode) p.set("match", params.matchMode);
  if (params.expected) p.set("expected", params.expected);
  if (params.regions && params.regions.length > 0) p.set("regions", params.regions.join(","));
  if (params.flags && params.flags.length > 0) p.set("flags", params.flags.join(","));
  if (typeof window === "undefined") return `?${p.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${p.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ShareParams> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const p = new URLSearchParams(clean);
  const validTypes: RecordType[] = ["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SOA", "CAA"];
  const validTools: CommandTool[] = ["dig", "kdig", "resolve-dnsname"];
  const validMatch: MatchMode[] = ["exact", "contains", "regex"];
  const validRegions: Region[] = REGIONS.map((r) => r.id);
  const validFlags: DigFlag["id"][] = ["short", "answer", "dnssec", "multi", "trace"];

  const type = p.get("type") as RecordType | null;
  const tool = p.get("tool") as CommandTool | null;
  const match = p.get("match") as MatchMode | null;
  const regionsStr = p.get("regions") ?? "";
  const flagsStr = p.get("flags") ?? "";

  return {
    domain: p.get("domain") ?? "",
    recordType: type && validTypes.includes(type) ? type : undefined,
    tool: tool && validTools.includes(tool) ? tool : undefined,
    matchMode: match && validMatch.includes(match) ? match : undefined,
    expected: p.get("expected") ?? "",
    regions: regionsStr
      ? regionsStr.split(",").filter((r) => validRegions.includes(r as Region)) as Region[]
      : undefined,
    flags: flagsStr
      ? flagsStr.split(",").filter((f) => validFlags.includes(f as DigFlag["id"])) as DigFlag["id"][]
      : undefined,
  };
}
