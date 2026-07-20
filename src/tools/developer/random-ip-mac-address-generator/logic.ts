/**
 * Random IP & MAC Address Generator — pure logic.
 *
 * Generates random IPv4 (with scope filters + CIDR/range constraints), IPv6
 * (full + RFC 5952 compressed), and MAC addresses (with bundled IEEE OUI
 * vendor prefixes, 4 formats, unicast/multicast + LAA/UAA bits) in bulk.
 * Also provides a subnet helper and reverse lookups.
 *
 * Pure functions only — no DOM, no network, no external deps.
 *
 * PRIVACY: The history feature stores only metadata (counts + timestamps),
 * NEVER the generated addresses. Addresses are never transmitted or logged.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IpFamily = "ipv4" | "ipv6";

export type Ipv4Scope =
  | "any"
  | "public"
  | "private"
  | "loopback"
  | "link_local"
  | "multicast";

export type MacFormat = "colon" | "hyphen" | "dot" | "raw";
export type MacCase = "upper" | "lower";
export type MacMode = "random" | "vendor" | "laa";

export interface OuiEntry {
  /** 24-bit prefix as 6 uppercase hex chars, no separators (e.g. "005056"). */
  prefix: string;
  /** Vendor / manufacturer name. */
  vendor: string;
}

export interface MacOptions {
  format: MacFormat;
  case: MacCase;
  mode: MacMode;
  /** Required when mode === "vendor". */
  vendorPrefix?: string;
  /** Force multicast bit (LSB of first octet). Default: false (unicast). */
  multicast?: boolean;
  /** Force locally-administered bit (bit 1 of first octet). Auto-set when mode === "laa". */
  locallyAdministered?: boolean;
}

export interface Ipv4Options {
  scope: Ipv4Scope;
  /** Optional CIDR like "192.168.1.0/24" to constrain generation. */
  cidr?: string;
  /** Optional from..to range (overrides cidr when both given). */
  from?: string;
  to?: string;
}

export interface Ipv6Options {
  /** Return compressed (::) form per RFC 5952 when true. Default: true. */
  compressed: boolean;
  /** Optional CIDR like "2001:db8::/32" to constrain generation. */
  cidr?: string;
}

export interface GeneratedIpv4 {
  index: number;
  address: string;
  scope: Ipv4Scope;
  klass: "A" | "B" | "C" | "D" | "E";
}

export interface GeneratedIpv6 {
  index: number;
  full: string;
  compressed: string;
}

export interface GeneratedMac {
  index: number;
  mac: string;
  raw: string;
  vendor: string | null;
  multicast: boolean;
  locallyAdministered: boolean;
}

export interface HistoryEntry {
  ts: number;
  action: "generate_ipv4" | "generate_ipv6" | "generate_mac" | "lookup_mac" | "lookup_ip" | "subnet";
  family: IpFamily | "mac" | null;
  count: number;
}

export interface SubnetInfo {
  cidr: string;
  network: string;
  broadcast: string;
  mask: string;
  wildcard: string;
  prefix: number;
  hostCount: number;
  /** Number of addresses in the block (including network + broadcast). */
  addressCount: number;
}

export interface IpLookupInfo {
  address: string;
  family: IpFamily;
  scope: Ipv4Scope | "ipv6";
  klass: "A" | "B" | "C" | "D" | "E" | null;
  isLoopback: boolean;
  isPrivate: boolean;
  isLinkLocal: boolean;
  isMulticast: boolean;
  isReserved: boolean;
  notes: string[];
}

export interface MacLookupInfo {
  mac: string;
  raw: string;
  vendor: string | null;
  multicast: boolean;
  locallyAdministered: boolean;
  isUaa: boolean;
  isLaa: boolean;
  notes: string[];
}

// ---------------------------------------------------------------------------
// PRNG — deterministic mulberry32 + BigInt helpers
// ---------------------------------------------------------------------------

export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(seed: string | number): number {
  if (typeof seed === "number" && Number.isFinite(seed)) return seed >>> 0;
  const str = String(seed);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface Rng {
  next(): number;
  int(min: number, max: number): number;
  /** Random BigInt in [min, max] inclusive. */
  bigInt(min: bigint, max: bigint): bigint;
  pick<T>(arr: readonly T[]): T;
}

export function createRng(seed: string | number): Rng {
  const r = mulberry32(hashSeed(seed));
  const int = (min: number, max: number): number =>
    Math.floor(r() * (max - min + 1)) + min;
  const bigInt = (min: bigint, max: bigint): bigint => {
    if (min > max) throw new Error(`bigInt: min > min (${min} > ${max})`);
    const span = max - min + BigInt(1);
    // Span up to 64 bits — sample in 32-bit chunks to avoid precision loss.
    const spanBits = span.toString(2).length;
    let attempts = 0;
    while (attempts < 64) {
      let val = BigInt(0);
      let bits = spanBits;
      while (bits > 0) {
        const take = Math.min(32, bits);
        val = (val << BigInt(take)) | BigInt(Math.floor(r() * (1 << take)));
        bits -= take;
      }
      if (val < span) return min + val;
      attempts++;
    }
    // Fallback: simple modulo (slight bias for non-power-of-2 spans, acceptable).
    return min + (span === BigInt(0) ? BigInt(0) : val_mod(span));
    function val_mod(span: bigint): bigint {
      let v = BigInt(0);
      const spanBits2 = span.toString(2).length;
      for (let i = 0; i < spanBits2; i += 32) {
        const take = Math.min(32, spanBits2 - i);
        v = (v << BigInt(take)) | BigInt(Math.floor(r() * (1 << take)));
      }
      return v % span;
    }
  };
  const pick = <T,>(arr: readonly T[]): T => {
    if (arr.length === 0) throw new Error("pick: empty array");
    return arr[Math.floor(r() * arr.length)] as T;
  };
  return { next: r, int, bigInt, pick };
}

// ---------------------------------------------------------------------------
// Bundled IEEE OUI registry (compact, well-known vendors)
// ---------------------------------------------------------------------------

/**
 * Compact OUI registry — covers well-known vendors used in network testing.
 * Each entry maps a 24-bit prefix (6 hex chars) to a vendor name.
 *
 * NOTE: This is intentionally a curated subset of the IEEE OUI registry for
 * offline use. For unknown prefixes, reverse lookup returns vendor=null.
 */
export const OUI_REGISTRY: OuiEntry[] = [
  { prefix: "000000", vendor: "Officially Xerox, but commonly used as null/AnyLan" },
  { prefix: "000001", vendor: "Xerox" },
  { prefix: "000C29", vendor: "VMware" },
  { prefix: "005056", vendor: "VMware" },
  { prefix: "080027", vendor: "VirtualBox (PCS Systemtechnik)" },
  { prefix: "080070", vendor: "Mips Computer Systems" },
  { prefix: "000569", vendor: "VMware" },
  { prefix: "001C42", vendor: "Parallels" },
  { prefix: "00155D", vendor: "Microsoft Hyper-V" },
  { prefix: "0CC47A", vendor: "Super Micro" },
  { prefix: "F45EAB", vendor: "Super Micro" },
  { prefix: "002500", vendor: "Apple" },
  { prefix: "ACDE48", vendor: "Apple" },
  { prefix: "D89E3F", vendor: "Apple" },
  { prefix: "3CD92B", vendor: "Hewlett-Packard" },
  { prefix: "001083", vendor: "Cisco Systems" },
  { prefix: "001B54", vendor: "Cisco Systems" },
  { prefix: "F866F2", vendor: "Cisco Systems" },
  { prefix: "0017F2", vendor: "Apple" },
  { prefix: "ACBC32", vendor: "Apple" },
  { prefix: "0021CC", vendor: "Dell" },
  { prefix: "001E4F", vendor: "Dell" },
  { prefix: "F80F41", vendor: "Dell" },
  { prefix: "001999", vendor: "Dell" },
  { prefix: "001E67", vendor: "Dell" },
  { prefix: "0015C5", vendor: "Dell" },
  { prefix: "002356", vendor: "Intel Corporate" },
  { prefix: "001320", vendor: "Intel Corporate" },
  { prefix: "F0DEF1", vendor: "Intel Corporate" },
  { prefix: "A4BAC5", vendor: "Intel Corporate" },
  { prefix: "DC4155", vendor: "Intel Corporate" },
  { prefix: "001A11", vendor: "Google" },
  { prefix: "3CECEC", vendor: "Google" },
  { prefix: "FCC233", vendor: "Google" },
  { prefix: "001FA64C", vendor: "Google" },
  { prefix: "001125", vendor: "Microsoft" },
  { prefix: "001D7E", vendor: "Microsoft" },
  { prefix: "002248", vendor: "TriQuint Semiconductor" },
  { prefix: "002608", vendor: "Apple" },
  { prefix: "B8E856", vendor: "Apple" },
  { prefix: "0021CC", vendor: "Dell EMBEDDED" },
  { prefix: "0050B6", vendor: "Virtualbox (PCS)" },
  { prefix: "00D0F5", vendor: "SSE Telecom" },
  { prefix: "000B82", vendor: "Canon" },
  { prefix: "001871", vendor: "Cisco Systems" },
  { prefix: "0014A4", vendor: "Netgear" },
  { prefix: "001E2A", vendor: "Netgear" },
  { prefix: "002215", vendor: "Netgear" },
  { prefix: "C03F0E", vendor: "Netgear" },
  { prefix: "0022B0", vendor: "Netgear" },
  { prefix: "001310", vendor: "Belkin" },
  { prefix: "08BD43", vendor: "Belkin" },
  { prefix: "0016B6", vendor: "Linksys" },
  { prefix: "0014BF", vendor: "Linksys" },
  { prefix: "001839", vendor: "TP-Link" },
  { prefix: "F8D111", vendor: "TP-Link" },
  { prefix: "50C7BF", vendor: "TP-Link" },
  { prefix: "0018F3", vendor: "Cisco-Linksys" },
  { prefix: "00024B", vendor: "Lantronix" },
  { prefix: "00A0F8", vendor: "Symbol Technologies" },
];

/** OUI vendor presets for the UI dropdown. */
export const VENDOR_PRESETS: { vendor: string; prefix: string }[] = (() => {
  const seen = new Map<string, string>();
  for (const e of OUI_REGISTRY) {
    if (!seen.has(e.vendor)) seen.set(e.vendor, e.prefix);
  }
  return Array.from(seen.entries())
    .map(([vendor, prefix]) => ({ vendor, prefix }))
    .sort((a, b) => a.vendor.localeCompare(b.vendor));
})();

/** Look up the vendor for a 6-hex-char OUI prefix. */
export function lookupOui(prefix6: string): string | null {
  if (!prefix6) return null;
  const upper = prefix6.toUpperCase().replace(/[^0-9A-F]/g, "").slice(0, 6);
  if (upper.length !== 6) return null;
  const entry = OUI_REGISTRY.find((e) => e.prefix === upper);
  return entry ? entry.vendor : null;
}

// ---------------------------------------------------------------------------
// IPv4 helpers
// ---------------------------------------------------------------------------

/** Parse dotted-quad IPv4 → uint32 (unsigned, in Number range — safe up to 2^32). */
export function ipv4ToNumber(ip: string): number | null {
  if (!ip) return null;
  const parts = ip.trim().split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d+$/.test(p)) return null;
    const v = parseInt(p, 10);
    if (v < 0 || v > 255) return null;
    n = n * 256 + v;
  }
  return n >>> 0;
}

/** Format uint32 → dotted-quad IPv4. */
export function numberToIpv4(n: number): string {
  const v = n >>> 0;
  return [
    (v >>> 24) & 0xff,
    (v >>> 16) & 0xff,
    (v >>> 8) & 0xff,
    v & 0xff,
  ].join(".");
}

/** Classify IPv4 into class A/B/C/D/E. */
export function ipv4Class(n: number): "A" | "B" | "C" | "D" | "E" {
  const first = (n >>> 24) & 0xff;
  if (first < 128) return "A";
  if (first < 192) return "B";
  if (first < 224) return "C";
  if (first < 240) return "D";
  return "E";
}

/** True if IPv4 (as uint32) is in RFC 1918 private space. */
export function isIpv4Private(n: number): boolean {
  const first = (n >>> 24) & 0xff;
  const second = (n >>> 16) & 0xff;
  // 10.0.0.0/8
  if (first === 10) return true;
  // 172.16.0.0/12
  if (first === 172 && second >= 16 && second <= 31) return true;
  // 192.168.0.0/16
  if (first === 192 && second === 168) return true;
  return false;
}

export function isIpv4Loopback(n: number): boolean {
  return ((n >>> 24) & 0xff) === 127;
}

export function isIpv4LinkLocal(n: number): boolean {
  const first = (n >>> 24) & 0xff;
  const second = (n >>> 16) & 0xff;
  return first === 169 && second === 254;
}

export function isIpv4Multicast(n: number): boolean {
  const first = (n >>> 24) & 0xff;
  return first >= 224 && first <= 239;
}

/** Reserved IPv4 (RFC 5735 + others): 0.0.0.0/8, 240.0.0.0/4 (class E), 255.255.255.255 broadcast. */
export function isIpv4Reserved(n: number): boolean {
  const first = (n >>> 24) & 0xff;
  if (first === 0) return true;       // 0.0.0.0/8 — this network
  if (first >= 240) return true;      // 240.0.0.0/4 — class E reserved
  if (n === 0xffffffff) return true;  // 255.255.255.255 — limited broadcast
  return false;
}

/** True if IPv4 is publicly routable (i.e. not private/loopback/link-local/multicast/reserved). */
export function isIpv4Public(n: number): boolean {
  return !isIpv4Private(n)
    && !isIpv4Loopback(n)
    && !isIpv4LinkLocal(n)
    && !isIpv4Multicast(n)
    && !isIpv4Reserved(n);
}

/** Determine the IPv4 scope label for a uint32. */
export function ipv4ScopeOf(n: number): Ipv4Scope {
  if (isIpv4Loopback(n)) return "loopback";
  if (isIpv4LinkLocal(n)) return "link_local";
  if (isIpv4Multicast(n)) return "multicast";
  if (isIpv4Private(n)) return "private";
  if (isIpv4Reserved(n)) return "private"; // map reserved → "private" (non-public) for filter purposes
  return "public";
}

/** Parse a CIDR string → { network, prefix, count } or null. */
export function parseIpv4Cidr(cidr: string): {
  network: number;
  prefix: number;
  count: number;
} | null {
  if (!cidr || !cidr.includes("/")) return null;
  const [ipStr, prefixStr] = cidr.split("/");
  const ip = ipv4ToNumber(ipStr ?? "");
  if (ip == null) return null;
  const prefix = parseInt(prefixStr ?? "", 10);
  if (Number.isNaN(prefix) || prefix < 0 || prefix > 32) return null;
  const count = prefix === 0 ? 0xffffffff + 1 : Math.pow(2, 32 - prefix);
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const network = (ip & mask) >>> 0;
  return { network, prefix, count };
}

// ---------------------------------------------------------------------------
// IPv6 helpers (BigInt-safe)
// ---------------------------------------------------------------------------

const IPV6_BYTES = 16;

/** Parse a textual IPv6 (full or compressed) → BigInt, or null on parse failure. */
export function ipv6ToBigInt(ip: string): bigint | null {
  if (!ip) return null;
  let s = ip.trim().toLowerCase();
  // Handle IPv4-mapped form like ::ffff:192.168.1.1
  const v4Match = s.match(/:(\d+\.\d+\.\d+\.\d+)$/);
  if (v4Match) {
    const v4 = ipv4ToNumber(v4Match[1]!);
    if (v4 == null) return null;
    const v4Hex = v4.toString(16).padStart(8, "0");
    s = s.slice(0, s.length - v4Match[1]!.length) + v4Hex.slice(0, 4) + ":" + v4Hex.slice(4, 8);
  }
  // Split on :: to handle compression
  const parts = s.split("::");
  if (parts.length > 2) return null; // more than one :: is invalid
  let leftStrs: string[];
  let rightStrs: string[];
  if (parts.length === 2) {
    leftStrs = parts[0] ? parts[0]!.split(":") : [];
    rightStrs = parts[1] ? parts[1]!.split(":") : [];
  } else {
    leftStrs = parts[0]!.split(":");
    rightStrs = [];
  }
  const total = leftStrs.length + rightStrs.length;
  if (parts.length === 1 && total !== 8) return null;
  if (parts.length === 2 && total > 8) return null;
  const zerosNeeded = 8 - total;
  const allStrs = [...leftStrs, ...Array(zerosNeeded).fill("0"), ...rightStrs];
  let val = BigInt(0);
  for (const g of allStrs) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
    val = (val << BigInt(16)) | BigInt(parseInt(g, 16));
  }
  return val;
}

/** Format a BigInt as full IPv6 (8 groups of 4 hex chars, lowercase). */
export function bigIntToIpv6Full(val: bigint): string {
  const groups: string[] = [];
  let v = val;
  for (let i = 7; i >= 0; i--) {
    groups[i] = (v & BigInt(0xffff)).toString(16);
    v >>= BigInt(16);
  }
  return groups.join(":");
}

/**
 * Format a BigInt as RFC 5952 compressed IPv6.
 * Compresses the longest run of consecutive zero groups into "::".
 */
export function bigIntToIpv6Compressed(val: bigint): string {
  const groups: number[] = [];
  let v = val;
  for (let i = 7; i >= 0; i--) {
    groups[i] = Number(v & BigInt(0xffff));
    v >>= BigInt(16);
  }
  // Find the longest run of zeros (length >= 2).
  let bestStart = -1;
  let bestLen = 0;
  let curStart = -1;
  let curLen = 0;
  for (let i = 0; i < 8; i++) {
    if (groups[i] === 0) {
      if (curStart < 0) curStart = i;
      curLen++;
      if (curLen > bestLen) {
        bestLen = curLen;
        bestStart = curStart;
      }
    } else {
      curStart = -1;
      curLen = 0;
    }
  }
  if (bestLen < 2) return groups.map((g) => g.toString(16)).join(":");
  const left = groups.slice(0, bestStart).map((g) => g.toString(16));
  const right = groups.slice(bestStart + bestLen).map((g) => g.toString(16));
  const leftStr = left.join(":");
  const rightStr = right.join(":");
  if (leftStr && rightStr) return `${leftStr}::${rightStr}`;
  if (leftStr) return `${leftStr}::`;
  if (rightStr) return `::${rightStr}`;
  return "::";
}

/** Parse an IPv6 CIDR → { network, prefix, count }, or null. */
export function parseIpv6Cidr(cidr: string): {
  network: bigint;
  prefix: number;
  count: bigint;
} | null {
  if (!cidr || !cidr.includes("/")) return null;
  const [ipStr, prefixStr] = cidr.split("/");
  const ip = ipv6ToBigInt(ipStr ?? "");
  if (ip == null) return null;
  const prefix = parseInt(prefixStr ?? "", 10);
  if (Number.isNaN(prefix) || prefix < 0 || prefix > 128) return null;
  const mask = prefix === 0
    ? BigInt(0)
    : ((BigInt(1) << BigInt(128)) - BigInt(1)) ^ ((BigInt(1) << BigInt(128 - prefix)) - BigInt(1));
  const network = ip & mask;
  const count = prefix === 0 ? BigInt(1) << BigInt(128) : BigInt(1) << BigInt(128 - prefix);
  return { network, prefix, count };
}

// ---------------------------------------------------------------------------
// IPv4 generation
// ---------------------------------------------------------------------------

/** Generate a single random IPv4 subject to scope + CIDR/range constraints. */
export function generateIpv4(rng: Rng, options: Ipv4Options): string {
  // If CIDR/range given, sample within it; otherwise sample by scope.
  if (options.from && options.to) {
    const fromN = ipv4ToNumber(options.from);
    const toN = ipv4ToNumber(options.to);
    if (fromN != null && toN != null && fromN <= toN) {
      const span = toN - fromN;
      const val = (fromN + Math.floor(rng.next() * (span + 1))) >>> 0;
      return numberToIpv4(val);
    }
  }
  if (options.cidr) {
    const parsed = parseIpv4Cidr(options.cidr);
    if (parsed) {
      const span = parsed.count - 1; // inclusive range [network, network+count-1]
      const offset = Math.floor(rng.next() * (span + 1));
      const val = (parsed.network + offset) >>> 0;
      return numberToIpv4(val);
    }
  }
  // Sample by scope using direct predicate checks (not ipv4ScopeOf, which
  // conflates "private" and "reserved" for filter purposes).
  const scope = options.scope ?? "any";
  if (scope === "any") {
    return numberToIpv4(rng.int(0, 0xffffffff));
  }
  const predicate = (n: number): boolean => {
    switch (scope) {
      case "public": return isIpv4Public(n);
      case "private": return isIpv4Private(n);
      case "loopback": return isIpv4Loopback(n);
      case "link_local": return isIpv4LinkLocal(n);
      case "multicast": return isIpv4Multicast(n);
      default: return true;
    }
  };
  // Rejection-sample for the requested scope.
  for (let i = 0; i < 1024; i++) {
    const n = rng.int(0, 0xffffffff);
    if (predicate(n)) return numberToIpv4(n);
  }
  // Fallback: any. (Should not happen — at least 1/256 of the space is
  // private, etc.)
  return numberToIpv4(rng.int(0, 0xffffffff));
}

export interface GenerateIpv4Options extends Ipv4Options {
  count: number;
  seed: string;
}

export function generateIpv4Batch(options: GenerateIpv4Options): GeneratedIpv4[] {
  const count = Math.max(0, Math.min(10000, Math.floor(options.count)));
  const rng = createRng(options.seed);
  const out: GeneratedIpv4[] = [];
  for (let i = 0; i < count; i++) {
    const address = generateIpv4(rng, options);
    const n = ipv4ToNumber(address)!;
    out.push({
      index: i,
      address,
      scope: ipv4ScopeOf(n),
      klass: ipv4Class(n),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// IPv6 generation
// ---------------------------------------------------------------------------

const IPV6_MAX = (BigInt(1) << BigInt(128)) - BigInt(1);

/** Generate a single random IPv6 (optionally constrained by CIDR). */
export function generateIpv6(rng: Rng, options: Ipv6Options): { full: string; compressed: string } {
  let val: bigint;
  if (options.cidr) {
    const parsed = parseIpv6Cidr(options.cidr);
    if (parsed) {
      const offset = rng.bigInt(BigInt(0), parsed.count - BigInt(1));
      val = parsed.network + offset;
    } else {
      val = rng.bigInt(BigInt(0), IPV6_MAX);
    }
  } else {
    val = rng.bigInt(BigInt(0), IPV6_MAX);
  }
  return {
    full: bigIntToIpv6Full(val),
    compressed: bigIntToIpv6Compressed(val),
  };
}

export interface GenerateIpv6Options extends Ipv6Options {
  count: number;
  seed: string;
}

export function generateIpv6Batch(options: GenerateIpv6Options): GeneratedIpv6[] {
  const count = Math.max(0, Math.min(10000, Math.floor(options.count)));
  const rng = createRng(options.seed);
  const out: GeneratedIpv6[] = [];
  for (let i = 0; i < count; i++) {
    const g = generateIpv6(rng, options);
    out.push({ index: i, full: g.full, compressed: g.compressed });
  }
  return out;
}

// ---------------------------------------------------------------------------
// MAC generation
// ---------------------------------------------------------------------------

/** Generate a single random byte 0–255. */
function randomByte(rng: Rng): number {
  return rng.int(0, 255);
}

/** Convert a 12-hex-char MAC string into the requested format. */
export function formatMac(raw12: string, options: MacOptions): string {
  const clean = raw12.toUpperCase().replace(/[^0-9A-F]/g, "").slice(0, 12).padStart(12, "0");
  const cased = options.case === "lower" ? clean.toLowerCase() : clean;
  switch (options.format) {
    case "colon":
      return cased.match(/.{2}/g)!.join(":");
    case "hyphen":
      return cased.match(/.{2}/g)!.join("-");
    case "dot":
      return cased.match(/.{4}/g)!.join(".");
    case "raw":
    default:
      return cased;
  }
}

/** Generate a single MAC subject to mode/format/case/scope-bit options. */
export function generateMac(rng: Rng, options: MacOptions): {
  mac: string;
  raw: string;
  vendor: string | null;
  multicast: boolean;
  locallyAdministered: boolean;
} {
  let prefix6: string;
  let vendor: string | null = null;
  if (options.mode === "vendor" && options.vendorPrefix) {
    prefix6 = options.vendorPrefix.toUpperCase().replace(/[^0-9A-F]/g, "").slice(0, 6).padStart(6, "0");
    vendor = lookupOui(prefix6);
  } else if (options.mode === "laa") {
    // Random prefix with locally-administered bit set (bit 1 of first octet).
    const firstByte = randomByte(rng) | 0x02;
    prefix6 = firstByte.toString(16).padStart(2, "0").toUpperCase()
      + randomByte(rng).toString(16).padStart(2, "0").toUpperCase()
      + randomByte(rng).toString(16).padStart(2, "0").toUpperCase();
  } else {
    // Fully random.
    prefix6 = randomByte(rng).toString(16).padStart(2, "0").toUpperCase()
      + randomByte(rng).toString(16).padStart(2, "0").toUpperCase()
      + randomByte(rng).toString(16).padStart(2, "0").toUpperCase();
  }

  // Build remaining 24 bits (3 bytes).
  let suffix6 = randomByte(rng).toString(16).padStart(2, "0").toUpperCase()
    + randomByte(rng).toString(16).padStart(2, "0").toUpperCase()
    + randomByte(rng).toString(16).padStart(2, "0").toUpperCase();

  // Apply multicast + locally-administered bit overrides on the first byte.
  let firstByte = parseInt(prefix6.slice(0, 2), 16);
  if (options.locallyAdministered || options.mode === "laa") {
    firstByte |= 0x02; // set bit 1 (LAA)
  }
  if (options.multicast) {
    firstByte |= 0x01; // set bit 0 (multicast)
  } else {
    firstByte &= 0xfe; // clear bit 0 (unicast)
  }
  const firstByteHex = firstByte.toString(16).padStart(2, "0").toUpperCase();
  const raw12 = firstByteHex + prefix6.slice(2, 6) + suffix6;
  const mac = formatMac(raw12, options);
  return {
    mac,
    raw: raw12,
    vendor: options.mode === "vendor" ? vendor : null,
    multicast: (firstByte & 0x01) === 0x01,
    locallyAdministered: (firstByte & 0x02) === 0x02,
  };
}

export interface GenerateMacOptions extends MacOptions {
  count: number;
  seed: string;
}

export function generateMacBatch(options: GenerateMacOptions): GeneratedMac[] {
  const count = Math.max(0, Math.min(10000, Math.floor(options.count)));
  const rng = createRng(options.seed);
  const out: GeneratedMac[] = [];
  for (let i = 0; i < count; i++) {
    const g = generateMac(rng, options);
    out.push({
      index: i,
      mac: g.mac,
      raw: g.raw,
      vendor: g.vendor,
      multicast: g.multicast,
      locallyAdministered: g.locallyAdministered,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Subnet helper (IPv4)
// ---------------------------------------------------------------------------

export function computeSubnet(cidr: string): SubnetInfo | null {
  const parsed = parseIpv4Cidr(cidr);
  if (!parsed) return null;
  const { network, prefix, count } = parsed;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const wildcard = (~mask) >>> 0;
  const broadcast = prefix === 32 ? network : (network | wildcard) >>> 0;
  const hostCount = prefix >= 31 ? (prefix === 32 ? 1 : 2) : Math.max(0, count - 2);
  return {
    cidr: `${numberToIpv4(network)}/${prefix}`,
    network: numberToIpv4(network),
    broadcast: numberToIpv4(broadcast),
    mask: numberToIpv4(mask),
    wildcard: numberToIpv4(wildcard),
    prefix,
    hostCount,
    addressCount: count,
  };
}

// ---------------------------------------------------------------------------
// Reverse lookups
// ---------------------------------------------------------------------------

export function lookupIp(ip: string): IpLookupInfo | null {
  // Try IPv4 first.
  const v4 = ipv4ToNumber(ip);
  if (v4 != null) {
    const notes: string[] = [];
    if (isIpv4Loopback(v4)) notes.push("Loopback (127.0.0.0/8) — host self-communication.");
    if (isIpv4Private(v4)) notes.push("Private (RFC 1918) — not routable on the internet.");
    if (isIpv4LinkLocal(v4)) notes.push("Link-local (169.254.0.0/16) — auto-config / APIPA.");
    if (isIpv4Multicast(v4)) notes.push("Multicast (224.0.0.0/4) — group addressing.");
    if (isIpv4Reserved(v4)) notes.push("Reserved — not allocated for general use.");
    if (isIpv4Public(v4)) notes.push("Public — globally routable.");
    return {
      address: numberToIpv4(v4),
      family: "ipv4",
      scope: ipv4ScopeOf(v4),
      klass: ipv4Class(v4),
      isLoopback: isIpv4Loopback(v4),
      isPrivate: isIpv4Private(v4),
      isLinkLocal: isIpv4LinkLocal(v4),
      isMulticast: isIpv4Multicast(v4),
      isReserved: isIpv4Reserved(v4),
      notes,
    };
  }
  // Try IPv6.
  const v6 = ipv6ToBigInt(ip);
  if (v6 != null) {
    const notes: string[] = [];
    const firstByte = Number((v6 >> BigInt(120)) & BigInt(0xff));
    if (firstByte === 0 && v6 === BigInt(1)) notes.push("IPv6 loopback (::1).");
    else if (firstByte === 0xfe) {
      const secondByte = Number((v6 >> BigInt(112)) & BigInt(0xff));
      if (secondByte === 0x80) notes.push("IPv6 link-local (fe80::/10).");
      else if (secondByte === 0xc0) notes.push("IPv6 unique-local (fec0::/10 — deprecated).");
    } else if (firstByte === 0xff) notes.push("IPv6 multicast (ff00::/8).");
    else if (firstByte === 0xfc || firstByte === 0xfd) notes.push("IPv6 unique-local (fc00::/7).");
    else if (firstByte === 0x20 && Number((v6 >> BigInt(104)) & BigInt(0xff)) === 0x01) notes.push("Global unicast (2001::/16).");
    else notes.push("Global IPv6 unicast (likely).");
    return {
      address: bigIntToIpv6Compressed(v6),
      family: "ipv6",
      scope: "ipv6",
      klass: null,
      isLoopback: firstByte === 0 && v6 === BigInt(1),
      isPrivate: firstByte === 0xfc || firstByte === 0xfd,
      isLinkLocal: firstByte === 0xfe && (Number((v6 >> BigInt(112)) & BigInt(0xff)) === 0x80),
      isMulticast: firstByte === 0xff,
      isReserved: false,
      notes,
    };
  }
  return null;
}

/** Normalize a MAC string (any format) → 12 hex chars uppercase. */
export function normalizeMac(input: string): string | null {
  if (!input) return null;
  const cleaned = input.toUpperCase().replace(/[^0-9A-F]/g, "");
  if (cleaned.length === 12) return cleaned;
  // Some formats use 12 hex; if shorter or longer, reject.
  return null;
}

export function lookupMac(input: string): MacLookupInfo | null {
  const raw = normalizeMac(input);
  if (!raw) return null;
  const prefix6 = raw.slice(0, 6);
  const vendor = lookupOui(prefix6);
  const firstByte = parseInt(raw.slice(0, 2), 16);
  const multicast = (firstByte & 0x01) === 0x01;
  const laa = (firstByte & 0x02) === 0x02;
  const notes: string[] = [];
  if (multicast) notes.push("Multicast bit set (LSB of first octet) — group destination.");
  else notes.push("Unicast (LSB of first octet clear) — single destination.");
  if (laa) notes.push("Locally-administered (bit 1 of first octet set) — LAA, not globally unique.");
  else notes.push("Universally-administered (UAA) — OUI prefix assigned by IEEE.");
  if (vendor) notes.push(`Vendor (OUI ${prefix6}): ${vendor}.`);
  else notes.push(`No vendor match for OUI ${prefix6} (not in bundled registry).`);
  return {
    mac: formatMac(raw, { format: "colon", case: "upper", mode: "random" }),
    raw,
    vendor,
    multicast,
    locallyAdministered: laa,
    isUaa: !laa,
    isLaa: laa,
    notes,
  };
}

// ---------------------------------------------------------------------------
// CSV / JSON rendering
// ---------------------------------------------------------------------------

export function renderIpv4Csv(rows: GeneratedIpv4[]): string {
  const lines = ["index,address,scope,class"];
  for (const r of rows) {
    lines.push([r.index, r.address, r.scope, r.klass].join(","));
  }
  return lines.join("\n");
}

export function renderIpv6Csv(rows: GeneratedIpv6[]): string {
  const lines = ["index,full,compressed"];
  for (const r of rows) {
    lines.push([r.index, r.full, r.compressed].join(","));
  }
  return lines.join("\n");
}

export function renderMacCsv(rows: GeneratedMac[]): string {
  const lines = ["index,mac,raw,vendor,multicast,laa"];
  for (const r of rows) {
    lines.push([
      r.index,
      r.mac,
      r.raw,
      r.vendor ? `"${r.vendor.replace(/"/g, '""')}"` : "",
      r.multicast ? "true" : "false",
      r.locallyAdministered ? "true" : "false",
    ].join(","));
  }
  return lines.join("\n");
}

export function renderJson(rows: unknown): string {
  return JSON.stringify(rows, null, 2);
}

// ---------------------------------------------------------------------------
// Canonical test vectors
// ---------------------------------------------------------------------------

export const CANONICAL_PRIVATE_IPV4: readonly string[] = [
  "10.0.0.1",
  "10.255.255.255",
  "172.16.0.1",
  "172.31.255.254",
  "192.168.1.1",
  "192.168.0.0",
];

export const CANONICAL_PUBLIC_IPV4: readonly string[] = [
  "8.8.8.8",
  "1.1.1.1",
  "172.32.0.1", // just outside 172.16/12
  "192.169.0.1", // just outside 192.168/16
];

export const CANONICAL_RESERVED_IPV4: readonly string[] = [
  "127.0.0.1", // loopback
  "169.254.1.1", // link-local
  "224.0.0.1", // multicast
  "0.0.0.0", // reserved
  "240.0.0.1", // class E
];

export const CANONICAL_IPV6: readonly { input: string; compressed: string }[] = [
  { input: "2001:0db8:0000:0000:0000:0000:0000:0001", compressed: "2001:db8::1" },
  { input: "2001:db8:0:0:0:0:0:1", compressed: "2001:db8::1" },
  { input: "::1", compressed: "::1" },
  { input: "0:0:0:0:0:0:0:0", compressed: "::" },
  { input: "fe80:0:0:0:202:b3ff:fe1e:8329", compressed: "fe80::202:b3ff:fe1e:8329" },
  { input: "2001:db8:85a3:8d3:1319:8a2e:370:7348", compressed: "2001:db8:85a3:8d3:1319:8a2e:370:7348" },
];

// ---------------------------------------------------------------------------
// History (localStorage) — stores metadata only, NEVER addresses
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:random-ip-mac-address-generator:history";
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
  family: IpFamily | "mac",
  params: Record<string, string>,
): string {
  const sp = new URLSearchParams();
  sp.set("family", family);
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") sp.set(k, v);
  }
  if (typeof window === "undefined") return `?${sp.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${sp.toString()}`;
}

export interface ParsedShareUrl {
  family: IpFamily | "mac";
  params: Record<string, string>;
}

export function parseShareUrl(hash: string): ParsedShareUrl {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { family: "ipv4", params: {} };
  const sp = new URLSearchParams(clean);
  const famStr = sp.get("family") ?? "ipv4";
  const family = (["ipv4", "ipv6", "mac"].includes(famStr)
    ? famStr
    : "ipv4") as ParsedShareUrl["family"];
  const params: Record<string, string> = {};
  sp.forEach((v, k) => {
    if (k !== "family") params[k] = v;
  });
  return { family, params };
}

// ---------------------------------------------------------------------------
// Honesty banner — fixtures only
// ---------------------------------------------------------------------------

export const HONESTY_BANNER =
  "Generated addresses are random fixtures for testing/development. They may collide with real-world assignments — always verify against your network before use.";
