/**
 * Scientific & Engineering Notation Converter — pure logic.
 *
 * Convert numbers between decimal, scientific (a × 10^b), engineering
 * (exponent a multiple of 3), SI-prefixed (12.3k, 4.7µ), and E-notation
 * (1.5e-9) — with significant-figure control and exact BigInt mantissa
 * math. Pure functions only — no DOM, no network.
 *
 * Internal representation:
 *
 *   value = sign × digits × 10^exp
 *
 * where `digits` is a non-negative BigInt (the integer formed by all the
 * significant digits in order, no decimal point) and `exp` is a number
 * that places the decimal point. Zero is sign=1, digits=0n, exp=0.
 */

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

export interface BigDec {
  sign: -1 | 1;
  digits: bigint;
  exp: number;
}

export type RoundingMode =
  | "half-up"
  | "half-even"
  | "half-down"
  | "up"
  | "down";

export const ROUNDING_MODES: RoundingMode[] = [
  "half-up",
  "half-even",
  "half-down",
  "up",
  "down",
];

export interface SIPrefix {
  prefix: string;
  name: string;
  exp: number;
}

/** Metric SI prefixes from quetta (10^30) down to quecto (10^-30). */
export const SI_PREFIXES: SIPrefix[] = [
  { prefix: "Q", name: "quetta", exp: 30 },
  { prefix: "R", name: "ronna", exp: 27 },
  { prefix: "Y", name: "yotta", exp: 24 },
  { prefix: "Z", name: "zetta", exp: 21 },
  { prefix: "E", name: "exa", exp: 18 },
  { prefix: "P", name: "peta", exp: 15 },
  { prefix: "T", name: "tera", exp: 12 },
  { prefix: "G", name: "giga", exp: 9 },
  { prefix: "M", name: "mega", exp: 6 },
  { prefix: "k", name: "kilo", exp: 3 },
  { prefix: "h", name: "hecto", exp: 2 },
  { prefix: "da", name: "deca", exp: 1 },
  { prefix: "", name: "", exp: 0 },
  { prefix: "d", name: "deci", exp: -1 },
  { prefix: "c", name: "centi", exp: -2 },
  { prefix: "m", name: "milli", exp: -3 },
  { prefix: "µ", name: "micro", exp: -6 },
  { prefix: "u", name: "micro", exp: -6 },
  { prefix: "n", name: "nano", exp: -9 },
  { prefix: "p", name: "pico", exp: -12 },
  { prefix: "f", name: "femto", exp: -15 },
  { prefix: "a", name: "atto", exp: -18 },
  { prefix: "z", name: "zepto", exp: -21 },
  { prefix: "y", name: "yocto", exp: -24 },
  { prefix: "r", name: "ronto", exp: -27 },
  { prefix: "q", name: "quecto", exp: -30 },
];

/** IEC binary prefixes from kibi (2^10) to yobi (2^80). */
export const BINARY_PREFIXES: SIPrefix[] = [
  { prefix: "Ki", name: "kibi", exp: 10 },
  { prefix: "Mi", name: "mebi", exp: 20 },
  { prefix: "Gi", name: "gibi", exp: 30 },
  { prefix: "Ti", name: "tebi", exp: 40 },
  { prefix: "Pi", name: "pebi", exp: 50 },
  { prefix: "Ei", name: "exbi", exp: 60 },
  { prefix: "Zi", name: "zebi", exp: 70 },
  { prefix: "Yi", name: "yobi", exp: 80 },
];

/** SI prefixes whose exponent is a multiple of 3 (engineering set). */
export const ENGINEERING_PREFIXES: SIPrefix[] = SI_PREFIXES.filter(
  (p) => p.exp % 3 === 0 && p.prefix !== "",
);

export type InputForm =
  | "decimal"
  | "scientific"
  | "engineering"
  | "e-notation"
  | "si-prefixed"
  | "binary-prefixed"
  | "unknown";

export interface ConvertOptions {
  /** Significant figures (1–50). 0 means "preserve all input digits". */
  sigFigs?: number;
  /** Rounding mode. Default "half-up". */
  roundingMode?: RoundingMode;
  /** Include IEC binary prefix output. Default false. */
  binaryPrefixes?: boolean;
  /** Use × 10^b (true) or ×10^b (false) in scientific/engineering output. Default true. */
  spaces?: boolean;
}

export interface ConversionResult {
  decimal: string;
  scientific: string;
  engineering: string;
  eNotation: string;
  siPrefixed: string;
  binaryPrefixed: string;
  /** Detected input form. */
  form: InputForm;
  /** Error message if conversion failed. */
  error?: string;
}

export interface BatchResult {
  input: string;
  result: ConversionResult;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MIN_SIG_FIGS = 0;
const MAX_SIG_FIGS = 50;

function clampSigFigs(n: number): number {
  if (!Number.isFinite(n) || n <= MIN_SIG_FIGS) return 0;
  if (n > MAX_SIG_FIGS) return MAX_SIG_FIGS;
  return Math.floor(n);
}

/** Strip trailing zero digits, adjusting exp. Zero stays zero. */
export function normalizeBigDec(d: BigDec): BigDec {
  if (d.digits === 0n) return { sign: 1, digits: 0n, exp: 0 };
  let digits = d.digits;
  let exp = d.exp;
  while (digits % 10n === 0n && digits !== 0n) {
    digits /= 10n;
    exp += 1;
  }
  return { sign: d.sign, digits, exp };
}

/** Return the number of significant digits in `digits` (BigInt magnitude). */
export function countSigFigs(d: BigDec): number {
  if (d.digits === 0n) return 0;
  return d.digits.toString().length;
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

const SCI_NOTATION_RE =
  /^([+-]?\d+(?:\.\d+)?)\s*[×x*·]\s*10\s*\^\s*([+-]?\d+)\s*$/i;
const E_NOTATION_RE = /^([+-]?\d+(?:\.\d+)?)[eE]([+-]?\d+)\s*$/;
const DECIMAL_RE = /^[+-]?\d+(?:\.\d+)?$/;

/** Detect which notation form a string is in. */
export function detectInputForm(input: string): InputForm {
  const trimmed = input.trim();
  if (!trimmed) return "unknown";
  if (SCI_NOTATION_RE.test(trimmed)) return "scientific";
  if (E_NOTATION_RE.test(trimmed)) return "e-notation";
  // Check SI prefix suffix (longest first)
  for (const list of [BINARY_PREFIXES, SI_PREFIXES]) {
    for (const p of list) {
      if (!p.prefix) continue;
      if (trimmed.endsWith(p.prefix)) {
        const mantissa = trimmed.slice(0, trimmed.length - p.prefix.length);
        if (DECIMAL_RE.test(mantissa)) {
          return list === BINARY_PREFIXES ? "binary-prefixed" : "si-prefixed";
        }
      }
    }
  }
  if (DECIMAL_RE.test(trimmed)) return "decimal";
  return "unknown";
}

/** Parse a plain decimal string into a BigDec. Throws on invalid. */
export function parseDecimal(input: string): BigDec {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Empty input");
  if (!DECIMAL_RE.test(trimmed)) throw new Error(`Invalid decimal: "${input}"`);
  let sign: -1 | 1 = 1;
  let rest = trimmed;
  if (rest.startsWith("-")) {
    sign = -1;
    rest = rest.slice(1);
  } else if (rest.startsWith("+")) {
    rest = rest.slice(1);
  }
  const parts = rest.split(".");
  if (parts.length > 2) throw new Error("Multiple decimal points");
  const intStr = parts[0] ?? "";
  const fracStr = parts[1] ?? "";
  const allDigits = intStr + fracStr;
  if (!allDigits || !/^\d+$/.test(allDigits)) {
    throw new Error(`No digits in "${input}"`);
  }
  // Strip leading zeros but keep at least one digit.
  let stripped = allDigits.replace(/^0+/, "");
  if (stripped === "") stripped = "0";
  const digits = BigInt(stripped);
  if (digits === 0n) return { sign: 1, digits: 0n, exp: 0 };
  // The decimal point sits `fracStr.length` places from the right of the
  // original digit string; stripping leading zeros does not move it. Use
  // a ternary to avoid producing -0 when fracStr is empty.
  const exp = fracStr.length > 0 ? -fracStr.length : 0;
  // Canonicalize by stripping trailing zeros (so "12300" → 123 × 10^2).
  return normalizeBigDec({ sign, digits, exp });
}

/**
 * Parse any supported form (decimal, scientific, engineering, E-notation,
 * SI-prefixed, binary-prefixed) into a BigDec. Throws on invalid input.
 */
export function parseNumber(input: string): BigDec {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Empty input");

  // Scientific: "1.234 × 10^5"
  const sciMatch = trimmed.match(SCI_NOTATION_RE);
  if (sciMatch) {
    const mantissa = parseDecimal(sciMatch[1]);
    const exp = parseInt(sciMatch[2], 10);
    if (!Number.isFinite(exp)) throw new Error(`Invalid exponent: "${sciMatch[2]}"`);
    if (mantissa.digits === 0n) return { sign: 1, digits: 0n, exp: 0 };
    return { sign: mantissa.sign, digits: mantissa.digits, exp: mantissa.exp + exp };
  }

  // E-notation: "1.5e-9"
  const eMatch = trimmed.match(E_NOTATION_RE);
  if (eMatch) {
    const mantissa = parseDecimal(eMatch[1]);
    const exp = parseInt(eMatch[2], 10);
    if (!Number.isFinite(exp)) throw new Error(`Invalid exponent: "${eMatch[2]}"`);
    if (mantissa.digits === 0n) return { sign: 1, digits: 0n, exp: 0 };
    return { sign: mantissa.sign, digits: mantissa.digits, exp: mantissa.exp + exp };
  }

  // SI / binary prefix suffix
  for (const list of [BINARY_PREFIXES, SI_PREFIXES]) {
    for (const p of list) {
      if (!p.prefix) continue;
      if (trimmed.endsWith(p.prefix)) {
        const mantissaStr = trimmed.slice(0, trimmed.length - p.prefix.length);
        if (DECIMAL_RE.test(mantissaStr)) {
          const mantissa = parseDecimal(mantissaStr);
          if (mantissa.digits === 0n) return { sign: 1, digits: 0n, exp: 0 };
          // For binary prefixes, multiply by 2^exp directly into BigDec.
          if (list === BINARY_PREFIXES) {
            const factor = 2n ** BigInt(p.exp);
            return {
              sign: mantissa.sign,
              digits: mantissa.digits * factor,
              exp: mantissa.exp,
            };
          }
          return {
            sign: mantissa.sign,
            digits: mantissa.digits,
            exp: mantissa.exp + p.exp,
          };
        }
      }
    }
  }

  // Plain decimal
  return parseDecimal(trimmed);
}

// ---------------------------------------------------------------------------
// Rounding
// ---------------------------------------------------------------------------

/**
 * Round a BigDec to the given number of significant figures using the
 * specified rounding mode. sigFigs=0 returns the input unchanged.
 */
export function roundToSigFigs(
  d: BigDec,
  sigFigs: number,
  mode: RoundingMode = "half-up",
): BigDec {
  const n = clampSigFigs(sigFigs);
  if (n === 0 || d.digits === 0n) return d;
  const numDigits = d.digits.toString().length;
  if (numDigits === n) return { ...d };
  if (numDigits < n) {
    // Pad with trailing zeros, adjusting exp downward.
    const pad = n - numDigits;
    return {
      sign: d.sign,
      digits: d.digits * 10n ** BigInt(pad),
      exp: d.exp - pad,
    };
  }
  // Need to round: drop (numDigits - n) trailing digits.
  const drop = numDigits - n;
  const divisor = 10n ** BigInt(drop);
  const quotient = d.digits / divisor;
  const remainder = d.digits % divisor;
  let rounded = quotient;
  if (remainder !== 0n) {
    const twiceRem = remainder * 2n;
    switch (mode) {
      case "up":
        rounded = quotient + 1n;
        break;
      case "down":
        // truncate
        break;
      case "half-up":
        if (twiceRem >= divisor) rounded = quotient + 1n;
        break;
      case "half-down":
        if (twiceRem > divisor) rounded = quotient + 1n;
        break;
      case "half-even":
        if (twiceRem > divisor) rounded = quotient + 1n;
        else if (twiceRem === divisor && quotient % 2n === 1n) rounded = quotient + 1n;
        break;
    }
  }
  // If rounding overflowed (e.g. 999 → 1000 at 1 sig fig), digits grows.
  let result = rounded;
  let resultExp = d.exp + drop;
  // Normalize if rounded has more digits than expected (e.g. 9→10).
  if (result.toString().length > n) {
    result = result / 10n;
    resultExp += 1;
  }
  return { sign: d.sign, digits: result, exp: resultExp };
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/** Format as a plain decimal string. */
export function formatDecimal(d: BigDec): string {
  if (d.digits === 0n) return "0";
  const s = d.digits.toString();
  let result: string;
  if (d.exp >= 0) {
    result = s + "0".repeat(d.exp);
  } else {
    const absExp = -d.exp;
    if (s.length > absExp) {
      result = s.slice(0, s.length - absExp) + "." + s.slice(s.length - absExp);
    } else {
      result = "0." + "0".repeat(absExp - s.length) + s;
    }
  }
  return (d.sign < 0 ? "-" : "") + result;
}

/** Format as `a × 10^b` with 1 ≤ |a| < 10. */
export function formatScientific(d: BigDec, spaces = true): string {
  if (d.digits === 0n) return `0${spaces ? " × 10^0" : "×10^0"}`;
  const s = d.digits.toString();
  const N = s.length;
  const b = d.exp + N - 1;
  const mantissaStr = N === 1 ? s : `${s[0]}.${s.slice(1)}`;
  const sign = d.sign < 0 ? "-" : "";
  const sep = spaces ? " × 10^" : "×10^";
  return `${sign}${mantissaStr}${sep}${b < 0 ? "-" : ""}${Math.abs(b)}`;
}

/** Format as `a × 10^b` with exponent a multiple of 3 and 1 ≤ |a| < 1000. */
export function formatEngineering(d: BigDec, spaces = true): string {
  if (d.digits === 0n) return `0${spaces ? " × 10^0" : "×10^0"}`;
  const s = d.digits.toString();
  const N = s.length;
  const E_sci = d.exp + N - 1;
  // Floor division by 3 (works for negative numbers too).
  const E_eng = 3 * Math.floor(E_sci / 3);
  const intDigits = E_sci - E_eng + 1; // 1, 2, or 3
  let mantissa: string;
  if (intDigits >= N) {
    mantissa = s + "0".repeat(intDigits - N);
  } else {
    const intPart = s.slice(0, intDigits);
    const fracPart = s.slice(intDigits);
    mantissa = fracPart ? `${intPart}.${fracPart}` : intPart;
  }
  const sign = d.sign < 0 ? "-" : "";
  const sep = spaces ? " × 10^" : "×10^";
  return `${sign}${mantissa}${sep}${E_eng < 0 ? "-" : ""}${Math.abs(E_eng)}`;
}

/** Format as E-notation (e.g. `1.5e-9`). */
export function formatENotation(d: BigDec): string {
  if (d.digits === 0n) return "0e0";
  const s = d.digits.toString();
  const N = s.length;
  const b = d.exp + N - 1;
  const mantissaStr = N === 1 ? s : `${s[0]}.${s.slice(1)}`;
  const sign = d.sign < 0 ? "-" : "";
  return `${sign}${mantissaStr}e${b}`;
}

/** Format using an SI prefix, falling back to scientific if out of range. */
export function formatSIPrefixed(d: BigDec, spaces = true): string {
  if (d.digits === 0n) return "0";
  const s = d.digits.toString();
  const N = s.length;
  const E_sci = d.exp + N - 1;
  const E_eng = 3 * Math.floor(E_sci / 3);
  const prefix = SI_PREFIXES.find(
    (p) => p.exp === E_eng && p.prefix !== "",
  );
  if (!prefix) {
    // Out of SI prefix range — fall back to scientific.
    return formatScientific(d, spaces);
  }
  const intDigits = E_sci - E_eng + 1;
  let mantissa: string;
  if (intDigits >= N) {
    mantissa = s + "0".repeat(intDigits - N);
  } else {
    const intPart = s.slice(0, intDigits);
    const fracPart = s.slice(intDigits);
    mantissa = fracPart ? `${intPart}.${fracPart}` : intPart;
  }
  const sign = d.sign < 0 ? "-" : "";
  return `${sign}${mantissa}${prefix.prefix}`;
}

/** Format using a binary IEC prefix, falling back if out of range. */
export function formatBinaryPrefixed(d: BigDec, spaces = true): string {
  if (d.digits === 0n) return "0";
  if (d.sign < 0) return formatScientific(d, spaces);
  if (d.exp !== 0) {
    // Binary prefixes only make sense for integers; for fractional values
    // fall back to scientific.
    return formatScientific(d, spaces);
  }
  // Find the largest binary prefix whose 2^exp ≤ digits. Iterate from
  // largest (Yi, 2^80) down to smallest (Ki, 2^10).
  let chosen: SIPrefix | null = null;
  for (let i = BINARY_PREFIXES.length - 1; i >= 0; i--) {
    const p = BINARY_PREFIXES[i];
    const factor = 2n ** BigInt(p.exp);
    if (d.digits >= factor) {
      chosen = p;
      break;
    }
  }
  if (!chosen) return formatDecimal(d);
  const factor = 2n ** BigInt(chosen.exp);
  const intPart = d.digits / factor;
  const remainder = d.digits % factor;
  const intStr = intPart.toString();
  // 3 fractional digits, stripped of trailing zeros.
  let fracStr = "";
  if (remainder > 0n) {
    // Compute remainder * 1000 / factor for 3 fractional digits.
    const fracNum = (remainder * 1000n) / factor;
    fracStr = fracNum.toString().padStart(3, "0").replace(/0+$/, "");
  }
  const mantissa = fracStr ? `${intStr}.${fracStr}` : intStr;
  return `${mantissa}${chosen.prefix}`;
}

// ---------------------------------------------------------------------------
// Top-level convert
// ---------------------------------------------------------------------------

/**
 * Convert an input string into all five forms. Returns an error in
 * `result.error` if parsing failed (other fields are empty strings).
 */
export function convertAll(
  input: string,
  options: ConvertOptions = {},
): ConversionResult {
  const sigFigs = clampSigFigs(options.sigFigs ?? 0);
  const mode: RoundingMode = options.roundingMode ?? "half-up";
  const spaces = options.spaces ?? true;
  const form = detectInputForm(input);

  let parsed: BigDec;
  try {
    parsed = parseNumber(input);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Parse error";
    return {
      decimal: "",
      scientific: "",
      engineering: "",
      eNotation: "",
      siPrefixed: "",
      binaryPrefixed: "",
      form,
      error: msg,
    };
  }

  const rounded = roundToSigFigs(parsed, sigFigs, mode);

  return {
    decimal: formatDecimal(rounded),
    scientific: formatScientific(rounded, spaces),
    engineering: formatEngineering(rounded, spaces),
    eNotation: formatENotation(rounded),
    siPrefixed: formatSIPrefixed(rounded, spaces),
    binaryPrefixed: options.binaryPrefixes
      ? formatBinaryPrefixed(rounded, spaces)
      : "",
    form,
  };
}

// ---------------------------------------------------------------------------
// Batch conversion
// ---------------------------------------------------------------------------

/** Parse multi-line input into individual non-empty lines. */
export function parseBatchInput(text: string): string[] {
  if (!text) return [];
  return text
    .split(/[\n;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Convert a list of inputs. Each line is converted to all forms. */
export function batchConvert(
  inputs: string[],
  options: ConvertOptions = {},
): BatchResult[] {
  return inputs.map((line) => ({
    input: line,
    result: convertAll(line, options),
  }));
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:scientific-engineering-notation-converter:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  input: string;
  sigFigs: number;
  roundingMode: RoundingMode;
  form: InputForm;
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

export interface ShareState {
  input: string;
  sigFigs: number;
  roundingMode: RoundingMode;
  binaryPrefixes: boolean;
}

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  if (state.input) params.set("input", state.input);
  if (state.sigFigs) params.set("sig", String(state.sigFigs));
  if (state.roundingMode) params.set("mode", state.roundingMode);
  if (state.binaryPrefixes) params.set("bin", "1");
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { input: "", sigFigs: 0, roundingMode: "half-up", binaryPrefixes: false };
  const params = new URLSearchParams(clean);
  const input = params.get("input") ?? "";
  const sigRaw = params.get("sig");
  const sigFigs = sigRaw ? clampSigFigs(parseInt(sigRaw, 10)) : 0;
  const modeRaw = params.get("mode");
  const roundingMode: RoundingMode =
    modeRaw && ROUNDING_MODES.includes(modeRaw as RoundingMode)
      ? (modeRaw as RoundingMode)
      : "half-up";
  const binaryPrefixes = params.get("bin") === "1";
  return { input, sigFigs, roundingMode, binaryPrefixes };
}
