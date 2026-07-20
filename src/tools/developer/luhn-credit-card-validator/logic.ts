/**
 * Luhn / Credit Card Validator — pure logic.
 *
 * Validates identification numbers (credit cards, IMEI, gift cards, etc.)
 * using the Luhn (mod-10) checksum algorithm. Includes brand detection
 * from BIN/IIN prefixes, step-by-step checksum visualization, corrected
 * check-digit suggestion, transposition/typo hint, formatting, masked
 * display, and bulk list validation.
 *
 * Pure functions only — no DOM, no network, no external deps.
 *
 * PRIVACY: The history feature stores only metadata (count + timestamp),
 * NEVER the card numbers themselves. Card numbers are never transmitted
 * or logged.
 */

// ---------------------------------------------------------------------------
// Card brands + BIN/IIN prefixes
// ---------------------------------------------------------------------------

export type CardBrand =
  | "visa"
  | "mastercard"
  | "amex"
  | "discover"
  | "jcb"
  | "diners"
  | "unionpay"
  | "maestro";

export interface BrandSpec {
  brand: CardBrand;
  label: string;
  /** Known IIN/BIN prefixes (string digits), longest-first within brand. */
  prefixes: string[];
  /** Allowed total lengths (including check digit). */
  lengths: number[];
  /** CVV/CVC length (informational). */
  cvvLength: number;
  /** Display grouping, e.g. [4,6,5] for Amex. */
  grouping: number[];
}

export const BRAND_SPECS: Record<CardBrand, BrandSpec> = {
  visa: {
    brand: "visa",
    label: "Visa",
    prefixes: ["4"],
    lengths: [13, 16, 19],
    cvvLength: 3,
    grouping: [4, 4, 4, 4],
  },
  mastercard: {
    brand: "mastercard",
    label: "Mastercard",
    prefixes: [
      // 2-series (longest first)
      "2221", "2222", "2223", "2224", "2225",
      "2226", "2227", "2228", "2229",
      "223", "224", "225", "226", "227", "228", "229",
      "23", "24", "25", "26", "270", "271", "2720",
      // 5-series
      "51", "52", "53", "54", "55",
    ],
    lengths: [16],
    cvvLength: 3,
    grouping: [4, 4, 4, 4],
  },
  amex: {
    brand: "amex",
    label: "American Express",
    prefixes: ["34", "37"],
    lengths: [15],
    cvvLength: 4,
    grouping: [4, 6, 5],
  },
  discover: {
    brand: "discover",
    label: "Discover",
    // Longest first so 622126-622925 wins over UnionPay 62
    prefixes: [
      "622126", "622225", "622226", "622300", "622925",
      "6011", "644", "645", "646", "647", "648", "649", "65",
    ],
    lengths: [16, 17, 18, 19],
    cvvLength: 3,
    grouping: [4, 4, 4, 4],
  },
  jcb: {
    brand: "jcb",
    label: "JCB",
    prefixes: [
      "3528", "3529", "353", "354", "355", "356", "357", "358",
    ],
    lengths: [16, 17, 18, 19],
    cvvLength: 3,
    grouping: [4, 4, 4, 4],
  },
  diners: {
    brand: "diners",
    label: "Diners Club",
    prefixes: [
      "300", "301", "302", "303", "304", "305", "3095",
      "36", "38", "39",
    ],
    lengths: [14, 16, 19],
    cvvLength: 3,
    grouping: [4, 6, 4],
  },
  unionpay: {
    brand: "unionpay",
    label: "UnionPay",
    prefixes: ["62", "81"],
    lengths: [16, 17, 18, 19],
    cvvLength: 3,
    grouping: [4, 4, 4, 4],
  },
  maestro: {
    brand: "maestro",
    label: "Maestro",
    prefixes: [
      "5018", "5020", "5038", "5093", "5096", "5893", "5896",
      "6304", "6390", "6759", "6761", "6762", "6763", "6767",
      "6777",
    ],
    lengths: [12, 13, 14, 15, 16, 17, 18, 19],
    cvvLength: 3,
    grouping: [4, 4, 4, 4],
  },
};

export const BRAND_LIST: CardBrand[] = [
  "visa", "mastercard", "amex", "discover", "jcb", "diners", "unionpay", "maestro",
];

export function getBrandSpec(brand: CardBrand): BrandSpec {
  return BRAND_SPECS[brand];
}

// ---------------------------------------------------------------------------
// Modes
// ---------------------------------------------------------------------------

export type InputMode = "credit" | "imei" | "gift" | "any";

export interface ModeSpec {
  mode: InputMode;
  label: string;
  hint: string;
  /** Allowed lengths for this mode (empty array = any). */
  lengths: number[];
  /** Whether brand detection applies. */
  detectBrand: boolean;
}

export const MODE_SPECS: Record<InputMode, ModeSpec> = {
  credit: {
    mode: "credit",
    label: "Credit Card",
    hint: "12–19 digits, brand detection on",
    lengths: [12, 13, 14, 15, 16, 17, 18, 19],
    detectBrand: true,
  },
  imei: {
    mode: "imei",
    label: "IMEI",
    hint: "15 digits (14 + check digit), no brand",
    lengths: [15],
    detectBrand: false,
  },
  gift: {
    mode: "gift",
    label: "Gift Card",
    hint: "12–19 digits, no brand",
    lengths: [12, 13, 14, 15, 16, 17, 18, 19],
    detectBrand: false,
  },
  any: {
    mode: "any",
    label: "Any Luhn",
    hint: "Any length ≥ 2, no brand",
    lengths: [],
    detectBrand: false,
  },
};

export const MODE_LIST: InputMode[] = ["credit", "imei", "gift", "any"];

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

/** Strip all non-digit characters from input. */
export function normalizeNumber(input: string): string {
  return (input || "").replace(/\D/g, "");
}

/** Mask all but the last 4 digits, preserving length with •. */
export function maskCard(input: string, keepLast = 4): string {
  const digits = normalizeNumber(input);
  if (digits.length <= keepLast) return digits;
  const masked = "•".repeat(digits.length - keepLast);
  return masked + digits.slice(-keepLast);
}

// ---------------------------------------------------------------------------
// Luhn algorithm (validate + check digit + explanation)
// ---------------------------------------------------------------------------

/** Compute the Luhn check digit for a number string (without check digit). */
export function luhnCheckDigit(numberWithoutCheck: string): number {
  if (!/^\d*$/.test(numberWithoutCheck)) {
    throw new Error("luhnCheckDigit: input must be all digits");
  }
  // Reverse so index 0 = digit just to the left of where the check digit goes.
  const digits = numberWithoutCheck.split("").reverse().map((d) => parseInt(d, 10));
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = digits[i]!;
    if (i % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return (10 - (sum % 10)) % 10;
}

/** Validate that a full number (digits only or with separators) passes Luhn. */
export function luhnValidate(fullNumber: string): boolean {
  const s = normalizeNumber(fullNumber);
  if (!/^\d+$/.test(s)) return false;
  if (s.length < 2) return false;
  const withoutCheck = s.slice(0, -1);
  const providedCheck = parseInt(s.slice(-1), 10);
  const expectedCheck = luhnCheckDigit(withoutCheck);
  return providedCheck === expectedCheck;
}

export interface LuhnStep {
  /** Original digit (left to right). */
  digit: number;
  /** Position from the right of the FULL number (1 = check digit). */
  positionFromRight: number;
  /** Whether this digit is doubled (odd positions from the right, excluding check). */
  doubled: boolean;
  /** Value after doubling (with 9-subtraction if > 9). */
  value: number;
}

export interface LuhnExplanation {
  /** Digits left-to-right (with check digit at end). */
  steps: LuhnStep[];
  /** Sum of all step values. */
  sum: number;
  /** sum % 10 — if 0, the number is Luhn-valid. */
  mod10: number;
  /** True if mod10 === 0. */
  valid: boolean;
  /** Provided check digit (last digit). */
  providedCheck: number;
  /** Expected check digit for the rest of the number. */
  expectedCheck: number;
}

/** Produce a step-by-step Luhn explanation for visualization. */
export function explainLuhn(fullNumber: string): LuhnExplanation {
  const s = normalizeNumber(fullNumber);
  if (!/^\d+$/.test(s) || s.length < 2) {
    return {
      steps: [],
      sum: 0,
      mod10: 0,
      valid: false,
      providedCheck: -1,
      expectedCheck: -1,
    };
  }
  const digits = s.split("").map((d) => parseInt(d, 10));
  const len = digits.length;
  const steps: LuhnStep[] = [];
  let sum = 0;
  for (let i = 0; i < len; i++) {
    const positionFromRight = len - i; // 1 = rightmost (check digit)
    const isCheck = positionFromRight === 1;
    const doubled = !isCheck && positionFromRight % 2 === 0;
    let value = digits[i]!;
    if (doubled) {
      value *= 2;
      if (value > 9) value -= 9;
    }
    steps.push({ digit: digits[i]!, positionFromRight, doubled, value });
    sum += value;
  }
  const mod10 = sum % 10;
  const valid = mod10 === 0;
  const providedCheck = digits[len - 1]!;
  const expectedCheck = luhnCheckDigit(s.slice(0, -1));
  return { steps, sum, mod10, valid, providedCheck, expectedCheck };
}

/** Given a number with a wrong check digit, return the corrected full number. */
export function correctCheckDigit(numberWithBadCheck: string): string | null {
  const s = normalizeNumber(numberWithBadCheck);
  if (!/^\d+$/.test(s) || s.length < 2) return null;
  const withoutCheck = s.slice(0, -1);
  const correctCheck = luhnCheckDigit(withoutCheck);
  return withoutCheck + correctCheck.toString();
}

/** Detect the most likely adjacent-transposition typo (swap two neighboring digits). */
export function transpositionHint(number: string): string | null {
  const s = normalizeNumber(number);
  if (!/^\d+$/.test(s) || s.length < 3) return null;
  // Try swapping each adjacent pair and re-test Luhn.
  for (let i = 0; i < s.length - 1; i++) {
    if (s[i] === s[i + 1]) continue; // swap would be no-op
    const swapped =
      s.slice(0, i) + s[i + 1]! + s[i]! + s.slice(i + 2);
    if (luhnValidate(swapped)) {
      return swapped;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Brand detection
// ---------------------------------------------------------------------------

/**
 * Detect a card brand from a number string. Returns null if no match.
 * Iterates brands in declaration order, attempting the longest prefix
 * first within each brand so 622126 (Discover) wins over 62 (UnionPay).
 */
export function detectBrand(number: string): CardBrand | null {
  const digits = normalizeNumber(number);
  if (!digits) return null;
  for (const brand of BRAND_LIST) {
    const spec = BRAND_SPECS[brand];
    // If we know the length range, require a match — otherwise skip length checks
    // (lets us still detect partial inputs as the user types).
    if (spec.lengths.length > 0 && !spec.lengths.includes(digits.length)) {
      // continue — still try other brands that accept this length
    }
    for (const prefix of spec.prefixes) {
      if (digits.startsWith(prefix)) return brand;
    }
  }
  return null;
}

/** Return the BIN (first 6 digits, or fewer if number is shorter). */
export function extractBin(number: string, binLength = 6): string {
  return normalizeNumber(number).slice(0, binLength);
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export type CardFormat = "plain" | "spaced" | "dashed" | "grouped";

/** Format a card number with separators. */
export function formatCard(number: string, format: CardFormat): string {
  const digits = normalizeNumber(number);
  switch (format) {
    case "plain": return digits;
    case "spaced": return digits.match(/.{1,4}/g)?.join(" ") ?? digits;
    case "dashed": return digits.match(/.{1,4}/g)?.join("-") ?? digits;
    case "grouped": {
      // Use brand grouping if detected; else default to 4-4-4-4.
      const brand = detectBrand(digits);
      const grouping = brand ? BRAND_SPECS[brand].grouping : [4, 4, 4, 4];
      let out = "";
      let i = 0;
      for (const g of grouping) {
        if (i >= digits.length) break;
        if (i > 0) out += " ";
        out += digits.slice(i, i + g);
        i += g;
      }
      if (i < digits.length) {
        // leftover digits (number longer than grouping spec)
        if (out) out += " ";
        out += digits.slice(i);
      }
      return out;
    }
    default: return digits;
  }
}

// ---------------------------------------------------------------------------
// Full single-number validation result
// ---------------------------------------------------------------------------

export interface ValidationResult {
  input: string;
  normalized: string;
  valid: boolean;
  mode: InputMode;
  modeLengthOk: boolean;
  brand: CardBrand | null;
  brandLabel: string;
  length: number;
  providedCheck: number;
  expectedCheck: number;
  corrected: string | null;
  transposition: string | null;
  bin: string;
  masked: string;
  formatted: string;
}

/** Validate a single number under a given mode, returning rich detail. */
export function validateSingle(input: string, mode: InputMode, format: CardFormat = "grouped"): ValidationResult {
  const normalized = normalizeNumber(input);
  const valid = luhnValidate(normalized);
  const spec = MODE_SPECS[mode];
  const modeLengthOk =
    spec.lengths.length === 0 ? normalized.length >= 2 : spec.lengths.includes(normalized.length);
  const brand = spec.detectBrand ? detectBrand(normalized) : null;
  const brandLabel = brand ? BRAND_SPECS[brand].label : "Unknown";
  const explanation = explainLuhn(normalized);
  const corrected = !valid ? correctCheckDigit(normalized) : null;
  const transposition = !valid ? transpositionHint(normalized) : null;
  return {
    input,
    normalized,
    valid,
    mode,
    modeLengthOk,
    brand,
    brandLabel,
    length: normalized.length,
    providedCheck: explanation.providedCheck >= 0 ? explanation.providedCheck : -1,
    expectedCheck: explanation.expectedCheck >= 0 ? explanation.expectedCheck : -1,
    corrected,
    transposition,
    bin: extractBin(normalized),
    masked: maskCard(normalized),
    formatted: formatCard(normalized, format),
  };
}

// ---------------------------------------------------------------------------
// Batch validation
// ---------------------------------------------------------------------------

export interface BatchRow {
  index: number;
  raw: string;
  normalized: string;
  valid: boolean;
  brand: CardBrand | null;
  brandLabel: string;
  length: number;
  mode: InputMode;
  modeLengthOk: boolean;
  hint: string;
}

/** Parse bulk input — one number per line (commas also accepted). */
export function parseBatchInput(input: string): string[] {
  if (!input) return [];
  return input
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Validate a list of numbers under a given mode. */
export function validateBatch(numbers: string[], mode: InputMode): BatchRow[] {
  return numbers.map((raw, index) => {
    const normalized = normalizeNumber(raw);
    const valid = luhnValidate(normalized);
    const spec = MODE_SPECS[mode];
    const modeLengthOk =
      spec.lengths.length === 0 ? normalized.length >= 2 : spec.lengths.includes(normalized.length);
    const brand = spec.detectBrand ? detectBrand(normalized) : null;
    const brandLabel = brand ? BRAND_SPECS[brand].label : "Unknown";
    let hint = "";
    if (!normalized) hint = "Empty line";
    else if (normalized.length < 2) hint = "Too short";
    else if (!modeLengthOk) hint = `Wrong length for ${spec.label} mode`;
    else if (!valid) {
      const trans = transpositionHint(normalized);
      hint = trans ? `Transposition? → ${trans}` : "Fails mod-10";
    }
    return {
      index,
      raw,
      normalized,
      valid: valid && modeLengthOk,
      brand,
      brandLabel,
      length: normalized.length,
      mode,
      modeLengthOk,
      hint,
    };
  });
}

export interface BatchSummary {
  total: number;
  valid: number;
  invalid: number;
  byBrand: Record<string, number>;
}

/** Summarize a batch result set. */
export function summarizeBatch(rows: BatchRow[]): BatchSummary {
  const byBrand: Record<string, number> = {};
  let valid = 0;
  for (const r of rows) {
    if (r.valid) valid++;
    const k = r.brandLabel || "Unknown";
    byBrand[k] = (byBrand[k] ?? 0) + 1;
  }
  return { total: rows.length, valid, invalid: rows.length - valid, byBrand };
}

/** Render batch rows as CSV. */
export function renderBatchCsv(rows: BatchRow[]): string {
  const headers = ["index", "raw", "normalized", "valid", "brand", "length", "mode_length_ok", "hint"];
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push([
      String(r.index),
      escapeCsvCell(r.raw),
      escapeCsvCell(r.normalized),
      r.valid ? "valid" : "invalid",
      escapeCsvCell(r.brandLabel),
      String(r.length),
      r.modeLengthOk ? "ok" : "bad",
      escapeCsvCell(r.hint),
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
 * Wikipedia Luhn test vectors plus canonical Stripe/Adyen/Braintree sandbox
 * numbers. All Luhn-valid. Useful for sanity-checking the implementation.
 */
export const CANONICAL_VALID_NUMBERS: readonly { number: string; brand: CardBrand | null; note: string }[] = [
  { number: "79927398713", brand: null, note: "Wikipedia canonical example" },
  { number: "4242424242424242", brand: "visa", note: "Stripe Visa success" },
  { number: "4111111111111111", brand: "visa", note: "Braintree Visa success" },
  { number: "5555555555554444", brand: "mastercard", note: "Stripe Mastercard success" },
  { number: "2223003122003222", brand: "mastercard", note: "Stripe MC 2-series success" },
  { number: "378282246310005", brand: "amex", note: "Stripe Amex success" },
  { number: "371449635398431", brand: "amex", note: "Stripe Amex alt" },
  { number: "6011111111111117", brand: "discover", note: "Stripe Discover success" },
  { number: "3530111333300000", brand: "jcb", note: "Stripe JCB success" },
  { number: "3056930009020004", brand: "diners", note: "Stripe Diners success" },
  { number: "6200000000000005", brand: "unionpay", note: "UnionPay sample" },
  { number: "6759411100000008", brand: "maestro", note: "Maestro sample" },
];

/** Invalid numbers (Wikipedia example with the wrong check digit). */
export const CANONICAL_INVALID_NUMBERS: readonly { number: string; note: string }[] = [
  { number: "79927398710", note: "Wikipedia example with wrong check digit (should be 3, is 0)" },
  { number: "79927398711", note: "Wrong check digit" },
  { number: "79927398712", note: "Wrong check digit" },
  { number: "4242424242424241", note: "Stripe Visa with flipped check digit" },
];

// ---------------------------------------------------------------------------
// History (localStorage) — stores metadata only, NEVER card numbers
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:luhn-credit-card-validator:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  mode: InputMode;
  format: CardFormat;
  singleCount: number;
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

export function buildShareUrl(mode: InputMode, format: CardFormat): string {
  const params = new URLSearchParams();
  if (mode) params.set("mode", mode);
  if (format) params.set("fmt", format);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(
  hash: string,
): { mode: InputMode; format: CardFormat } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { mode: "credit", format: "grouped" };
  const params = new URLSearchParams(clean);
  const m = params.get("mode") ?? "credit";
  const f = params.get("fmt") ?? "grouped";
  const validModes: InputMode[] = ["credit", "imei", "gift", "any"];
  const validFmts: CardFormat[] = ["plain", "spaced", "dashed", "grouped"];
  return {
    mode: validModes.includes(m as InputMode) ? (m as InputMode) : "credit",
    format: validFmts.includes(f as CardFormat) ? (f as CardFormat) : "grouped",
  };
}
