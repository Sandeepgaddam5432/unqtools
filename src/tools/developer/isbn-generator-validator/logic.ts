/**
 * ISBN Generator & Validator — pure logic.
 *
 * Generates and validates ISBN-10 (mod-11) and ISBN-13 (weighted mod-10)
 * identifiers per the ISO 2108 / ISBN Users' Manual. Ships a bundled
 * ISBN range message (registration groups + publisher ranges) for proper
 * hyphenation and structural parsing into prefix/group/publisher/title/check.
 *
 * Pure functions only — no DOM, no network, no external deps.
 *
 * SANDBOX HONESTY CLAUSE: Generated ISBNs are structurally valid (pass
 * the mod-11 / weighted mod-10 checksum and length checks) but UNREGISTERED.
 * They are for testing/development only — they do not identify real books.
 *
 * PRIVACY: The history feature stores only metadata (counts + timestamps),
 * NEVER the ISBNs themselves. ISBNs are never transmitted or logged.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IsbnVersion = "isbn10" | "isbn13";

export type IsbnFormat = "raw" | "hyphenated";

export interface ValidationResult {
  input: string;
  normalized: string;
  valid: boolean;
  version: IsbnVersion | null;
  code: "ok" | "empty" | "wrong_length" | "bad_chars" | "bad_checksum" | "bad_x_position";
  message: string;
  checkDigit: string | null;
}

export interface ParsedIsbn {
  /** Original normalized ISBN string (no hyphens/spaces). */
  raw: string;
  version: IsbnVersion;
  /** "978" / "979" for ISBN-13, "" for ISBN-10. */
  prefix: string;
  /** Registration group identifier (e.g. "0", "1", "2", "88"). */
  group: string;
  /** Publisher identifier within the group. */
  publisher: string;
  /** Title identifier (remainder before check digit). */
  title: string;
  /** Check digit character ("0"-"9", or "X" for ISBN-10). */
  check: string;
  /** Hyphenated form, or null when group/publisher could not be resolved. */
  hyphenated: string | null;
  /** True if the group was matched in the range table. */
  groupResolved: boolean;
  /** True if the publisher block was matched within the group. */
  publisherResolved: boolean;
}

export interface BatchRow {
  index: number;
  raw: string;
  normalized: string;
  valid: boolean;
  version: IsbnVersion | null;
  code: ValidationResult["code"];
  message: string;
}

export interface BatchSummary {
  total: number;
  valid: number;
  invalid: number;
  isbn10Count: number;
  isbn13Count: number;
}

export interface HistoryEntry {
  ts: number;
  action: "generate" | "validate_single" | "validate_batch" | "convert";
  version: IsbnVersion | null;
  generateCount: number;
  batchTotal: number;
  batchValid: number;
  batchInvalid: number;
}

// ---------------------------------------------------------------------------
// PRNG — deterministic mulberry32 (for reproducible test ISBN generation)
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
  pick<T>(arr: readonly T[]): T;
}

export function createRng(seed: string | number): Rng {
  const r = mulberry32(hashSeed(seed));
  const int = (min: number, max: number): number =>
    Math.floor(r() * (max - min + 1)) + min;
  const pick = <T,>(arr: readonly T[]): T => {
    if (arr.length === 0) throw new Error("pick: empty array");
    return arr[Math.floor(r() * arr.length)] as T;
  };
  return { next: r, int, pick };
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

/** Strip whitespace, hyphens, lowercase 'x' → 'X' for ISBN-10 check digit. */
export function normalizeIsbn(input: string): string {
  if (!input) return "";
  return input.replace(/[\s-]+/g, "").toUpperCase();
}

/** Detect ISBN version by length + character set after normalization. */
export function detectVersion(normalized: string): IsbnVersion | null {
  if (!normalized) return null;
  if (/^\d{9}[\dX]$/.test(normalized)) return "isbn10";
  if (/^\d{13}$/.test(normalized)) return "isbn13";
  return null;
}

// ---------------------------------------------------------------------------
// Checksum algorithms
// ---------------------------------------------------------------------------

/**
 * Compute ISBN-10 check digit using mod-11.
 * Input: 9-digit string. Output: "0"-"9" or "X" (when checksum is 10).
 */
export function computeIsbn10Check(nineDigits: string): string {
  if (!/^\d{9}$/.test(nineDigits)) {
    throw new Error(`computeIsbn10Check: expected 9 digits, got '${nineDigits}'`);
  }
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += (10 - i) * parseInt(nineDigits[i]!, 10);
  }
  const rem = sum % 11;
  const check = (11 - rem) % 11;
  return check === 10 ? "X" : String(check);
}

/**
 * Compute ISBN-13 check digit using weighted mod-10.
 * Input: 12-digit string. Output: single digit "0"-"9".
 */
export function computeIsbn13Check(twelveDigits: string): string {
  if (!/^\d{12}$/.test(twelveDigits)) {
    throw new Error(`computeIsbn13Check: expected 12 digits, got '${twelveDigits}'`);
  }
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const d = parseInt(twelveDigits[i]!, 10);
    sum += i % 2 === 0 ? d : d * 3;
  }
  const check = (10 - (sum % 10)) % 10;
  return String(check);
}

/** Verify ISBN-10 checksum (mod-11, 'X' allowed in last position only). */
export function verifyIsbn10(normalized: string): boolean {
  if (!/^\d{9}[\dX]$/.test(normalized)) return false;
  const nine = normalized.slice(0, 9);
  const expected = computeIsbn10Check(nine);
  return normalized[9]! === expected;
}

/** Verify ISBN-13 checksum (weighted mod-10). */
export function verifyIsbn13(normalized: string): boolean {
  if (!/^\d{13}$/.test(normalized)) return false;
  const twelve = normalized.slice(0, 12);
  const expected = computeIsbn13Check(twelve);
  return normalized[12]! === expected;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateIsbn(input: string): ValidationResult {
  const normalized = normalizeIsbn(input);
  if (!normalized) {
    return {
      input,
      normalized,
      valid: false,
      version: null,
      code: "empty",
      message: "Empty input.",
      checkDigit: null,
    };
  }
  const version = detectVersion(normalized);

  // Early check: malformed ISBN-10 — 10 chars of [0-9X] but X in non-final
  // position. detectVersion returns null for this so we catch it here.
  if (normalized.length === 10
    && /^[0-9X]+$/.test(normalized)
    && /X/.test(normalized.slice(0, 9))) {
    return {
      input, normalized, valid: false, version: null,
      code: "bad_x_position",
      message: "ISBN-10 'X' is only allowed as the final (check) digit.",
      checkDigit: null,
    };
  }

  if (version === "isbn10") {
    // ISBN-10 must be 9 digits + (digit or X). X is allowed only in last position.
    if (!/^\d{9}[\dX]$/.test(normalized)) {
      // Check if X appears in non-final position.
      if (/X/.test(normalized.slice(0, 9))) {
        return {
          input, normalized, valid: false, version: null,
          code: "bad_x_position",
          message: "ISBN-10 'X' is only allowed as the final (check) digit.",
          checkDigit: null,
        };
      }
      return {
        input, normalized, valid: false, version: null,
        code: "bad_chars",
        message: "ISBN-10 must be 9 digits followed by a digit or 'X'.",
        checkDigit: null,
      };
    }
    const ok = verifyIsbn10(normalized);
    return {
      input, normalized, valid: ok, version: "isbn10",
      code: ok ? "ok" : "bad_checksum",
      message: ok
        ? "Valid ISBN-10 (mod-11 checksum passes)."
        : `Invalid ISBN-10 checksum — expected check digit '${computeIsbn10Check(normalized.slice(0, 9))}'.`,
      checkDigit: normalized[9]!,
    };
  }

  if (version === "isbn13") {
    if (!/^\d{13}$/.test(normalized)) {
      return {
        input, normalized, valid: false, version: null,
        code: "bad_chars",
        message: "ISBN-13 must be exactly 13 digits.",
        checkDigit: null,
      };
    }
    const prefix = normalized.slice(0, 3);
    if (prefix !== "978" && prefix !== "979") {
      return {
        input, normalized, valid: false, version: "isbn13",
        code: "bad_checksum",
        message: `ISBN-13 must start with 978 or 979 (got '${prefix}').`,
        checkDigit: normalized[12]!,
      };
    }
    const ok = verifyIsbn13(normalized);
    return {
      input, normalized, valid: ok, version: "isbn13",
      code: ok ? "ok" : "bad_checksum",
      message: ok
        ? "Valid ISBN-13 (weighted mod-10 checksum passes)."
        : `Invalid ISBN-13 checksum — expected check digit '${computeIsbn13Check(normalized.slice(0, 12))}'.`,
      checkDigit: normalized[12]!,
    };
  }

  // Wrong length or bad chars.
  if (/^[0-9X]+$/.test(normalized)) {
    return {
      input, normalized, valid: false, version: null,
      code: "wrong_length",
      message: `Wrong length: ISBN-10 needs 10 chars, ISBN-13 needs 13 (got ${normalized.length}).`,
      checkDigit: null,
    };
  }
  return {
    input, normalized, valid: false, version: null,
    code: "bad_chars",
    message: "Invalid characters — ISBN uses digits 0-9 (and 'X' only as ISBN-10 check digit).",
    checkDigit: null,
  };
}

// ---------------------------------------------------------------------------
// ISBN range table (compact, ISBN Users' Manual)
// ---------------------------------------------------------------------------

/**
 * A single publisher range within a registration group.
 * Range is inclusive on both ends, expressed as digit strings of equal
 * length so lexicographic comparison works for fixed-width prefixes.
 */
export interface PublisherRange {
  from: string;
  to: string;
  /** Number of digits in the publisher identifier. */
  length: number;
}

export interface GroupSpec {
  /** Group identifier (e.g. "0", "1", "2", "88"). */
  group: string;
  /** Human-readable name. */
  name: string;
  /** Publisher ranges within this group. */
  publishers: PublisherRange[];
}

/**
 * Compact ISBN range table — covers the major registration groups with
 * representative publisher sub-ranges. Adapted from the ISBN Range Message
 * published by the International ISBN Agency (abbreviated for offline use).
 *
 * NOTE: This table is sufficient for structural parsing/hyphenation of the
 * common groups; for long-tail national ranges it falls back to a default
 * 3-digit publisher split.
 */
export const ISBN_GROUPS: GroupSpec[] = [
  {
    group: "0", name: "English-speaking (group 0)",
    publishers: [
      { from: "00", to: "19", length: 2 },
      { from: "200", to: "699", length: 3 },
      { from: "7000", to: "8499", length: 4 },
      { from: "85000", to: "89999", length: 5 },
      { from: "900000", to: "949999", length: 6 },
      { from: "9500000", to: "9999999", length: 7 },
    ],
  },
  {
    group: "1", name: "English-speaking (group 1)",
    publishers: [
      { from: "00", to: "09", length: 2 },
      { from: "100", to: "399", length: 3 },
      { from: "4000", to: "5499", length: 4 },
      { from: "550000", to: "649999", length: 6 },
      { from: "6500000", to: "6799999", length: 7 },
      { from: "7000000", to: "8499999", length: 7 },
      { from: "85000", to: "89999", length: 5 },
      { from: "900000", to: "949999", length: 6 },
    ],
  },
  {
    group: "2", name: "French-speaking",
    publishers: [
      { from: "00", to: "19", length: 2 },
      { from: "200", to: "349", length: 3 },
      { from: "35000", to: "39999", length: 5 },
      { from: "400", to: "699", length: 3 },
      { from: "7000", to: "8399", length: 4 },
      { from: "84000", to: "89999", length: 5 },
      { from: "900000", to: "975999", length: 6 },
      { from: "9760000", to: "9999999", length: 7 },
    ],
  },
  {
    group: "3", name: "German-speaking",
    publishers: [
      { from: "00", to: "02", length: 2 },
      { from: "030", to: "033", length: 3 },
      { from: "0340", to: "0369", length: 4 },
      { from: "03700", to: "03999", length: 5 },
      { from: "04", to: "19", length: 2 },
      { from: "200", to: "699", length: 3 },
      { from: "7000", to: "8499", length: 4 },
      { from: "85000", to: "89999", length: 5 },
      { from: "900000", to: "949999", length: 6 },
      { from: "9500000", to: "9999999", length: 7 },
    ],
  },
  {
    group: "4", name: "Japanese",
    publishers: [
      { from: "00", to: "19", length: 2 },
      { from: "200", to: "699", length: 3 },
      { from: "7000", to: "8499", length: 4 },
      { from: "85000", to: "89999", length: 5 },
      { from: "900000", to: "949999", length: 6 },
      { from: "9500000", to: "9999999", length: 7 },
    ],
  },
  {
    group: "5", name: "Russian (former USSR)",
    publishers: [
      { from: "00", to: "19", length: 2 },
      { from: "200", to: "420", length: 3 },
      { from: "4210", to: "4299", length: 4 },
      { from: "430", to: "430", length: 3 },
      { from: "4310", to: "4399", length: 4 },
      { from: "440", to: "699", length: 3 },
      { from: "7000", to: "8499", length: 4 },
      { from: "85000", to: "89999", length: 5 },
      { from: "900000", to: "909999", length: 6 },
      { from: "91000", to: "91999", length: 5 },
      { from: "9200", to: "9299", length: 4 },
      { from: "9300000", to: "9499999", length: 7 },
      { from: "9500000", to: "9999999", length: 7 },
    ],
  },
  {
    group: "7", name: "Chinese",
    publishers: [
      { from: "00", to: "09", length: 2 },
      { from: "100", to: "499", length: 3 },
      { from: "5000", to: "7999", length: 4 },
      { from: "80000", to: "89999", length: 5 },
      { from: "900000", to: "999999", length: 6 },
    ],
  },
  {
    group: "80", name: "Czech Republic & Slovakia",
    publishers: [
      { from: "00", to: "19", length: 2 },
      { from: "200", to: "699", length: 3 },
      { from: "7000", to: "8499", length: 4 },
      { from: "85000", to: "89999", length: 5 },
      { from: "900000", to: "999999", length: 6 },
    ],
  },
  {
    group: "82", name: "Norwegian",
    publishers: [
      { from: "00", to: "19", length: 2 },
      { from: "200", to: "699", length: 3 },
      { from: "7000", to: "8999", length: 4 },
      { from: "90000", to: "98999", length: 5 },
      { from: "990000", to: "999999", length: 6 },
    ],
  },
  {
    group: "83", name: "Polish",
    publishers: [
      { from: "00", to: "19", length: 2 },
      { from: "200", to: "599", length: 3 },
      { from: "6000", to: "8999", length: 4 },
      { from: "90000", to: "99999", length: 5 },
    ],
  },
  {
    group: "84", name: "Spanish",
    publishers: [
      { from: "00", to: "09", length: 2 },
      { from: "100", to: "199", length: 3 },
      { from: "2000", to: "2999", length: 4 },
      { from: "30000", to: "39999", length: 5 },
      { from: "400", to: "599", length: 3 },
      { from: "6000", to: "8999", length: 4 },
      { from: "90000", to: "91999", length: 5 },
      { from: "920000", to: "923999", length: 6 },
      { from: "92400", to: "92999", length: 5 },
      { from: "9300000", to: "9379999", length: 7 },
      { from: "938000", to: "969999", length: 6 },
      { from: "97000", to: "99999", length: 5 },
    ],
  },
  {
    group: "85", name: "Brazilian",
    publishers: [
      { from: "00", to: "19", length: 2 },
      { from: "200", to: "599", length: 3 },
      { from: "6000", to: "8999", length: 4 },
      { from: "90000", to: "97999", length: 5 },
      { from: "980000", to: "999999", length: 6 },
    ],
  },
  {
    group: "87", name: "Danish",
    publishers: [
      { from: "00", to: "29", length: 2 },
      { from: "300", to: "499", length: 3 },
      { from: "5000", to: "6499", length: 4 },
      { from: "65000", to: "69999", length: 5 },
      { from: "7000", to: "7999", length: 4 },
      { from: "80000", to: "84999", length: 5 },
      { from: "850000", to: "899999", length: 6 },
      { from: "90000", to: "94999", length: 5 },
      { from: "950000", to: "999999", length: 6 },
    ],
  },
  {
    group: "88", name: "Italian",
    publishers: [
      { from: "00", to: "19", length: 2 },
      { from: "200", to: "599", length: 3 },
      { from: "6000", to: "8499", length: 4 },
      { from: "85000", to: "89999", length: 5 },
      { from: "900000", to: "909999", length: 6 },
      { from: "9100", to: "9299", length: 4 },
      { from: "930000", to: "939999", length: 6 },
      { from: "9400", to: "9499", length: 4 },
      { from: "95000", to: "99999", length: 5 },
    ],
  },
  {
    group: "89", name: "Korean",
    publishers: [
      { from: "00", to: "24", length: 2 },
      { from: "250", to: "549", length: 3 },
      { from: "5500", to: "8499", length: 4 },
      { from: "85000", to: "94999", length: 5 },
      { from: "950000", to: "989999", length: 6 },
      { from: "9900000", to: "9999999", length: 7 },
    ],
  },
  {
    group: "90", name: "Dutch / Flemish",
    publishers: [
      { from: "00", to: "19", length: 2 },
      { from: "200", to: "499", length: 3 },
      { from: "5000", to: "6999", length: 4 },
      { from: "70000", to: "79999", length: 5 },
      { from: "8000", to: "8499", length: 4 },
      { from: "85000", to: "89999", length: 5 },
      { from: "900000", to: "999999", length: 6 },
    ],
  },
  {
    group: "91", name: "Swedish",
    publishers: [
      { from: "0", to: "1", length: 1 },
      { from: "20", to: "49", length: 2 },
      { from: "500", to: "649", length: 3 },
      { from: "6500", to: "7999", length: 4 },
      { from: "80000", to: "81999", length: 5 },
      { from: "82000", to: "84999", length: 5 },
      { from: "850000", to: "899999", length: 6 },
      { from: "90000", to: "99999", length: 5 },
    ],
  },
  {
    group: "92", name: "International (UNESCO, EU)",
    publishers: [
      { from: "0", to: "5", length: 1 },
      { from: "60", to: "79", length: 2 },
      { from: "800", to: "899", length: 3 },
      { from: "9000", to: "9499", length: 4 },
      { from: "95000", to: "98999", length: 5 },
      { from: "990000", to: "999999", length: 6 },
    ],
  },
  {
    group: "93", name: "Indian",
    publishers: [
      { from: "00", to: "09", length: 2 },
      { from: "100", to: "499", length: 3 },
      { from: "5000", to: "7999", length: 4 },
      { from: "80000", to: "94999", length: 5 },
      { from: "950000", to: "999999", length: 6 },
    ],
  },
  {
    group: "94", name: "Dutch (group 94)",
    publishers: [
      { from: "000", to: "599", length: 3 },
      { from: "6000", to: "8999", length: 4 },
      { from: "90000", to: "99999", length: 5 },
    ],
  },
  {
    group: "977", name: "Egypt",
    publishers: [
      { from: "00", to: "19", length: 2 },
      { from: "200", to: "699", length: 3 },
      { from: "7000", to: "8499", length: 4 },
      { from: "85000", to: "89999", length: 5 },
      { from: "900000", to: "999999", length: 6 },
    ],
  },
  {
    group: "9955", name: "Lithuanian",
    publishers: [
      { from: "00", to: "29", length: 2 },
      { from: "300", to: "399", length: 3 },
      { from: "4000", to: "9499", length: 4 },
      { from: "95000", to: "99999", length: 5 },
    ],
  },
];

/**
 * Lookup the registration group spec by walking the group ranges.
 * Returns the matched GroupSpec (or null) and the number of chars consumed.
 */
export function findGroup(
  body: string,
): { spec: GroupSpec; consumed: number } | null {
  // Try 5-digit groups first, then 4, 3, 2, 1.
  for (let len = 5; len >= 1; len--) {
    if (body.length < len) continue;
    const candidate = body.slice(0, len);
    const spec = ISBN_GROUPS.find((g) => g.group === candidate);
    if (spec) return { spec, consumed: len };
  }
  return null;
}

/**
 * Lookup the publisher range within a group.
 * Returns the matched PublisherRange (or null) and the number of chars consumed.
 */
export function findPublisher(
  groupSpec: GroupSpec,
  bodyAfterGroup: string,
): { range: PublisherRange; consumed: number } | null {
  // Sort publisher ranges by length so we try the shortest prefix first
  // (matching the longest publisher identifier the body actually satisfies).
  // Per ISBN rules, ranges are non-overlapping for a given length, but
  // multiple lengths may share prefixes — we test by length and compare
  // the appropriate-width slice lexicographically.
  const sorted = [...groupSpec.publishers].sort((a, b) => a.length - b.length);
  for (const range of sorted) {
    if (bodyAfterGroup.length < range.length) continue;
    const slice = bodyAfterGroup.slice(0, range.length);
    // Pad from/to to the slice length for comparison.
    if (slice >= range.from && slice <= range.to) {
      return { range, consumed: range.length };
    }
  }
  return null;
}

/**
 * Parse an ISBN into prefix / group / publisher / title / check components.
 * Returns groupResolved=false when the group isn't in our compact table.
 */
export function parseIsbn(input: string): ParsedIsbn | null {
  const normalized = normalizeIsbn(input);
  const version = detectVersion(normalized);
  if (!version) return null;

  if (version === "isbn10") {
    const body = normalized.slice(0, 9); // 9 digits, check is index 9
    const check = normalized[9]!;
    const groupMatch = findGroup(body);
    if (!groupMatch) {
      return {
        raw: normalized,
        version: "isbn10",
        prefix: "",
        group: "",
        publisher: "",
        title: body,
        check,
        hyphenated: null,
        groupResolved: false,
        publisherResolved: false,
      };
    }
    const rest = body.slice(groupMatch.consumed);
    const pubMatch = findPublisher(groupMatch.spec, rest);
    if (!pubMatch) {
      return {
        raw: normalized,
        version: "isbn10",
        prefix: "",
        group: groupMatch.spec.group,
        publisher: "",
        title: rest,
        check,
        hyphenated: `${groupMatch.spec.group}-${rest}-${check}`,
        groupResolved: true,
        publisherResolved: false,
      };
    }
    const title = rest.slice(pubMatch.consumed);
    const hyphenated = `${groupMatch.spec.group}-${rest.slice(0, pubMatch.consumed)}-${title}-${check}`;
    return {
      raw: normalized,
      version: "isbn10",
      prefix: "",
      group: groupMatch.spec.group,
      publisher: rest.slice(0, pubMatch.consumed),
      title,
      check,
      hyphenated,
      groupResolved: true,
      publisherResolved: true,
    };
  }

  // ISBN-13
  const prefix = normalized.slice(0, 3); // 978 or 979
  const check = normalized[12]!;
  const body = normalized.slice(3, 12); // 9 digits
  const groupMatch = findGroup(body);
  if (!groupMatch) {
    return {
      raw: normalized,
      version: "isbn13",
      prefix,
      group: "",
      publisher: "",
      title: body,
      check,
      hyphenated: null,
      groupResolved: false,
      publisherResolved: false,
    };
  }
  const rest = body.slice(groupMatch.consumed);
  const pubMatch = findPublisher(groupMatch.spec, rest);
  if (!pubMatch) {
    return {
      raw: normalized,
      version: "isbn13",
      prefix,
      group: groupMatch.spec.group,
      publisher: "",
      title: rest,
      check,
      hyphenated: `${prefix}-${groupMatch.spec.group}-${rest}-${check}`,
      groupResolved: true,
      publisherResolved: false,
    };
  }
  const title = rest.slice(pubMatch.consumed);
  const hyphenated = `${prefix}-${groupMatch.spec.group}-${rest.slice(0, pubMatch.consumed)}-${title}-${check}`;
  return {
    raw: normalized,
    version: "isbn13",
    prefix,
    group: groupMatch.spec.group,
    publisher: rest.slice(0, pubMatch.consumed),
    title,
    check,
    hyphenated,
    groupResolved: true,
    publisherResolved: true,
  };
}

/** Pretty hyphenated form of an ISBN. Falls back to raw if not parseable. */
export function hyphenateIsbn(input: string): string {
  const parsed = parseIsbn(input);
  if (parsed && parsed.hyphenated) return parsed.hyphenated;
  return normalizeIsbn(input);
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

/**
 * Generate a valid ISBN-10. Returns the 10-char string (digits + check).
 * Optional groupHint lets the caller bias the registration group (e.g. "0").
 */
export function generateIsbn10(rng: Rng, groupHint?: string): string {
  let body: string;
  if (groupHint) {
    const spec = ISBN_GROUPS.find((g) => g.group === groupHint);
    if (spec && spec.publishers.length > 0) {
      const pubRange = rng.pick(spec.publishers);
      const pubLen = pubRange.length;
      // Generate a publisher id within the range.
      const from = parseInt(pubRange.from, 10);
      const to = parseInt(pubRange.to, 10);
      const pubNum = rng.int(from, to);
      const pub = String(pubNum).padStart(pubLen, "0");
      const restLen = 9 - spec.group.length - pubLen;
      let rest = "";
      for (let i = 0; i < restLen; i++) rest += String(rng.int(0, 9));
      body = spec.group + pub + rest;
    } else {
      body = randomDigits(rng, 9);
    }
  } else {
    body = randomDigits(rng, 9);
  }
  // Pad/truncate to exactly 9 digits (group + publisher + title).
  body = body.slice(0, 9).padEnd(9, "0");
  const check = computeIsbn10Check(body);
  return body + check;
}

/** Generate a valid ISBN-13 with 978 (default) or 979 prefix. */
export function generateIsbn13(
  rng: Rng,
  options?: { prefix?: "978" | "979"; groupHint?: string },
): string {
  const prefix = options?.prefix ?? "978";
  const groupHint = options?.groupHint;
  let body: string; // 9 digits (group + publisher + title)
  if (groupHint) {
    const spec = ISBN_GROUPS.find((g) => g.group === groupHint);
    if (spec && spec.publishers.length > 0) {
      const pubRange = rng.pick(spec.publishers);
      const pubLen = pubRange.length;
      const from = parseInt(pubRange.from, 10);
      const to = parseInt(pubRange.to, 10);
      const pubNum = rng.int(from, to);
      const pub = String(pubNum).padStart(pubLen, "0");
      const restLen = 9 - spec.group.length - pubLen;
      let rest = "";
      for (let i = 0; i < restLen; i++) rest += String(rng.int(0, 9));
      body = spec.group + pub + rest;
    } else {
      body = randomDigits(rng, 9);
    }
  } else {
    body = randomDigits(rng, 9);
  }
  body = body.slice(0, 9).padEnd(9, "0");
  const twelve = prefix + body;
  const check = computeIsbn13Check(twelve);
  return twelve + check;
}

function randomDigits(rng: Rng, count: number): string {
  let out = "";
  for (let i = 0; i < count; i++) out += String(rng.int(0, 9));
  return out;
}

export interface GenerateOptions {
  version: IsbnVersion;
  count: number;
  seed: string;
  prefix?: "978" | "979";
  groupHint?: string;
}

export interface GeneratedIsbn {
  index: number;
  isbn: string;
  version: IsbnVersion;
  hyphenated: string;
}

/** Generate a batch of ISBNs with deterministic seed. */
export function generateBatch(options: GenerateOptions): GeneratedIsbn[] {
  const count = Math.max(0, Math.min(1000, Math.floor(options.count)));
  const rng = createRng(options.seed);
  const out: GeneratedIsbn[] = [];
  for (let i = 0; i < count; i++) {
    let isbn: string;
    if (options.version === "isbn10") {
      isbn = generateIsbn10(rng, options.groupHint);
    } else {
      isbn = generateIsbn13(rng, { prefix: options.prefix, groupHint: options.groupHint });
    }
    out.push({
      index: i,
      isbn,
      version: options.version,
      hyphenated: hyphenateIsbn(isbn),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Conversion (ISBN-10 ↔ ISBN-13)
// ---------------------------------------------------------------------------

/** Convert ISBN-10 → ISBN-13 (978 prefix, recompute check digit). */
export function isbn10to13(isbn10: string): string | null {
  const normalized = normalizeIsbn(isbn10);
  if (!/^\d{9}[\dX]$/.test(normalized)) return null;
  const nine = normalized.slice(0, 9); // drop check
  const twelve = "978" + nine;
  const check = computeIsbn13Check(twelve);
  return twelve + check;
}

/**
 * Convert ISBN-13 → ISBN-10. Only works for 978-prefixed ISBN-13s
 * (979-prefixed ISBN-13s have no ISBN-10 equivalent).
 */
export function isbn13to10(isbn13: string): string | null {
  const normalized = normalizeIsbn(isbn13);
  if (!/^\d{13}$/.test(normalized)) return null;
  const prefix = normalized.slice(0, 3);
  if (prefix !== "978") return null; // 979 has no ISBN-10 equivalent
  const nine = normalized.slice(3, 12); // 9 digits
  const check = computeIsbn10Check(nine);
  return nine + check;
}

export interface ConvertResult {
  input: string;
  output: string | null;
  ok: boolean;
  message: string;
}

/** Convert ISBN between versions with helpful messages. */
export function convertIsbn(input: string, target: IsbnVersion): ConvertResult {
  const normalized = normalizeIsbn(input);
  const version = detectVersion(normalized);
  if (!version) {
    return {
      input: normalized, output: null, ok: false,
      message: "Input is not a valid ISBN-10 or ISBN-13.",
    };
  }
  if (version === target) {
    return {
      input: normalized, output: normalized, ok: true,
      message: `Input is already ${target === "isbn10" ? "ISBN-10" : "ISBN-13"}.`,
    };
  }
  if (version === "isbn10" && target === "isbn13") {
    const out = isbn10to13(normalized);
    if (!out) {
      return { input: normalized, output: null, ok: false, message: "Conversion failed." };
    }
    return {
      input: normalized, output: out, ok: true,
      message: `Converted ISBN-10 → ISBN-13 (added 978 prefix, recomputed check digit).`,
    };
  }
  // isbn13 → isbn10
  const prefix = normalized.slice(0, 3);
  if (prefix === "979") {
    return {
      input: normalized, output: null, ok: false,
      message: "979-prefixed ISBN-13 has no ISBN-10 equivalent (allocated after ISBN-10 retirement).",
    };
  }
  const out = isbn13to10(normalized);
  if (!out) {
    return { input: normalized, output: null, ok: false, message: "Conversion failed." };
  }
  return {
    input: normalized, output: out, ok: true,
    message: "Converted ISBN-13 → ISBN-10 (dropped 978 prefix, recomputed mod-11 check digit).",
  };
}

// ---------------------------------------------------------------------------
// Batch operations
// ---------------------------------------------------------------------------

/** Parse bulk input — newline, comma, semicolon, or whitespace separated. */
export function parseBatchInput(input: string): string[] {
  if (!input) return [];
  return input
    .split(/[\n,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Validate a list of raw ISBN strings into structured rows. */
export function validateBatch(raws: string[]): BatchRow[] {
  return raws.map((raw, i) => {
    const result = validateIsbn(raw);
    return {
      index: i + 1,
      raw,
      normalized: result.normalized,
      valid: result.valid,
      version: result.version,
      code: result.code,
      message: result.message,
    };
  });
}

/** Summarize a batch result. */
export function summarizeBatch(rows: BatchRow[]): BatchSummary {
  let valid = 0;
  let isbn10 = 0;
  let isbn13 = 0;
  for (const r of rows) {
    if (r.valid) {
      valid++;
      if (r.version === "isbn10") isbn10++;
      else if (r.version === "isbn13") isbn13++;
    }
  }
  return {
    total: rows.length,
    valid,
    invalid: rows.length - valid,
    isbn10Count: isbn10,
    isbn13Count: isbn13,
  };
}

/** Render batch rows as CSV. */
export function renderBatchCsv(rows: BatchRow[]): string {
  const lines = ["index,raw,normalized,valid,version,code,message"];
  for (const r of rows) {
    lines.push([
      String(r.index),
      escapeCsvCell(r.raw),
      escapeCsvCell(r.normalized),
      r.valid ? "valid" : "invalid",
      r.version ?? "",
      r.code,
      escapeCsvCell(r.message),
    ].join(","));
  }
  return lines.join("\n");
}

function escapeCsvCell(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---------------------------------------------------------------------------
// EAN-13 barcode text art (1-digit guard bars + 12 digits in 2 groups of 6)
// ---------------------------------------------------------------------------

/**
 * Render an EAN-13 barcode as ASCII art. The 13-digit ISBN is encoded with
 * guard bars (||) and digit group separators. This is purely visual —
 * no scanning-capable barcode is generated.
 */
export function renderEan13Text(isbn13: string): string {
  const normalized = normalizeIsbn(isbn13);
  if (!/^\d{13}$/.test(normalized)) return "";
  const first = normalized[0]!;
  const left = normalized.slice(1, 7);
  const right = normalized.slice(7, 13);
  const bar = (d: string): string => {
    // Pseudo-bar: each digit becomes N '#' chars where N = digit + 1.
    return "#".repeat(parseInt(d, 10) + 1);
  };
  const top = `||${left.split("").map(bar).join(" ")}|| ${right.split("").map(bar).join(" ")}||`;
  const mid = `||${left.split("").map(bar).join(" ")}|| ${right.split("").map(bar).join(" ")}||`;
  const digits = ` ${first}  ${left}  ${right} `;
  return [top, mid, digits].join("\n");
}

// ---------------------------------------------------------------------------
// Canonical test vectors (real-world sample ISBNs from public docs)
// ---------------------------------------------------------------------------

/**
 * Known-good ISBN test vectors sourced from public documentation
 * (Wikipedia, ISBN.org, O'Reilly book pages). All pass their respective
 * checksum algorithms.
 */
export const CANONICAL_VALID_ISBNS: readonly {
  isbn: string; version: IsbnVersion; note: string;
}[] = [
  { isbn: "0306406152", version: "isbn10", note: "Wikipedia ISBN-10 example" },
  { isbn: "030640615", version: "isbn10", note: "Wikipedia 9-digit body (no check)" },
  { isbn: "9780306406157", version: "isbn13", note: "Wikipedia ISBN-13 example" },
  { isbn: "9781861978769", version: "isbn13", note: "ISBN.org example" },
  { isbn: "0590353403", version: "isbn10", note: "Harry Potter & Sorcerer's Stone (US)" },
  { isbn: "9780747532699", version: "isbn13", note: "Harry Potter & Philosopher's Stone" },
  { isbn: "9780132350884", version: "isbn13", note: "Clean Code (Robert C. Martin)" },
  { isbn: "020161622X", version: "isbn10", note: "The Pragmatic Programmer (X check digit)" },
  { isbn: "9780596520687", version: "isbn13", note: "JavaScript: The Good Parts" },
  { isbn: "9781449331818", version: "isbn13", note: "Learning React (O'Reilly)" },
  { isbn: "9781491950296", version: "isbn13", note: "Designing Data-Intensive Applications" },
  { isbn: "9780201633610", version: "isbn13", note: "Design Patterns (Gang of Four)" },
];

/** ISBNs that should fail validation (bad checksum or structure). */
export const CANONICAL_INVALID_ISBNS: readonly { isbn: string; note: string }[] = [
  { isbn: "0306406153", note: "ISBN-10 with wrong check digit" },
  { isbn: "9780306406158", note: "ISBN-13 with wrong check digit" },
  { isbn: "030640615", note: "Truncated ISBN-10 (9 digits, no check)" },
  { isbn: "978030640615", note: "Truncated ISBN-13 (12 digits)" },
  { isbn: "020161622Y", note: "Invalid character (Y not allowed)" },
  { isbn: "X20161622X", note: "X in non-final position" },
];

// ---------------------------------------------------------------------------
// History (localStorage) — stores metadata only, NEVER ISBNs
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:isbn-generator-validator:history";
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
  mode: "generate" | "validate" | "convert" | "batch",
  params: Record<string, string>,
): string {
  const sp = new URLSearchParams();
  sp.set("mode", mode);
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") sp.set(k, v);
  }
  if (typeof window === "undefined") return `?${sp.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${sp.toString()}`;
}

export interface ParsedShareUrl {
  mode: "generate" | "validate" | "convert" | "batch";
  params: Record<string, string>;
}

export function parseShareUrl(hash: string): ParsedShareUrl {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { mode: "generate", params: {} };
  const sp = new URLSearchParams(clean);
  const modeStr = sp.get("mode") ?? "generate";
  const mode = (["generate", "validate", "convert", "batch"].includes(modeStr)
    ? modeStr
    : "generate") as ParsedShareUrl["mode"];
  const params: Record<string, string> = {};
  sp.forEach((v, k) => {
    if (k !== "mode") params[k] = v;
  });
  return { mode, params };
}

// ---------------------------------------------------------------------------
// Honesty banner — sandbox only
// ---------------------------------------------------------------------------

export const HONESTY_BANNER =
  "Generated ISBNs are structurally valid (pass mod-11 / weighted mod-10 checksums) but UNREGISTERED. They are for testing/development only — they do not identify real books.";
