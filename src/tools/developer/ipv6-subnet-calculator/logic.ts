/**
 * IPv6 Subnet Calculator — pure logic.
 *
 * Compute IPv6 network / range / host count (BigInt-exact) from an address +
 * prefix length, expand and compress addresses (RFC 5952 canonical form),
 * show the 128-bit binary representation with nibble markers, subdivide a
 * prefix into child prefixes, and generate the ip6.arpa reverse DNS zone.
 *
 * 128-bit math via BigInt — Number can only safely hold 53-bit integers, so
 * every value (IP, mask, network, last) is a BigInt. Parsing accepts the
 * standard text forms: full 8-hextet, compressed with '::', and embedded
 * IPv4 (::ffff:192.0.2.1).
 *
 * Pure functions only — no DOM, no network.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IPv6Address {
  /** Eight 16-bit hextets, MSB first. */
  hextets: [number, number, number, number, number, number, number, number];
  /** 128-bit BigInt value (unsigned). */
  value: bigint;
}

export interface SubnetInfo {
  ip: string;
  ipCompressed: string;
  ipExpanded: string;
  cidr: number;
  networkAddress: string;
  networkCompressed: string;
  networkExpanded: string;
  firstAddress: string;
  firstAddressCompressed: string;
  lastAddress: string;
  lastAddressCompressed: string;
  totalAddresses: string; // BigInt as decimal string
  countOf64s: string; // BigInt as decimal string (number of /64 blocks)
  isOnNibbleBoundary: boolean;
  ip6ArpaZone: string;
  ipBinary: string;
  networkBinary: string;
  maskBinary: string;
  wildcardBinary: string;
  /** Internal BigInt values. */
  ipValue: string;
  networkValue: string;
  lastValue: string;
  maskValue: string;
  wildcardValue: string;
}

export interface ChildSubnet {
  index: number;
  cidr: number;
  networkAddress: string;
  networkCompressed: string;
  networkExpanded: string;
  firstAddress: string;
  lastAddress: string;
  totalAddresses: string;
  countOf64s: string;
  ip6ArpaZone: string;
}

export interface SubdivideResult {
  parent: SubnetInfo;
  childPrefix: number;
  childCount: string; // BigInt as decimal string
  displayed: ChildSubnet[];
  displayedCount: number;
  capped: boolean;
  cap: number;
  error?: string;
}

export type SubnetToolMode = "subnet" | "subdivide" | "reference";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const BIG_0 = 0n;
export const BIG_1 = 1n;
export const BIG_128 = 128n;
export const BIG_64 = 64n;
export const BIG_FFFF = 0xffffn;
export const BIG_TWO = 2n;
export const MAX_PREFIX = 128;
export const SUBDIVIDE_CAP = 4096;

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/**
 * Parse an IPv6 address string into hextets + BigInt value.
 *
 * Accepts:
 *  - Full 8-hextet form: "2001:0db8:0000:0000:0000:0000:0000:0001"
 *  - Compressed form with '::': "2001:db8::1"
 *  - Embedded IPv4 in last 32 bits: "::ffff:192.0.2.1"
 *  - Loopback "::1", unspecified "::".
 */
export function parseIPv6(
  input: string,
): { ok: true; address: IPv6Address } | { ok: false; error: string } {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: "Empty address" };
  if (trimmed.length > 48) return { ok: false, error: "Address too long" };

  // Reject forbidden characters early.
  if (!/^[0-9a-fA-F:.]+$/.test(trimmed)) {
    return { ok: false, error: "Invalid character in IPv6 address" };
  }

  // Only one '::' allowed.
  const doubleColonCount = (trimmed.match(/::/g) ?? []).length;
  if (doubleColonCount > 1) {
    return { ok: false, error: "Multiple '::' sequences in IPv6 address" };
  }

  const hasDoubleColon = trimmed.includes("::");
  const lower = trimmed.toLowerCase();

  // Detect embedded IPv4 (a.b.c.d in the last 32 bits).
  let embeddedV4: [number, number, number, number] | null = null;
  let core = lower;
  const lastColon = lower.lastIndexOf(":");
  if (lastColon !== -1) {
    const tail = lower.slice(lastColon + 1);
    if (tail.includes(".") && /^\d+\.\d+\.\d+\.\d+$/.test(tail)) {
      const parts = tail.split(".");
      if (parts.length !== 4) {
        return { ok: false, error: "Embedded IPv4 must have 4 octets" };
      }
      const oct: [number, number, number, number] = [0, 0, 0, 0];
      for (let i = 0; i < 4; i++) {
        const n = Number.parseInt(parts[i], 10);
        if (!Number.isFinite(n) || n < 0 || n > 255) {
          return { ok: false, error: `Invalid IPv4 octet "${parts[i]}"` };
        }
        oct[i] = n;
      }
      embeddedV4 = oct;
      core = lower.slice(0, lastColon);
    }
  }

  // Split into hextets — keep left/right parts separate so we can correctly
  // place the '::' gap (especially with embedded IPv4).
  let leftParts: string[] = [];
  let rightParts: string[] = [];
  if (hasDoubleColon) {
    const idx = core.indexOf("::");
    const left = core.slice(0, idx);
    const right = core.slice(idx + 2);
    leftParts = left ? left.split(":") : [];
    rightParts = right ? right.split(":") : [];
  } else {
    leftParts = core.split(":");
  }

  // Validate each hextet.
  for (const h of [...leftParts, ...rightParts]) {
    if (h === "") return { ok: false, error: "Empty hextet" };
    if (!/^[0-9a-f]{1,4}$/.test(h)) {
      return { ok: false, error: `Invalid hextet "${h}" (must be 1–4 hex digits)` };
    }
  }

  // Build the 8-hextet array. The '::' gap (if any) is inserted as zeros
  // between leftParts and rightParts.
  const hextets: number[] = [];
  if (embeddedV4) {
    // The last 32 bits come from the IPv4 octets → two trailing hextets.
    // The leading 6 hextets come from leftParts + gap zeros + rightParts.
    const [a, b, c, d] = embeddedV4;
    const totalLeading = leftParts.length + rightParts.length;
    const needed = 6 - totalLeading;
    if (needed < 0) {
      return { ok: false, error: "Too many hextets with embedded IPv4" };
    }
    if (!hasDoubleColon && totalLeading !== 6) {
      return { ok: false, error: "Embedded IPv4 address needs '::' or full 6 leading hextets" };
    }
    for (const h of leftParts) hextets.push(Number.parseInt(h, 16));
    for (let i = 0; i < needed; i++) hextets.push(0);
    for (const h of rightParts) hextets.push(Number.parseInt(h, 16));
    hextets.push((a << 8) | b);
    hextets.push((c << 8) | d);
  } else {
    const totalLeading = leftParts.length + rightParts.length;
    const needed = 8 - totalLeading;
    if (needed < 0) {
      return { ok: false, error: "Too many hextets (more than 8)" };
    }
    if (needed > 0 && !hasDoubleColon) {
      return { ok: false, error: `Expected 8 hextets, got ${totalLeading} (use '::' to compress)` };
    }
    for (const h of leftParts) hextets.push(Number.parseInt(h, 16));
    for (let i = 0; i < needed; i++) hextets.push(0);
    for (const h of rightParts) hextets.push(Number.parseInt(h, 16));
  }

  if (hextets.length !== 8) {
    return { ok: false, error: `Address resolved to ${hextets.length} hextets, expected 8` };
  }

  // Validate hextet range.
  for (const h of hextets) {
    if (h < 0 || h > 0xffff) {
      return { ok: false, error: "Hextet out of range (0–ffff)" };
    }
  }

  // Compute BigInt value (hextet 0 is most significant).
  let value = BIG_0;
  for (let i = 0; i < 8; i++) {
    value = (value << 16n) | BigInt(hextets[i]);
  }

  return {
    ok: true,
    address: {
      hextets: hextets as [number, number, number, number, number, number, number, number],
      value,
    },
  };
}

/**
 * Parse a combined "address/prefix" input. Returns the validated ip + cidr.
 * If no '/' is present, prefix defaults to 128.
 */
export function parseIpCidr(
  input: string,
): { ok: true; ip: string; cidr: number } | { ok: false; error: string } {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: "Empty input" };
  let addrPart: string;
  let prefixPart: string;
  if (trimmed.includes("/")) {
    const slash = trimmed.lastIndexOf("/");
    addrPart = trimmed.slice(0, slash);
    prefixPart = trimmed.slice(slash + 1);
  } else {
    addrPart = trimmed;
    prefixPart = "";
  }
  const parsed = parseIPv6(addrPart);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  if (!prefixPart) return { ok: true, ip: addrPart.trim(), cidr: 128 };
  if (!/^\d+$/.test(prefixPart)) {
    return { ok: false, error: "Prefix length must be a decimal integer" };
  }
  const cidr = Number.parseInt(prefixPart, 10);
  if (cidr < 0 || cidr > 128) {
    return { ok: false, error: "Prefix length must be 0–128" };
  }
  return { ok: true, ip: addrPart.trim(), cidr };
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/** Convert a BigInt 128-bit value into eight 16-bit hextets (MSB first). */
export function valueToHextets(value: bigint): [number, number, number, number, number, number, number, number] {
  const out: number[] = [];
  let v = value & ((BIG_1 << 128n) - BIG_1);
  for (let i = 7; i >= 0; i--) {
    out[i] = Number(v & BIG_FFFF);
    v >>= 16n;
  }
  return out as [number, number, number, number, number, number, number, number];
}

/** Format hextets as the expanded form (8 hextets, 4 hex digits each, no '::'). */
export function expandHextets(hextets: readonly number[]): string {
  return hextets.map((h) => h.toString(16).padStart(4, "0")).join(":");
}

/** Format hextets as the RFC 5952 canonical compressed form. */
export function compressHextets(hextets: readonly number[]): string {
  // Find the longest run of consecutive zero hextets (length >= 2).
  let bestStart = -1;
  let bestLen = 0;
  let curStart = -1;
  let curLen = 0;
  for (let i = 0; i < hextets.length; i++) {
    if (hextets[i] === 0) {
      if (curStart === -1) curStart = i;
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
  if (bestLen < 2) {
    // No compression possible.
    return hextets.map((h) => h.toString(16)).join(":");
  }
  const left = hextets.slice(0, bestStart).map((h) => h.toString(16));
  const right = hextets.slice(bestStart + bestLen).map((h) => h.toString(16));
  return `${left.join(":")}::${right.join(":")}`;
}

/** Format a 128-bit BigInt value as the expanded IPv6 string. */
export function expandValue(value: bigint): string {
  return expandHextets(valueToHextets(value));
}

/** Format a 128-bit BigInt value as the RFC 5952 compressed IPv6 string. */
export function compressValue(value: bigint): string {
  return compressHextets(valueToHextets(value));
}

/** Format a 128-bit BigInt value as a 128-character binary string (MSB first). */
export function ipv6ToBinary(value: bigint): string {
  let v = value & ((BIG_1 << 128n) - BIG_1);
  if (v === BIG_0) return "0".repeat(128);
  let bits = v.toString(2);
  if (bits.length < 128) bits = "0".repeat(128 - bits.length) + bits;
  return bits;
}

/** Group a binary string into 16-bit hextet groups separated by spaces. */
export function formatBinaryHextets(binary: string): string {
  return binary.match(/.{1,16}/g)?.join(" ") ?? binary;
}

/** Group a binary string into 4-bit nibble groups separated by spaces. */
export function formatBinaryNibbles(binary: string): string {
  return binary.match(/.{1,4}/g)?.join(" ") ?? binary;
}

// ---------------------------------------------------------------------------
// Mask helpers
// ---------------------------------------------------------------------------

/** Compute the 128-bit BigInt mask for a given prefix length (0–128). */
export function maskForPrefix(prefix: number): bigint {
  if (prefix <= 0) return BIG_0;
  if (prefix >= 128) return (BIG_1 << 128n) - BIG_1;
  // Top `prefix` bits set.
  const zeros = 128n - BigInt(prefix);
  return ((BIG_1 << 128n) - BIG_1) ^ ((BIG_1 << zeros) - BIG_1);
}

/** Compute the 128-bit BigInt wildcard (inverse mask) for a given prefix. */
export function wildcardForPrefix(prefix: number): bigint {
  return ((BIG_1 << 128n) - BIG_1) ^ maskForPrefix(prefix);
}

/** Total address count for a prefix: 2^(128−prefix). Returned as a BigInt. */
export function totalAddressesForPrefix(prefix: number): bigint {
  if (prefix >= 128) return BIG_1;
  if (prefix <= 0) return BIG_1 << 128n;
  return BIG_1 << (128n - BigInt(prefix));
}

/** Number of /64 blocks in a prefix: 2^(64−prefix) when prefix ≤ 64, else 0. */
export function countOf64sForPrefix(prefix: number): bigint {
  if (prefix > 64) return BIG_0;
  if (prefix === 64) return BIG_1;
  return BIG_1 << (64n - BigInt(prefix));
}

/** Is the prefix on a nibble boundary (multiple of 4)? */
export function isNibbleBoundary(prefix: number): boolean {
  return prefix % 4 === 0;
}

/** Generate the ip6.arpa reverse DNS zone name for a network address + prefix. */
export function ip6ArpaZone(networkValue: bigint, prefix: number): string {
  const bits = ipv6ToBinary(networkValue);
  // Build the 32 nibbles (MSB first).
  const nibbles: string[] = [];
  for (let i = 0; i < 32; i++) {
    const nibble = bits.slice(i * 4, i * 4 + 4);
    const hexDigit = Number.parseInt(nibble, 2).toString(16);
    nibbles.push(hexDigit);
  }
  // The reverse DNS tree puts the least-significant nibble first. For a
  // delegation zone of `prefix` bits on a nibble boundary (prefix % 4 === 0),
  // the zone covers exactly prefix/4 nibbles — the network nibbles in reverse
  // order, with the host portion (lower-significance nibbles) stripped off.
  const nibbleCount = Math.max(1, Math.floor(prefix / 4));
  const networkNibbles = nibbles.slice(0, nibbleCount);
  networkNibbles.reverse();
  return `${networkNibbles.join(".")}.ip6.arpa`;
}

// ---------------------------------------------------------------------------
// Subnet compute
// ---------------------------------------------------------------------------

/** Compute full subnet info for an address + prefix length. */
export function computeSubnet(ipInput: string, cidr: number): SubnetInfo {
  if (cidr < 0 || cidr > 128) throw new Error("Prefix length must be 0–128");
  const parsed = parseIPv6(ipInput);
  if (!parsed.ok) throw new Error(parsed.error);
  const ipValue = parsed.address.value;
  const mask = maskForPrefix(cidr);
  const wildcard = wildcardForPrefix(cidr);
  const networkValue = ipValue & mask;
  const lastValue = networkValue | wildcard;
  const firstValue = networkValue; // First address = network (subnet-router anycast uses first)
  const total = totalAddressesForPrefix(cidr);
  const c64 = countOf64sForPrefix(cidr);

  const networkHextets = valueToHextets(networkValue);
  const ipHextets = parsed.address.hextets;
  const firstHextets = valueToHextets(firstValue);
  const lastHextets = valueToHextets(lastValue);

  return {
    ip: ipInput,
    ipCompressed: compressHextets(ipHextets),
    ipExpanded: expandHextets(ipHextets),
    cidr,
    networkAddress: compressHextets(networkHextets),
    networkCompressed: compressHextets(networkHextets),
    networkExpanded: expandHextets(networkHextets),
    firstAddress: compressHextets(firstHextets),
    firstAddressCompressed: compressHextets(firstHextets),
    lastAddress: compressHextets(lastHextets),
    lastAddressCompressed: compressHextets(lastHextets),
    totalAddresses: total.toString(),
    countOf64s: c64.toString(),
    isOnNibbleBoundary: isNibbleBoundary(cidr),
    ip6ArpaZone: ip6ArpaZone(networkValue, cidr),
    ipBinary: ipv6ToBinary(ipValue),
    networkBinary: ipv6ToBinary(networkValue),
    maskBinary: ipv6ToBinary(mask),
    wildcardBinary: ipv6ToBinary(wildcard),
    ipValue: ipValue.toString(),
    networkValue: networkValue.toString(),
    lastValue: lastValue.toString(),
    maskValue: mask.toString(),
    wildcardValue: wildcard.toString(),
  };
}

// ---------------------------------------------------------------------------
// Subdivide
// ---------------------------------------------------------------------------

/** Subdivide a parent prefix into child prefixes of the given length. */
export function subdivide(
  parentIp: string,
  parentCidr: number,
  childCidr: number,
  cap: number = SUBDIVIDE_CAP,
): SubdivideResult {
  if (parentCidr < 0 || parentCidr > 128) {
    throw new Error("Parent prefix must be 0–128");
  }
  if (childCidr < 0 || childCidr > 128) {
    throw new Error("Child prefix must be 0–128");
  }
  if (childCidr <= parentCidr) {
    return {
      parent: computeSubnet(parentIp, parentCidr),
      childPrefix: childCidr,
      childCount: "0",
      displayed: [],
      displayedCount: 0,
      capped: false,
      cap,
      error: "Child prefix must be longer than the parent prefix",
    };
  }
  const parent = computeSubnet(parentIp, parentCidr);
  const shift = BigInt(childCidr - parentCidr);
  const totalChildren = BIG_1 << shift;
  const parentNetwork = parent.networkValue ? BigInt(parent.networkValue) : BIG_0;
  const childSize = totalAddressesForPrefix(childCidr);
  const c64 = countOf64sForPrefix(childCidr);

  const displayCount = totalChildren > BigInt(cap) ? cap : Number(totalChildren);
  const displayed: ChildSubnet[] = [];
  for (let i = 0; i < displayCount; i++) {
    const offset = BigInt(i) * childSize;
    const childNetwork = parentNetwork + offset;
    const childLast = childNetwork + (childSize - BIG_1);
    const netHextets = valueToHextets(childNetwork);
    const lastHextets = valueToHextets(childLast);
    displayed.push({
      index: i,
      cidr: childCidr,
      networkAddress: compressHextets(netHextets),
      networkCompressed: compressHextets(netHextets),
      networkExpanded: expandHextets(netHextets),
      firstAddress: compressHextets(netHextets),
      lastAddress: compressHextets(lastHextets),
      totalAddresses: childSize.toString(),
      countOf64s: c64.toString(),
      ip6ArpaZone: ip6ArpaZone(childNetwork, childCidr),
    });
  }

  return {
    parent,
    childPrefix: childCidr,
    childCount: totalChildren.toString(),
    displayed,
    displayedCount: displayCount,
    capped: totalChildren > BigInt(cap),
    cap,
  };
}

// ---------------------------------------------------------------------------
// CSV / JSON export
// ---------------------------------------------------------------------------

/** Render child subnets as CSV. */
export function renderSubdivideCsv(children: ChildSubnet[]): string {
  const headers = [
    "index", "cidr", "network", "network_expanded", "first_address",
    "last_address", "total_addresses", "count_of_64s", "ip6_arpa_zone",
  ];
  const lines = [headers.join(",")];
  for (const c of children) {
    lines.push([
      c.index,
      c.cidr,
      c.networkAddress,
      c.networkExpanded,
      c.firstAddress,
      c.lastAddress,
      c.totalAddresses,
      c.countOf64s,
      escapeCsv(c.ip6ArpaZone),
    ].join(","));
  }
  return lines.join("\n");
}

/** Render subnet info as CSV. */
export function renderSubnetCsv(info: SubnetInfo): string {
  const headers = ["field", "value"];
  const lines = [headers.join(",")];
  const rows: [string, string][] = [
    ["ip", info.ip],
    ["ip_compressed", info.ipCompressed],
    ["ip_expanded", info.ipExpanded],
    ["cidr", String(info.cidr)],
    ["network", info.networkCompressed],
    ["network_expanded", info.networkExpanded],
    ["first_address", info.firstAddress],
    ["last_address", info.lastAddress],
    ["total_addresses", info.totalAddresses],
    ["count_of_64s", info.countOf64s],
    ["nibble_boundary", info.isOnNibbleBoundary ? "yes" : "no"],
    ["ip6_arpa_zone", info.ip6ArpaZone],
  ];
  for (const [k, v] of rows) {
    lines.push(`${k},${escapeCsv(v)}`);
  }
  return lines.join("\n");
}

/** Render any value as pretty JSON (BigInts as strings). */
export function renderJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---------------------------------------------------------------------------
// Reference table
// ---------------------------------------------------------------------------

export interface PrefixReferenceRow {
  prefix: number;
  totalAddresses: string;
  countOf64s: string;
  nibbleBoundary: boolean;
  example: string;
}

/** Build a reference table of common IPv6 prefix sizes. */
export function buildPrefixReferenceTable(): PrefixReferenceRow[] {
  const common = [0, 4, 8, 12, 16, 32, 40, 44, 48, 52, 56, 60, 64, 80, 96, 112, 120, 124, 126, 127, 128];
  const rows: PrefixReferenceRow[] = [];
  for (const p of common) {
    rows.push({
      prefix: p,
      totalAddresses: totalAddressesForPrefix(p).toString(),
      countOf64s: countOf64sForPrefix(p).toString(),
      nibbleBoundary: isNibbleBoundary(p),
      example: `2001:db8::/${p}`,
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:ipv6-subnet-calculator:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  mode: SubnetToolMode;
  input: string;
  summary: string;
}

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
  mode: SubnetToolMode,
  ip: string,
  cidr: number,
  extra: { childCidr?: number } = {},
): string {
  const params = new URLSearchParams();
  params.set("mode", mode);
  if (ip) params.set("ip", ip);
  params.set("cidr", String(cidr));
  if (extra.childCidr !== undefined) params.set("child", String(extra.childCidr));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export interface ShareParams {
  mode: SubnetToolMode;
  ip: string;
  cidr: number;
  childCidr: number;
}

export function parseShareUrl(hash: string): ShareParams {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) {
    return { mode: "subnet", ip: "2001:db8::1", cidr: 32, childCidr: 48 };
  }
  const params = new URLSearchParams(clean);
  const m = params.get("mode") ?? "subnet";
  const mode: SubnetToolMode =
    m === "subdivide" || m === "reference" ? m : "subnet";
  const ip = params.get("ip") ?? "2001:db8::1";
  const cidrRaw = Number.parseInt(params.get("cidr") ?? "32", 10);
  const cidr = Number.isFinite(cidrRaw) && cidrRaw >= 0 && cidrRaw <= 128 ? cidrRaw : 32;
  const childRaw = Number.parseInt(params.get("child") ?? "48", 10);
  const childCidr = Number.isFinite(childRaw) && childRaw >= 0 && childRaw <= 128 ? childRaw : 48;
  return { mode, ip, cidr, childCidr };
}
