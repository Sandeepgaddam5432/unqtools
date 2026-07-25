/**
 * IPv4 Range Splitter — pure logic.
 * Convert an IP range (start - end) into a minimal list of CIDR blocks.
 * Pure functions only; no DOM access.
 */

function ipToInt(ip: string): number {
  if (typeof ip !== "string") return -1;
  const parts = ip.trim().split(".");
  if (parts.length !== 4) return -1;
  let r = 0;
  for (const p of parts) {
    if (!/^\d+$/.test(p)) return -1;
    const n = parseInt(p, 10);
    if (n < 0 || n > 255) return -1;
    r = (r * 256 + n) >>> 0;
  }
  return r >>> 0;
}

function intToIp(n: number): string {
  n = n >>> 0;
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff].join(".");
}

export interface SplitResult {
  cidrs: string[];
  start: string;
  end: string;
  count: number;
  blockCount: number;
  isValid: boolean;
  error?: string;
}

/** Split a "start - end" or "start end" range into a minimal CIDR list. */
export function splitRange(rangeInput: string): SplitResult {
  const trimmed = (rangeInput || "").trim();
  if (!trimmed) {
    return { cidrs: [], start: "", end: "", count: 0, blockCount: 0, isValid: false, error: "Empty input." };
  }
  const parts = trimmed.split(/[\s,\-]+/).map((s) => s.trim()).filter(Boolean);
  if (parts.length !== 2) {
    return { cidrs: [], start: "", end: "", count: 0, blockCount: 0, isValid: false, error: "Use format: start end (e.g. 192.168.1.0 192.168.1.255)." };
  }
  return splitStartEnd(parts[0], parts[1]);
}

export function splitStartEnd(startIp: string, endIp: string): SplitResult {
  const start = ipToInt(startIp);
  const end = ipToInt(endIp);
  if (start === -1) {
    return { cidrs: [], start: "", end: "", count: 0, blockCount: 0, isValid: false, error: `Invalid start IP "${startIp}".` };
  }
  if (end === -1) {
    return { cidrs: [], start: "", end: "", count: 0, blockCount: 0, isValid: false, error: `Invalid end IP "${endIp}".` };
  }
  if (start > end) {
    return { cidrs: [], start: "", end: "", count: 0, blockCount: 0, isValid: false, error: "Start IP must be <= end IP." };
  }
  const cidrs = rangeToCidrList(start, end);
  return {
    cidrs,
    start: intToIp(start),
    end: intToIp(end),
    count: end - start + 1,
    blockCount: cidrs.length,
    isValid: true,
  };
}

/** Greedy algorithm: emit the largest aligned block that fits. */
export function rangeToCidrList(start: number, end: number): string[] {
  const cidrs: string[] = [];
  let s = start >>> 0;
  const e = end >>> 0;
  while (s <= e) {
    // max size aligned at s, not exceeding e
    const maxByEnd = Math.floor(Math.log2(e - s + 1));
    let bits = 0;
    while (bits < 32 && (s & (1 << bits)) === 0 && bits < maxByEnd) bits++;
    const prefix = 32 - bits;
    const blockSize = 1 << bits;
    cidrs.push(`${intToIp(s)}/${prefix}`);
    s = s + blockSize;
  }
  return cidrs;
}

/** Summarize: total address count, smallest/largest block. */
export function summarizeSplit(result: SplitResult): {
  smallestPrefix: number;
  largestPrefix: number;
  totalAddresses: number;
} {
  if (!result.isValid || result.cidrs.length === 0) {
    return { smallestPrefix: 0, largestPrefix: 0, totalAddresses: 0 };
  }
  const prefixes = result.cidrs.map((c) => parseInt(c.split("/")[1], 10));
  return {
    smallestPrefix: Math.min(...prefixes),
    largestPrefix: Math.max(...prefixes),
    totalAddresses: result.count,
  };
}
