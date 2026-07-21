/**
 * IPv6 Address Expander / Compressor & Validator — pure logic.
 *
 * Expand a compressed IPv6 address to its full 128-bit form, compress a full
 * address to its RFC 5952 canonical short form, validate it, explain which
 * rules were applied, list every valid representation, classify the address
 * type, and batch-process lists. Embedded IPv4 and zone IDs handled.
 *
 * 128-bit math via BigInt — Number can only safely hold 53-bit integers.
 *
 * Pure functions only — no DOM, no network.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Eight 16-bit hextets, MSB first. */
type Hextets = [number, number, number, number, number, number, number, number];

export interface IPv6Address {
  hextets: Hextets;
  /** 128-bit BigInt value (unsigned). */
  value: bigint;
  /** Original input (trimmed, before zone-ID strip). */
  input: string;
  /** Zone ID (after '%') if present, without the percent sign. */
  zoneId: string | null;
  /** True if the input contained an embedded IPv4 in the last 32 bits. */
  hadEmbeddedV4: boolean;
}

export interface IPv6ParseOk {
  ok: true;
  address: IPv6Address;
}

export interface IPv6ParseErr {
  ok: false;
  error: string;
}

export type IPv6ParseResult = IPv6ParseOk | IPv6ParseErr;

/** Address type classification. */
export type AddressType =
  | "unspecified"
  | "loopback"
  | "ipv4-mapped"
  | "ipv4-compatible"
  | "link-local"
  | "ula" // Unique-Local Address (fc00::/7)
  | "multicast"
  | "global"
  | "documentation" // 2001:db8::/32
  | "discard"; // 100::/64

/** A rule that was applied during expansion or compression. */
export interface RuleExplanation {
  rule: string;
  description: string;
}

/** The result of validating an IPv6 address. */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  rules: RuleExplanation[];
  address?: IPv6Address;
  expanded?: string;
  compressed?: string;
  type?: AddressType;
  representations?: string[];
}

/** The result of expanding an IPv6 address. */
export interface ExpansionResult {
  ok: boolean;
  input: string;
  expanded?: string;
  rules: RuleExplanation[];
  error?: string;
  address?: IPv6Address;
}

/** The result of compressing an IPv6 address. */
export interface CompressionResult {
  ok: boolean;
  input: string;
  compressed?: string;
  rules: RuleExplanation[];
  error?: string;
  address?: IPv6Address;
  /** The hextet indices where '::' was placed, or null if not compressed. */
  runStart?: number | null;
  runLength?: number;
}

/** One row in a batch result. */
export interface BatchRow {
  input: string;
  ok: boolean;
  error?: string;
  expanded?: string;
  compressed?: string;
  type?: AddressType;
  valid: boolean;
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

export const BIG_0 = BigInt(0);
export const BIG_1 = BigInt(1);
export const BIG_FFFF = BigInt(0xffff);

export const ADDRESS_TYPE_LABELS: Record<AddressType, string> = {
  "unspecified": "Unspecified (::)",
  "loopback": "Loopback (::1)",
  "ipv4-mapped": "IPv4-mapped (::ffff:a.b.c.d)",
  "ipv4-compatible": "IPv4-compatible (::a.b.c.d, deprecated)",
  "link-local": "Link-local (fe80::/10)",
  "ula": "Unique-Local (fc00::/7)",
  "multicast": "Multicast (ff00::/8)",
  "global": "Global unicast",
  "documentation": "Documentation (2001:db8::/32)",
  "discard": "Discard-only (100::/64)",
};

export const ADDRESS_TYPE_COLORS: Record<AddressType, string> = {
  "unspecified": "muted",
  "loopback": "secondary",
  "ipv4-mapped": "secondary",
  "ipv4-compatible": "outline",
  "link-local": "secondary",
  "ula": "secondary",
  "multicast": "secondary",
  "global": "default",
  "documentation": "outline",
  "discard": "outline",
};

export const RULE_LABELS = {
  lowercase: "Lowercase hex",
  leadingZeros: "Leading-zero removal",
  doubleColon: "'::' compression",
  embeddedV4: "Embedded IPv4 conversion",
  zoneId: "Zone ID stripped",
  noSingleZero: "No '::' for a single zero hextet",
  longestRun: "Longest zero run selected",
  leftmostTie: "Leftmost run chosen on tie",
} as const;

export const IPV6_PRESETS: string[] = [
  "2001:db8::1",
  "2001:0db8:0000:0000:0000:0000:0000:0001",
  "::1",
  "::",
  "fe80::1",
  "ff02::1",
  "fc00::1",
  "::ffff:192.0.2.1",
  "2001:db8:85a3::8a2e:370:7334",
  "fd00:dead:beef::1%eth0",
];

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/**
 * Parse an IPv6 address string into an address object.
 *
 * Accepts:
 *  - Full 8-hextet form: "2001:0db8:0000:0000:0000:0000:0000:0001"
 *  - Compressed form with '::': "2001:db8::1"
 *  - Embedded IPv4 in last 32 bits: "::ffff:192.0.2.1"
 *  - Zone IDs: "fe80::1%eth0"
 *  - Loopback "::1", unspecified "::".
 */
export function parseIPv6(input: string): IPv6ParseResult {
  const trimmed = (input ?? "").trim();
  if (!trimmed) return { ok: false, error: "Empty IPv6 address" };

  // Strip and remember a zone ID (%eth0) at the end.
  let zoneId: string | null = null;
  let core = trimmed;
  const percentIdx = trimmed.lastIndexOf("%");
  if (percentIdx !== -1) {
    const tail = trimmed.slice(percentIdx + 1);
    if (/^[A-Za-z0-9._-]+$/.test(tail)) {
      zoneId = tail;
      core = trimmed.slice(0, percentIdx);
    } else {
      return { ok: false, error: `Invalid zone ID "%${tail}"` };
    }
  }

  if (!core) return { ok: false, error: "Empty address (only zone ID)" };
  if (core.length > 48) return { ok: false, error: "IPv6 address too long" };
  if (!/^[0-9a-fA-F:.]+$/.test(core)) {
    return { ok: false, error: "Invalid character in IPv6 address" };
  }
  const doubleColonCount = (core.match(/::/g) ?? []).length;
  if (doubleColonCount > 1) {
    return { ok: false, error: "Multiple '::' sequences in IPv6 address" };
  }
  const hasDoubleColon = core.includes("::");
  const lower = core.toLowerCase();

  // Detect embedded IPv4 in the last 32 bits.
  let embeddedV4: [number, number, number, number] | null = null;
  let hextetsCore = lower;
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
      hextetsCore = lower.slice(0, lastColon);
    }
  }

  let leftParts: string[] = [];
  let rightParts: string[] = [];
  if (hasDoubleColon) {
    const idx = hextetsCore.indexOf("::");
    const leftStr = hextetsCore.slice(0, idx);
    const rightStr = hextetsCore.slice(idx + 2);
    leftParts = leftStr ? leftStr.split(":") : [];
    rightParts = rightStr ? rightStr.split(":") : [];
  } else {
    leftParts = hextetsCore.split(":");
  }
  if (leftParts.length === 1 && leftParts[0] === "") leftParts = [];
  if (rightParts.length === 1 && rightParts[0] === "") rightParts = [];

  for (const h of [...leftParts, ...rightParts]) {
    if (h === "") return { ok: false, error: "Empty hextet (consecutive '::')" };
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
    address: {
      hextets: hextets as Hextets,
      value,
      input: trimmed,
      zoneId,
      hadEmbeddedV4: embeddedV4 !== null,
    },
  };
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/** Format hextets as the expanded form (8 hextets, 4 hex digits each). */
export function expandHextets(hextets: readonly number[]): string {
  return hextets.map((h) => h.toString(16).padStart(4, "0")).join(":");
}

/**
 * Format hextets as the RFC 5952 canonical compressed form.
 * Returns the compressed string and the run that was replaced with '::'.
 */
export function compressHextets(
  hextets: readonly number[],
): { compressed: string; runStart: number | null; runLength: number } {
  // Find the longest run of consecutive zero hextets (length >= 2).
  // On ties, the leftmost run wins (RFC 5952 §4.2.3).
  let bestStart = -1;
  let bestLen = 0;
  let curStart = -1;
  let curLen = 0;
  for (let i = 0; i < hextets.length; i++) {
    if (hextets[i] === 0) {
      if (curStart === -1) curStart = i;
      curLen++;
      // Use > (not >=) so the first (leftmost) run wins on ties.
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
    // RFC 5952 §4.2.2: a single zero hextet must NOT be compressed.
    return {
      compressed: hextets.map((h) => h.toString(16)).join(":"),
      runStart: null,
      runLength: 0,
    };
  }
  const left = hextets.slice(0, bestStart).map((h) => h.toString(16));
  const right = hextets.slice(bestStart + bestLen).map((h) => h.toString(16));
  return {
    compressed: `${left.join(":")}::${right.join(":")}`,
    runStart: bestStart,
    runLength: bestLen,
  };
}

/** Format hextets with embedded IPv4 in the last 32 bits, if applicable. */
export function formatWithEmbeddedV4(hextets: readonly number[]): string {
  // Compress first, but the '::' placement must be computed ignoring the
  // trailing 2 hextets when they represent the IPv4 octets.
  // Simpler: just produce "compressed-prefix:last 2 hextets → a.b.c.d".
  const prefix = hextets.slice(0, 6);
  const a = (hextets[6] >> 8) & 0xff;
  const b = hextets[6] & 0xff;
  const c = (hextets[7] >> 8) & 0xff;
  const d = hextets[7] & 0xff;
  // Compress the prefix (6 hextets) with '::' if there's a 2+ zero run.
  const { compressed, runStart, runLength } = compressHextets(prefix);
  let prefixStr: string;
  if (runStart !== null) {
    const left = prefix.slice(0, runStart).map((h) => h.toString(16));
    const right = prefix.slice(runStart + runLength).map((h) => h.toString(16));
    prefixStr = `${left.join(":")}::${right.join(":")}`;
    if (right.length === 0) prefixStr = `${left.join(":")}::`;
  } else {
    prefixStr = compressed;
  }
  return `${prefixStr}:${a}.${b}.${c}.${d}`;
}

// ---------------------------------------------------------------------------
// Expand + Compose (with rule explanations)
// ---------------------------------------------------------------------------

/** Expand an IPv6 address to its full 128-bit form with rule explanations. */
export function expandIPv6(input: string): ExpansionResult {
  const parsed = parseIPv6(input);
  if (!parsed.ok) {
    return { ok: false, input, rules: [], error: parsed.error };
  }
  const rules: RuleExplanation[] = [];
  if (parsed.address.zoneId !== null) {
    rules.push({
      rule: RULE_LABELS.zoneId,
      description: `Zone ID "%${parsed.address.zoneId}" stripped before parsing (not part of the 128-bit address).`,
    });
  }
  if (parsed.address.hadEmbeddedV4) {
    rules.push({
      rule: RULE_LABELS.embeddedV4,
      description: "Embedded IPv4 in the last 32 bits converted to two trailing hextets.",
    });
  }
  if (input !== input.toLowerCase()) {
    rules.push({
      rule: RULE_LABELS.lowercase,
      description: "Uppercase hex digits normalized to lowercase per RFC 5952 §4.3.",
    });
  }
  rules.push({
    rule: "Expansion",
    description: "Each hextet padded to 4 hex digits with leading zeros; '::' filled with zero hextets to total 8.",
  });
  return {
    ok: true,
    input,
    expanded: expandHextets(parsed.address.hextets),
    rules,
    address: parsed.address,
  };
}

/** Compress an IPv6 address to its RFC 5952 canonical form with rule explanations. */
export function compressIPv6(input: string): CompressionResult {
  const parsed = parseIPv6(input);
  if (!parsed.ok) {
    return { ok: false, input, rules: [], error: parsed.error };
  }
  const rules: RuleExplanation[] = [];
  if (parsed.address.zoneId !== null) {
    rules.push({
      rule: RULE_LABELS.zoneId,
      description: `Zone ID "%${parsed.address.zoneId}" stripped before parsing.`,
    });
  }
  if (parsed.address.hadEmbeddedV4) {
    rules.push({
      rule: RULE_LABELS.embeddedV4,
      description: "Embedded IPv4 in the last 32 bits converted to two trailing hextets.",
    });
  }
  if (input !== input.toLowerCase()) {
    rules.push({
      rule: RULE_LABELS.lowercase,
      description: "Uppercase hex digits normalized to lowercase per RFC 5952 §4.3.",
    });
  }
  rules.push({
    rule: RULE_LABELS.leadingZeros,
    description: "Leading zeros removed from each hextet ('0db8' → 'db8').",
  });

  const { compressed, runStart, runLength } = compressHextets(parsed.address.hextets);
  if (runStart !== null) {
    rules.push({
      rule: RULE_LABELS.doubleColon,
      description: `Longest run of ${runLength} consecutive zero hextets (index ${runStart}–${runStart + runLength - 1}) replaced with '::'.`,
    });
    rules.push({
      rule: RULE_LABELS.longestRun,
      description: "The longest zero run is selected; ties go to the leftmost run (RFC 5952 §4.2.3).",
    });
  } else {
    rules.push({
      rule: RULE_LABELS.noSingleZero,
      description: "No '::' compression: no run of 2+ consecutive zero hextets (RFC 5952 §4.2.2 forbids '::' for a single zero).",
    });
  }
  return {
    ok: true,
    input,
    compressed,
    rules,
    address: parsed.address,
    runStart,
    runLength,
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate an IPv6 address and return a comprehensive result.
 *
 * On success, includes the parsed address, expanded + compressed forms, the
 * address type, and a list of every valid representation. On failure, the
 * `errors` array carries precise messages.
 */
export function validateIPv6(input: string): ValidationResult {
  const parsed = parseIPv6(input);
  if (!parsed.ok) {
    return {
      valid: false,
      errors: [parsed.error],
      warnings: [],
      rules: [],
    };
  }
  const errors: string[] = [];
  const warnings: string[] = [];
  const rules: RuleExplanation[] = [];

  if (parsed.address.zoneId !== null) {
    rules.push({
      rule: RULE_LABELS.zoneId,
      description: `Zone ID "%${parsed.address.zoneId}" stripped before validation.`,
    });
  }
  if (parsed.address.hadEmbeddedV4) {
    rules.push({
      rule: RULE_LABELS.embeddedV4,
      description: "Embedded IPv4 in the last 32 bits converted to two trailing hextets.",
    });
  }
  const trimmed = input.trim();
  if (trimmed !== trimmed.toLowerCase() && !trimmed.includes("%")) {
    // Zone IDs may legitimately contain uppercase letters — only flag
    // uppercase hex.
    const withoutZone = trimmed.split("%")[0];
    if (withoutZone !== withoutZone.toLowerCase()) {
      warnings.push("Address contains uppercase hex digits; RFC 5952 recommends lowercase.");
      rules.push({
        rule: RULE_LABELS.lowercase,
        description: "Uppercase hex digits should be normalized to lowercase per RFC 5952 §4.3.",
      });
    }
  }

  // Detect IPv4-compatible (::a.b.c.d where a is not 0 and not by mapped form).
  // The deprecated IPv4-compatible form is ::a.b.c.d (first 80 bits zero,
  // next 16 bits zero, last 32 bits non-zero). The modern replacement is
  // ::ffff:a.b.c.d (IPv4-mapped).
  const h = parsed.address.hextets;
  const first80Zero = h[0] === 0 && h[1] === 0 && h[2] === 0 && h[3] === 0 && h[4] === 0;
  if (first80Zero && h[5] === 0 && (h[6] !== 0 || h[7] !== 0)) {
    warnings.push("Address uses the deprecated IPv4-compatible form (::a.b.c.d). Use IPv4-mapped (::ffff:a.b.c.d) instead.");
  }

  const type = classifyAddressType(parsed.address);
  const { compressed } = compressHextets(h);
  const expanded = expandHextets(h);
  const representations = getAllRepresentations(parsed.address);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    rules,
    address: parsed.address,
    expanded,
    compressed,
    type,
    representations,
  };
}

// ---------------------------------------------------------------------------
// Address type classification
// ---------------------------------------------------------------------------

/** Classify an IPv6 address by its type. */
export function classifyAddressType(addr: IPv6Address): AddressType {
  const h = addr.hextets;
  // Unspecified: all zeros.
  if (addr.value === BIG_0) return "unspecified";
  // Loopback: ::1.
  if (addr.value === BIG_1) return "loopback";
  // IPv4-mapped: ::ffff:a.b.c.d  (first 80 bits zero, next 16 bits 0xffff).
  const first80Zero = h[0] === 0 && h[1] === 0 && h[2] === 0 && h[3] === 0 && h[4] === 0;
  if (first80Zero && h[5] === 0xffff) return "ipv4-mapped";
  // IPv4-compatible (deprecated): ::a.b.c.d (first 96 bits zero, non-zero last 32).
  if (first80Zero && h[5] === 0 && (h[6] !== 0 || h[7] !== 0)) return "ipv4-compatible";
  // Multicast: ff00::/8.
  if ((h[0] & 0xff00) === 0xff00) return "multicast";
  // Link-local: fe80::/10.
  if (h[0] === 0xfe80 && h[1] === 0 && h[2] === 0 && h[3] === 0) return "link-local";
  // More general fe80::/10 check: top 10 bits are 1111111010.
  if ((h[0] & 0xffc0) === 0xfe80) return "link-local";
  // ULA: fc00::/7 (top 7 bits are 1111110).
  if ((h[0] & 0xfe00) === 0xfc00) return "ula";
  // Documentation: 2001:db8::/32.
  if (h[0] === 0x2001 && h[1] === 0x0db8) return "documentation";
  // Discard-only: 100::/64.
  if (h[0] === 0x0100 && h[1] === 0 && h[2] === 0 && h[3] === 0) return "discard";
  // Otherwise global unicast.
  return "global";
}

// ---------------------------------------------------------------------------
// All representations
// ---------------------------------------------------------------------------

/** Return every valid representation of an IPv6 address. */
export function getAllRepresentations(addr: IPv6Address): string[] {
  const h = addr.hextets;
  const reps = new Set<string>();
  const { compressed } = compressHextets(h);
  const expanded = expandHextets(h);
  reps.add(compressed);
  reps.add(expanded);
  // Uppercase variants (technically valid, though non-canonical).
  reps.add(compressed.toUpperCase());
  reps.add(expanded.toUpperCase());
  // With zone ID re-attached (compressed form).
  if (addr.zoneId) {
    reps.add(`${compressed}%${addr.zoneId}`);
    reps.add(`${expanded}%${addr.zoneId}`);
  }
  // With embedded IPv4 in the last 32 bits, if applicable (ipv4-mapped,
  // ipv4-compatible, or any address whose last 32 bits can be written as a
  // dotted IPv4 — RFC 4291 allows it for any address).
  reps.add(formatWithEmbeddedV4(h));
  return Array.from(reps);
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

/** Process a list of addresses — expand, compress, validate, classify. */
export function batchProcess(list: string[]): BatchResult {
  const rows: BatchRow[] = list.map((s) => {
    const v = validateIPv6(s);
    if (!v.valid) {
      return { input: s, ok: false, valid: false, error: v.errors.join("; ") };
    }
    return {
      input: s,
      ok: true,
      valid: true,
      expanded: v.expanded,
      compressed: v.compressed,
      type: v.type,
    };
  });
  return {
    rows,
    total: rows.length,
    okCount: rows.filter((r) => r.ok).length,
    errCount: rows.filter((r) => !r.ok).length,
  };
}

/** Render batch rows as CSV. */
export function renderBatchCsv(result: BatchResult): string {
  const headers = ["input", "valid", "expanded", "compressed", "type", "error"];
  const lines = [headers.join(",")];
  for (const r of result.rows) {
    lines.push([
      escapeCsv(r.input),
      r.valid ? "yes" : "no",
      r.expanded ? escapeCsv(r.expanded) : "",
      r.compressed ? escapeCsv(r.compressed) : "",
      r.type ?? "",
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

const HISTORY_KEY = "unqtools:ipv6-expander-compressor-validator:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  input: string;
  type?: AddressType;
  compressed?: string;
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
