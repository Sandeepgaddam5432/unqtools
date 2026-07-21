/**
 * CIDR ↔ IP Range / Netmask Converter — pure logic.
 *
 * Bidirectional conversions between CIDR notation, IP range (start–end),
 * netmask (dotted decimal), and wildcard mask for both IPv4 (32-bit) and
 * IPv6 (128-bit). Range → minimal exact CIDR set via the greedy algorithm.
 * Batch conversion with per-line family auto-detection.
 *
 * IPv4 values use 32-bit unsigned integers (>>> 0 keeps them unsigned).
 * IPv6 values use BigInt for 128-bit precision. Pure functions only —
 * no DOM, no network.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IpFamily = "ipv4" | "ipv6";

export interface ParsedIPv4 {
  octets: [number, number, number, number];
  value: number;
}

export interface ParsedIPv6 {
  hextets: [number, number, number, number, number, number, number, number];
  value: bigint;
}

export type AnyIpValue = { family: IpFamily; v4: number; v6: bigint };

export interface ConvertResult {
  family: IpFamily;
  cidr: string;
  cidrInt: number;
  network: string;
  first: string;
  last: string;
  mask: string;
  wildcard: string;
  hostCount: string; // BigInt as decimal string (RFC 3021 aware for IPv4)
  totalAddresses: string; // BigInt as decimal string
  error?: string;
}

export interface BatchLineResult {
  line: string;
  index: number;
  ok: boolean;
  result?: ConvertResult;
  error?: string;
}

export interface BatchResult {
  results: BatchLineResult[];
  okCount: number;
  errCount: number;
  cidrList: string[];
}

export interface MaskEquivalenceRow {
  cidr: number;
  mask: string;
  wildcard: string;
  hostCount: string;
  totalAddresses: string;
}

export type ToolMode = "convert" | "range" | "batch" | "reference";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BIG_0 = 0n;
const BIG_1 = 1n;
const IPV4_MAX = 0xffffffff >>> 0;
const IPV6_MAX = (BIG_1 << 128n) - BIG_1;
const V4_BITS = 32;
const V6_BITS = 128;

// ---------------------------------------------------------------------------
// IPv4 parsing & formatting
// ---------------------------------------------------------------------------

/** Parse a dotted-decimal IPv4 string into octets + 32-bit value. */
export function parseIPv4(input: string): { ok: true; address: ParsedIPv4 } | { ok: false; error: string } {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: "Empty IPv4 address" };
  const parts = trimmed.split(".");
  if (parts.length !== 4) {
    return { ok: false, error: "Expected 4 octets separated by dots" };
  }
  const octets: [number, number, number, number] = [0, 0, 0, 0];
  for (let i = 0; i < 4; i++) {
    const p = parts[i];
    if (!/^\d+$/.test(p)) {
      return { ok: false, error: `Invalid octet "${p}"` };
    }
    const n = Number.parseInt(p, 10);
    if (n < 0 || n > 255) {
      return { ok: false, error: `Octet ${n} out of range (0–255)` };
    }
    octets[i] = n;
  }
  const value = (((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>> 0);
  return { ok: true, address: { octets, value } };
}

/** Format a 32-bit unsigned integer as dotted-decimal. */
export function ipv4ToString(value: number): string {
  const v = value >>> 0;
  const a = (v >>> 24) & 0xff;
  const b = (v >>> 16) & 0xff;
  const c = (v >>> 8) & 0xff;
  const d = v & 0xff;
  return `${a}.${b}.${c}.${d}`;
}

/** IPv4 mask value for a prefix length (0–32). */
export function ipv4MaskValue(cidr: number): number {
  if (cidr <= 0) return 0;
  if (cidr >= 32) return 0xffffffff >>> 0;
  return ((0xffffffff << (32 - cidr)) >>> 0);
}

/** IPv4 wildcard value for a prefix length. */
export function ipv4WildcardValue(cidr: number): number {
  return (~ipv4MaskValue(cidr)) >>> 0;
}

// ---------------------------------------------------------------------------
// IPv6 parsing & formatting
// ---------------------------------------------------------------------------

/** Parse an IPv6 address into hextets + BigInt value. */
export function parseIPv6(input: string): { ok: true; address: ParsedIPv6 } | { ok: false; error: string } {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: "Empty IPv6 address" };
  if (trimmed.length > 48) return { ok: false, error: "IPv6 address too long" };
  if (!/^[0-9a-fA-F:.]+$/.test(trimmed)) {
    return { ok: false, error: "Invalid character in IPv6 address" };
  }
  const doubleColonCount = (trimmed.match(/::/g) ?? []).length;
  if (doubleColonCount > 1) {
    return { ok: false, error: "Multiple '::' sequences in IPv6 address" };
  }
  const hasDoubleColon = trimmed.includes("::");
  const lower = trimmed.toLowerCase();

  // Embedded IPv4 in last 32 bits.
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

  let hextetStrs: string[] = [];
  let leftParts: string[] = [];
  let rightParts: string[] = [];
  if (hasDoubleColon) {
    const idx = core.indexOf("::");
    const left = core.slice(0, idx);
    const right = core.slice(idx + 2);
    leftParts = left ? left.split(":") : [];
    rightParts = right ? right.split(":") : [];
    hextetStrs = [...leftParts, ...rightParts];
    if (leftParts.length + rightParts.length > 7) {
      return { ok: false, error: "Too many hextets for '::' compression" };
    }
  } else {
    leftParts = core.split(":");
    hextetStrs = leftParts;
  }

  for (const h of hextetStrs) {
    if (h === "") return { ok: false, error: "Empty hextet" };
    if (!/^[0-9a-f]{1,4}$/.test(h)) {
      return { ok: false, error: `Invalid hextet "${h}" (must be 1–4 hex digits)` };
    }
  }

  const hextets: number[] = [];
  if (embeddedV4) {
    const [a, b, c, d] = embeddedV4;
    const totalLeading = leftParts.length + rightParts.length;
    const needed = 6 - totalLeading;
    if (needed < 0) {
      return { ok: false, error: "Too many hextets with embedded IPv4" };
    }
    if (!hasDoubleColon && totalLeading !== 6) {
      return { ok: false, error: "Embedded IPv4 needs '::' or full 6 leading hextets" };
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
  for (const h of hextets) {
    if (h < 0 || h > 0xffff) {
      return { ok: false, error: "Hextet out of range (0–ffff)" };
    }
  }

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

/** Format a BigInt 128-bit value into eight hextets (MSB first). */
export function ipv6Hextets(value: bigint): [number, number, number, number, number, number, number, number] {
  const out: number[] = [];
  let v = value & IPV6_MAX;
  for (let i = 7; i >= 0; i--) {
    out[i] = Number(v & 0xffffn);
    v >>= 16n;
  }
  return out as [number, number, number, number, number, number, number, number];
}

/** Format an IPv6 BigInt value as the RFC 5952 canonical compressed string. */
export function ipv6ToString(value: bigint): string {
  const hextets = ipv6Hextets(value);
  // Find longest run of zeros (length >= 2).
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
    return hextets.map((h) => h.toString(16)).join(":");
  }
  const left = hextets.slice(0, bestStart).map((h) => h.toString(16));
  const right = hextets.slice(bestStart + bestLen).map((h) => h.toString(16));
  return `${left.join(":")}::${right.join(":")}`;
}

/** IPv6 BigInt mask value for a prefix length (0–128). */
export function ipv6MaskValue(cidr: number): bigint {
  if (cidr <= 0) return BIG_0;
  if (cidr >= 128) return IPV6_MAX;
  const zeros = 128n - BigInt(cidr);
  return IPV6_MAX ^ ((BIG_1 << zeros) - BIG_1);
}

/** IPv6 BigInt wildcard value for a prefix length. */
export function ipv6WildcardValue(cidr: number): bigint {
  return IPV6_MAX ^ ipv6MaskValue(cidr);
}

// ---------------------------------------------------------------------------
// Family detection & parsing
// ---------------------------------------------------------------------------

/** Detect IPv4 vs IPv6 from a string. */
export function detectFamily(s: string): IpFamily {
  const t = s.trim();
  if (t.includes(":")) return "ipv6";
  return "ipv4";
}

/** Parse any IP string (IPv4 or IPv6) into an AnyIpValue. */
export function parseAnyIp(input: string): { ok: true; value: AnyIpValue } | { ok: false; error: string } {
  const family = detectFamily(input);
  if (family === "ipv4") {
    const r = parseIPv4(input);
    if (!r.ok) return { ok: false, error: r.error };
    return { ok: true, value: { family, v4: r.address.value, v6: BIG_0 } };
  }
  const r = parseIPv6(input);
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, value: { family, v4: 0, v6: r.address.value } };
}

/** Format an AnyIpValue back to its canonical string form. */
export function anyIpToString(v: AnyIpValue): string {
  return v.family === "ipv4" ? ipv4ToString(v.v4) : ipv6ToString(v.v6);
}

/** Get the BigInt value of an AnyIpValue (IPv4 widened to 32-bit BigInt). */
export function anyIpToBig(v: AnyIpValue): bigint {
  return v.family === "ipv4" ? BigInt(v.v4 >>> 0) : v.v6;
}

/** Build an AnyIpValue from a BigInt + family. */
export function bigToAnyIp(value: bigint, family: IpFamily): AnyIpValue {
  if (family === "ipv4") {
    return { family, v4: Number(value & 0xffffffffn) >>> 0, v6: BIG_0 };
  }
  return { family, v4: 0, v6: value & IPV6_MAX };
}

/** Bit width for a family. */
export function familyBits(family: IpFamily): number {
  return family === "ipv4" ? V4_BITS : V6_BITS;
}

/** Max BigInt value for a family. */
export function familyMax(family: IpFamily): bigint {
  return family === "ipv4" ? BigInt(IPV4_MAX) : IPV6_MAX;
}

// ---------------------------------------------------------------------------
// Mask validation & conversion
// ---------------------------------------------------------------------------

/**
 * Validate that a 32-bit value is a contiguous netmask (all 1s then all 0s).
 * Returns the prefix length, or null if not a valid mask. Iterates over all
 * valid prefix lengths to avoid JavaScript's 32-bit signed-shift quirks.
 */
export function ipv4MaskToCidr(mask: number): number | null {
  const v = mask >>> 0;
  for (let c = 0; c <= 32; c++) {
    if (ipv4MaskValue(c) === v) return c;
  }
  return null;
}

/**
 * Validate that a 128-bit BigInt is a contiguous netmask. Returns the prefix
 * length, or null if not a valid mask.
 */
export function ipv6MaskToCidr(mask: bigint): number | null {
  const v = mask & IPV6_MAX;
  if (v === BIG_0) return 0;
  let cidr = 0;
  for (let i = 127; i >= 0; i--) {
    if ((v >> BigInt(i)) & BIG_1) cidr++;
    else break;
  }
  const rest = (v << BigInt(128 - cidr)) & ((BIG_1 << BigInt(128 - cidr)) - BIG_1);
  if (rest !== BIG_0) return null;
  return cidr;
}

/** Parse a dotted-decimal netmask (IPv4) or hex form (IPv6) into a CIDR. */
export function parseMask(input: string, family: IpFamily): { ok: true; cidr: number } | { ok: false; error: string } {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: "Empty mask" };
  if (family === "ipv4") {
    const parsed = parseIPv4(trimmed);
    if (!parsed.ok) return { ok: false, error: parsed.error };
    const cidr = ipv4MaskToCidr(parsed.address.value);
    if (cidr === null) return { ok: false, error: "Not a valid contiguous netmask" };
    return { ok: true, cidr };
  }
  // IPv6: accept the dotted-decimal-less form like "ffff:ffff:ffff::" — same parser as IPv6.
  const parsed = parseIPv6(trimmed);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const cidr = ipv6MaskToCidr(parsed.address.value);
  if (cidr === null) return { ok: false, error: "Not a valid contiguous netmask" };
  return { ok: true, cidr };
}

// ---------------------------------------------------------------------------
// CIDR / range parsing
// ---------------------------------------------------------------------------

/** Parse a CIDR string ("ip/prefix") into IP + prefix length. */
export function parseCidr(input: string): { ok: true; value: AnyIpValue; cidr: number } | { ok: false; error: string } {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: "Empty input" };
  const slash = trimmed.lastIndexOf("/");
  if (slash === -1) {
    // Bare IP — assume /32 (IPv4) or /128 (IPv6).
    const r = parseAnyIp(trimmed);
    if (!r.ok) return { ok: false, error: r.error };
    const maxBits = familyBits(r.value.family);
    return { ok: true, value: r.value, cidr: maxBits };
  }
  const addrPart = trimmed.slice(0, slash);
  const prefixPart = trimmed.slice(slash + 1);
  if (!/^\d+$/.test(prefixPart)) {
    return { ok: false, error: "Prefix length must be a decimal integer" };
  }
  const cidr = Number.parseInt(prefixPart, 10);
  const r = parseAnyIp(addrPart);
  if (!r.ok) return { ok: false, error: r.error };
  const maxBits = familyBits(r.value.family);
  if (cidr < 0 || cidr > maxBits) {
    return { ok: false, error: `Prefix length must be 0–${maxBits} for ${r.value.family}` };
  }
  return { ok: true, value: r.value, cidr };
}

/** Parse a range string "start–end" (also "start - end", "start to end") into two IPs. */
export function parseRange(input: string): { ok: true; start: AnyIpValue; end: AnyIpValue } | { ok: false; error: string } {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: "Empty input" };
  // Split on ' – ', ' - ', ' to ', or en-dash/em-dash.
  const m = trimmed.match(/\s*(?:–|—|->|to|-|\.\.)\s*/i);
  if (!m || m.index === undefined) {
    return { ok: false, error: "Range must be 'start – end' or 'start - end'" };
  }
  const startStr = trimmed.slice(0, m.index).trim();
  const endStr = trimmed.slice(m.index + m[0].length).trim();
  if (!startStr || !endStr) {
    return { ok: false, error: "Range must have both start and end" };
  }
  const s = parseAnyIp(startStr);
  if (!s.ok) return { ok: false, error: `Start: ${s.error}` };
  const e = parseAnyIp(endStr);
  if (!e.ok) return { ok: false, error: `End: ${e.error}` };
  if (s.value.family !== e.value.family) {
    return { ok: false, error: "Start and end must be the same family (both IPv4 or both IPv6)" };
  }
  if (anyIpToBig(s.value) > anyIpToBig(e.value)) {
    return { ok: false, error: "Start address is greater than end address" };
  }
  return { ok: true, start: s.value, end: e.value };
}

// ---------------------------------------------------------------------------
// Core conversion
// ---------------------------------------------------------------------------

/** IPv4 host count for a prefix (RFC 3021: /31 → 2, /32 → 1, else 2^(32−c) − 2). */
export function ipv4HostCount(cidr: number): bigint {
  if (cidr >= 32) return BIG_1;
  if (cidr === 31) return BIG_1 << 1n;
  return (BIG_1 << BigInt(32 - cidr)) - BIG_1 - BIG_1;
}

/** IPv6 total address count for a prefix (BigInt-exact). */
export function ipv6TotalForPrefix(cidr: number): bigint {
  if (cidr >= 128) return BIG_1;
  if (cidr <= 0) return BIG_1 << 128n;
  return BIG_1 << BigInt(128 - cidr);
}

/** IPv4 total address count for a prefix. */
export function ipv4TotalForPrefix(cidr: number): bigint {
  if (cidr >= 32) return BIG_1;
  if (cidr <= 0) return BIG_1 << 32n;
  return BIG_1 << BigInt(32 - cidr);
}

/**
 * Compute the full conversion result from an IP + prefix length.
 * Falls back to an error result if the IP/prefix is invalid.
 */
export function convertFromIpCidr(value: AnyIpValue, cidr: number): ConvertResult {
  if (value.family === "ipv4") {
    const mask = ipv4MaskValue(cidr);
    const wildcard = ipv4WildcardValue(cidr);
    const network = value.v4 & mask;
    const first = network; // First address = network (RFC 3021: /31 uses both)
    const last = network | wildcard;
    const total = ipv4TotalForPrefix(cidr);
    const hosts = ipv4HostCount(cidr);
    return {
      family: "ipv4",
      cidr: `${ipv4ToString(network)}/${cidr}`,
      cidrInt: cidr,
      network: ipv4ToString(network),
      first: ipv4ToString(first),
      last: ipv4ToString(last),
      mask: ipv4ToString(mask),
      wildcard: ipv4ToString(wildcard),
      hostCount: hosts.toString(),
      totalAddresses: total.toString(),
    };
  }
  const mask = ipv6MaskValue(cidr);
  const wildcard = ipv6WildcardValue(cidr);
  const network = value.v6 & mask;
  const last = network | wildcard;
  const total = ipv6TotalForPrefix(cidr);
  // IPv6 has no broadcast — every address is usable. Host count = total addresses.
  return {
    family: "ipv6",
    cidr: `${ipv6ToString(network)}/${cidr}`,
    cidrInt: cidr,
    network: ipv6ToString(network),
    first: ipv6ToString(network),
    last: ipv6ToString(last),
    mask: ipv6ToString(mask),
    wildcard: ipv6ToString(wildcard),
    hostCount: total.toString(),
    totalAddresses: total.toString(),
  };
}

/** Convert a CIDR string into a full ConvertResult. */
export function convertCidr(cidrStr: string): ConvertResult {
  const r = parseCidr(cidrStr);
  if (!r.ok) {
    return {
      family: detectFamily(cidrStr),
      cidr: cidrStr,
      cidrInt: -1,
      network: "",
      first: "",
      last: "",
      mask: "",
      wildcard: "",
      hostCount: "0",
      totalAddresses: "0",
      error: r.error,
    };
  }
  return convertFromIpCidr(r.value, r.cidr);
}

/** Convert a mask (dotted-decimal or IPv6 hex form) + family into a ConvertResult. */
export function convertMask(maskStr: string, family: IpFamily): ConvertResult {
  const r = parseMask(maskStr, family);
  if (!r.ok) {
    return {
      family,
      cidr: maskStr,
      cidrInt: -1,
      network: "",
      first: "",
      last: "",
      mask: "",
      wildcard: "",
      hostCount: "0",
      totalAddresses: "0",
      error: r.error,
    };
  }
  // Synthesize a network address of all zeros for the family so we can compute the rest.
  const zeroIp: AnyIpValue = family === "ipv4"
    ? { family, v4: 0, v6: BIG_0 }
    : { family, v4: 0, v6: BIG_0 };
  const result = convertFromIpCidr(zeroIp, r.cidr);
  // Replace the network/first/last with the mask's own block at offset 0 (which they already are).
  return result;
}

// ---------------------------------------------------------------------------
// Range → minimal CIDR set (greedy algorithm)
// ---------------------------------------------------------------------------

/** Greedy range-to-CIDR decomposition. Returns the minimal exact CIDR block list. */
export function rangeToCidrList(start: AnyIpValue, end: AnyIpValue): string[] {
  if (start.family !== end.family) return [];
  const bits = familyBits(start.family);
  const max = familyMax(start.family);
  let cur = anyIpToBig(start);
  const endBig = anyIpToBig(end);
  const out: string[] = [];
  while (cur <= endBig) {
    // Find the largest CIDR block starting at `cur` that does not overshoot endBig.
    // The block size is limited by (a) trailing zeros in `cur` (alignment), and (b) remaining range.
    // b is the log2 of the block size; b ranges 0..bits (so block prefix ranges bits..0).
    let maxBlockBits = 0;
    for (let b = 0; b <= bits; b++) {
      // Can we use a /(bits - b) block (i.e. 2^b addresses)?
      // Requires cur mod 2^b == 0 (alignment), and cur + 2^b - 1 <= endBig.
      if (b > 0 && (cur & ((BIG_1 << BigInt(b)) - BIG_1)) !== BIG_0) break;
      const blockEnd = cur + (BIG_1 << BigInt(b)) - BIG_1;
      if (blockEnd > endBig) break;
      maxBlockBits = b;
    }
    const blockPrefix = bits - maxBlockBits;
    const blockSize = BIG_1 << BigInt(maxBlockBits);
    const blockStart = cur;
    const ipStr = anyIpToString(bigToAnyIp(blockStart, start.family));
    out.push(`${ipStr}/${blockPrefix}`);
    cur = cur + blockSize;
    if (cur > max) break; // overflow guard
  }
  return out;
}

/** Convert a range string into a list of CIDR ConvertResults. */
export function convertRange(rangeStr: string): { results: ConvertResult[]; error?: string } {
  const r = parseRange(rangeStr);
  if (!r.ok) return { results: [], error: r.error };
  const cidrs = rangeToCidrList(r.start, r.end);
  const results = cidrs.map((c) => convertCidr(c));
  return { results };
}

// ---------------------------------------------------------------------------
// Batch conversion
// ---------------------------------------------------------------------------

/** Parse batch input (one entry per line). Auto-detects family per line. */
export function parseBatch(input: string): string[] {
  if (!input) return [];
  return input
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("#"));
}

/** Convert each batch line. */
export function convertBatch(lines: string[]): BatchResult {
  const results: BatchLineResult[] = [];
  let okCount = 0;
  let errCount = 0;
  const cidrList: string[] = [];
  lines.forEach((line, index) => {
    // Try CIDR first; if that fails, try range.
    const cidrRes = convertCidr(line);
    if (!cidrRes.error) {
      results.push({ line, index, ok: true, result: cidrRes });
      cidrList.push(cidrRes.cidr);
      okCount++;
      return;
    }
    const rangeRes = convertRange(line);
    if (!rangeRes.error && rangeRes.results.length > 0) {
      for (const r of rangeRes.results) {
        results.push({ line, index, ok: true, result: r });
        cidrList.push(r.cidr);
        okCount++;
      }
      return;
    }
    results.push({
      line,
      index,
      ok: false,
      error: rangeRes.error ?? cidrRes.error,
    });
    errCount++;
  });
  return { results, okCount, errCount, cidrList };
}

// ---------------------------------------------------------------------------
// Reference table
// ---------------------------------------------------------------------------

/** Build a netmask equivalence table for IPv4 (CIDR, mask, wildcard, hosts, total). */
export function buildIpv4MaskTable(): MaskEquivalenceRow[] {
  const rows: MaskEquivalenceRow[] = [];
  for (let c = 0; c <= 32; c++) {
    rows.push({
      cidr: c,
      mask: ipv4ToString(ipv4MaskValue(c)),
      wildcard: ipv4ToString(ipv4WildcardValue(c)),
      hostCount: ipv4HostCount(c).toString(),
      totalAddresses: ipv4TotalForPrefix(c).toString(),
    });
  }
  return rows;
}

/** Build a netmask equivalence table for common IPv6 prefixes. */
export function buildIpv6MaskTable(): MaskEquivalenceRow[] {
  const common = [0, 4, 8, 12, 16, 32, 40, 44, 48, 52, 56, 60, 64, 80, 96, 112, 120, 124, 126, 127, 128];
  const rows: MaskEquivalenceRow[] = [];
  for (const c of common) {
    rows.push({
      cidr: c,
      mask: ipv6ToString(ipv6MaskValue(c)),
      wildcard: ipv6ToString(ipv6WildcardValue(c)),
      hostCount: ipv6TotalForPrefix(c).toString(),
      totalAddresses: ipv6TotalForPrefix(c).toString(),
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// CSV / JSON export
// ---------------------------------------------------------------------------

/** Render a ConvertResult as CSV. */
export function renderConvertCsv(r: ConvertResult): string {
  const headers = ["cidr", "family", "network", "first", "last", "mask", "wildcard", "host_count", "total_addresses"];
  const lines = [headers.join(",")];
  lines.push([
    escapeCsv(r.cidr),
    r.family,
    escapeCsv(r.network),
    escapeCsv(r.first),
    escapeCsv(r.last),
    escapeCsv(r.mask),
    escapeCsv(r.wildcard),
    r.hostCount,
    r.totalAddresses,
  ].join(","));
  return lines.join("\n");
}

/** Render a batch result as CSV (one row per line). */
export function renderBatchCsv(result: BatchResult): string {
  const headers = ["line_index", "input", "ok", "cidr", "family", "network", "first", "last", "mask", "wildcard", "host_count", "total_addresses", "error"];
  const lines = [headers.join(",")];
  for (const r of result.results) {
    if (r.ok && r.result) {
      const x = r.result;
      lines.push([
        r.index,
        escapeCsv(r.line),
        "yes",
        escapeCsv(x.cidr),
        x.family,
        escapeCsv(x.network),
        escapeCsv(x.first),
        escapeCsv(x.last),
        escapeCsv(x.mask),
        escapeCsv(x.wildcard),
        x.hostCount,
        x.totalAddresses,
        "",
      ].join(","));
    } else {
      lines.push([
        r.index,
        escapeCsv(r.line),
        "no",
        "", "", "", "", "", "", "", "", "",
        escapeCsv(r.error ?? "error"),
      ].join(","));
    }
  }
  return lines.join("\n");
}

/** Render a mask equivalence table as CSV. */
export function renderMaskTableCsv(rows: MaskEquivalenceRow[]): string {
  const headers = ["cidr", "mask", "wildcard", "host_count", "total_addresses"];
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push([r.cidr, escapeCsv(r.mask), escapeCsv(r.wildcard), r.hostCount, r.totalAddresses].join(","));
  }
  return lines.join("\n");
}

/** Render any value as pretty JSON. */
export function renderJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:cidr-ip-range-netmask-converter:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  mode: ToolMode;
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
  mode: ToolMode,
  family: IpFamily,
  input: string,
  extra: { batch?: string } = {},
): string {
  const params = new URLSearchParams();
  params.set("mode", mode);
  params.set("fam", family);
  if (input) params.set("in", input);
  if (extra.batch !== undefined) params.set("batch", extra.batch);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export interface ShareParams {
  mode: ToolMode;
  family: IpFamily;
  input: string;
  batch: string;
}

export function parseShareUrl(hash: string): ShareParams {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) {
    return { mode: "convert", family: "ipv4", input: "192.168.1.0/24", batch: "" };
  }
  const params = new URLSearchParams(clean);
  const m = params.get("mode") ?? "convert";
  const mode: ToolMode =
    m === "range" || m === "batch" || m === "reference" ? m : "convert";
  const fam = params.get("fam");
  const family: IpFamily = fam === "ipv6" ? "ipv6" : "ipv4";
  const input = params.get("in") ?? (family === "ipv4" ? "192.168.1.0/24" : "2001:db8::/32");
  const batch = params.get("batch") ?? "";
  return { mode, family, input, batch };
}
