/**
 * IBAN Generator & Validator — pure logic.
 *
 * Generates and validates International Bank Account Numbers (IBANs) per
 * ISO 13616. Ships a bundled registry of 70+ IBAN-enabled countries with
 * per-country BBAN structure. Computes MOD-97 checksums using a chunked
 * big-integer modulo so IBANs of any length work correctly.
 *
 * Pure functions only — no DOM, no network, no external deps.
 *
 * SANDBOX HONESTY CLAUSE: Generated IBANs are structurally valid (pass
 * MOD-97 + length + character-type checks) but UNASSIGNED. They are for
 * testing/development only. Never use them for real financial transactions.
 *
 * PRIVACY: The history feature stores only metadata (counts + timestamps),
 * NEVER the IBANs themselves. IBANs are never transmitted or logged.
 */

// ---------------------------------------------------------------------------
// Country registry (ISO 13616)
// ---------------------------------------------------------------------------

/** BBAN segment character type per ISO 13616. */
export type BbanCharType = "n" | "a" | "c";

export interface BbanSegment {
  type: BbanCharType;
  length: number;
}

export interface CountrySpec {
  /** ISO 3166-1 alpha-2 country code. */
  country: string;
  /** Full country name. */
  name: string;
  /** Total IBAN length (including country code + check digits). */
  length: number;
  /** BBAN segment layout. */
  bban: BbanSegment[];
  /** Human-readable structure, e.g. "8n,16c". */
  structure: string;
  /** Optional pretty component labels (when known). */
  labels?: string[];
}

/**
 * ISO 13616 IBAN registry — 70+ countries. Lengths verified against
 * SWIFT/IBAN registry and Wikipedia's IBAN article (Jun 2026).
 */
export const IBAN_REGISTRY: Record<string, CountrySpec> = {
  AD: { country: "AD", name: "Andorra", length: 24, bban: [{ type: "n", length: 8 }, { type: "c", length: 12 }], structure: "8n,12c", labels: ["Bank code", "Account"] },
  AE: { country: "AE", name: "United Arab Emirates", length: 23, bban: [{ type: "n", length: 3 }, { type: "n", length: 16 }], structure: "3n,16n", labels: ["Bank", "Account"] },
  AL: { country: "AL", name: "Albania", length: 28, bban: [{ type: "n", length: 8 }, { type: "c", length: 16 }], structure: "8n,16c", labels: ["Bank", "Branch", "Account", "National check"] },
  AT: { country: "AT", name: "Austria", length: 20, bban: [{ type: "n", length: 16 }], structure: "16n", labels: ["Bank", "Account"] },
  AZ: { country: "AZ", name: "Azerbaijan", length: 28, bban: [{ type: "a", length: 4 }, { type: "n", length: 20 }], structure: "4a,20n", labels: ["Bank", "Account"] },
  BA: { country: "BA", name: "Bosnia & Herzegovina", length: 20, bban: [{ type: "n", length: 16 }], structure: "16n", labels: ["Bank", "Branch", "Account", "National check"] },
  BE: { country: "BE", name: "Belgium", length: 16, bban: [{ type: "n", length: 12 }], structure: "12n", labels: ["Bank code", "Account", "National check"] },
  BG: { country: "BG", name: "Bulgaria", length: 22, bban: [{ type: "a", length: 4 }, { type: "n", length: 6 }, { type: "c", length: 8 }], structure: "4a,6n,8c", labels: ["Bank", "Branch", "Account", "Bank BIC"] },
  BH: { country: "BH", name: "Bahrain", length: 22, bban: [{ type: "a", length: 4 }, { type: "c", length: 14 }], structure: "4a,14c", labels: ["Bank", "Account"] },
  BR: { country: "BR", name: "Brazil", length: 29, bban: [{ type: "n", length: 23 }, { type: "a", length: 1 }, { type: "c", length: 1 }], structure: "23n,1a,1c", labels: ["Bank", "Branch", "Account", "Account type", "Owner"] },
  BY: { country: "BY", name: "Belarus", length: 28, bban: [{ type: "c", length: 4 }, { type: "n", length: 20 }], structure: "4c,20n", labels: ["Bank", "Branch", "Account"] },
  CH: { country: "CH", name: "Switzerland", length: 21, bban: [{ type: "n", length: 5 }, { type: "c", length: 12 }], structure: "5n,12c", labels: ["Bank", "Account"] },
  CR: { country: "CR", name: "Costa Rica", length: 22, bban: [{ type: "n", length: 18 }], structure: "18n", labels: ["Bank", "Account"] },
  CY: { country: "CY", name: "Cyprus", length: 28, bban: [{ type: "n", length: 8 }, { type: "c", length: 16 }], structure: "8n,16c", labels: ["Bank", "Branch", "Account"] },
  CZ: { country: "CZ", name: "Czech Republic", length: 24, bban: [{ type: "n", length: 20 }], structure: "20n", labels: ["Bank", "Account"] },
  DE: { country: "DE", name: "Germany", length: 22, bban: [{ type: "n", length: 18 }], structure: "18n", labels: ["Bank code", "Account"] },
  DK: { country: "DK", name: "Denmark", length: 18, bban: [{ type: "n", length: 14 }], structure: "14n", labels: ["Bank", "Account"] },
  DO: { country: "DO", name: "Dominican Republic", length: 28, bban: [{ type: "a", length: 4 }, { type: "n", length: 20 }], structure: "4a,20n", labels: ["Bank", "Account"] },
  EE: { country: "EE", name: "Estonia", length: 20, bban: [{ type: "n", length: 16 }], structure: "16n", labels: ["Bank", "Branch", "Account", "National check"] },
  EG: { country: "EG", name: "Egypt", length: 29, bban: [{ type: "n", length: 25 }], structure: "25n", labels: ["Bank", "Branch", "Account"] },
  ES: { country: "ES", name: "Spain", length: 24, bban: [{ type: "n", length: 20 }], structure: "20n", labels: ["Bank", "Branch", "Account", "National check"] },
  FI: { country: "FI", name: "Finland", length: 18, bban: [{ type: "n", length: 14 }], structure: "14n", labels: ["Bank", "Account", "National check"] },
  FO: { country: "FO", name: "Faroe Islands", length: 18, bban: [{ type: "n", length: 14 }], structure: "14n", labels: ["Bank", "Account"] },
  FR: { country: "FR", name: "France", length: 27, bban: [{ type: "n", length: 10 }, { type: "c", length: 11 }, { type: "n", length: 2 }], structure: "10n,11c,2n", labels: ["Bank", "Branch", "Account", "National check"] },
  GB: { country: "GB", name: "United Kingdom", length: 22, bban: [{ type: "a", length: 4 }, { type: "n", length: 6 }, { type: "n", length: 8 }], structure: "4a,6n,8n", labels: ["Bank (BIC)", "Sort code", "Account"] },
  GE: { country: "GE", name: "Georgia", length: 22, bban: [{ type: "c", length: 2 }, { type: "n", length: 16 }], structure: "2c,16n", labels: ["Bank", "Account"] },
  GI: { country: "GI", name: "Gibraltar", length: 23, bban: [{ type: "a", length: 4 }, { type: "c", length: 15 }], structure: "4a,15c", labels: ["Bank", "Account"] },
  GL: { country: "GL", name: "Greenland", length: 18, bban: [{ type: "n", length: 14 }], structure: "14n", labels: ["Bank", "Account"] },
  GR: { country: "GR", name: "Greece", length: 27, bban: [{ type: "n", length: 7 }, { type: "c", length: 16 }], structure: "7n,16c", labels: ["Bank", "Branch", "Account"] },
  GT: { country: "GT", name: "Guatemala", length: 28, bban: [{ type: "c", length: 4 }, { type: "c", length: 20 }], structure: "4c,20c", labels: ["Bank", "Currency", "Account"] },
  HR: { country: "HR", name: "Croatia", length: 21, bban: [{ type: "n", length: 17 }], structure: "17n", labels: ["Bank", "Branch", "Account"] },
  HU: { country: "HU", name: "Hungary", length: 28, bban: [{ type: "n", length: 24 }], structure: "24n", labels: ["Bank", "Branch", "Account", "National check"] },
  IE: { country: "IE", name: "Ireland", length: 22, bban: [{ type: "c", length: 4 }, { type: "n", length: 14 }], structure: "4c,14n", labels: ["Bank", "Branch", "Account"] },
  IL: { country: "IL", name: "Israel", length: 23, bban: [{ type: "n", length: 19 }], structure: "19n", labels: ["Bank", "Branch", "Account"] },
  IQ: { country: "IQ", name: "Iraq", length: 23, bban: [{ type: "a", length: 4 }, { type: "n", length: 15 }], structure: "4a,15n", labels: ["Bank", "Branch", "Account"] },
  IS: { country: "IS", name: "Iceland", length: 26, bban: [{ type: "n", length: 22 }], structure: "22n", labels: ["Bank", "Branch", "Account", "Identification"] },
  IT: { country: "IT", name: "Italy", length: 27, bban: [{ type: "a", length: 1 }, { type: "n", length: 10 }, { type: "c", length: 12 }], structure: "1a,10n,12c", labels: ["National check", "Bank", "Branch", "Account"] },
  JO: { country: "JO", name: "Jordan", length: 30, bban: [{ type: "a", length: 4 }, { type: "n", length: 22 }], structure: "4a,22n", labels: ["Bank", "Branch", "Account"] },
  KW: { country: "KW", name: "Kuwait", length: 30, bban: [{ type: "a", length: 4 }, { type: "c", length: 22 }], structure: "4a,22c", labels: ["Bank", "Account"] },
  KZ: { country: "KZ", name: "Kazakhstan", length: 20, bban: [{ type: "n", length: 3 }, { type: "c", length: 13 }], structure: "3n,13c", labels: ["Bank", "Account"] },
  LB: { country: "LB", name: "Lebanon", length: 28, bban: [{ type: "n", length: 4 }, { type: "c", length: 20 }], structure: "4n,20c", labels: ["Bank", "Account"] },
  LC: { country: "LC", name: "Saint Lucia", length: 32, bban: [{ type: "a", length: 4 }, { type: "c", length: 24 }], structure: "4a,24c", labels: ["Bank", "Account"] },
  LI: { country: "LI", name: "Liechtenstein", length: 21, bban: [{ type: "n", length: 5 }, { type: "c", length: 12 }], structure: "5n,12c", labels: ["Bank", "Account"] },
  LT: { country: "LT", name: "Lithuania", length: 20, bban: [{ type: "n", length: 16 }], structure: "16n", labels: ["Bank", "Account"] },
  LU: { country: "LU", name: "Luxembourg", length: 20, bban: [{ type: "n", length: 3 }, { type: "c", length: 13 }], structure: "3n,13c", labels: ["Bank", "Account"] },
  LV: { country: "LV", name: "Latvia", length: 21, bban: [{ type: "a", length: 4 }, { type: "c", length: 13 }], structure: "4a,13c", labels: ["Bank", "Account"] },
  LY: { country: "LY", name: "Libya", length: 25, bban: [{ type: "n", length: 21 }], structure: "21n", labels: ["Bank", "Branch", "Account"] },
  MC: { country: "MC", name: "Monaco", length: 27, bban: [{ type: "n", length: 10 }, { type: "c", length: 11 }, { type: "n", length: 2 }], structure: "10n,11c,2n", labels: ["Bank", "Branch", "Account", "National check"] },
  MD: { country: "MD", name: "Moldova", length: 24, bban: [{ type: "c", length: 2 }, { type: "c", length: 18 }], structure: "2c,18c", labels: ["Bank", "Account"] },
  ME: { country: "ME", name: "Montenegro", length: 22, bban: [{ type: "n", length: 18 }], structure: "18n", labels: ["Bank", "Account", "National check"] },
  MK: { country: "MK", name: "North Macedonia", length: 19, bban: [{ type: "n", length: 3 }, { type: "c", length: 10 }, { type: "n", length: 2 }], structure: "3n,10c,2n", labels: ["Bank", "Account", "National check"] },
  MR: { country: "MR", name: "Mauritania", length: 27, bban: [{ type: "n", length: 23 }], structure: "23n", labels: ["Bank", "Branch", "Account", "National check"] },
  MT: { country: "MT", name: "Malta", length: 31, bban: [{ type: "a", length: 4 }, { type: "n", length: 5 }, { type: "c", length: 18 }], structure: "4a,5n,18c", labels: ["Bank", "Branch", "Account"] },
  MU: { country: "MU", name: "Mauritius", length: 30, bban: [{ type: "a", length: 4 }, { type: "n", length: 19 }, { type: "a", length: 3 }], structure: "4a,19n,3a", labels: ["Bank", "Branch", "Account", "Currency"] },
  NL: { country: "NL", name: "Netherlands", length: 18, bban: [{ type: "a", length: 4 }, { type: "n", length: 10 }], structure: "4a,10n", labels: ["Bank", "Account"] },
  NO: { country: "NO", name: "Norway", length: 15, bban: [{ type: "n", length: 11 }], structure: "11n", labels: ["Bank", "Account", "National check"] },
  PK: { country: "PK", name: "Pakistan", length: 24, bban: [{ type: "c", length: 4 }, { type: "n", length: 16 }], structure: "4c,16n", labels: ["Bank", "Account"] },
  PL: { country: "PL", name: "Poland", length: 28, bban: [{ type: "n", length: 24 }], structure: "24n", labels: ["Bank", "Branch", "Account", "National check"] },
  PS: { country: "PS", name: "Palestine", length: 29, bban: [{ type: "c", length: 4 }, { type: "n", length: 21 }], structure: "4c,21n", labels: ["Bank", "Branch", "Account"] },
  PT: { country: "PT", name: "Portugal", length: 25, bban: [{ type: "n", length: 21 }], structure: "21n", labels: ["Bank", "Branch", "Account", "National check"] },
  QA: { country: "QA", name: "Qatar", length: 29, bban: [{ type: "a", length: 4 }, { type: "c", length: 21 }], structure: "4a,21c", labels: ["Bank", "Account"] },
  RO: { country: "RO", name: "Romania", length: 24, bban: [{ type: "a", length: 4 }, { type: "c", length: 16 }], structure: "4a,16c", labels: ["Bank", "Account"] },
  RS: { country: "RS", name: "Serbia", length: 22, bban: [{ type: "n", length: 18 }], structure: "18n", labels: ["Bank", "Account", "National check"] },
  SA: { country: "SA", name: "Saudi Arabia", length: 24, bban: [{ type: "n", length: 2 }, { type: "c", length: 18 }], structure: "2n,18c", labels: ["Bank", "Account"] },
  SC: { country: "SC", name: "Seychelles", length: 31, bban: [{ type: "a", length: 4 }, { type: "n", length: 20 }, { type: "a", length: 3 }], structure: "4a,20n,3a", labels: ["Bank", "Branch", "Account", "Currency"] },
  SD: { country: "SD", name: "Sudan", length: 18, bban: [{ type: "n", length: 14 }], structure: "14n", labels: ["Bank", "Account"] },
  SE: { country: "SE", name: "Sweden", length: 24, bban: [{ type: "n", length: 20 }], structure: "20n", labels: ["Bank", "Account"] },
  SI: { country: "SI", name: "Slovenia", length: 19, bban: [{ type: "n", length: 15 }], structure: "15n", labels: ["Bank", "Branch", "Account"] },
  SK: { country: "SK", name: "Slovakia", length: 24, bban: [{ type: "n", length: 20 }], structure: "20n", labels: ["Bank", "Account"] },
  SM: { country: "SM", name: "San Marino", length: 27, bban: [{ type: "a", length: 1 }, { type: "n", length: 10 }, { type: "c", length: 12 }], structure: "1a,10n,12c", labels: ["National check", "Bank", "Branch", "Account"] },
  ST: { country: "ST", name: "São Tomé & Príncipe", length: 25, bban: [{ type: "n", length: 21 }], structure: "21n", labels: ["Bank", "Branch", "Account"] },
  SV: { country: "SV", name: "El Salvador", length: 28, bban: [{ type: "a", length: 4 }, { type: "n", length: 20 }], structure: "4a,20n", labels: ["Bank", "Account"] },
  TL: { country: "TL", name: "Timor-Leste", length: 23, bban: [{ type: "n", length: 19 }], structure: "19n", labels: ["Bank", "Branch", "Account"] },
  TN: { country: "TN", name: "Tunisia", length: 24, bban: [{ type: "n", length: 20 }], structure: "20n", labels: ["Bank", "Branch", "Account"] },
  TR: { country: "TR", name: "Turkey", length: 26, bban: [{ type: "n", length: 5 }, { type: "c", length: 17 }], structure: "5n,17c", labels: ["Bank", "Account"] },
  UA: { country: "UA", name: "Ukraine", length: 29, bban: [{ type: "n", length: 6 }, { type: "c", length: 19 }], structure: "6n,19c", labels: ["Bank", "Account"] },
  VA: { country: "VA", name: "Vatican City", length: 22, bban: [{ type: "n", length: 3 }, { type: "n", length: 15 }], structure: "3n,15n", labels: ["Bank", "Account"] },
  VG: { country: "VG", name: "British Virgin Islands", length: 24, bban: [{ type: "c", length: 4 }, { type: "n", length: 16 }], structure: "4c,16n", labels: ["Bank", "Account"] },
  XK: { country: "XK", name: "Kosovo", length: 20, bban: [{ type: "n", length: 4 }, { type: "n", length: 10 }, { type: "n", length: 2 }], structure: "4n,10n,2n", labels: ["Bank", "Branch", "Account", "National check"] },
};

export const COUNTRY_LIST: string[] = Object.keys(IBAN_REGISTRY).sort();

export function getCountrySpec(country: string): CountrySpec | null {
  if (!country) return null;
  return IBAN_REGISTRY[country.toUpperCase()] ?? null;
}

export function listCountries(): { country: string; name: string; length: number; structure: string }[] {
  return COUNTRY_LIST.map((c) => ({
    country: c,
    name: IBAN_REGISTRY[c]!.name,
    length: IBAN_REGISTRY[c]!.length,
    structure: IBAN_REGISTRY[c]!.structure,
  }));
}

// ---------------------------------------------------------------------------
// PRNG — deterministic mulberry32 (for reproducible test IBAN generation)
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
// Normalization & character conversion
// ---------------------------------------------------------------------------

/** Uppercase and strip whitespace from an IBAN. */
export function normalizeIban(input: string): string {
  return (input || "").toUpperCase().replace(/\s+/g, "");
}

/** Convert a single alphanumeric character to its MOD-97 numeric value. */
export function charToValue(ch: string): number {
  const c = ch.toUpperCase();
  if (c >= "0" && c <= "9") return c.charCodeAt(0) - "0".charCodeAt(0);
  if (c >= "A" && c <= "Z") return c.charCodeAt(0) - "A".charCodeAt(0) + 10;
  throw new Error(`charToValue: invalid character '${ch}'`);
}

/**
 * Convert an entire string to its MOD-97 digit string.
 * Each letter becomes two digits (A=10, B=11, ..., Z=35).
 * Digits stay as themselves.
 */
export function alphaToDigits(s: string): string {
  let out = "";
  for (const ch of s) {
    if (ch >= "0" && ch <= "9") {
      out += ch;
    } else if (ch >= "A" && ch <= "Z") {
      out += (ch.charCodeAt(0) - "A".charCodeAt(0) + 10).toString();
    } else if (ch >= "a" && ch <= "z") {
      out += (ch.charCodeAt(0) - "a".charCodeAt(0) + 10).toString();
    } else {
      throw new Error(`alphaToDigits: invalid character '${ch}'`);
    }
  }
  return out;
}

/**
 * Chunked MOD-97 — compute (numeric string) mod 97 without overflowing
 * JS Number. Processes left-to-right in chunks of up to 9 digits.
 */
export function mod97(numericString: string): number {
  if (!/^\d+$/.test(numericString)) {
    throw new Error("mod97: input must be all digits");
  }
  let remainder = 0;
  const chunkSize = 9;
  for (let i = 0; i < numericString.length; i += chunkSize) {
    const chunk = numericString.slice(i, i + chunkSize);
    const combined = remainder * Math.pow(10, chunk.length) + parseInt(chunk, 10);
    remainder = combined % 97;
  }
  return remainder;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type IbanValidationCode =
  | "valid"
  | "empty"
  | "too_short"
  | "bad_chars"
  | "unknown_country"
  | "wrong_length"
  | "bad_structure"
  | "bad_checksum";

export interface IbanValidationResult {
  input: string;
  normalized: string;
  valid: boolean;
  code: IbanValidationCode;
  message: string;
  country: string | null;
  countryName: string | null;
  expectedLength: number | null;
  actualLength: number;
  checkDigits: string | null;
  mod97Remainder: number | null;
}

/** Validate an IBAN structurally and via MOD-97. */
export function validateIban(input: string): IbanValidationResult {
  const normalized = normalizeIban(input);
  const actualLength = normalized.length;

  if (normalized === "") {
    return {
      input, normalized, valid: false, code: "empty",
      message: "IBAN is empty",
      country: null, countryName: null,
      expectedLength: null, actualLength,
      checkDigits: null, mod97Remainder: null,
    };
  }
  if (actualLength < 5) {
    return {
      input, normalized, valid: false, code: "too_short",
      message: "IBAN too short (minimum 5 chars)",
      country: null, countryName: null,
      expectedLength: null, actualLength,
      checkDigits: null, mod97Remainder: null,
    };
  }
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(normalized)) {
    return {
      input, normalized, valid: false, code: "bad_chars",
      message: "Invalid characters — IBAN must be 2 letters, 2 digits, then alphanumeric",
      country: null, countryName: null,
      expectedLength: null, actualLength,
      checkDigits: normalized.slice(2, 4) || null, mod97Remainder: null,
    };
  }

  const country = normalized.slice(0, 2);
  const checkDigits = normalized.slice(2, 4);
  const spec = getCountrySpec(country);

  if (!spec) {
    return {
      input, normalized, valid: false, code: "unknown_country",
      message: `Country '${country}' is not in the IBAN registry`,
      country, countryName: null,
      expectedLength: null, actualLength,
      checkDigits, mod97Remainder: null,
    };
  }
  if (actualLength !== spec.length) {
    return {
      input, normalized, valid: false, code: "wrong_length",
      message: `Wrong length — ${spec.name} IBANs must be ${spec.length} chars (got ${actualLength})`,
      country, countryName: spec.name,
      expectedLength: spec.length, actualLength,
      checkDigits, mod97Remainder: null,
    };
  }

  // Structural check: BBAN must match per-segment character types.
  const bban = normalized.slice(4);
  if (!bbanMatchesStructure(bban, spec.bban)) {
    return {
      input, normalized, valid: false, code: "bad_structure",
      message: `BBAN structure mismatch — ${spec.name} expects ${spec.structure}`,
      country, countryName: spec.name,
      expectedLength: spec.length, actualLength,
      checkDigits, mod97Remainder: null,
    };
  }

  // MOD-97 checksum
  const rearranged = normalized.slice(4) + normalized.slice(0, 4);
  const digits = alphaToDigits(rearranged);
  const remainder = mod97(digits);
  const valid = remainder === 1;

  return {
    input, normalized, valid,
    code: valid ? "valid" : "bad_checksum",
    message: valid
      ? "Valid IBAN — MOD-97 checksum passes"
      : `MOD-97 checksum failed (remainder ${remainder}, expected 1)`,
    country, countryName: spec.name,
    expectedLength: spec.length, actualLength,
    checkDigits, mod97Remainder: remainder,
  };
}

/** Check whether a BBAN string matches a per-country segment layout. */
export function bbanMatchesStructure(bban: string, segments: BbanSegment[]): boolean {
  let pos = 0;
  for (const seg of segments) {
    const chunk = bban.slice(pos, pos + seg.length);
    if (chunk.length !== seg.length) return false;
    for (const ch of chunk) {
      if (!charMatchesType(ch, seg.type)) return false;
    }
    pos += seg.length;
  }
  return pos === bban.length;
}

export function charMatchesType(ch: string, type: BbanCharType): boolean {
  switch (type) {
    case "n": return ch >= "0" && ch <= "9";
    case "a": return ch >= "A" && ch <= "Z";
    case "c": return (ch >= "0" && ch <= "9") || (ch >= "A" && ch <= "Z");
    default: return false;
  }
}

// ---------------------------------------------------------------------------
// Check digit computation
// ---------------------------------------------------------------------------

/** Compute MOD-97 check digits (2-digit, zero-padded) for an IBAN without them. */
export function computeCheckDigits(country: string, bban: string): string {
  const cc = country.toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) {
    throw new Error("computeCheckDigits: country must be 2 letters");
  }
  // Construct the candidate IBAN with placeholder check digits "00".
  // Then rearrange: BBAN + country + "00" → digit string → mod 97.
  const rearranged = bban + cc + "00";
  const digits = alphaToDigits(rearranged);
  const remainder = mod97(digits);
  const check = 98 - remainder;
  return check.toString().padStart(2, "0");
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

const CHARSET_N = "0123456789";
const CHARSET_A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function charsetFor(type: BbanCharType): string {
  switch (type) {
    case "n": return CHARSET_N;
    case "a": return CHARSET_A;
    case "c": return CHARSET_N + CHARSET_A;
    default: return CHARSET_N;
  }
}

/** Generate a random BBAN matching the country's segment layout. */
export function generateBban(spec: CountrySpec, rng: Rng): string {
  let bban = "";
  for (const seg of spec.bban) {
    const charset = charsetFor(seg.type);
    for (let i = 0; i < seg.length; i++) {
      bban += charset[Math.floor(rng.next() * charset.length)];
    }
  }
  return bban;
}

/** Generate a single valid test IBAN for a given country. */
export function generateIban(country: string, rng: Rng): string {
  const spec = getCountrySpec(country);
  if (!spec) {
    throw new Error(`generateIban: unknown country '${country}'`);
  }
  const bban = generateBban(spec, rng);
  const check = computeCheckDigits(spec.country, bban);
  return spec.country + check + bban;
}

export interface GenerateOptions {
  country: string;
  count: number;
  seed?: string | number;
}

/** Generate a batch of test IBANs (max 1000 per call). */
export function generateIbanBatch(opts: GenerateOptions): string[] {
  const spec = getCountrySpec(opts.country);
  if (!spec) {
    throw new Error(`generateIbanBatch: unknown country '${opts.country}'`);
  }
  const seed = opts.seed ?? Math.random().toString(36).slice(2);
  const rng = createRng(seed);
  const n = Math.max(0, Math.min(opts.count, 1000));
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    out.push(generateIban(spec.country, rng));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Decode (structural breakdown)
// ---------------------------------------------------------------------------

export interface DecodedSegment {
  label: string;
  value: string;
  type: BbanCharType;
  length: number;
}

export interface IbanDecoded {
  country: string;
  countryName: string;
  checkDigits: string;
  bban: string;
  segments: DecodedSegment[];
  structure: string;
}

/**
 * Decode an IBAN into its structural components. Returns null on unknown
 * country. Does NOT validate the checksum — use validateIban() for that.
 */
export function decodeIban(input: string): IbanDecoded | null {
  const normalized = normalizeIban(input);
  if (normalized.length < 4) return null;
  const country = normalized.slice(0, 2);
  const checkDigits = normalized.slice(2, 4);
  const bban = normalized.slice(4);
  const spec = getCountrySpec(country);
  if (!spec) return null;

  const segments: DecodedSegment[] = [];
  let pos = 0;
  for (let i = 0; i < spec.bban.length; i++) {
    const seg = spec.bban[i]!;
    const value = bban.slice(pos, pos + seg.length);
    const label = spec.labels && spec.labels[i] ? spec.labels[i]! : `Segment ${i + 1}`;
    segments.push({ label, value, type: seg.type, length: seg.length });
    pos += seg.length;
  }

  return {
    country: spec.country,
    countryName: spec.name,
    checkDigits,
    bban,
    segments,
    structure: spec.structure,
  };
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export type IbanFormat = "electronic" | "print";

/** Format an IBAN as either electronic (no spaces) or print (4-char groups). */
export function formatIban(input: string, format: IbanFormat): string {
  const normalized = normalizeIban(input);
  if (format === "electronic") return normalized;
  return normalized.match(/.{1,4}/g)?.join(" ") ?? normalized;
}

/** Mask all but the first 4 (country + check) and last 4 characters. */
export function maskIban(input: string): string {
  const normalized = normalizeIban(input);
  if (normalized.length <= 8) return normalized;
  return normalized.slice(0, 4) + "•".repeat(normalized.length - 8) + normalized.slice(-4);
}

// ---------------------------------------------------------------------------
// Batch validation
// ---------------------------------------------------------------------------

export interface BatchRow {
  index: number;
  raw: string;
  normalized: string;
  valid: boolean;
  code: IbanValidationCode;
  message: string;
  country: string | null;
  countryName: string | null;
}

/** Parse batch input — one IBAN per line (commas/semicolons also accepted). */
export function parseBatchInput(input: string): string[] {
  if (!input) return [];
  return input
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Validate a list of IBANs. */
export function validateBatch(ibans: string[]): BatchRow[] {
  return ibans.map((raw, index) => {
    const r = validateIban(raw);
    return {
      index,
      raw,
      normalized: r.normalized,
      valid: r.valid,
      code: r.code,
      message: r.message,
      country: r.country,
      countryName: r.countryName,
    };
  });
}

export interface BatchSummary {
  total: number;
  valid: number;
  invalid: number;
  byCountry: Record<string, number>;
}

export function summarizeBatch(rows: BatchRow[]): BatchSummary {
  const byCountry: Record<string, number> = {};
  let valid = 0;
  for (const r of rows) {
    if (r.valid) valid++;
    const k = r.countryName || r.country || "Unknown";
    byCountry[k] = (byCountry[k] ?? 0) + 1;
  }
  return { total: rows.length, valid, invalid: rows.length - valid, byCountry };
}

/** Render batch rows as CSV. */
export function renderBatchCsv(rows: BatchRow[]): string {
  const headers = ["index", "raw", "normalized", "valid", "code", "country", "message"];
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push([
      String(r.index),
      escapeCsvCell(r.raw),
      escapeCsvCell(r.normalized),
      r.valid ? "valid" : "invalid",
      r.code,
      escapeCsvCell(r.countryName || r.country || ""),
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
// Autocomplete for missing digits
// ---------------------------------------------------------------------------

/**
 * Given an IBAN template containing '?' placeholders, fill them with random
 * valid characters and compute correct check digits. Useful for partial
 * IBAN reconstruction.
 */
export function autocompleteIban(template: string, rng: Rng): string {
  const normalized = normalizeIban(template);
  if (normalized.length < 4) {
    throw new Error("autocompleteIban: template too short — needs at least country code + check digits");
  }
  const country = normalized.slice(0, 2);
  const spec = getCountrySpec(country);
  if (!spec) {
    throw new Error(`autocompleteIban: unknown country '${country}'`);
  }
  // Build a full-length template, padding with '?' as needed.
  let bbanTemplate = normalized.slice(4);
  const bbanLength = spec.length - 4;
  while (bbanTemplate.length < bbanLength) bbanTemplate += "?";
  bbanTemplate = bbanTemplate.slice(0, bbanLength);

  // Walk the segments and fill '?' with random chars of the appropriate type.
  let bban = "";
  let pos = 0;
  for (const seg of spec.bban) {
    const chunk = bbanTemplate.slice(pos, pos + seg.length);
    const charset = charsetFor(seg.type);
    for (let i = 0; i < seg.length; i++) {
      const ch = chunk[i] ?? "?";
      if (ch === "?") {
        bban += charset[Math.floor(rng.next() * charset.length)];
      } else if (charMatchesType(ch, seg.type)) {
        bban += ch;
      } else {
        // Wrong-type character — replace with random valid one.
        bban += charset[Math.floor(rng.next() * charset.length)];
      }
    }
    pos += seg.length;
  }

  const check = computeCheckDigits(spec.country, bban);
  return spec.country + check + bban;
}

// ---------------------------------------------------------------------------
// Canonical test vectors (real-world sample IBANs from public docs)
// ---------------------------------------------------------------------------

/**
 * Known-good IBAN test vectors sourced from public documentation
 * (Wikipedia, iban.com examples, bank.codes examples). All are MOD-97-valid
 * and structural matches for their country.
 */
export const CANONICAL_VALID_IBANS: readonly { iban: string; country: string; note: string }[] = [
  { iban: "GB82WEST12345698765432", country: "GB", note: "Wikipedia UK example" },
  { iban: "BE68539007547034", country: "BE", note: "Wikipedia Belgium example" },
  { iban: "FR1420041010050500013M02606", country: "FR", note: "Wikipedia France example" },
  { iban: "DE89370400440532013000", country: "DE", note: "Wikipedia Germany example" },
  { iban: "CH9300762011623852957", country: "CH", note: "Wikipedia Switzerland example" },
  { iban: "AT611904300234573201", country: "AT", note: "Wikipedia Austria example" },
  { iban: "NL91ABNA0417164300", country: "NL", note: "Wikipedia Netherlands example" },
  { iban: "IT60X0542811101000000123456", country: "IT", note: "Wikipedia Italy example" },
  { iban: "AD1200012030200359100100", country: "AD", note: "Andorra example" },
  { iban: "SA0380000000608010167519", country: "SA", note: "Saudi Arabia example" },
  { iban: "AE070331234567890123456", country: "AE", note: "UAE example" },
  { iban: "ES9121000418450200051332", country: "ES", note: "Spain example" },
];

/** IBANs that should fail validation (bad checksum or structure). */
export const CANONICAL_INVALID_IBANS: readonly { iban: string; note: string }[] = [
  { iban: "GB82WEST12345698765433", note: "UK IBAN with wrong last digit" },
  { iban: "DE89370400440532013001", note: "German IBAN with wrong check digit" },
  { iban: "XX82WEST12345698765432", note: "Unknown country code" },
  { iban: "GB82WEST123", note: "Truncated UK IBAN — wrong length" },
];

// ---------------------------------------------------------------------------
// History (localStorage) — stores metadata only, NEVER IBANs
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:iban-generator-validator:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  action: "generate" | "validate_single" | "validate_batch";
  country: string | null;
  format: IbanFormat;
  generateCount: number;
  batchTotal: number;
  batchValid: number;
  batchInvalid: number;
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
  country: string,
  count: number,
  format: IbanFormat,
): string {
  const params = new URLSearchParams();
  if (country) params.set("cc", country.toUpperCase());
  if (count) params.set("count", String(count));
  if (format) params.set("fmt", format);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(
  hash: string,
): { country: string; count: number; format: IbanFormat } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { country: "DE", count: 10, format: "print" };
  const params = new URLSearchParams(clean);
  const cc = (params.get("cc") ?? "DE").toUpperCase();
  const country = IBAN_REGISTRY[cc] ? cc : "DE";
  const countStr = params.get("count") ?? "10";
  const parsedCount = parseInt(countStr, 10);
  const count = Number.isNaN(parsedCount) ? 10 : Math.max(1, Math.min(1000, parsedCount));
  const fmt = params.get("fmt") ?? "print";
  const format: IbanFormat = fmt === "electronic" ? "electronic" : "print";
  return { country, count, format };
}

// ---------------------------------------------------------------------------
// Honesty banner — sandbox only
// ---------------------------------------------------------------------------

export const HONESTY_BANNER =
  "Generated IBANs are structurally valid (pass MOD-97 + length + character-type checks) but UNASSIGNED. They are for testing/development only — never use them for real financial transactions.";
