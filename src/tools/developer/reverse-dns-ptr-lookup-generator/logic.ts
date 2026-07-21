/**
 * Reverse DNS (PTR) Lookup Generator — pure logic.
 *
 * Builds the correct reverse-zone (in-addr.arpa / ip6.arpa) name for any
 * IPv4 or IPv6 address or small CIDR, generates ready-to-paste
 * dig / nslookup / kdig (DoH) / host commands for the chosen resolver,
 * parses PTR zone records, builds a forward-confirmed reverse DNS
 * (FCrDNS) chain, and flags private/loopback/link-local addresses that
 * have no public PTR.
 *
 * Pure functions only — no DOM, no network, no external deps.
 *
 * PRIVACY: The history feature stores only operation metadata (action +
 * resolver + count + ts), NEVER the queried IP address itself.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IpVersion = "IPv4" | "IPv6";

export type ResolverId =
  | "google"
  | "cloudflare"
  | "quad9"
  | "opendns"
  | "custom";

export interface ResolverPreset {
  id: ResolverId;
  label: string;
  /** IP/hostname used for dig @server. Empty = no @server (use system default). */
  server: string;
  /** DoH endpoint (kdig +https=), empty when N/A. */
  dohUrl: string;
  notes: string;
}

export type CommandTool = "dig" | "nslookup" | "kdig" | "host";

export type DigFlag = "short" | "answer" | "multi" | "dnssec";

export interface GeneratedCommand {
  tool: CommandTool;
  command: string;
  explanation: string;
}

export interface ReverseZoneResult {
  ok: true;
  ip: string;
  version: IpVersion;
  zone: string;
  isPrivate: boolean;
  classification: string;
  note: string;
}

export interface ReverseZoneError {
  ok: false;
  error: string;
}

export type ReverseZoneOutcome = ReverseZoneResult | ReverseZoneError;

export interface FcrdnsStep {
  step: number;
  description: string;
  command: string;
  tool: CommandTool;
}

export interface FcrdnsPlan {
  ok: true;
  ip: string;
  zone: string;
  steps: FcrdnsStep[];
  explanation: string;
}

export type FcrdnsOutcome = FcrdnsPlan | ReverseZoneError;

export interface ParsedPtrRecord {
  ok: boolean;
  name: string;
  ttl: string;
  class: string;
  type: string;
  target: string;
  notes: string[];
}

export interface HistoryEntry {
  ts: number;
  action: "reverse" | "fcrdns" | "parse" | "batch";
  resolver: ResolverId;
  count: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum number of IPs a CIDR range may emit. */
export const CIDR_MAX_ADDRESSES = 256;

/** Maximum number of history entries kept. */
export const HISTORY_MAX = 20;

export const RESOLVERS: ResolverPreset[] = [
  {
    id: "google",
    label: "Google Public DNS",
    server: "8.8.8.8",
    dohUrl: "https://dns.google/dns-query",
    notes: "8.8.8.8 / 8.8.4.4. DoH at dns.google. Logs limited TTL info; DNSSEC on.",
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
// IP validation & classification
// ---------------------------------------------------------------------------

const IPV4_RE = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

/** True if string is a valid IPv4 dotted-quad. */
export function isValidIpv4(s: string): boolean {
  return IPV4_RE.test(s.trim());
}

/**
 * True if string is a valid IPv6 address (with optional :: shorthand).
 * Validates by expanding and confirming 8 groups of 1-4 hex digits.
 */
export function isValidIpv6(s: string): boolean {
  const addr = s.trim().toLowerCase();
  if (!addr) return false;
  // Reject zone IDs
  if (addr.includes("%")) return false;
  // Must contain only hex, colons, and at most one "::"
  if (!/^[0-9a-f:]+$/.test(addr)) return false;
  const doubleColons = addr.match(/::/g);
  if (doubleColons && doubleColons.length > 1) return false;
  // Cannot start or end with single ':' (only '::' allowed at edges)
  if (addr.startsWith(":") && !addr.startsWith("::")) return false;
  if (addr.endsWith(":") && !addr.endsWith("::")) return false;

  // Expand and check group count
  const expanded = expandIpv6(addr);
  if (expanded === null) return false;
  const groups = expanded.split(":");
  if (groups.length !== 8) return false;
  return groups.every((g) => /^[0-9a-f]{1,4}$/.test(g));
}

/** Expand an IPv6 address to its full 8-group form. Returns null on parse error. */
export function expandIpv6(addr: string): string | null {
  const a = addr.trim().toLowerCase();
  if (a.includes("%")) return null;
  if (!/^[0-9a-f:]+$/.test(a)) return null;

  let halves: string[];
  if (a.includes("::")) {
    const idx = a.indexOf("::");
    const left = a.slice(0, idx);
    const right = a.slice(idx + 2);
    if (right.includes("::") || left.includes("::")) return null;
    halves = [left, right];
  } else {
    halves = [a, ""];
  }

  const leftGroups = halves[0] ? halves[0].split(":") : [];
  const rightGroups = halves[1] ? halves[1].split(":") : [];

  if (!a.includes("::")) {
    if (leftGroups.length !== 8) return null;
    return leftGroups.map((g) => g.padStart(4, "0")).join(":");
  }

  const missing = 8 - leftGroups.length - rightGroups.length;
  if (missing < 1) return null;
  const zeros = Array(missing).fill("0000");
  const all = [...leftGroups, ...zeros, ...rightGroups];
  if (all.length !== 8) return null;
  return all.map((g) => g.padStart(4, "0")).join(":");
}

/** Detect whether an IPv4 address is in a private / reserved range. */
export function classifyIpv4(ip: string): { isPrivate: boolean; label: string; note: string } {
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})/);
  if (!m) return { isPrivate: false, label: "Public", note: "" };
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a === 10) return { isPrivate: true, label: "Private (RFC 1918)", note: "10.0.0.0/8 — no public PTR." };
  if (a === 127) return { isPrivate: true, label: "Loopback", note: "127.0.0.0/8 — localhost, no public PTR." };
  if (a === 0) return { isPrivate: true, label: "Reserved (this-network)", note: "0.0.0.0/8 — no public PTR." };
  if (a === 169 && b === 254) return { isPrivate: true, label: "Link-local", note: "169.254.0.0/16 — no public PTR." };
  if (a === 172 && b >= 16 && b <= 31) return { isPrivate: true, label: "Private (RFC 1918)", note: "172.16.0.0/12 — no public PTR." };
  if (a === 192 && b === 168) return { isPrivate: true, label: "Private (RFC 1918)", note: "192.168.0.0/16 — no public PTR." };
  if (a === 192 && b === 0 && Number(m[3]) === 0) return { isPrivate: true, label: "Reserved", note: "192.0.0.0/24 — no public PTR." };
  if (a === 192 && b === 0 && Number(m[3]) === 2) return { isPrivate: true, label: "Documentation (RFC 5737)", note: "192.0.2.0/24 — TEST-NET-1, no public PTR." };
  if (a === 198 && (b === 18 || b === 19)) return { isPrivate: true, label: "Benchmarking", note: "198.18.0.0/15 — no public PTR." };
  if (a === 198 && b === 51 && Number(m[3]) === 100) return { isPrivate: true, label: "Documentation (RFC 5737)", note: "198.51.100.0/24 — TEST-NET-2, no public PTR." };
  if (a === 203 && b === 0 && Number(m[3]) === 113) return { isPrivate: true, label: "Documentation (RFC 5737)", note: "203.0.113.0/24 — TEST-NET-3, no public PTR." };
  if (a >= 224) return { isPrivate: true, label: "Multicast / Reserved", note: "224.0.0.0/4 and 240.0.0.0/4 — no public PTR." };
  if (a === 100 && b >= 64 && b <= 127) return { isPrivate: true, label: "Shared NAT (RFC 6598)", note: "100.64.0.0/10 — CGNAT, no public PTR." };
  return { isPrivate: false, label: "Public", note: "" };
}

/** Detect whether an IPv6 address is in a private / reserved range. */
export function classifyIpv6(ip: string): { isPrivate: boolean; label: string; note: string } {
  const expanded = expandIpv6(ip);
  if (!expanded) return { isPrivate: false, label: "Public", note: "" };
  const compact = expanded.replace(/:/g, "");
  const first = compact.slice(0, 4);
  const second = compact.slice(4, 8);
  if (compact === "00000000000000000000000000000000") return { isPrivate: true, label: "Unspecified", note: ":: — no public PTR." };
  if (compact === "00000000000000000000000000000001") return { isPrivate: true, label: "Loopback", note: "::1 — localhost, no public PTR." };
  if (first === "fe80") return { isPrivate: true, label: "Link-local", note: "fe80::/10 — no public PTR." };
  if (first === "fc00" || first === "fd00") return { isPrivate: true, label: "Unique local (ULA)", note: "fc00::/7 — no public PTR." };
  if (first === "fec0") return { isPrivate: true, label: "Site-local (deprecated)", note: "fec0::/10 — no public PTR." };
  if (first === "2001" && second === "0db8") return { isPrivate: true, label: "Documentation (RFC 3849)", note: "2001:db8::/32 — no public PTR." };
  if (first === "ff00") return { isPrivate: true, label: "Multicast", note: "ff00::/8 — no public PTR." };
  if (first === "0000") return { isPrivate: true, label: "Reserved", note: "::/8 — no public PTR." };
  if (first === "0100" && expanded.slice(4) === "0000000000000000000000000000") {
    return { isPrivate: true, label: "Discard-only", note: "100::/64 — no public PTR." };
  }
  if (first === "0064" && second === "ff9b") return { isPrivate: true, label: "Discard (RFC 6666)", note: "64:ff9b::/96 — no public PTR." };
  return { isPrivate: false, label: "Public", note: "" };
}

// ---------------------------------------------------------------------------
// Reverse-zone construction
// ---------------------------------------------------------------------------

/** Build the in-addr.arpa name for an IPv4 address. */
export function buildIpv4ReverseZone(ip: string): string {
  const parts = ip.trim().split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    throw new Error(`Invalid IPv4 address: ${ip}`);
  }
  return `${parts[3]}.${parts[2]}.${parts[1]}.${parts[0]}.in-addr.arpa`;
}

/** Build the ip6.arpa name for an IPv6 address (nibble-reversed). */
export function buildIpv6ReverseZone(ip: string): string {
  const expanded = expandIpv6(ip);
  if (!expanded) throw new Error(`Invalid IPv6 address: ${ip}`);
  const nibbles = expanded.replace(/:/g, "").split("");
  return nibbles.reverse().join(".") + ".ip6.arpa";
}

/** Build the reverse-zone name for any IP (IPv4 or IPv6). */
export function buildReverseZone(ip: string): ReverseZoneOutcome {
  const trimmed = ip.trim();
  if (!trimmed) return { ok: false, error: "Empty IP address." };
  if (isValidIpv4(trimmed)) {
    const zone = buildIpv4ReverseZone(trimmed);
    const cls = classifyIpv4(trimmed);
    return { ok: true, ip: trimmed, version: "IPv4", zone, isPrivate: cls.isPrivate, classification: cls.label, note: cls.note };
  }
  if (isValidIpv6(trimmed)) {
    const zone = buildIpv6ReverseZone(trimmed);
    const cls = classifyIpv6(trimmed);
    return { ok: true, ip: trimmed, version: "IPv6", zone, isPrivate: cls.isPrivate, classification: cls.label, note: cls.note };
  }
  return { ok: false, error: `Not a valid IPv4 or IPv6 address: ${ip}` };
}

// ---------------------------------------------------------------------------
// CIDR range enumeration
// ---------------------------------------------------------------------------

export interface CidrParseResult {
  ok: true;
  baseIp: string;
  version: IpVersion;
  prefix: number;
  count: number;
  ips: string[];
  truncated: boolean;
}

export type CidrOutcome = CidrParseResult | ReverseZoneError;

/** Parse and enumerate a CIDR like "192.0.2.0/30" or "2001:db8::/126". */
export function enumerateCidr(cidr: string): CidrOutcome {
  const trimmed = cidr.trim();
  if (!trimmed) return { ok: false, error: "Empty CIDR." };
  const slash = trimmed.lastIndexOf("/");
  if (slash === -1) return { ok: false, error: "CIDR must contain a / prefix length." };
  const baseIp = trimmed.slice(0, slash).trim();
  const prefixStr = trimmed.slice(slash + 1).trim();
  const prefix = Number(prefixStr);
  if (!Number.isInteger(prefix) || prefix < 0) {
    return { ok: false, error: `Invalid prefix length: ${prefixStr}` };
  }

  if (isValidIpv4(baseIp)) {
    if (prefix > 32) return { ok: false, error: `IPv4 prefix /${prefix} > 32.` };
    const count = 1 << (32 - prefix);
    if (count > CIDR_MAX_ADDRESSES) {
      return { ok: false, error: `CIDR /${prefix} would emit ${count} addresses — cap is ${CIDR_MAX_ADDRESSES}. Use /${32 - Math.log2(CIDR_MAX_ADDRESSES)} or smaller (e.g. /24).` };
    }
    const parts = baseIp.split(".").map((p) => Number(p));
    const baseInt = ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
    const mask = prefix === 0 ? 0 : (0xFFFFFFFF << (32 - prefix)) >>> 0;
    const networkBase = (baseInt & mask) >>> 0;
    const ips: string[] = [];
    for (let i = 0; i < count; i++) {
      const n = (networkBase + i) >>> 0;
      ips.push(`${(n >>> 24) & 0xFF}.${(n >>> 16) & 0xFF}.${(n >>> 8) & 0xFF}.${n & 0xFF}`);
    }
    return { ok: true, baseIp, version: "IPv4", prefix, count, ips, truncated: false };
  }

  if (isValidIpv6(baseIp)) {
    if (prefix > 128) return { ok: false, error: `IPv6 prefix /${prefix} > 128.` };
    const count = 1 << (128 - prefix);
    if (count > CIDR_MAX_ADDRESSES) {
      const minPrefix = 128 - Math.log2(CIDR_MAX_ADDRESSES);
      return { ok: false, error: `CIDR /${prefix} would emit ${count} addresses — cap is ${CIDR_MAX_ADDRESSES}. Use /${minPrefix} or larger (e.g. /120).` };
    }
    const expanded = expandIpv6(baseIp)!;
    const nibbles = expanded.replace(/:/g, "");
    // Convert to BigInt via hex string ops (BigInt literals are unavailable on ES2017 target)
    const baseBigInt = BigInt("0x" + nibbles);
    const maskBigInt = prefix === 0 ? BigInt(0) : ((BigInt(1) << BigInt(128)) - BigInt(1)) ^ ((BigInt(1) << BigInt(128 - prefix)) - BigInt(1));
    const networkBase = baseBigInt & maskBigInt;
    const ips: string[] = [];
    for (let i = BigInt(0); i < BigInt(count); i++) {
      ips.push(bigIntToIpv6(networkBase + i));
    }
    return { ok: true, baseIp, version: "IPv6", prefix, count, ips, truncated: false };
  }

  return { ok: false, error: `Not a valid IPv4 or IPv6 base address: ${baseIp}` };
}

/** Convert a BigInt <= 2^128 to a compressed IPv6 string. */
function bigIntToIpv6(n: bigint): string {
  const groups: string[] = [];
  for (let i = 7; i >= 0; i--) {
    const g = Number((n >> BigInt(i * 16)) & BigInt(0xFFFF));
    groups.push(g.toString(16));
  }
  // Compress longest run of zeros
  let bestStart = -1;
  let bestLen = 0;
  let curStart = -1;
  let curLen = 0;
  for (let i = 0; i < groups.length; i++) {
    if (groups[i] === "0") {
      if (curStart === -1) curStart = i;
      curLen++;
      if (curLen > bestLen) { bestLen = curLen; bestStart = curStart; }
    } else {
      curStart = -1;
      curLen = 0;
    }
  }
  if (bestLen >= 2) {
    const left = groups.slice(0, bestStart).join(":");
    const right = groups.slice(bestStart + bestLen).join(":");
    return `${left}::${right}`;
  }
  return groups.join(":");
}

// ---------------------------------------------------------------------------
// Command generation
// ---------------------------------------------------------------------------

export interface CommandOptions {
  tool: CommandTool;
  ip: string;
  resolver: ResolverId;
  customServer?: string;
  flags?: DigFlag[];
  /** Hostname to forward-resolve when building an FCrDNS chain. */
  forwardHostname?: string;
}

function buildFlags(flags?: DigFlag[]): string {
  if (!flags || flags.length === 0) return "";
  const map: Record<DigFlag, string> = {
    short: "+short",
    answer: "+noall +answer",
    multi: "+multi",
    dnssec: "+dnssec",
  };
  return " " + flags.map((f) => map[f]).join(" ");
}

function resolverServer(id: ResolverId, custom?: string): string {
  if (id === "custom") return custom?.trim() || "";
  return getResolver(id).server;
}

/** Generate dig / nslookup / kdig / host command for a single reverse lookup. */
export function generateCommand(opts: CommandOptions): GeneratedCommand | null {
  const trimmed = opts.ip.trim();
  const zoneRes = buildReverseZone(trimmed);
  if (!zoneRes.ok) return null;
  const server = resolverServer(opts.resolver, opts.customServer);
  const flagsStr = buildFlags(opts.flags);

  switch (opts.tool) {
    case "dig": {
      const atPart = server ? ` @${server}` : "";
      const cmd = `dig${atPart} -x ${trimmed}${flagsStr}`;
      return {
        tool: "dig",
        command: cmd,
        explanation: `Reverse lookup of ${trimmed} via ${zoneRes.zone}${server ? ` using resolver ${server}` : " using the system default resolver"}. The -x flag auto-builds the in-addr.arpa / ip6.arpa name and sets the query type to PTR.`,
      };
    }
    case "nslookup": {
      const serverPart = server ? ` ${server}` : "";
      const cmd = `nslookup -type=PTR ${zoneRes.zone}${serverPart}`;
      return {
        tool: "nslookup",
        command: cmd,
        explanation: `Reverse lookup using nslookup against the explicit reverse-zone name ${zoneRes.zone}${server ? ` via ${server}` : ""}. nslookup does not have a -x flag, so the in-addr.arpa / ip6.arpa name is built for you.`,
      };
    }
    case "kdig": {
      const dohUrl = opts.resolver === "custom" ? (opts.customServer?.trim() || "") : getResolver(opts.resolver).dohUrl;
      if (!dohUrl) {
        // Fall back to plain dig-style kdig
        const atPart = server ? ` @${server}` : "";
        const cmd = `kdig${atPart} -x ${trimmed}${flagsStr}`;
        return {
          tool: "kdig",
          command: cmd,
          explanation: `Reverse lookup via kdig (Knot DNS)${server ? ` against ${server}` : ""}. DoH is unavailable for this resolver, so a plain UDP/TCP query is used.`,
        };
      }
      const cmd = `kdig @${opts.resolver === "custom" ? "<doh-host>" : dohUrl.replace(/^https?:\/\//, "").split("/")[0]} +https=${dohUrl} -x ${trimmed}${flagsStr}`;
      return {
        tool: "kdig",
        command: cmd,
        explanation: `DNS-over-HTTPS (DoH) reverse lookup via kdig against ${dohUrl}. The +https flag forces DoH; -x auto-builds ${zoneRes.zone}.`,
      };
    }
    case "host": {
      const serverPart = server ? ` ${server}` : "";
      const cmd = `host -t PTR ${zoneRes.zone}${serverPart}`;
      return {
        tool: "host",
        command: cmd,
        explanation: `Reverse lookup using the host utility against ${zoneRes.zone}${server ? ` via ${server}` : ""}. host prints a compact answer suitable for scripting.`,
      };
    }
    default:
      return null;
  }
}

/** Generate commands for all four tools for one IP. */
export function generateAllCommands(ip: string, resolver: ResolverId, customServer?: string, flags?: DigFlag[]): GeneratedCommand[] {
  const out: GeneratedCommand[] = [];
  for (const tool of ["dig", "nslookup", "kdig", "host"] as CommandTool[]) {
    const cmd = generateCommand({ tool, ip, resolver, customServer, flags });
    if (cmd) out.push(cmd);
  }
  return out;
}

/** Generate commands for every IP in a CIDR range, one tool per IP. */
export function generateCidrCommands(
  cidr: string,
  tool: CommandTool,
  resolver: ResolverId,
  customServer?: string,
  flags?: DigFlag[],
): { ok: true; commands: GeneratedCommand[]; count: number } | ReverseZoneError {
  const res = enumerateCidr(cidr);
  if (!res.ok) return res;
  const commands: GeneratedCommand[] = [];
  for (const ip of res.ips) {
    const c = generateCommand({ tool, ip, resolver, customServer, flags });
    if (c) commands.push(c);
  }
  return { ok: true, commands, count: commands.length };
}

// ---------------------------------------------------------------------------
// FCrDNS chain builder
// ---------------------------------------------------------------------------

/** Build an FCrDNS verification chain (PTR + A/AAAA) for an IP. */
export function buildFcrdnsChain(ip: string, resolver: ResolverId, customServer?: string): FcrdnsOutcome {
  const zoneRes = buildReverseZone(ip);
  if (!zoneRes.ok) return zoneRes;
  const server = resolverServer(resolver, customServer);
  const atPart = server ? ` @${server}` : "";
  const isV6 = zoneRes.version === "IPv6";
  const forwardType = isV6 ? "AAAA" : "A";

  const steps: FcrdnsStep[] = [
    {
      step: 1,
      description: `Reverse lookup: query the PTR record for ${zoneRes.ip} (${zoneRes.zone}).`,
      tool: "dig",
      command: `dig${atPart} -x ${zoneRes.ip} +short`,
    },
    {
      step: 2,
      description: `Take the hostname returned in step 1 (call it HOSTNAME) and forward-resolve it with a ${forwardType} query.`,
      tool: "dig",
      command: `dig${atPart} ${forwardType} HOSTNAME +short`,
    },
    {
      step: 3,
      description: `Compare the IP set returned in step 2 against ${zoneRes.ip}. FCrDNS passes only if ${zoneRes.ip} is in that set.`,
      tool: "dig",
      command: `# If step 2 contains "${zoneRes.ip}", FCrDNS PASSES. Otherwise it FAILS.`,
    },
  ];

  const explanation = isV6
    ? `Forward-Confirmed reverse DNS (FCrDNS) for IPv6 ${zoneRes.ip}: query PTR to get a hostname, then AAAA that hostname, then verify ${zoneRes.ip} is in the answer set. This is the check mail servers actually care about for IPv6 deliverability.`
    : `Forward-Confirmed reverse DNS (FCrDNS) for IPv4 ${zoneRes.ip}: query PTR to get a hostname, then A that hostname, then verify ${zoneRes.ip} is in the answer set. This is the check mail servers actually care about for deliverability.`;

  return { ok: true, ip: zoneRes.ip, zone: zoneRes.zone, steps, explanation };
}

/** Convenience: hostname → IP → PTR chain (the reverse of FCrDNS). */
export function buildHostnameChain(hostname: string, resolver: ResolverId, customServer?: string): GeneratedCommand[] {
  const trimmed = hostname.trim();
  if (!trimmed) return [];
  const server = resolverServer(resolver, customServer);
  const atPart = server ? ` @${server}` : "";
  const out: GeneratedCommand[] = [
    {
      tool: "dig",
      command: `dig${atPart} A ${trimmed} +short`,
      explanation: `Step 1: resolve ${trimmed} to its IPv4 address(es).`,
    },
    {
      tool: "dig",
      command: `dig${atPart} AAAA ${trimmed} +short`,
      explanation: `Step 1b: resolve ${trimmed} to its IPv6 address(es) (optional — skip if not v6-enabled).`,
    },
    {
      tool: "dig",
      command: `dig${atPart} -x <IP-FROM-STEP-1> +short`,
      explanation: `Step 2: take one IP from step 1 and reverse-resolve it back to a hostname. Compare against ${trimmed}.`,
    },
  ];
  return out;
}

// ---------------------------------------------------------------------------
// PTR record parser (zone-file format: "name TTL IN PTR target.")
// ---------------------------------------------------------------------------

export function parsePtrRecord(input: string): ParsedPtrRecord {
  const line = input.trim().replace(/\s+/g, " ");
  if (!line) {
    return { ok: false, name: "", ttl: "", class: "", type: "", target: "", notes: ["Empty input."] };
  }
  const tokens = line.split(" ");
  const notes: string[] = [];

  // Forms:
  //   name TTL IN PTR target
  //   name IN PTR target           (no TTL)
  //   name PTR target              (no TTL, no class)
  //   IN PTR target                (no name — inherits origin)
  //   PTR target                   (no name, no class)
  // Also accept "@" placeholder.

  let name = "";
  let ttl = "";
  let cls = "";
  let type = "";
  let target = "";

  const ptrIdx = tokens.findIndex((t) => t.toUpperCase() === "PTR");
  if (ptrIdx === -1) {
    return { ok: false, name: "", ttl: "", class: "", type: "", target: "", notes: ["No PTR token found. Expected format: name TTL IN PTR target."] };
  }

  const before = tokens.slice(0, ptrIdx);
  target = tokens.slice(ptrIdx + 1).join(" ").trim();

  if (before.length === 0) {
    // "PTR target" — name inherits zone origin
    name = "@";
  } else if (before.length === 1) {
    // "name PTR target" or "IN PTR target"
    if (before[0].toUpperCase() === "IN") {
      cls = "IN";
      name = "@";
    } else {
      name = before[0];
    }
  } else if (before.length === 2) {
    // "name TTL PTR target" or "name IN PTR target"
    if (before[1].toUpperCase() === "IN") {
      name = before[0];
      cls = "IN";
    } else if (/^\d+$/.test(before[1])) {
      name = before[0];
      ttl = before[1];
    } else {
      // Unknown 2-token form; assume name + class
      name = before[0];
      cls = before[1].toUpperCase();
    }
  } else {
    // 3+ tokens before PTR: name TTL IN PTR target
    name = before[0];
    ttl = before[1];
    cls = before[2].toUpperCase();
  }

  type = "PTR";

  if (!target) {
    notes.push("Missing PTR target — the record points to nothing.");
    return { ok: false, name, ttl, class: cls, type, target: "", notes };
  }

  if (!target.endsWith(".")) {
    notes.push("Target is relative (no trailing dot). In a zone file this would have the zone origin appended.");
  }

  if (cls && cls !== "IN") {
    notes.push(`Unexpected class "${cls}" — most PTR records use IN.`);
  }

  if (ttl && !/^\d+$/.test(ttl)) {
    notes.push(`TTL "${ttl}" is not a plain integer.`);
  } else if (ttl) {
    const n = Number(ttl);
    if (n < 60) notes.push(`TTL ${n}s is unusually short for a PTR record.`);
    if (n > 604800) notes.push(`TTL ${n}s is unusually long (>1 week) — propagation of PTR changes will be slow.`);
  }

  // Sanity-check that target looks like a hostname
  if (!/^[a-z0-9.\-_]+$/i.test(target.replace(/\.$/, ""))) {
    notes.push("Target contains non-hostname characters.");
  }

  return { ok: notes.length === 0, name, ttl, class: cls || "IN", type, target, notes };
}

// ---------------------------------------------------------------------------
// Batch script generator
// ---------------------------------------------------------------------------

/** Generate a bash script that runs a reverse lookup per IP in a list. */
export function generateBashScript(
  ips: string[],
  tool: CommandTool,
  resolver: ResolverId,
  customServer?: string,
  flags?: DigFlag[],
): string {
  const lines: string[] = [
    "#!/usr/bin/env bash",
    "# Generated by UnQTools — Reverse DNS (PTR) Lookup Generator",
    "# 100% client-side tool. This script runs the actual queries from your shell.",
    'set -euo pipefail',
    "",
    `# Resolver: ${getResolver(resolver).label}${resolver === "custom" ? ` (${customServer ?? "none"})` : ""}`,
    `# Tool: ${tool}`,
    `# Addresses: ${ips.length}`,
    "",
    'echo "=== Reverse DNS (PTR) lookup batch ==="',
    'echo "Started at: $(date -u +%Y-%m-%dT%H:%M:%SZ)"',
    'echo',
    "",
  ];
  for (const ip of ips) {
    const cmd = generateCommand({ tool, ip, resolver, customServer, flags });
    if (!cmd) continue;
    lines.push(`echo "--- ${ip} ---"`);
    lines.push(`${cmd.command} || echo "  (no PTR / lookup failed for ${ip})"`);
    lines.push('echo');
  }
  lines.push('echo "=== Done ==="');
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:reverse-dns-ptr-lookup-generator:history";

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
  ip: string;
  tool: CommandTool;
  resolver: ResolverId;
  customServer?: string;
  flags?: DigFlag[];
}

export function buildShareUrl(params: ShareParams): string {
  const p = new URLSearchParams();
  if (params.ip) p.set("ip", params.ip);
  if (params.tool) p.set("tool", params.tool);
  if (params.resolver) p.set("resolver", params.resolver);
  if (params.customServer) p.set("server", params.customServer);
  if (params.flags && params.flags.length > 0) p.set("flags", params.flags.join(","));
  if (typeof window === "undefined") return `?${p.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${p.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ShareParams> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const p = new URLSearchParams(clean);
  const tool = p.get("tool") as CommandTool | null;
  const resolver = p.get("resolver") as ResolverId | null;
  const flagsStr = p.get("flags") ?? "";
  const validTools: CommandTool[] = ["dig", "nslookup", "kdig", "host"];
  const validResolvers: ResolverId[] = ["google", "cloudflare", "quad9", "opendns", "custom"];
  const validFlags: DigFlag[] = ["short", "answer", "multi", "dnssec"];
  return {
    ip: p.get("ip") ?? "",
    tool: tool && validTools.includes(tool) ? tool : undefined,
    resolver: resolver && validResolvers.includes(resolver) ? resolver : undefined,
    customServer: p.get("server") ?? undefined,
    flags: flagsStr
      ? flagsStr.split(",").filter((f) => validFlags.includes(f as DigFlag)) as DigFlag[]
      : undefined,
  };
}
