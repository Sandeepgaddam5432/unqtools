/**
 * Subnet CIDR Merger — pure logic.
 * Merge multiple CIDR blocks into the minimal set of summarized ranges.
 * No DOM, no side effects.
 */

export interface MergedRange {
  cidr: string;
  start: string;
  end: string;
  count: number;
}

function ipToInt(ip: string): number {
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

function prefixToMaskInt(prefix: number): number {
  if (prefix === 0) return 0;
  return (0xffffffff << (32 - prefix)) >>> 0;
}

export interface ParseError {
  ok: false;
  error: string;
  input: string;
}

export interface ParseOk {
  ok: true;
  cidr: string;
  start: number;
  end: number;
  prefix: number;
}

export type ParseResult = ParseOk | ParseError;

/** Parse a single CIDR like 192.168.1.0/24 into a numeric range. */
export function parseCidr(input: string): ParseResult {
  const trimmed = (input || "").trim();
  if (!trimmed.includes("/")) {
    return { ok: false, input, error: `Missing /prefix in "${trimmed}".` };
  }
  const [ipPart, prefixPart] = trimmed.split("/");
  const ip = ipToInt(ipPart);
  if (ip === -1) return { ok: false, input, error: `Invalid IP "${ipPart}".` };
  const prefix = parseInt(prefixPart, 10);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    return { ok: false, input, error: `Invalid prefix "${prefixPart}".` };
  }
  const mask = prefixToMaskInt(prefix);
  const start = (ip & mask) >>> 0;
  const end = (start | (~mask >>> 0)) >>> 0;
  return { ok: true, cidr: `${intToIp(start)}/${prefix}`, start, end, prefix };
}

/** Convert an arbitrary numeric range into the minimal CIDR list. */
export function rangeToCidrs(start: number, end: number): string[] {
  const cidrs: string[] = [];
  let s = start >>> 0;
  const e = end >>> 0;
  while (s <= e) {
    // max block aligned at s that doesn't overshoot e
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

export interface MergeResult {
  ranges: MergedRange[];
  errors: ParseError[];
  inputCount: number;
  uniqueCount: number;
}

/** Merge multiple CIDRs into summarized ranges. Pure. */
export function mergeCidrs(inputs: string[]): MergeResult {
  const errors: ParseError[] = [];
  const ranges: Array<{ start: number; end: number }> = [];
  for (const raw of inputs) {
    const trimmed = (raw || "").trim();
    if (!trimmed) continue;
    const parsed = parseCidr(trimmed);
    if (parsed.ok) {
      ranges.push({ start: parsed.start, end: parsed.end });
    } else {
      errors.push(parsed);
    }
  }
  ranges.sort((a, b) => a.start - b.start);
  const merged: Array<{ start: number; end: number }> = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r.start <= last.end + 1) {
      last.end = Math.max(last.end, r.end);
    } else {
      merged.push({ start: r.start, end: r.end });
    }
  }
  const out: MergedRange[] = merged.map((r) => {
    const cidrList = rangeToCidrs(r.start, r.end);
    return {
      cidr: cidrList.join(", "),
      start: intToIp(r.start),
      end: intToIp(r.end),
      count: r.end - r.start + 1,
    };
  });
  return {
    ranges: out,
    errors,
    inputCount: inputs.length,
    uniqueCount: merged.length,
  };
}
