/**
 * CIDR Aggregator & Network Summarizer — pure logic.
 *
 * Aggregate a messy mix of IPs, dashed ranges, and CIDR blocks (IPv4 and
 * IPv6) into the smallest possible set of CIDR prefixes — merge adjacent /
 * overlapping blocks, dedupe, optionally subtract exclusions — with
 * before/after prefix & address counts and export in CIDR / range /
 * Cisco ACL / pfSense alias / nginx allow formats.
 *
 * All math uses BigInt so 0.0.0.0/0 and ::/0 are counted correctly without
 * enumerating every address. Pure functions only — no DOM, no network.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IpFamily = "ipv4" | "ipv6";

/** A numeric [start, end] inclusive interval on a single address family. */
export interface Interval {
  family: IpFamily;
  start: bigint;
  end: bigint;
}

/** A CIDR block: network address (BigInt) + prefix length. */
export interface CidrBlock {
  family: IpFamily;
  network: bigint;
  prefix: number;
}

/** Result of parsing a single input line. */
export interface ParsedLine {
  line: string;
  index: number;
  ok: boolean;
  interval?: Interval;
  error?: string;
}

/** Per-family aggregation breakdown. */
export interface FamilyResult {
  family: IpFamily;
  /** All valid input intervals (pre-merge) — duplicates included. */
  inputIntervals: Interval[];
  /** Merged + excluded intervals (post-aggregation). */
  mergedIntervals: Interval[];
  /** Minimal CIDR set covering mergedIntervals. */
  cidrs: CidrBlock[];
  /** CIDR set before aggregation (the raw input CIDRs / canonicalized). */
  inputCidrs: CidrBlock[];
  /** Total addresses in input set (BigInt string). */
  inputAddresses: bigint;
  /** Total addresses in output set (BigInt string). */
  outputAddresses: bigint;
  /** Total addresses removed by exclusions. */
  excludedAddresses: bigint;
}

/** Full aggregation result. */
export interface AggregateResult {
  ipv4: FamilyResult | null;
  ipv6: FamilyResult | null;
  errors: ParsedLine[];
  warnings: string[];
  /** Total input entries (valid). */
  totalInput: number;
  /** Total output CIDRs across both families. */
  totalOutput: number;
  /** Total addresses saved (BigInt as string). */
  addressesSaved: bigint;
  /** Prefixes saved (input - output count). */
  prefixesSaved: number;
}

export type ExportFormat = "cidr" | "range" | "cisco" | "pfsense" | "nginx";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// BigInt constants (avoid BigInt literals — TS target is ES2017).
const BIG_0 = BigInt(0);
const BIG_1 = BigInt(1);
const BIG_2 = BigInt(2);
const BIG_8 = BigInt(8);
const BIG_16 = BigInt(16);
const BIG_32 = BigInt(32);
const BIG_128 = BigInt(128);
const BIG_FF = BigInt(0xff);
const BIG_FFFF = BigInt(0xffff);
const IPV4_MAX = (BIG_1 << BIG_32) - BIG_1;
const IPV6_MAX = (BIG_1 << BIG_128) - BIG_1;
const V4_BITS = 32;
const V6_BITS = 128;

// ---------------------------------------------------------------------------
// IPv4 parsing & formatting
// ---------------------------------------------------------------------------

/** Parse a dotted-decimal IPv4 string into a 32-bit BigInt. */
export function parseIPv4(input: string): { ok: true; value: bigint } | { ok: false; error: string } {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: "Empty IPv4 address" };
  const parts = trimmed.split(".");
  if (parts.length !== 4) return { ok: false, error: "Expected 4 octets separated by dots" };
  let value = BIG_0;
  for (let i = 0; i < 4; i++) {
    const p = parts[i];
    if (!/^\d+$/.test(p)) return { ok: false, error: `Invalid octet "${p}"` };
    const n = Number.parseInt(p, 10);
    if (n < 0 || n > 255) return { ok: false, error: `Octet ${n} out of range (0–255)` };
    value = (value << BIG_8) | BigInt(n);
  }
  return { ok: true, value };
}

/** Format a 32-bit BigInt as dotted-decimal. */
export function ipv4ToString(value: bigint): string {
  const v = value & IPV4_MAX;
  const a = Number((v >> BigInt(24)) & BIG_FF);
  const b = Number((v >> BigInt(16)) & BIG_FF);
  const c = Number((v >> BIG_8) & BIG_FF);
  const d = Number(v & BIG_FF);
  return `${a}.${b}.${c}.${d}`;
}

// ---------------------------------------------------------------------------
// IPv6 parsing & formatting
// ---------------------------------------------------------------------------

/** Parse an IPv6 address (with '::' compression and embedded IPv4) into a 128-bit BigInt. */
export function parseIPv6(input: string): { ok: true; value: bigint } | { ok: false; error: string } {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: "Empty IPv6 address" };
  if (trimmed.length > 48) return { ok: false, error: "IPv6 address too long" };
  if (!/^[0-9a-fA-F:.]+$/.test(trimmed)) {
    return { ok: false, error: "Invalid character in IPv6 address" };
  }
  const doubleColonCount = (trimmed.match(/::/g) ?? []).length;
  if (doubleColonCount > 1) return { ok: false, error: "Multiple '::' sequences in IPv6 address" };
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
      if (parts.length !== 4) return { ok: false, error: "Embedded IPv4 must have 4 octets" };
      const oct: [number, number, number, number] = [0, 0, 0, 0];
      for (let i = 0; i < 4; i++) {
        const n = Number.parseInt(parts[i], 10);
        if (!Number.isFinite(n) || n < 0 || n > 255) return { ok: false, error: `Invalid IPv4 octet "${parts[i]}"` };
        oct[i] = n;
      }
      embeddedV4 = oct;
      core = lower.slice(0, lastColon);
    }
  }

  let leftParts: string[] = [];
  let rightParts: string[] = [];
  if (hasDoubleColon) {
    const idx = core.indexOf("::");
    const left = core.slice(0, idx);
    const right = core.slice(idx + 2);
    leftParts = left ? left.split(":") : [];
    rightParts = right ? right.split(":") : [];
    if (leftParts.length + rightParts.length > 7) {
      return { ok: false, error: "Too many hextets for '::' compression" };
    }
  } else {
    leftParts = core.split(":");
  }

  const hextetStrs = [...leftParts, ...rightParts];
  for (const h of hextetStrs) {
    if (h === "") return { ok: false, error: "Empty hextet" };
    if (!/^[0-9a-f]{1,4}$/.test(h)) return { ok: false, error: `Invalid hextet "${h}" (must be 1–4 hex digits)` };
  }

  const hextets: number[] = [];
  if (embeddedV4) {
    const [a, b, c, d] = embeddedV4;
    const totalLeading = leftParts.length + rightParts.length;
    const needed = 6 - totalLeading;
    if (needed < 0) return { ok: false, error: "Too many hextets with embedded IPv4" };
    if (!hasDoubleColon && totalLeading !== 6) return { ok: false, error: "Embedded IPv4 needs '::' or full 6 leading hextets" };
    for (const h of leftParts) hextets.push(Number.parseInt(h, 16));
    for (let i = 0; i < needed; i++) hextets.push(0);
    for (const h of rightParts) hextets.push(Number.parseInt(h, 16));
    hextets.push((a << 8) | b);
    hextets.push((c << 8) | d);
  } else {
    const totalLeading = leftParts.length + rightParts.length;
    const needed = 8 - totalLeading;
    if (needed < 0) return { ok: false, error: "Too many hextets (more than 8)" };
    if (needed > 0 && !hasDoubleColon) return { ok: false, error: `Expected 8 hextets, got ${totalLeading} (use '::' to compress)` };
    for (const h of leftParts) hextets.push(Number.parseInt(h, 16));
    for (let i = 0; i < needed; i++) hextets.push(0);
    for (const h of rightParts) hextets.push(Number.parseInt(h, 16));
  }

  if (hextets.length !== 8) return { ok: false, error: `Address resolved to ${hextets.length} hextets, expected 8` };

  let value = BIG_0;
  for (let i = 0; i < 8; i++) value = (value << BIG_16) | BigInt(hextets[i]);
  return { ok: true, value };
}

/** Format a BigInt 128-bit value into eight hextets (MSB first). */
export function ipv6Hextets(value: bigint): number[] {
  const out: number[] = [];
  let v = value & IPV6_MAX;
  for (let i = 7; i >= 0; i--) {
    out[i] = Number(v & BIG_FFFF);
    v >>= BIG_16;
  }
  return out;
}

/** Format an IPv6 BigInt as the RFC 5952 canonical compressed string. */
export function ipv6ToString(value: bigint): string {
  const hextets = ipv6Hextets(value);
  let bestStart = -1;
  let bestLen = 0;
  let curStart = -1;
  let curLen = 0;
  for (let i = 0; i < hextets.length; i++) {
    if (hextets[i] === 0) {
      if (curStart === -1) curStart = i;
      curLen++;
      if (curLen > bestLen) { bestLen = curLen; bestStart = curStart; }
    } else { curStart = -1; curLen = 0; }
  }
  if (bestLen < 2) return hextets.map((h) => h.toString(16)).join(":");
  const left = hextets.slice(0, bestStart).map((h) => h.toString(16));
  const right = hextets.slice(bestStart + bestLen).map((h) => h.toString(16));
  return `${left.join(":")}::${right.join(":")}`;
}

// ---------------------------------------------------------------------------
// Family detection & shared helpers
// ---------------------------------------------------------------------------

/** Detect IPv4 vs IPv6 from a string. */
export function detectFamily(s: string): IpFamily {
  return s.trim().includes(":") ? "ipv6" : "ipv4";
}

/** Bit width for a family. */
export function familyBits(family: IpFamily): number {
  return family === "ipv4" ? V4_BITS : V6_BITS;
}

/** Max BigInt value for a family. */
export function familyMax(family: IpFamily): bigint {
  return family === "ipv4" ? IPV4_MAX : IPV6_MAX;
}

/** Format an IP BigInt per family. */
export function ipToString(value: bigint, family: IpFamily): string {
  return family === "ipv4" ? ipv4ToString(value) : ipv6ToString(value);
}

/** Build a BigInt mask value for a prefix length on a family. */
export function maskValue(cidr: number, family: IpFamily): bigint {
  const bits = familyBits(family);
  const max = familyMax(family);
  if (cidr <= 0) return BIG_0;
  if (cidr >= bits) return max;
  const zeros = BigInt(bits - cidr);
  return max ^ ((BIG_1 << zeros) - BIG_1);
}

/** Build a BigInt wildcard (inverse mask) value. */
export function wildcardValue(cidr: number, family: IpFamily): bigint {
  return familyMax(family) ^ maskValue(cidr, family);
}

/** Count addresses in a CIDR block (BigInt). */
export function cidrAddressCount(cidr: number, family: IpFamily): bigint {
  const bits = familyBits(family);
  if (cidr >= bits) return BIG_1;
  if (cidr <= 0) return familyMax(family) + BIG_1;
  return BIG_1 << BigInt(bits - cidr);
}

/** Format a CIDR block as a string. */
export function cidrToString(block: CidrBlock): string {
  return `${ipToString(block.network, block.family)}/${block.prefix}`;
}

/** Count of trailing zero bits in a BigInt value (capped at maxBits). */
export function trailingZeros(value: bigint, maxBits: number): number {
  if (value === BIG_0) return maxBits;
  let count = 0;
  let v = value;
  while ((v & BIG_1) === BIG_0 && count < maxBits) {
    count++;
    v = v >> BIG_1;
  }
  return count;
}

/** Floor of log2 of a positive BigInt (returns -1 for 0). */
export function floorLog2(value: bigint): number {
  if (value <= BIG_0) return -1;
  let n = 0;
  let v = value;
  while (v > BIG_1) { v >>= BIG_1; n++; }
  return n;
}

// ---------------------------------------------------------------------------
// CIDR & range parsing
// ---------------------------------------------------------------------------

/** Parse a CIDR block string ("a.b.c.d/N" or IPv6 equivalent). */
export function parseCidr(input: string): { ok: true; block: CidrBlock } | { ok: false; error: string } {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: "Empty CIDR" };
  const slashIdx = trimmed.lastIndexOf("/");
  if (slashIdx === -1) return { ok: false, error: "Missing '/' in CIDR" };
  const ipPart = trimmed.slice(0, slashIdx);
  const cidrPart = trimmed.slice(slashIdx + 1);
  if (!/^\d+$/.test(cidrPart)) return { ok: false, error: `Invalid prefix length "${cidrPart}"` };
  const cidr = Number.parseInt(cidrPart, 10);
  const family = detectFamily(ipPart);
  const bits = familyBits(family);
  if (cidr < 0 || cidr > bits) return { ok: false, error: `Prefix length ${cidr} out of range (0–${bits})` };
  const parsed = family === "ipv4" ? parseIPv4(ipPart) : parseIPv6(ipPart);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  // Network-align: zero out the host bits.
  const network = parsed.value & maskValue(cidr, family);
  return { ok: true, block: { family, network, prefix: cidr } };
}

/** Parse a dashed range string ("a.b.c.d-e.f.g.h" or IPv6 equivalent). */
export function parseRange(input: string): { ok: true; interval: Interval } | { ok: false; error: string } {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: "Empty range" };
  // Support both "-" and "–" (en dash) and " to ".
  const parts = trimmed.split(/[\s]*[-–][\s]*|[\s]+to[\s]+/i);
  if (parts.length !== 2) return { ok: false, error: "Range must be 'start-end'" };
  const [startStr, endStr] = parts;
  if (detectFamily(startStr) !== detectFamily(endStr)) {
    return { ok: false, error: "Range endpoints must be the same family" };
  }
  const family = detectFamily(startStr);
  const startParsed = family === "ipv4" ? parseIPv4(startStr) : parseIPv6(startStr);
  if (!startParsed.ok) return { ok: false, error: `Start: ${startParsed.error}` };
  const endParsed = family === "ipv4" ? parseIPv4(endStr) : parseIPv6(endStr);
  if (!endParsed.ok) return { ok: false, error: `End: ${endParsed.error}` };
  const start = startParsed.value;
  const end = endParsed.value;
  if (start > end) return { ok: false, error: "Range start is greater than end" };
  return { ok: true, interval: { family, start, end } };
}

/** Parse a single input line: single IP, CIDR, or dashed range. */
export function parseLine(line: string, index: number): ParsedLine {
  const trimmed = line.trim();
  if (!trimmed) return { line, index, ok: false, error: "Empty line" };
  // Skip comments.
  if (trimmed.startsWith("#") || trimmed.startsWith(";")) {
    return { line, index, ok: false, error: "Comment skipped" };
  }
  // CIDR?
  if (trimmed.includes("/")) {
    const r = parseCidr(trimmed);
    if (!r.ok) return { line, index, ok: false, error: r.error };
    const block = r.block;
    const count = cidrAddressCount(block.prefix, block.family);
    const end = block.network + count - BIG_1;
    return { line, index, ok: true, interval: { family: block.family, start: block.network, end } };
  }
  // Range?
  const dashMatch = trimmed.match(/[^-–\s][\s]*[-–][\s]*[^-–\s]/);
  if (dashMatch && !trimmed.includes(":")) {
    // IPv4 range — must have a dash between two dotted IPs.
    if (/^\d+\.\d+\.\d+\.\d+\s*[-–]\s*\d+\.\d+\.\d+\.\d+$/.test(trimmed)) {
      const r = parseRange(trimmed);
      if (!r.ok) return { line, index, ok: false, error: r.error };
      return { line, index, ok: true, interval: r.interval };
    }
  }
  // IPv6 range with dash (rare but supported).
  if (trimmed.includes(":") && /[-–]/.test(trimmed) && !trimmed.includes("::/")) {
    const parts = trimmed.split(/[-–]/);
    if (parts.length === 2 && parts[0].includes(":") && parts[1].includes(":")) {
      const r = parseRange(trimmed);
      if (!r.ok) return { line, index, ok: false, error: r.error };
      return { line, index, ok: true, interval: r.interval };
    }
  }
  // Bare IP?
  const family = detectFamily(trimmed);
  const parsed = family === "ipv4" ? parseIPv4(trimmed) : parseIPv6(trimmed);
  if (!parsed.ok) return { line, index, ok: false, error: parsed.error };
  return { line, index, ok: true, interval: { family, start: parsed.value, end: parsed.value } };
}

/** Parse a multi-line input block. */
export function parseInput(text: string): { results: ParsedLine[]; intervals: Interval[]; errors: ParsedLine[] } {
  const lines = text.split(/\r?\n/);
  const results: ParsedLine[] = [];
  const intervals: Interval[] = [];
  const errors: ParsedLine[] = [];
  for (let i = 0; i < lines.length; i++) {
    const r = parseLine(lines[i], i + 1);
    results.push(r);
    if (r.ok && r.interval) intervals.push(r.interval);
    else if (!r.ok && r.error !== "Empty line" && r.error !== "Comment skipped") errors.push(r);
  }
  return { results, intervals, errors };
}

// ---------------------------------------------------------------------------
// CIDR ↔ interval conversion
// ---------------------------------------------------------------------------

/** Convert a CIDR block to an inclusive [start, end] interval. */
export function cidrToInterval(block: CidrBlock): Interval {
  const count = cidrAddressCount(block.prefix, block.family);
  return { family: block.family, start: block.network, end: block.network + count - BIG_1 };
}

/** Convert an interval to a minimal list of CIDR blocks (greedy). */
export function intervalToCidrs(interval: Interval): CidrBlock[] {
  const bits = familyBits(interval.family);
  const out: CidrBlock[] = [];
  let start = interval.start;
  const end = interval.end;
  while (start <= end) {
    // Max prefix size such that `start` is aligned (trailing zeros).
    const alignment = trailingZeros(start, bits);
    // Max block size that fits in remaining range.
    const remaining = end - start + BIG_1;
    const maxBits = floorLog2(remaining);
    const size = Math.min(alignment, maxBits);
    const prefix = bits - size;
    out.push({ family: interval.family, network: start, prefix });
    start += BIG_1 << BigInt(size);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Interval merge & subtract
// ---------------------------------------------------------------------------

/** Sort and merge overlapping / adjacent intervals within a family. */
export function mergeIntervals(intervals: Interval[]): Interval[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  const out: Interval[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const last = out[out.length - 1];
    const cur = sorted[i];
    // Adjacent or overlapping (cur.start <= last.end + 1).
    if (cur.start <= last.end + BIG_1) {
      if (cur.end > last.end) last.end = cur.end;
    } else {
      out.push({ ...cur });
    }
  }
  return out;
}

/** Subtract `exclusions` from `intervals` (set difference). Same family assumed. */
export function subtractIntervals(intervals: Interval[], exclusions: Interval[]): Interval[] {
  if (exclusions.length === 0) return intervals;
  const mergedExcl = mergeIntervals(exclusions);
  const out: Interval[] = [];
  for (const iv of intervals) {
    let segments: Interval[] = [{ ...iv }];
    for (const ex of mergedExcl) {
      const next: Interval[] = [];
      for (const seg of segments) {
        // No overlap: seg entirely outside ex.
        if (seg.end < ex.start || seg.start > ex.end) {
          next.push(seg);
          continue;
        }
        // Overlap: split into up to 2 segments.
        if (seg.start < ex.start) {
          next.push({ family: seg.family, start: seg.start, end: ex.start - BIG_1 });
        }
        if (seg.end > ex.end) {
          next.push({ family: seg.family, start: ex.end + BIG_1, end: seg.end });
        }
      }
      segments = next;
    }
    out.push(...segments);
  }
  return out;
}

/** Sum the address count across a list of intervals. */
export function sumIntervalAddresses(intervals: Interval[]): bigint {
  let total = BIG_0;
  for (const iv of intervals) total += iv.end - iv.start + BIG_1;
  return total;
}

/** Convert a list of intervals to a minimal CIDR set (sorted by network). */
export function intervalsToCidrs(intervals: Interval[]): CidrBlock[] {
  const out: CidrBlock[] = [];
  for (const iv of intervals) out.push(...intervalToCidrs(iv));
  out.sort((a, b) => (a.network < b.network ? -1 : a.network > b.network ? 1 : a.prefix - b.prefix));
  return out;
}

// ---------------------------------------------------------------------------
// Main aggregate function
// ---------------------------------------------------------------------------

/**
 * Aggregate a mixed input set, optionally subtracting exclusions.
 * Returns per-family results + global totals.
 */
export function aggregate(input: string, exclusionsInput: string = ""): AggregateResult {
  const parsed = parseInput(input);
  const parsedExcl = parseInput(exclusionsInput);

  const errors = parsed.errors;
  const warnings: string[] = [];
  if (parsedExcl.errors.length > 0) {
    warnings.push(`${parsedExcl.errors.length} exclusion line(s) failed to parse — see errors.`);
  }

  const v4Input = parsed.intervals.filter((iv) => iv.family === "ipv4");
  const v6Input = parsed.intervals.filter((iv) => iv.family === "ipv6");
  const v4Excl = parsedExcl.intervals.filter((iv) => iv.family === "ipv4");
  const v6Excl = parsedExcl.intervals.filter((iv) => iv.family === "ipv6");

  let ipv4: FamilyResult | null = null;
  let ipv6: FamilyResult | null = null;

  if (v4Input.length > 0 || v4Excl.length > 0) {
    ipv4 = buildFamilyResult("ipv4", v4Input, v4Excl);
  }
  if (v6Input.length > 0 || v6Excl.length > 0) {
    ipv6 = buildFamilyResult("ipv6", v6Input, v6Excl);
  }

  const totalInput = v4Input.length + v6Input.length;
  const totalOutput =
    (ipv4 ? ipv4.cidrs.length : 0) + (ipv6 ? ipv6.cidrs.length : 0);
  const inputAddresses =
    (ipv4 ? ipv4.inputAddresses : BIG_0) + (ipv6 ? ipv6.inputAddresses : BIG_0);
  const outputAddresses =
    (ipv4 ? ipv4.outputAddresses : BIG_0) + (ipv6 ? ipv6.outputAddresses : BIG_0);
  const addressesSaved = inputAddresses - outputAddresses;

  const inputPrefixCount =
    (ipv4 ? ipv4.inputCidrs.length : 0) + (ipv6 ? ipv6.inputCidrs.length : 0);
  const prefixesSaved = inputPrefixCount - totalOutput;

  return {
    ipv4, ipv6, errors, warnings,
    totalInput, totalOutput, addressesSaved, prefixesSaved,
  };
}

/** Build a per-family result: merge inputs, subtract exclusions, decompose to CIDRs. */
function buildFamilyResult(family: IpFamily, inputs: Interval[], exclusions: Interval[]): FamilyResult {
  const inputIntervals = inputs;
  // Canonical input CIDRs (after merging just to dedupe).
  const inputMerged = mergeIntervals(inputs);
  const inputCidrs = intervalsToCidrs(inputMerged);
  const inputAddresses = sumIntervalAddresses(inputMerged);

  const mergedInputs = mergeIntervals(inputs);
  const mergedExclusions = mergeIntervals(exclusions);
  const afterExclusion = subtractIntervals(mergedInputs, mergedExclusions);
  const cidrs = intervalsToCidrs(afterExclusion);
  const outputAddresses = sumIntervalAddresses(afterExclusion);
  const excludedAddresses = inputAddresses - outputAddresses;

  return {
    family,
    inputIntervals,
    mergedIntervals: afterExclusion,
    cidrs,
    inputCidrs,
    inputAddresses,
    outputAddresses,
    excludedAddresses,
  };
}

// ---------------------------------------------------------------------------
// Export renderers
// ---------------------------------------------------------------------------

/** Render CIDR list (one per line). */
export function renderCidrList(blocks: CidrBlock[]): string {
  return blocks.map(cidrToString).join("\n");
}

/** Render IP ranges (start-end per line). */
export function renderRangeList(blocks: CidrBlock[]): string {
  const lines: string[] = [];
  for (const b of blocks) {
    const iv = cidrToInterval(b);
    lines.push(`${ipToString(iv.start, b.family)} - ${ipToString(iv.end, b.family)}`);
  }
  return lines.join("\n");
}

/** Render Cisco ACL lines (`access-list NAME permit ip <net> <wildcard> any`). */
export function renderCiscoAcl(blocks: CidrBlock[], aclName = "UNQTOOLS"): string {
  const lines: string[] = [];
  for (const b of blocks) {
    const wc = wildcardValue(b.prefix, b.family);
    if (b.family === "ipv4") {
      lines.push(`access-list ${aclName} permit ip ${ipToString(b.network, b.family)} ${ipv4ToString(wc)} any`);
    } else {
      // Cisco IPv6 ACLs use prefix-length directly.
      lines.push(`ipv6 access-list ${aclName}`);
      lines.push(`  permit ipv6 ${ipToString(b.network, b.family)}/${b.prefix} any`);
    }
  }
  return lines.join("\n");
}

/** Render a pfSense alias body (a network alias — one CIDR per line). */
export function renderPfSenseAlias(blocks: CidrBlock[], aliasName = "unqtools_net"): string {
  const lines: string[] = [];
  lines.push(`<alias><name>${aliasName}</name><type>network</type><address>`);
  lines.push(blocks.map(cidrToString).join(" "));
  lines.push(`</address><detail></detail></alias>`);
  return lines.join("\n");
}

/** Render nginx allow directives. */
export function renderNginxAllow(blocks: CidrBlock[]): string {
  return blocks.map((b) => `allow ${cidrToString(b)};`).join("\n");
}

/** Render by format key. */
export function renderExport(blocks: CidrBlock[], format: ExportFormat, opts: { aclName?: string; aliasName?: string } = {}): string {
  switch (format) {
    case "cidr": return renderCidrList(blocks);
    case "range": return renderRangeList(blocks);
    case "cisco": return renderCiscoAcl(blocks, opts.aclName ?? "UNQTOOLS");
    case "pfsense": return renderPfSenseAlias(blocks, opts.aliasName ?? "unqtools_net");
    case "nginx": return renderNginxAllow(blocks);
  }
}

/** All CIDR blocks from an AggregateResult (IPv4 first, then IPv6). */
export function allCidrs(result: AggregateResult): CidrBlock[] {
  const out: CidrBlock[] = [];
  if (result.ipv4) out.push(...result.ipv4.cidrs);
  if (result.ipv6) out.push(...result.ipv6.cidrs);
  return out;
}

/** Format a BigInt as a decimal string with thousands separators. */
export function formatBig(value: bigint): string {
  const s = value.toString();
  // Insert commas every 3 digits from the right.
  const neg = s.startsWith("-");
  const digits = neg ? s.slice(1) : s;
  const withCommas = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return (neg ? "-" : "") + withCommas;
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:cidr-aggregator-network-summarizer:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  input: string;
  exclusions: string;
  totalInput: number;
  totalOutput: number;
  addressesSaved: string;
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
    } catch { /* ignore */ }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try { localStorage.removeItem(HISTORY_KEY); } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Shareable URL
// ---------------------------------------------------------------------------

export function buildShareUrl(input: string, exclusions: string, format: ExportFormat): string {
  const params = new URLSearchParams();
  if (input) params.set("i", input);
  if (exclusions) params.set("x", exclusions);
  if (format !== "cidr") params.set("f", format);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export interface ShareParams {
  input: string;
  exclusions: string;
  format: ExportFormat;
}

export function parseShareUrl(hash: string): ShareParams {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { input: "", exclusions: "", format: "cidr" };
  const params = new URLSearchParams(clean);
  const input = params.get("i") ?? "";
  const exclusions = params.get("x") ?? "";
  const f = params.get("f") ?? "cidr";
  const format: ExportFormat =
    f === "range" || f === "cisco" || f === "pfsense" || f === "nginx" ? f : "cidr";
  return { input, exclusions, format };
}

// ---------------------------------------------------------------------------
// Sample inputs (presets) for the UI
// ---------------------------------------------------------------------------

export const SAMPLE_INPUTS: { label: string; value: string; exclusions?: string }[] = [
  {
    label: "Overlapping /24s (merge to /23)",
    value: "192.168.0.0/24\n192.168.1.0/24\n192.168.0.50",
  },
  {
    label: "Mixed IPs + ranges + CIDRs",
    value: "10.0.0.1\n10.0.0.5\n10.0.0.0/24\n10.0.1.0/24\n10.0.0.50-10.0.0.60",
  },
  {
    label: "Supernet to /22",
    value: "172.16.0.0/24\n172.16.1.0/24\n172.16.2.0/24\n172.16.3.0/24",
  },
  {
    label: "Exclusion (split a /24 around a /28)",
    value: "192.168.10.0/24",
    exclusions: "192.168.10.16/28",
  },
  {
    label: "IPv6 merge",
    value: "2001:db8::/64\n2001:db8:0:1::/64\n2001:db8::1",
  },
  {
    label: "0.0.0.0/0 (huge range)",
    value: "0.0.0.0/0",
  },
];
