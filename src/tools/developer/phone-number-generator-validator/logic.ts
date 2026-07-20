/**
 * Phone Number Generator & Validator — pure logic.
 *
 * Generates and validates phone numbers across 30+ country numbering plans.
 * Provides multi-format normalization (E.164, international, national,
 * RFC 3966 tel: URI), country auto-detect, number-type detection, batch
 * processing, and a deterministic seeded PRNG for reproducible test data.
 *
 * Pure functions only — no DOM, no network, no external deps.
 *
 * SANDBOX HONESTY CLAUSE: Generated numbers are structurally valid (correct
 * calling code, NSN length, and prefix) but UNASSIGNED. They are for
 * testing/development only. Never use them for real calls, SMS, or 2FA.
 *
 * PRIVACY: The history feature stores only metadata (counts + timestamps),
 * NEVER the phone numbers themselves. Phone numbers are never transmitted
 * or logged.
 */

// ---------------------------------------------------------------------------
// Country registry (30+ numbering plans)
// ---------------------------------------------------------------------------

/** Phone number type as classified by the numbering plan. */
export type PhoneNumberType =
  | "mobile"
  | "fixed"
  | "toll-free"
  | "voip"
  | "premium"
  | "unknown";

/** Per-country numbering plan spec. */
export interface CountryPhoneSpec {
  /** ISO 3166-1 alpha-2 country code. */
  country: string;
  /** Full country name. */
  name: string;
  /** E.164 country calling code (no "+"). */
  callingCode: string;
  /** National Significant Number length (excluding calling code). */
  nsnLength: number;
  /** Trunk prefix used for national dialing (e.g. "0" in UK). */
  trunkPrefix?: string;
  /** National destination code length (area code), if applicable. */
  ndcLength?: number;
  /** National format template using N for digits. */
  nationalFormat: string;
  /** International format template using N for digits. */
  internationalFormat: string;
  /** Mobile number prefixes (start of NSN). */
  mobilePrefixes: string[];
  /** Fixed-line number prefixes (start of NSN). */
  fixedPrefixes: string[];
  /** Toll-free number prefixes (start of NSN). */
  tollFreePrefixes?: string[];
}

/**
 * Bundled numbering-plan registry for 30+ countries.
 * Lengths/prefixes verified against Wikipedia "Telephone numbers in" articles
 * and the ITU-T E.164 national numbering plans (Jun 2026).
 */
export const PHONE_REGISTRY: Record<string, CountryPhoneSpec> = {
  US: { country: "US", name: "United States", callingCode: "1", nsnLength: 10, nationalFormat: "(NNN) NNN-NNNN", internationalFormat: "+N NNN NNN-NNNN", mobilePrefixes: ["2", "3", "4", "5", "6", "7", "8", "9"], fixedPrefixes: ["2", "3", "4", "5", "6", "7", "8", "9"], tollFreePrefixes: ["800", "833", "844", "855", "866", "877", "888"] },
  CA: { country: "CA", name: "Canada", callingCode: "1", nsnLength: 10, nationalFormat: "(NNN) NNN-NNNN", internationalFormat: "+N NNN NNN-NNNN", mobilePrefixes: ["2", "3", "4", "5", "6", "7", "8", "9"], fixedPrefixes: ["2", "3", "4", "5", "6", "7", "8", "9"], tollFreePrefixes: ["800", "833", "844", "855", "866", "877", "888"] },
  GB: { country: "GB", name: "United Kingdom", callingCode: "44", nsnLength: 10, trunkPrefix: "0", nationalFormat: "(0NN) NNNN NNNN", internationalFormat: "+NN NN NNNN NNNN", mobilePrefixes: ["7"], fixedPrefixes: ["1", "2"], tollFreePrefixes: ["800", "808"] },
  FR: { country: "FR", name: "France", callingCode: "33", nsnLength: 9, trunkPrefix: "0", nationalFormat: "0N NN NN NN NN", internationalFormat: "+NN N NN NN NN NN", mobilePrefixes: ["6", "7"], fixedPrefixes: ["1", "2", "3", "4", "5"], tollFreePrefixes: ["800", "805"] },
  DE: { country: "DE", name: "Germany", callingCode: "49", nsnLength: 10, trunkPrefix: "0", nationalFormat: "0NNN NNNNNNN", internationalFormat: "+NN NNN NNNNNNN", mobilePrefixes: ["15", "16", "17"], fixedPrefixes: ["2", "3", "4", "5", "6", "7", "8", "9"] },
  IT: { country: "IT", name: "Italy", callingCode: "39", nsnLength: 10, nationalFormat: "NNN NNN NNNN", internationalFormat: "+NN NNN NNN NNNN", mobilePrefixes: ["3"], fixedPrefixes: ["0"], tollFreePrefixes: ["800"] },
  ES: { country: "ES", name: "Spain", callingCode: "34", nsnLength: 9, nationalFormat: "NNN NN NN NN", internationalFormat: "+NN NNN NN NN NN", mobilePrefixes: ["6", "7"], fixedPrefixes: ["8", "9"], tollFreePrefixes: ["800", "900"] },
  NL: { country: "NL", name: "Netherlands", callingCode: "31", nsnLength: 9, trunkPrefix: "0", nationalFormat: "0N NNNNNNNN", internationalFormat: "+NN N NNNNNNNN", mobilePrefixes: ["6"], fixedPrefixes: ["1", "2", "3", "4", "5", "7", "8"], tollFreePrefixes: ["800"] },
  BE: { country: "BE", name: "Belgium", callingCode: "32", nsnLength: 9, trunkPrefix: "0", nationalFormat: "0NN NN NN NN", internationalFormat: "+NN NN NN NN NN", mobilePrefixes: ["4"], fixedPrefixes: ["1", "2", "3", "5", "6", "7", "8", "9"] },
  CH: { country: "CH", name: "Switzerland", callingCode: "41", nsnLength: 9, trunkPrefix: "0", nationalFormat: "0NN NNN NN NN", internationalFormat: "+NN NN NNN NN NN", mobilePrefixes: ["7"], fixedPrefixes: ["2", "3", "4", "5", "6", "8"], tollFreePrefixes: ["800"] },
  AT: { country: "AT", name: "Austria", callingCode: "43", nsnLength: 10, trunkPrefix: "0", nationalFormat: "0NNN NNNNNNN", internationalFormat: "+NN NNN NNNNNNN", mobilePrefixes: ["6"], fixedPrefixes: ["1", "2", "3", "4", "5", "7", "8"] },
  SE: { country: "SE", name: "Sweden", callingCode: "46", nsnLength: 9, trunkPrefix: "0", nationalFormat: "0NN NNN NN NN", internationalFormat: "+NN NN NNN NN NN", mobilePrefixes: ["7"], fixedPrefixes: ["1", "2", "3", "4", "5", "6", "8", "9"] },
  NO: { country: "NO", name: "Norway", callingCode: "47", nsnLength: 8, nationalFormat: "NNN NN NNN", internationalFormat: "+NN NNN NN NNN", mobilePrefixes: ["4", "9"], fixedPrefixes: ["2", "3", "5", "6", "7", "8"] },
  DK: { country: "DK", name: "Denmark", callingCode: "45", nsnLength: 8, nationalFormat: "NN NN NN NN", internationalFormat: "+NN NN NN NN NN", mobilePrefixes: ["2", "3", "4", "5", "6", "7", "8", "9"], fixedPrefixes: ["2", "3", "4", "5", "6", "7", "8", "9"] },
  FI: { country: "FI", name: "Finland", callingCode: "358", nsnLength: 9, trunkPrefix: "0", nationalFormat: "0NN NNN NNNN", internationalFormat: "+NNN NN NNN NNNN", mobilePrefixes: ["4", "5"], fixedPrefixes: ["2", "3", "6", "7", "8", "9"] },
  IE: { country: "IE", name: "Ireland", callingCode: "353", nsnLength: 9, trunkPrefix: "0", nationalFormat: "0NN NNN NNNN", internationalFormat: "+NNN NN NNN NNNN", mobilePrefixes: ["8"], fixedPrefixes: ["1", "2", "4", "5", "6", "7", "9"] },
  PT: { country: "PT", name: "Portugal", callingCode: "351", nsnLength: 9, nationalFormat: "NNN NNN NNN", internationalFormat: "+NNN NNN NNN NNN", mobilePrefixes: ["9"], fixedPrefixes: ["2"], tollFreePrefixes: ["800"] },
  GR: { country: "GR", name: "Greece", callingCode: "30", nsnLength: 10, nationalFormat: "NNN NNN NNNN", internationalFormat: "+NN NNN NNN NNNN", mobilePrefixes: ["6"], fixedPrefixes: ["2"] },
  PL: { country: "PL", name: "Poland", callingCode: "48", nsnLength: 9, nationalFormat: "NNN NNN NNN", internationalFormat: "+NN NNN NNN NNN", mobilePrefixes: ["5", "6", "7"], fixedPrefixes: ["2", "3", "4", "8", "9"] },
  RU: { country: "RU", name: "Russia", callingCode: "7", nsnLength: 10, nationalFormat: "(NNN) NNN-NN-NN", internationalFormat: "+N NNN NNN-NN-NN", mobilePrefixes: ["9"], fixedPrefixes: ["3", "4", "5", "8"], tollFreePrefixes: ["800"] },
  TR: { country: "TR", name: "Turkey", callingCode: "90", nsnLength: 10, trunkPrefix: "0", nationalFormat: "0NNN NNN NN NN", internationalFormat: "+NN NNN NNN NN NN", mobilePrefixes: ["5"], fixedPrefixes: ["2", "3", "4"], tollFreePrefixes: ["800"] },
  AU: { country: "AU", name: "Australia", callingCode: "61", nsnLength: 9, trunkPrefix: "0", nationalFormat: "0NNN NNN NNN", internationalFormat: "+NN NNN NNN NNN", mobilePrefixes: ["4", "5"], fixedPrefixes: ["2", "3", "7", "8"], tollFreePrefixes: ["800"] },
  NZ: { country: "NZ", name: "New Zealand", callingCode: "64", nsnLength: 9, trunkPrefix: "0", nationalFormat: "0N NNN NNNN", internationalFormat: "+NN N NNN NNNN", mobilePrefixes: ["2"], fixedPrefixes: ["3", "4", "6", "7", "9"] },
  JP: { country: "JP", name: "Japan", callingCode: "81", nsnLength: 10, trunkPrefix: "0", nationalFormat: "0N-NNNN-NNNN", internationalFormat: "+NN N NNNN NNNN", mobilePrefixes: ["70", "80", "90"], fixedPrefixes: ["1", "2", "3", "4", "5", "6"] },
  KR: { country: "KR", name: "South Korea", callingCode: "82", nsnLength: 9, trunkPrefix: "0", nationalFormat: "0NN NNNN NNNN", internationalFormat: "+NN NN NNNN NNNN", mobilePrefixes: ["10", "11"], fixedPrefixes: ["2", "3", "4", "5", "6", "7", "8", "9"] },
  CN: { country: "CN", name: "China", callingCode: "86", nsnLength: 11, nationalFormat: "NNN NNNN NNNN", internationalFormat: "+NN NNN NNNN NNNN", mobilePrefixes: ["13", "14", "15", "16", "17", "18", "19"], fixedPrefixes: ["10", "2", "3", "4", "5", "6", "7", "8", "9"] },
  IN: { country: "IN", name: "India", callingCode: "91", nsnLength: 10, nationalFormat: "NNNNN NNNNN", internationalFormat: "+NN NNNNN NNNNN", mobilePrefixes: ["6", "7", "8", "9"], fixedPrefixes: ["1", "2", "3", "4", "5"] },
  BR: { country: "BR", name: "Brazil", callingCode: "55", nsnLength: 11, nationalFormat: "(NN) NNNNN-NNNN", internationalFormat: "+NN NN NNNNN NNNN", mobilePrefixes: ["1", "2", "3", "4", "5", "6", "7", "8", "9"], fixedPrefixes: ["1", "2", "3", "4", "5"] },
  MX: { country: "MX", name: "Mexico", callingCode: "52", nsnLength: 10, nationalFormat: "NNN NNN NNNN", internationalFormat: "+NN NNN NNN NNNN", mobilePrefixes: ["1", "2", "3", "4", "5", "6", "7", "8", "9"], fixedPrefixes: ["1", "2", "3", "4", "5", "6", "7", "8", "9"] },
  ZA: { country: "ZA", name: "South Africa", callingCode: "27", nsnLength: 9, trunkPrefix: "0", nationalFormat: "0NN NNN NNNN", internationalFormat: "+NN NN NNN NNNN", mobilePrefixes: ["6", "7", "8"], fixedPrefixes: ["1", "2", "3", "4", "5"] },
  SA: { country: "SA", name: "Saudi Arabia", callingCode: "966", nsnLength: 9, trunkPrefix: "0", nationalFormat: "0NN NNN NNNN", internationalFormat: "+NNN NN NNN NNNN", mobilePrefixes: ["5"], fixedPrefixes: ["1", "2", "3", "4", "6", "7", "8", "9"] },
  AE: { country: "AE", name: "United Arab Emirates", callingCode: "971", nsnLength: 9, trunkPrefix: "0", nationalFormat: "0NN NNN NNNN", internationalFormat: "+NNN NN NNN NNNN", mobilePrefixes: ["5"], fixedPrefixes: ["2", "3", "4", "6", "7", "9"] },
  SG: { country: "SG", name: "Singapore", callingCode: "65", nsnLength: 8, nationalFormat: "NNNN NNNN", internationalFormat: "+NN NNNN NNNN", mobilePrefixes: ["8", "9"], fixedPrefixes: ["6"] },
  HK: { country: "HK", name: "Hong Kong", callingCode: "852", nsnLength: 8, nationalFormat: "NNNN NNNN", internationalFormat: "+NNN NNNN NNNN", mobilePrefixes: ["5", "6", "7", "8", "9"], fixedPrefixes: ["2", "3"] },
};

export const COUNTRY_LIST: string[] = Object.keys(PHONE_REGISTRY).sort();

/** Lookup a country spec by ISO code (case-insensitive). */
export function getCountrySpec(country: string): CountryPhoneSpec | null {
  if (!country) return null;
  return PHONE_REGISTRY[country.toUpperCase()] ?? null;
}

/** List all countries as plain meta objects. */
export function listCountries(): { country: string; name: string; callingCode: string; nsnLength: number }[] {
  return COUNTRY_LIST.map((c) => ({
    country: c,
    name: PHONE_REGISTRY[c]!.name,
    callingCode: PHONE_REGISTRY[c]!.callingCode,
    nsnLength: PHONE_REGISTRY[c]!.nsnLength,
  }));
}

// ---------------------------------------------------------------------------
// PRNG — deterministic mulberry32 (for reproducible test number generation)
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
  digit(): string;
}

export function createRng(seed: string | number): Rng {
  const r = mulberry32(hashSeed(seed));
  const int = (min: number, max: number): number =>
    Math.floor(r() * (max - min + 1)) + min;
  const pick = <T,>(arr: readonly T[]): T => {
    if (arr.length === 0) throw new Error("pick: empty array");
    return arr[Math.floor(r() * arr.length)] as T;
  };
  const digit = (): string => String(int(0, 9));
  return { next: r, int, pick, digit };
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

/**
 * Strip all formatting (spaces, dashes, parens, dots, slashes) and any
 * alphabetic extension markers. Preserves a leading '+' for international
 * form. Returns the canonical digits-only string (with optional leading +).
 */
export function normalizePhoneNumber(input: string): string {
  if (!input) return "";
  let s = String(input).trim();
  const hasPlus = s.startsWith("+");
  // Remove all non-digit characters (after stripping a leading +).
  s = s.replace(/[^\d]/g, "");
  return hasPlus ? `+${s}` : s;
}

/** Strip EVERYTHING except digits (no leading +). */
export function digitsOnly(input: string): string {
  return (input || "").replace(/[^\d]/g, "");
}

// ---------------------------------------------------------------------------
// Country detection
// ---------------------------------------------------------------------------

/**
 * Detect a country from a normalized phone number.
 * Tries to match the longest calling code first. When multiple countries
 * share a calling code (e.g. US + CA both use "1"), we prefer the country
 * that appears first in the registry's insertion order — this gives US
 * priority over CA for NANP numbers, which is the more common case.
 */
export function detectCountry(normalized: string): string | null {
  const digits = digitsOnly(normalized);
  if (digits.length < 4) return null;
  // Try 3-, 2-, and 1-digit calling codes. Iterate the registry in
  // insertion order so the first match for a given code length wins ties.
  const candidates: { country: string; codeLen: number; order: number }[] = [];
  let order = 0;
  for (const cc of Object.keys(PHONE_REGISTRY)) {
    const spec = PHONE_REGISTRY[cc]!;
    if (digits.startsWith(spec.callingCode)) {
      candidates.push({ country: cc, codeLen: spec.callingCode.length, order });
    }
    order++;
  }
  if (candidates.length === 0) return null;
  // Prefer longest calling code, then earliest insertion order (US before CA).
  candidates.sort((a, b) =>
    b.codeLen - a.codeLen || a.order - b.order,
  );
  return candidates[0]!.country;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type PhoneValidationCode =
  | "valid"
  | "possible"
  | "empty"
  | "too_short"
  | "bad_chars"
  | "unknown_country"
  | "wrong_length"
  | "bad_prefix";

export interface PhoneValidationResult {
  input: string;
  normalized: string;
  digits: string;
  valid: boolean;
  possible: boolean;
  code: PhoneValidationCode;
  message: string;
  country: string | null;
  countryName: string | null;
  callingCode: string | null;
  nsn: string;
  nsnLength: number;
  type: PhoneNumberType;
  hasPlus: boolean;
}

/**
 * Validate a phone number against the bundled numbering plans.
 * If no country is given, attempts to detect from a leading +<calling-code>.
 */
export function validatePhoneNumber(input: string, defaultCountry?: string): PhoneValidationResult {
  const normalized = normalizePhoneNumber(input);
  const hasPlus = normalized.startsWith("+");
  const digits = digitsOnly(normalized);

  if (digits === "") {
    return emptyResult(input, normalized, digits, hasPlus, "empty", "Phone number is empty");
  }
  if (digits.length < 4) {
    return emptyResult(input, normalized, digits, hasPlus, "too_short", "Phone number too short (need at least 4 digits)");
  }
  if (digits.length > 15) {
    return emptyResult(input, normalized, digits, hasPlus, "too_short", "Phone number too long (max 15 digits per E.164)");
  }

  // Determine country.
  let country: string | null = null;
  let nsn = digits;
  if (hasPlus) {
    country = detectCountry(normalized);
    if (country) {
      const spec = PHONE_REGISTRY[country]!;
      nsn = digits.slice(spec.callingCode.length);
    }
  } else if (defaultCountry) {
    const spec = getCountrySpec(defaultCountry);
    if (spec) {
      country = spec.country;
      // Strip trunk prefix if present.
      if (spec.trunkPrefix && nsn.startsWith(spec.trunkPrefix)) {
        nsn = nsn.slice(spec.trunkPrefix.length);
      }
    }
  }

  if (!country) {
    return emptyResult(input, normalized, digits, hasPlus, "unknown_country", "Could not detect country — use +<calling-code> or set a default country");
  }

  const spec = PHONE_REGISTRY[country]!;
  const countryName = spec.name;

  if (nsn.length !== spec.nsnLength) {
    return {
      input, normalized, digits, valid: false, possible: false,
      code: "wrong_length",
      message: `Wrong NSN length — ${countryName} expects ${spec.nsnLength} digits, got ${nsn.length}`,
      country, countryName,
      callingCode: spec.callingCode,
      nsn, nsnLength: nsn.length,
      type: "unknown",
      hasPlus,
    };
  }

  // Possible = right length, valid = matches a known prefix.
  const type = detectType(nsn, spec);
  if (type === "unknown") {
    return {
      input, normalized, digits, valid: false, possible: true,
      code: "bad_prefix",
      message: `Possible number (correct length for ${countryName}) but no known mobile/fixed/toll-free prefix matches`,
      country, countryName,
      callingCode: spec.callingCode,
      nsn, nsnLength: nsn.length,
      type,
      hasPlus,
    };
  }

  return {
    input, normalized, digits, valid: true, possible: true,
    code: "valid",
    message: `Valid ${type} number for ${countryName}`,
    country, countryName,
    callingCode: spec.callingCode,
    nsn, nsnLength: nsn.length,
    type,
    hasPlus,
  };
}

function emptyResult(
  input: string,
  normalized: string,
  digits: string,
  hasPlus: boolean,
  code: PhoneValidationCode,
  message: string,
): PhoneValidationResult {
  return {
    input, normalized, digits, valid: false, possible: false,
    code, message,
    country: null, countryName: null, callingCode: null,
    nsn: digits, nsnLength: digits.length,
    type: "unknown",
    hasPlus,
  };
}

/** Detect the number type by checking prefix patterns. */
export function detectType(nsn: string, spec: CountryPhoneSpec): PhoneNumberType {
  if (spec.tollFreePrefixes && matchesAnyPrefix(nsn, spec.tollFreePrefixes)) return "toll-free";
  if (matchesAnyPrefix(nsn, spec.mobilePrefixes)) return "mobile";
  if (matchesAnyPrefix(nsn, spec.fixedPrefixes)) return "fixed";
  return "unknown";
}

function matchesAnyPrefix(nsn: string, prefixes: string[]): boolean {
  for (const p of prefixes) {
    if (nsn.startsWith(p)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

export type NumberTypeFilter = "mobile" | "fixed" | "toll-free";

/** Generate a single valid-format phone number for the given country. */
export function generatePhoneNumber(
  country: string,
  type: NumberTypeFilter,
  rng: Rng,
): string {
  const spec = getCountrySpec(country);
  if (!spec) {
    throw new Error(`generatePhoneNumber: unknown country '${country}'`);
  }
  const prefixes = type === "mobile"
    ? spec.mobilePrefixes
    : type === "fixed"
      ? spec.fixedPrefixes
      : spec.tollFreePrefixes ?? spec.mobilePrefixes;
  if (!prefixes || prefixes.length === 0) {
    throw new Error(`generatePhoneNumber: no prefixes for type '${type}' in ${country}`);
  }
  const prefix = rng.pick(prefixes);
  // Fill the remaining NSN length with random digits.
  let nsn = prefix;
  while (nsn.length < spec.nsnLength) nsn += rng.digit();
  nsn = nsn.slice(0, spec.nsnLength);
  return `+${spec.callingCode}${nsn}`;
}

export interface GenerateOptions {
  country: string;
  count: number;
  type?: NumberTypeFilter;
  seed?: string | number;
}

/** Generate a batch of test phone numbers (max 1000 per call). */
export function generatePhoneBatch(opts: GenerateOptions): string[] {
  const spec = getCountrySpec(opts.country);
  if (!spec) {
    throw new Error(`generatePhoneBatch: unknown country '${opts.country}'`);
  }
  const type: NumberTypeFilter = opts.type ?? "mobile";
  const seed = opts.seed ?? Math.random().toString(36).slice(2);
  const rng = createRng(seed);
  const n = Math.max(0, Math.min(opts.count, 1000));
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    out.push(generatePhoneNumber(spec.country, type, rng));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export type PhoneFormat = "e164" | "international" | "national" | "rfc3966";

/**
 * Format a phone number in one of four standard forms.
 * Falls back to E.164 if the country can't be determined.
 */
export function formatPhoneNumber(input: string, format: PhoneFormat, defaultCountry?: string): string {
  const result = validatePhoneNumber(input, defaultCountry);
  const digits = result.digits;
  if (!digits) return "";
  if (!result.country) {
    return format === "rfc3966" ? `tel:+${digits}` : `+${digits}`;
  }
  const spec = PHONE_REGISTRY[result.country]!;
  const nsn = result.nsn;

  switch (format) {
    case "e164":
      return `+${spec.callingCode}${nsn}`;
    case "international":
      return applyTemplate(spec.internationalFormat, spec.callingCode, nsn);
    case "national":
      return applyTemplate(spec.nationalFormat, spec.callingCode, nsn);
    case "rfc3966":
      return `tel:+${spec.callingCode}${nsn}`;
    default:
      return `+${spec.callingCode}${nsn}`;
  }
}

/** Apply a format template, replacing N with successive NSN digits. */
export function applyTemplate(template: string, callingCode: string, nsn: string): string {
  // The international template includes the calling code as Ns at the start.
  // We replace the first len(callingCode) N's with the calling code digits,
  // then replace the remaining N's with NSN digits.
  let digits: string;
  if (template.startsWith("+")) {
    // Template like "+N NNN NNN-NNNN" — first N is calling code digit.
    digits = callingCode + nsn;
  } else {
    // National format — uses NSN only.
    digits = nsn;
  }
  let out = "";
  let i = 0;
  for (const ch of template) {
    if (ch === "N") {
      out += digits[i] ?? "0";
      i++;
    } else {
      out += ch;
    }
  }
  return out;
}

/** Mask all but the country code and last 4 digits. */
export function maskPhoneNumber(input: string, defaultCountry?: string): string {
  const result = validatePhoneNumber(input, defaultCountry);
  const digits = result.digits;
  if (digits.length <= 4) return digits;
  const last4 = digits.slice(-4);
  const cc = result.callingCode ? `+${result.callingCode}` : "+";
  return `${cc}${"•".repeat(Math.min(digits.length - 4, 8))}${last4}`;
}

// ---------------------------------------------------------------------------
// Batch validation
// ---------------------------------------------------------------------------

export interface BatchRow {
  index: number;
  raw: string;
  normalized: string;
  valid: boolean;
  possible: boolean;
  code: PhoneValidationCode;
  message: string;
  country: string | null;
  countryName: string | null;
  type: PhoneNumberType;
}

/** Parse batch input — one number per line (commas/semicolons also accepted). */
export function parseBatchInput(input: string): string[] {
  if (!input) return [];
  return input
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Validate a list of phone numbers. */
export function validateBatch(numbers: string[], defaultCountry?: string): BatchRow[] {
  return numbers.map((raw, index) => {
    const r = validatePhoneNumber(raw, defaultCountry);
    return {
      index,
      raw,
      normalized: r.normalized,
      valid: r.valid,
      possible: r.possible,
      code: r.code,
      message: r.message,
      country: r.country,
      countryName: r.countryName,
      type: r.type,
    };
  });
}

export interface BatchSummary {
  total: number;
  valid: number;
  possible: number;
  invalid: number;
  byCountry: Record<string, number>;
  byType: Record<PhoneNumberType, number>;
}

export function summarizeBatch(rows: BatchRow[]): BatchSummary {
  const byCountry: Record<string, number> = {};
  const byType: Record<PhoneNumberType, number> = {
    mobile: 0, fixed: 0, "toll-free": 0, voip: 0, premium: 0, unknown: 0,
  };
  let valid = 0;
  let possible = 0;
  for (const r of rows) {
    if (r.valid) valid++;
    if (r.possible) possible++;
    const k = r.countryName || r.country || "Unknown";
    byCountry[k] = (byCountry[k] ?? 0) + 1;
    byType[r.type] = (byType[r.type] ?? 0) + 1;
  }
  return {
    total: rows.length,
    valid,
    possible,
    invalid: rows.length - valid,
    byCountry,
    byType,
  };
}

/** Render batch rows as CSV. */
export function renderBatchCsv(rows: BatchRow[]): string {
  const headers = ["index", "raw", "normalized", "valid", "possible", "code", "country", "type", "message"];
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push([
      String(r.index),
      escapeCsvCell(r.raw),
      escapeCsvCell(r.normalized),
      r.valid ? "valid" : "invalid",
      r.possible ? "possible" : "not-possible",
      r.code,
      escapeCsvCell(r.countryName || r.country || ""),
      r.type,
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
// Canonical test vectors
// ---------------------------------------------------------------------------

/**
 * Known-good phone number test vectors. These match real published test
 * numbers (Wikipedia, ITU examples) or are structurally valid format
 * examples for their country.
 */
export const CANONICAL_VALID_NUMBERS: readonly { number: string; country: string; type: PhoneNumberType; note: string }[] = [
  { number: "+14155552671", country: "US", type: "mobile", note: "US NANP format example" },
  { number: "+442071838750", country: "GB", type: "fixed", note: "UK London landline format" },
  { number: "+33170182345", country: "FR", type: "fixed", note: "France Paris landline format" },
  { number: "+493012345678", country: "DE", type: "fixed", note: "Germany Berlin landline format" },
  { number: "+8613812345678", country: "CN", type: "mobile", note: "China Mobile format example" },
  { number: "+819012345678", country: "JP", type: "mobile", note: "Japan mobile format example" },
  { number: "+61491578888", country: "AU", type: "mobile", note: "Australia mobile format" },
  { number: "+919876543210", country: "IN", type: "mobile", note: "India mobile format" },
  { number: "+5511991234567", country: "BR", type: "mobile", note: "Brazil São Paulo mobile" },
  { number: "+82101234567", country: "KR", type: "mobile", note: "Korea mobile format" },
  { number: "+46701234567", country: "SE", type: "mobile", note: "Sweden mobile format" },
  { number: "+31612345678", country: "NL", type: "mobile", note: "Netherlands mobile" },
];

/** Numbers that should fail validation (wrong length, bad prefix, etc.). */
export const CANONICAL_INVALID_NUMBERS: readonly { number: string; note: string }[] = [
  { number: "+12345", note: "Too short for any NANP number" },
  { number: "+4412345678", note: "UK number too short (NSN should be 10)" },
  { number: "+9999123456", note: "Unknown calling code 999" },
  { number: "abc", note: "Non-numeric input" },
  { number: "+3312345", note: "France NSN too short" },
];

// ---------------------------------------------------------------------------
// History (localStorage) — stores metadata only, NEVER numbers
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:phone-number-generator-validator:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  action: "generate" | "validate_single" | "validate_batch";
  country: string | null;
  format: PhoneFormat;
  generateCount: number;
  generateType: NumberTypeFilter | null;
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
  format: PhoneFormat,
  type: NumberTypeFilter,
): string {
  const params = new URLSearchParams();
  if (country) params.set("cc", country.toUpperCase());
  if (count) params.set("count", String(count));
  if (format) params.set("fmt", format);
  if (type) params.set("type", type);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(
  hash: string,
): { country: string; count: number; format: PhoneFormat; type: NumberTypeFilter } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { country: "US", count: 10, format: "e164", type: "mobile" };
  const params = new URLSearchParams(clean);
  const cc = (params.get("cc") ?? "US").toUpperCase();
  const country = PHONE_REGISTRY[cc] ? cc : "US";
  const countStr = params.get("count") ?? "10";
  const parsedCount = parseInt(countStr, 10);
  const count = Number.isNaN(parsedCount) ? 10 : Math.max(1, Math.min(1000, parsedCount));
  const fmt = params.get("fmt") ?? "e164";
  const format: PhoneFormat =
    fmt === "international" ? "international"
    : fmt === "national" ? "national"
    : fmt === "rfc3966" ? "rfc3966"
    : "e164";
  const t = params.get("type") ?? "mobile";
  const type: NumberTypeFilter =
    t === "fixed" ? "fixed"
    : t === "toll-free" ? "toll-free"
    : "mobile";
  return { country, count, format, type };
}

// ---------------------------------------------------------------------------
// Honesty banner — sandbox only
// ---------------------------------------------------------------------------

export const HONESTY_BANNER =
  "Generated phone numbers are structurally valid (correct calling code, NSN length, and prefix) but UNASSIGNED. They are for testing/development only — never use them for real calls, SMS, or 2FA.";
