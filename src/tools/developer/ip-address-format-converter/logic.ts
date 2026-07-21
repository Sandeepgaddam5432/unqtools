/**
 * IP Address Format Converter — pure logic.
 *
 * Convert IPv4 between dotted-decimal, 32-bit integer, hex, octal, binary,
 * dotted-hex, dotted-octal and dotted-binary. Convert IPv6 between its
 * 128-bit integer, hex, expanded and RFC 5952 compressed forms. Auto-detect
 * the input format and batch-convert lists.
 *
 * 128-bit math via BigInt — Number can only safely hold 53-bit integers,
 * so every IPv6 value is a BigInt.
 *
 * Pure functions only — no DOM, no network.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** IPv4 input formats supported by auto-detection. */
export type IPv4Format =
  | "dotted-decimal"
  | "decimal"
  | "hex"
  | "octal"
  | "binary"
  | "dotted-hex"
  | "dotted-octal"
  | "dotted-binary";

/** Address family. */
export type AddressFamily = "ipv4" | "ipv6";

/** A successful parse result for any IPv4 input format. */
export interface IPv4ParseOk {
  ok: true;
  octets: [number, number, number, number];
  /** The detected source format. */
  format: IPv4Format;
}

export interface IPv4ParseErr {
  ok: false;
  error: string;
}

export type IPv4ParseResult = IPv4ParseOk | IPv4ParseErr;

/** All representations of a single IPv4 address. */
export interface IPv4AllFormats {
  dottedDecimal: string;
  decimal: string;
  hex: string;
  hexNoPrefix: string;
  octal: string;
  binary: string;
  binaryNoPrefix: string;
  dottedHex: string;
  dottedOctal: string;
  dottedBinary: string;
  /** Per-octet breakdown (decimal/hex/binary/octal). */
  octets: OctetBreakdown[];
}

/** Per-octet breakdown. */
export interface OctetBreakdown {
  index: number;
  decimal: number;
  hex: string;
  binary: string;
  octal: string;
}

/** A successful parse result for an IPv6 input. */
export interface IPv6ParseOk {
  ok: true;
  /** Eight 16-bit hextets, MSB first. */
  hextets: [number, number, number, number, number, number, number, number];
  /** 128-bit BigInt value (unsigned). */
  value: bigint;
}

export interface IPv6ParseErr {
  ok: false;
  error: string;
}

export type IPv6ParseResult = IPv6ParseOk | IPv6ParseErr;

/** All representations of a single IPv6 address. */
export interface IPv6AllFormats {
  compressed: string;
  expanded: string;
  /** Full 128-bit hex, no separators, no 0x. */
  hex: string;
  /** Full 128-bit decimal integer (BigInt as string). */
  decimal: string;
  /** 128-bit binary string. */
  binary: string;
}

/** One row in a batch conversion. */
export interface BatchRow {
  input: string;
  ok: boolean;
  family?: AddressFamily;
  format?: IPv4Format;
  error?: string;
  ipv4?: IPv4AllFormats;
  ipv6?: IPv6AllFormats;
}

export interface BatchResult {
  rows: BatchRow[];
  total: number;
  okCount: number;
  errCount: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const FORMAT_LABELS: Record<IPv4Format, string> = {
  "dotted-decimal": "Dotted decimal",
  "decimal": "32-bit integer (decimal)",
  "hex": "Hexadecimal (0x)",
  "octal": "Octal (0…)",
  "binary": "Binary (0b)",
  "dotted-hex": "Dotted hex (0xC0.0xA8.0.1)",
  "dotted-octal": "Dotted octal (0300.0250.0.1)",
  "dotted-binary": "Dotted binary (11000000.…)",
};

export const FAMILY_LABELS: Record<AddressFamily, string> = {
  ipv4: "IPv4",
  ipv6: "IPv6",
};

/** Sample addresses the user can click to load. */
export const IP_PRESETS: string[] = [
  "192.168.0.1",
  "10.0.0.1",
  "172.16.254.1",
  "8.8.8.8",
  "255.255.255.255",
  "0.0.0.0",
  "0xC0A80001",
  "3232235521",
  "2001:db8::1",
  "::ffff:192.0.2.1",
  "fe80::1",
  "::1",
];

export const BIG_0 = BigInt(0);
export const BIG_1 = BigInt(1);
export const BIG_128 = BigInt(128);
export const BIG_FFFF = BigInt(0xffff);
export const MAX_UINT32 = 0xffffffff; // 4294967295

// ---------------------------------------------------------------------------
// IPv4 octet formatting
// ---------------------------------------------------------------------------

/** Format a single octet (0–255) as 2-digit hex. */
export function octetToHex(o: number): string {
  if (o < 0 || o > 255) throw new Error(`Octet out of range: ${o}`);
  return o.toString(16).padStart(2, "0");
}

/** Format a single octet (0–255) as 8-bit binary. */
export function octetToBinary(o: number): string {
  if (o < 0 || o > 255) throw new Error(`Octet out of range: ${o}`);
  return o.toString(2).padStart(8, "0");
}

/** Format a single octet (0–255) as 3-digit octal. */
export function octetToOctal(o: number): string {
  if (o < 0 || o > 255) throw new Error(`Octet out of range: ${o}`);
  return o.toString(8).padStart(3, "0");
}

/** Build the per-octet breakdown table for an IPv4 address. */
export function buildOctetBreakdown(octets: readonly number[]): OctetBreakdown[] {
  return octets.map((o, i) => ({
    index: i,
    decimal: o,
    hex: octetToHex(o),
    binary: octetToBinary(o),
    octal: octetToOctal(o),
  }));
}

// ---------------------------------------------------------------------------
// IPv4 octets → all formats
// ---------------------------------------------------------------------------

/** Build every representation of an IPv4 address from its octets. */
export function formatIPv4All(octets: readonly number[]): IPv4AllFormats {
  if (octets.length !== 4) throw new Error("IPv4 requires 4 octets");
  for (const o of octets) {
    if (o < 0 || o > 255) throw new Error(`Octet out of range: ${o}`);
  }
  const [a, b, c, d] = octets;
  const integer = (a * 16777216) + (b * 65536) + (c * 256) + d;
  return {
    dottedDecimal: `${a}.${b}.${c}.${d}`,
    decimal: String(integer),
    hex: `0x${integer.toString(16).padStart(8, "0").toUpperCase()}`,
    hexNoPrefix: integer.toString(16).padStart(8, "0").toUpperCase(),
    octal: `0${integer.toString(8)}`,
    binary: `0b${integer.toString(2).padStart(32, "0")}`,
    binaryNoPrefix: integer.toString(2).padStart(32, "0"),
    dottedHex: octets.map((o) => `0x${octetToHex(o).toUpperCase()}`).join("."),
    dottedOctal: octets.map((o) => `0${o.toString(8).padStart(3, "0")}`).join("."),
    dottedBinary: octets.map((o) => octetToBinary(o)).join("."),
    octets: buildOctetBreakdown(octets),
  };
}

// ---------------------------------------------------------------------------
// IPv4 single-integer → octets
// ---------------------------------------------------------------------------

/** Convert a 32-bit decimal integer to IPv4 octets. */
export function integerToIPv4(n: number): [number, number, number, number] {
  if (!Number.isFinite(n) || n < 0 || n > MAX_UINT32) {
    throw new Error(`Integer out of range (0–${MAX_UINT32}): ${n}`);
  }
  return [
    (n >>> 24) & 0xff,
    (n >>> 16) & 0xff,
    (n >>> 8) & 0xff,
    n & 0xff,
  ];
}

/** Convert a 32-bit hex string (with or without 0x) to IPv4 octets. */
export function hexToIPv4(s: string): [number, number, number, number] {
  const cleaned = s.trim().toLowerCase().replace(/^0x/, "");
  if (!/^[0-9a-f]+$/.test(cleaned)) {
    throw new Error(`Invalid hex: "${s}"`);
  }
  const n = Number.parseInt(cleaned, 16);
  if (!Number.isFinite(n) || n < 0 || n > MAX_UINT32) {
    throw new Error(`Hex out of range (0–0xFFFFFFFF): "${s}"`);
  }
  return integerToIPv4(n);
}

/** Convert a 32-bit octal string (with or without leading 0) to IPv4 octets. */
export function octalToIPv4(s: string): [number, number, number, number] {
  const cleaned = s.trim().replace(/^0(?=[0-7])/, "");
  if (!/^[0-7]+$/.test(cleaned)) {
    throw new Error(`Invalid octal: "${s}"`);
  }
  const n = Number.parseInt(cleaned, 8);
  if (!Number.isFinite(n) || n < 0 || n > MAX_UINT32) {
    throw new Error(`Octal out of range (0–037777777777): "${s}"`);
  }
  return integerToIPv4(n);
}

/** Convert a 32-bit binary string (with or without 0b) to IPv4 octets. */
export function binaryToIPv4(s: string): [number, number, number, number] {
  const cleaned = s.trim().replace(/^0b/i, "");
  if (!/^[01]+$/.test(cleaned)) {
    throw new Error(`Invalid binary: "${s}"`);
  }
  if (cleaned.length > 32) {
    throw new Error(`Binary too long (>32 bits): "${s}"`);
  }
  const n = Number.parseInt(cleaned, 2);
  if (!Number.isFinite(n) || n < 0 || n > MAX_UINT32) {
    throw new Error(`Binary out of range (0–0b11111111111111111111111111111111): "${s}"`);
  }
  return integerToIPv4(n);
}

// ---------------------------------------------------------------------------
// IPv4 dotted → octets
// ---------------------------------------------------------------------------

/** Parse dotted-decimal "a.b.c.d" → octets. */
export function dottedDecimalToIPv4(s: string): [number, number, number, number] {
  const parts = s.trim().split(".");
  if (parts.length !== 4) throw new Error(`Dotted-decimal needs 4 octets: "${s}"`);
  const out: number[] = [];
  for (const p of parts) {
    if (!/^\d+$/.test(p)) throw new Error(`Invalid decimal octet "${p}"`);
    const n = Number.parseInt(p, 10);
    if (n < 0 || n > 255) throw new Error(`Octet out of range (0–255): "${p}"`);
    out.push(n);
  }
  return out as [number, number, number, number];
}

/** Parse dotted-hex "0xC0.0xA8.0x00.0x01" or "C0.A8.0.1" → octets. */
export function dottedHexToIPv4(s: string): [number, number, number, number] {
  const parts = s.trim().split(".");
  if (parts.length !== 4) throw new Error(`Dotted-hex needs 4 octets: "${s}"`);
  const out: number[] = [];
  for (const p of parts) {
    const cleaned = p.trim().toLowerCase().replace(/^0x/, "");
    if (!/^[0-9a-f]{1,2}$/.test(cleaned)) {
      throw new Error(`Invalid hex octet "${p}" (1–2 hex digits)`);
    }
    const n = Number.parseInt(cleaned, 16);
    if (n < 0 || n > 255) throw new Error(`Hex octet out of range (0–0xFF): "${p}"`);
    out.push(n);
  }
  return out as [number, number, number, number];
}

/** Parse dotted-octal "0300.0250.0.01" → octets. */
export function dottedOctalToIPv4(s: string): [number, number, number, number] {
  const parts = s.trim().split(".");
  if (parts.length !== 4) throw new Error(`Dotted-octal needs 4 octets: "${s}"`);
  const out: number[] = [];
  for (const p of parts) {
    const cleaned = p.trim().replace(/^0(?=[0-7])/, "");
    if (!/^[0-7]{1,3}$/.test(cleaned)) {
      throw new Error(`Invalid octal octet "${p}" (1–3 octal digits)`);
    }
    const n = Number.parseInt(cleaned, 8);
    if (n < 0 || n > 255) throw new Error(`Octal octet out of range (0–0377): "${p}"`);
    out.push(n);
  }
  return out as [number, number, number, number];
}

/** Parse dotted-binary "11000000.10101000.00000000.00000001" → octets. */
export function dottedBinaryToIPv4(s: string): [number, number, number, number] {
  const parts = s.trim().split(".");
  if (parts.length !== 4) throw new Error(`Dotted-binary needs 4 octets: "${s}"`);
  const out: number[] = [];
  for (const p of parts) {
    const cleaned = p.trim().replace(/^0b/i, "");
    if (!/^[01]{1,8}$/.test(cleaned)) {
      throw new Error(`Invalid binary octet "${p}" (1–8 bits)`);
    }
    const n = Number.parseInt(cleaned, 2);
    if (n < 0 || n > 255) throw new Error(`Binary octet out of range (0–0b11111111): "${p}"`);
    out.push(n);
  }
  return out as [number, number, number, number];
}

// ---------------------------------------------------------------------------
// IPv4 auto-detect
// ---------------------------------------------------------------------------

/**
 * Auto-detect the format of an IPv4 input and parse it into octets.
 *
 * Detection rules (first match wins):
 *  - Contains '.' → dotted form:
 *      - any part has 0x → dotted-hex (mixed 0xC0.0xA8.0.1 supported)
 *      - any part has 0b OR all parts are 8 binary digits → dotted-binary
 *      - all parts are decimal octets (no leading zero) → dotted-decimal
 *      - all parts match octal octet regex → dotted-octal
 *  - No '.' → single integer:
 *      - 0x prefix → hex
 *      - 0b prefix → binary
 *      - leading 0 (multi-digit) → octal
 *      - all decimal digits → decimal
 *      - all hex digits with at least one letter → hex (bare-hex fallback)
 */
export function parseIPv4Auto(input: string): IPv4ParseResult {
  const s = (input ?? "").trim();
  if (!s) return { ok: false, error: "Empty input" };
  if (s.length > 64) return { ok: false, error: "Input too long" };

  try {
    if (s.includes(".")) {
      // Dotted form — detect the dotted variant.
      const parts = s.split(".");
      if (parts.length !== 4) {
        return { ok: false, error: `Dotted IPv4 needs 4 octets, got ${parts.length}` };
      }
      const tp = parts.map((p) => p.trim());
      const any0x = tp.some((p) => /^0x[0-9a-fA-F]+$/i.test(p));
      const any0b = tp.some((p) => /^0b[01]+$/i.test(p));
      const allBinary8 = tp.every((p) => /^[01]{8}$/.test(p));
      const allDecimal = tp.every((p) => /^(0|[1-9]\d{0,2})$/.test(p));
      const allOctal = tp.every((p) => /^(0|0[0-7]+)$/.test(p));
      if (any0x) {
        return { ok: true, octets: dottedHexToIPv4(s), format: "dotted-hex" };
      }
      if (any0b || allBinary8) {
        return { ok: true, octets: dottedBinaryToIPv4(s), format: "dotted-binary" };
      }
      if (allDecimal) {
        return { ok: true, octets: dottedDecimalToIPv4(s), format: "dotted-decimal" };
      }
      if (allOctal) {
        return { ok: true, octets: dottedOctalToIPv4(s), format: "dotted-octal" };
      }
      return { ok: false, error: `Unrecognized dotted IPv4 format: "${s}"` };
    }

    // Single-integer form.
    if (/^0x[0-9a-fA-F]+$/i.test(s)) {
      return { ok: true, octets: hexToIPv4(s), format: "hex" };
    }
    if (/^0b[01]+$/i.test(s)) {
      return { ok: true, octets: binaryToIPv4(s), format: "binary" };
    }
    if (/^0[0-7]+$/.test(s)) {
      return { ok: true, octets: octalToIPv4(s), format: "octal" };
    }
    if (/^\d+$/.test(s)) {
      const n = Number.parseInt(s, 10);
      if (!Number.isFinite(n) || n < 0 || n > MAX_UINT32) {
        return { ok: false, error: `Integer out of range (0–${MAX_UINT32}): ${s}` };
      }
      return { ok: true, octets: integerToIPv4(n), format: "decimal" };
    }
    // Bare hex fallback: 1–8 hex digits with at least one letter (so it is
    // unambiguously hex and not decimal).
    if (/^[0-9a-fA-F]{1,8}$/.test(s) && /[a-fA-F]/.test(s)) {
      return { ok: true, octets: hexToIPv4(s), format: "hex" };
    }
    return { ok: false, error: `Unrecognized IPv4 format: "${s}"` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Convenience: parse + format in one step. */
export function convertIPv4(input: string): IPv4ParseResult & { all?: IPv4AllFormats } {
  const r = parseIPv4Auto(input);
  if (!r.ok) return r;
  return { ...r, all: formatIPv4All(r.octets) };
}

// ---------------------------------------------------------------------------
// IPv6 parsing (shared with subnet calculator's approach, pure here)
// ---------------------------------------------------------------------------

/**
 * Parse an IPv6 address string into hextets + BigInt value.
 *
 * Accepts full 8-hextet form, compressed '::' form, embedded IPv4 in the
 * last 32 bits (::ffff:192.0.2.1), loopback ::1 and unspecified ::.
 */
export function parseIPv6(input: string): IPv6ParseResult {
  const trimmed = (input ?? "").trim();
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

  // Detect embedded IPv4 in the last 32 bits.
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

  let leftParts: string[] = [];
  let rightParts: string[] = [];
  if (hasDoubleColon) {
    const idx = core.indexOf("::");
    leftParts = core.slice(0, idx) ? core.slice(0, idx).split(":") : [];
    rightParts = core.slice(idx + 2) ? core.slice(idx + 2).split(":") : [];
  } else {
    leftParts = core.split(":");
  }
  if (leftParts.length === 1 && leftParts[0] === "") leftParts = [];
  if (rightParts.length === 1 && rightParts[0] === "") rightParts = [];

  for (const h of [...leftParts, ...rightParts]) {
    if (h === "") return { ok: false, error: "Empty hextet" };
    if (!/^[0-9a-f]{1,4}$/.test(h)) {
      return { ok: false, error: `Invalid hextet "${h}" (1–4 hex digits)` };
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
      return { ok: false, error: "Embedded IPv4 needs '::' or 6 leading hextets" };
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
      return { ok: false, error: `Expected 8 hextets, got ${totalLeading} (use '::')` };
    }
    for (const h of leftParts) hextets.push(Number.parseInt(h, 16));
    for (let i = 0; i < needed; i++) hextets.push(0);
    for (const h of rightParts) hextets.push(Number.parseInt(h, 16));
  }

  if (hextets.length !== 8) {
    return { ok: false, error: `Resolved to ${hextets.length} hextets, expected 8` };
  }
  for (const h of hextets) {
    if (h < 0 || h > 0xffff) {
      return { ok: false, error: "Hextet out of range (0–ffff)" };
    }
  }

  let value = BIG_0;
  for (let i = 0; i < 8; i++) {
    value = (value << BigInt(16)) | BigInt(hextets[i]);
  }

  return {
    ok: true,
    hextets: hextets as [number, number, number, number, number, number, number, number],
    value,
  };
}

/** Convert a 128-bit BigInt value into eight 16-bit hextets (MSB first). */
export function valueToHextets(value: bigint): [number, number, number, number, number, number, number, number] {
  const out: number[] = [];
  let v = value & ((BIG_1 << BIG_128) - BIG_1);
  for (let i = 7; i >= 0; i--) {
    out[i] = Number(v & BIG_FFFF);
    v >>= BigInt(16);
  }
  return out as [number, number, number, number, number, number, number, number];
}

/** Format hextets as the expanded form (8 hextets, 4 hex digits each). */
export function expandHextets(hextets: readonly number[]): string {
  return hextets.map((h) => h.toString(16).padStart(4, "0")).join(":");
}

/** Format hextets as the RFC 5952 canonical compressed form. */
export function compressHextets(hextets: readonly number[]): string {
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

/** Format a 128-bit BigInt as a 128-character binary string (MSB first). */
export function ipv6ToBinary(value: bigint): string {
  let v = value & ((BIG_1 << BIG_128) - BIG_1);
  if (v === BIG_0) return "0".repeat(128);
  let bits = v.toString(2);
  if (bits.length < 128) bits = "0".repeat(128 - bits.length) + bits;
  return bits;
}

/** Build every representation of an IPv6 address from its hextets + value. */
export function formatIPv6All(hextets: readonly number[], value: bigint): IPv6AllFormats {
  return {
    compressed: compressHextets(hextets),
    expanded: expandHextets(hextets),
    hex: value.toString(16).padStart(32, "0"),
    decimal: value.toString(10),
    binary: ipv6ToBinary(value),
  };
}

/** Convenience: parse + format IPv6 in one step. */
export function convertIPv6(input: string): IPv6ParseResult & { all?: IPv6AllFormats } {
  const r = parseIPv6(input);
  if (!r.ok) return r;
  return { ...r, all: formatIPv6All(r.hextets, r.value) };
}

// ---------------------------------------------------------------------------
// Dispatch: any input → IPv4 or IPv6
// ---------------------------------------------------------------------------

/** Decide whether an input is IPv4 or IPv6 and convert. */
export function convertAny(input: string): BatchRow {
  const trimmed = (input ?? "").trim();
  if (!trimmed) {
    return { input: trimmed, ok: false, error: "Empty input" };
  }
  // IPv6 if it contains ':' OR it's an embedded-IPv4 trailing form.
  if (trimmed.includes(":")) {
    const r = convertIPv6(trimmed);
    if (!r.ok) return { input: trimmed, ok: false, error: r.error };
    return { input: trimmed, ok: true, family: "ipv6", ipv6: r.all };
  }
  // IPv4 otherwise.
  const r = convertIPv4(trimmed);
  if (!r.ok) return { input: trimmed, ok: false, error: r.error };
  return { input: trimmed, ok: true, family: "ipv4", format: r.format, ipv4: r.all };
}

// ---------------------------------------------------------------------------
// Batch
// ---------------------------------------------------------------------------

/** Split a batch input (newline OR comma separated). */
export function parseBatchInput(input: string): string[] {
  if (!input) return [];
  return input
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Convert a list of addresses. */
export function batchConvert(list: string[]): BatchResult {
  const rows: BatchRow[] = list.map((s) => convertAny(s));
  return {
    rows,
    total: rows.length,
    okCount: rows.filter((r) => r.ok).length,
    errCount: rows.filter((r) => !r.ok).length,
  };
}

/** Render batch rows as CSV. */
export function renderBatchCsv(result: BatchResult): string {
  const headers = ["input", "family", "format", "dotted_decimal", "decimal", "hex", "octal", "binary", "dotted_hex", "dotted_octal", "dotted_binary", "ipv6_compressed", "ipv6_expanded", "ipv6_hex", "ipv6_decimal", "error"];
  const lines = [headers.join(",")];
  for (const r of result.rows) {
    const v4 = r.ipv4;
    const v6 = r.ipv6;
    lines.push([
      escapeCsv(r.input),
      r.family ?? "",
      r.format ?? "",
      v4 ? escapeCsv(v4.dottedDecimal) : "",
      v4 ? escapeCsv(v4.decimal) : "",
      v4 ? escapeCsv(v4.hex) : "",
      v4 ? escapeCsv(v4.octal) : "",
      v4 ? escapeCsv(v4.binary) : "",
      v4 ? escapeCsv(v4.dottedHex) : "",
      v4 ? escapeCsv(v4.dottedOctal) : "",
      v4 ? escapeCsv(v4.dottedBinary) : "",
      v6 ? escapeCsv(v6.compressed) : "",
      v6 ? escapeCsv(v6.expanded) : "",
      v6 ? escapeCsv(v6.hex) : "",
      v6 ? escapeCsv(v6.decimal) : "",
      r.error ? escapeCsv(r.error) : "",
    ].join(","));
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

const HISTORY_KEY = "unqtools:ip-address-format-converter:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  input: string;
  family?: AddressFamily;
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

export interface ShareParams {
  input: string;
  batch: string;
}

export function buildShareUrl(input: string, batch: string): string {
  const params = new URLSearchParams();
  if (input) params.set("i", input);
  if (batch) params.set("b", batch);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareParams {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { input: "", batch: "" };
  const params = new URLSearchParams(clean);
  return {
    input: params.get("i") ?? "",
    batch: params.get("b") ?? "",
  };
}
