/**
 * Roman Numeral Converter — pure logic.
 *
 * Convert between Arabic numbers and Roman numerals in both directions,
 * validate the Roman numeral grammar (strict or lenient), show the
 * additive / subtractive decomposition, and support large numbers via
 * vinculum (overline ×1000) notation up to 3,999,999. Batch conversion,
 * a year helper, and a curated history reference are included.
 *
 * Pure functions only — no DOM, no network. 100% client-side.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum value representable in standard Roman numerals. */
export const STANDARD_MAX = 3999;

/** Maximum value representable with vinculum (one level of overline ×1000). */
export const VINCULUM_MAX = 3999999;

/** Unicode combining overline (U+0305) — appended after a Roman char to mark ×1000. */
export const COMBINING_OVERLINE = "\u0305";

export type ConversionMode = "standard" | "vinculum";
export type ValidationMode = "strict" | "lenient";

export const CONVERSION_MODES: ConversionMode[] = ["standard", "vinculum"];
export const VALIDATION_MODES: ValidationMode[] = ["strict", "lenient"];

/** Roman symbol → base value (×1000 if vinculum-overlined). */
export const ROMAN_VALUES: Record<string, number> = {
  I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000,
};

/** Roman symbols in descending order of value (with their Arabic value). */
export const ROMAN_SYMBOLS: { sym: string; val: number }[] = [
  { sym: "M", val: 1000 },
  { sym: "CM", val: 900 },
  { sym: "D", val: 500 },
  { sym: "CD", val: 400 },
  { sym: "C", val: 100 },
  { sym: "XC", val: 90 },
  { sym: "L", val: 50 },
  { sym: "XL", val: 40 },
  { sym: "X", val: 10 },
  { sym: "IX", val: 9 },
  { sym: "V", val: 5 },
  { sym: "IV", val: 4 },
  { sym: "I", val: 1 },
];

/** Strict grammar for one "magnitude" (overlined or not). */
const STRICT_GROUP_REGEX = /^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;

// ---------------------------------------------------------------------------
// Tokenization & normalization
// ---------------------------------------------------------------------------

export interface RomanToken {
  /** Roman char (I/V/X/L/C/D/M), upper-case. */
  ch: string;
  /** True if the symbol carries an overline (×1000 multiplier). */
  over: boolean;
  /** Numeric value (already ×1000 if over). */
  value: number;
}

/** Lowercase / trim / collapse whitespace, leave combining marks intact. */
export function normalizeRoman(s: string): string {
  return (s ?? "").toUpperCase().replace(/\s+/g, "");
}

/** True if the string contains at least one combining overline (vinculum). */
export function hasVinculum(s: string): boolean {
  return s.includes(COMBINING_OVERLINE);
}

/** Strip all combining overlines from a string. */
export function stripOverline(s: string): string {
  return s.split(COMBINING_OVERLINE).join("");
}

/** Apply a combining overline after every character (for vinculum display). */
export function applyOverline(s: string): string {
  let out = "";
  for (const ch of s) {
    out += ch + COMBINING_OVERLINE;
  }
  return out;
}

/** Tokenize a Roman string into a list of (char, over, value) tokens. */
export function tokenizeRoman(s: string): { ok: boolean; tokens?: RomanToken[]; error?: string } {
  const cleaned = normalizeRoman(s);
  const tokens: RomanToken[] = [];
  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (ch === COMBINING_OVERLINE) {
      return { ok: false, error: "Stray combining overline (must follow a Roman character)." };
    }
    const base = ROMAN_VALUES[ch];
    if (!base) {
      return { ok: false, error: `Invalid Roman character '${ch}'.` };
    }
    const over = i + 1 < cleaned.length && cleaned[i + 1] === COMBINING_OVERLINE;
    if (over) i++;
    tokens.push({ ch, over, value: base * (over ? 1000 : 1) });
  }
  return { ok: true, tokens };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface ValidationResult {
  valid: boolean;
  error?: string;
  /** Mode used (strict / lenient). */
  mode: ValidationMode;
}

/**
 * Validate a Roman numeral string.
 * - strict: enforces standard subtractive rules + no 4-in-a-row + valid order.
 * - lenient: only requires that every character is a Roman numeral (or
 *   overlined Roman numeral). Allows clock-style IIII, VV, etc.
 */
export function validateRoman(s: string, mode: ValidationMode = "strict"): ValidationResult {
  const cleaned = normalizeRoman(s);
  if (!cleaned) return { valid: false, error: "Empty input.", mode };
  const tk = tokenizeRoman(cleaned);
  if (!tk.ok || !tk.tokens) {
    return { valid: false, error: tk.error, mode };
  }
  const tokens = tk.tokens;

  if (mode === "lenient") {
    // Lenient: only require that all chars are Roman numerals.
    return { valid: true, mode };
  }

  // Strict: split into overlined (high) and non-overlined (low) parts.
  // Overlined symbols must come before non-overlined symbols.
  let highPart = "";
  let lowPart = "";
  let seenLow = false;
  for (const t of tokens) {
    if (t.over) {
      if (seenLow) {
        return { valid: false, error: "Overlined (vinculum) symbols must come before non-overlined ones.", mode };
      }
      highPart += t.ch;
    } else {
      seenLow = true;
      lowPart += t.ch;
    }
  }
  // Empty parts are OK (e.g. "M̅" has high="M", low="").
  if (highPart && !STRICT_GROUP_REGEX.test(highPart)) {
    return { valid: false, error: `Overlined portion '${highPart}' is not standard strict Roman (e.g. no IIII, no IC).`, mode };
  }
  if (lowPart && !STRICT_GROUP_REGEX.test(lowPart)) {
    return { valid: false, error: `Non-overlined portion '${lowPart}' is not standard strict Roman (e.g. no IIII, no IC).`, mode };
  }
  return { valid: true, mode };
}

// ---------------------------------------------------------------------------
// Conversion: Arabic → Roman
// ---------------------------------------------------------------------------

export interface ConversionResult {
  ok: boolean;
  roman?: string;
  error?: string;
  /** The original input value. */
  input?: number;
  /** Mode used. */
  mode?: ConversionMode;
}

/** Convert a single Arabic number (1–3999) to standard Roman. */
export function arabicToStandardRoman(n: number): string {
  let result = "";
  let remaining = n;
  for (const { sym, val } of ROMAN_SYMBOLS) {
    while (remaining >= val) {
      result += sym;
      remaining -= val;
    }
  }
  return result;
}

/** Convert an Arabic number to Roman, optionally using vinculum for >3999. */
export function arabicToRoman(n: number, mode: ConversionMode = "standard"): ConversionResult {
  if (!Number.isInteger(n)) {
    return { ok: false, error: "Roman numerals only represent integers (no fractions)." };
  }
  if (n < 1) {
    return { ok: false, error: "Roman numerals have no representation for zero or negative numbers." };
  }
  const max = mode === "vinculum" ? VINCULUM_MAX : STANDARD_MAX;
  if (n > max) {
    return { ok: false, error: `Value ${n.toLocaleString()} exceeds ${mode} mode maximum (${max.toLocaleString()}).` };
  }
  if (n <= STANDARD_MAX) {
    return { ok: true, roman: arabicToStandardRoman(n), input: n, mode };
  }
  // Vinculum mode for n > 3999.
  const high = Math.floor(n / 1000); // 4..3999
  const low = n % 1000; // 0..999
  const highRoman = applyOverline(arabicToStandardRoman(high));
  const lowRoman = low > 0 ? arabicToStandardRoman(low) : "";
  return { ok: true, roman: highRoman + lowRoman, input: n, mode: "vinculum" };
}

/** Year helper — alias for arabicToRoman with vinculum mode (handles years > 3999). */
export function yearToRoman(year: number): ConversionResult {
  return arabicToRoman(year, "vinculum");
}

// ---------------------------------------------------------------------------
// Conversion: Roman → Arabic
// ---------------------------------------------------------------------------

export interface ParseResult {
  ok: boolean;
  value?: number;
  error?: string;
  /** Mode used. */
  mode: ValidationMode;
  /** Original input. */
  input: string;
  /** Whether vinculum (overline) was used. */
  usedVinculum: boolean;
}

/** Compute the integer value of a tokenized Roman sequence (lenient semantics). */
export function computeTokenValue(tokens: RomanToken[]): number {
  let total = 0;
  for (let i = 0; i < tokens.length; i++) {
    const cur = tokens[i].value;
    const next = i + 1 < tokens.length ? tokens[i + 1].value : 0;
    if (cur < next) {
      // Subtractive pair (lenient — any smaller-before-larger).
      total += next - cur;
      i++;
    } else {
      total += cur;
    }
  }
  return total;
}

/** Parse a Roman numeral string to its Arabic value. */
export function romanToArabic(s: string, mode: ValidationMode = "strict"): ParseResult {
  const cleaned = normalizeRoman(s);
  if (!cleaned) {
    return { ok: false, error: "Empty input.", mode, input: s, usedVinculum: false };
  }
  const v = validateRoman(cleaned, mode);
  if (!v.valid) {
    return { ok: false, error: v.error, mode, input: s, usedVinculum: hasVinculum(cleaned) };
  }
  const tk = tokenizeRoman(cleaned);
  if (!tk.ok || !tk.tokens) {
    return { ok: false, error: tk.error, mode, input: s, usedVinculum: hasVinculum(cleaned) };
  }
  const value = computeTokenValue(tk.tokens);
  if (value < 1) {
    return { ok: false, error: "Resulting value is zero or negative.", mode, input: s, usedVinculum: hasVinculum(cleaned) };
  }
  if (value > VINCULUM_MAX) {
    return { ok: false, error: `Value ${value.toLocaleString()} exceeds maximum supported (${VINCULUM_MAX.toLocaleString()}).`, mode, input: s, usedVinculum: hasVinculum(cleaned) };
  }
  return { ok: true, value, mode, input: s, usedVinculum: hasVinculum(cleaned) };
}

// ---------------------------------------------------------------------------
// Breakdown (additive / subtractive decomposition)
// ---------------------------------------------------------------------------

export interface BreakdownStep {
  /** The portion of the numeral this step covers (e.g. "CM", "XC", "IV"). */
  piece: string;
  /** Arithmetic description, e.g. "1000-100", "100-10", "5-1". */
  formula: string;
  /** Numeric value of this piece. */
  value: number;
  /** Cumulative total after this step. */
  cumulative: number;
}

export interface BreakdownResult {
  ok: boolean;
  steps?: BreakdownStep[];
  total?: number;
  error?: string;
  /** Pretty text representation (one step per line). */
  text?: string;
}

/** Decompose an Arabic number into the additive/subtractive steps that build its Roman form. */
export function decomposeArabic(n: number, mode: ConversionMode = "standard"): BreakdownResult {
  const conv = arabicToRoman(n, mode);
  if (!conv.ok || !conv.roman) {
    return { ok: false, error: conv.error };
  }
  return decomposeRoman(conv.roman);
}

/** Decompose a Roman numeral into its additive/subtractive steps. */
export function decomposeRoman(s: string): BreakdownResult {
  const cleaned = normalizeRoman(s);
  const tk = tokenizeRoman(cleaned);
  if (!tk.ok || !tk.tokens) {
    return { ok: false, error: tk.error };
  }
  const tokens = tk.tokens;
  const steps: BreakdownStep[] = [];
  let cumulative = 0;
  let i = 0;
  while (i < tokens.length) {
    const cur = tokens[i];
    const next = i + 1 < tokens.length ? tokens[i + 1] : null;
    if (next && cur.value < next.value) {
      // Subtractive pair.
      const piece = cur.ch + (cur.over ? COMBINING_OVERLINE : "") + next.ch + (next.over ? COMBINING_OVERLINE : "");
      const formula = `${next.value} - ${cur.value}`;
      const value = next.value - cur.value;
      cumulative += value;
      steps.push({ piece, formula, value, cumulative });
      i += 2;
    } else {
      const piece = cur.ch + (cur.over ? COMBINING_OVERLINE : "");
      const formula = `${cur.value}`;
      const value = cur.value;
      cumulative += value;
      steps.push({ piece, formula, value, cumulative });
      i += 1;
    }
  }
  const text = steps
    .map((st, idx) => `${idx === 0 ? "" : " + "}${st.piece} (${st.formula}) = ${st.value}`)
    .join("") + ` = ${cumulative}`;
  return { ok: true, steps, total: cumulative, text };
}

// ---------------------------------------------------------------------------
// Batch conversion
// ---------------------------------------------------------------------------

export interface BatchEntry {
  input: string;
  ok: boolean;
  /** Resulting Roman (if Arabic→Roman) or Arabic (if Roman→Arabic). */
  output?: string;
  error?: string;
}

export interface BatchResult {
  entries: BatchEntry[];
  /** Direction auto-detected per line: "to-roman" if Arabic, "to-arabic" if Roman. */
  direction: ("to-roman" | "to-arabic")[];
}

/**
 * Batch convert a multi-line list. Each non-empty line is auto-detected:
 * - if it parses as an integer → Arabic → Roman (vinculum mode)
 * - otherwise → Roman → Arabic (strict mode)
 */
export function parseBatch(text: string): BatchResult {
  const lines = (text ?? "").split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
  const entries: BatchEntry[] = [];
  const direction: ("to-roman" | "to-arabic")[] = [];
  for (const line of lines) {
    const asNum = Number(line.replace(/[, ]/g, ""));
    if (/^-?\d+$/.test(line.replace(/[, ]/g, ""))) {
      direction.push("to-roman");
      const r = arabicToRoman(asNum, "vinculum");
      if (r.ok && r.roman) {
        entries.push({ input: line, ok: true, output: r.roman });
      } else {
        entries.push({ input: line, ok: false, error: r.error });
      }
    } else {
      direction.push("to-arabic");
      const p = romanToArabic(line, "strict");
      if (p.ok && p.value !== undefined) {
        entries.push({ input: line, ok: true, output: String(p.value) });
      } else {
        entries.push({ input: line, ok: false, error: p.error });
      }
    }
  }
  return { entries, direction };
}

/** Render a batch result as plain text (one entry per line). */
export function renderBatchText(result: BatchResult): string {
  return result.entries
    .map((e) => `${e.input}\t→\t${e.ok ? e.output : `ERROR: ${e.error}`}`)
    .join("\n");
}

// ---------------------------------------------------------------------------
// History of Roman numerals (reference facts)
// ---------------------------------------------------------------------------

export interface HistoryFact {
  title: string;
  body: string;
}

export const HISTORY_FACTS: HistoryFact[] = [
  {
    title: "Etruscan roots",
    body: "Roman numerals evolved from the Etruscan numeral system around the 5th century BC. The symbols I, V, X, L, C, D, M derive from earlier notches and hand-gesture counting.",
  },
  {
    title: "Additive → subtractive",
    body: "Early Roman numerals were purely additive (4 = IIII). Subtractive forms (IV, IX, XL, XC, CD, CM) became common in medieval times to shorten inscriptions and avoid confusion.",
  },
  {
    title: "Vinculum (overline ×1000)",
    body: "To represent numbers beyond 3999, an overline (vinculum) above a numeral multiplies its value by 1000. So V̅ = 5,000 and X̅ = 10,000. A second overline or tallied box could multiply by another 1000, but one level (up to 3,999,999) covers most historical use.",
  },
  {
    title: "No symbol for zero",
    body: "Roman numerals have no zero. Latin used the word 'nulla' (nothing) or 'nihil' where zero was needed. The positional zero arrived in Europe with the Hindu-Arabic system around the 12th century.",
  },
  {
    title: "Clockmaker's IIII",
    body: "Many clock faces use IIII instead of IV for 4 — a tradition dating to medieval clockmakers. Theories: aesthetic balance with VIII, avoidance of IV being confused with VI (especially mirrored), or respect for the god Jupiter (IV = first two letters of IVPITTER).",
  },
  {
    title: "Modern uses",
    body: "Today, Roman numerals survive in monarch/papal names (Elizabeth II, Benedict XVI), book chapter numbers, movie copyright dates, Super Bowl numbering, building cornerstones, and outline numbering — lending an air of tradition or formality.",
  },
  {
    title: "Largest standard value",
    body: "In strict standard form (no vinculum), the largest representable value is 3,999 = MMMCMXCIX. Going higher requires vinculum notation or non-standard repetition (MMMM, used occasionally in antiquity but rejected by strict modern rules).",
  },
  {
    title: "Validity rules (strict)",
    body: "Strict rules: I, X, C, M repeat at most 3 times consecutively. V, L, D never repeat. Subtraction allowed only for IV, IX, XL, XC, CD, CM (a smaller value precedes a larger one of the same power-of-ten family or the next one).",
  },
];

// ---------------------------------------------------------------------------
// Quick presets
// ---------------------------------------------------------------------------

export interface RomanPreset {
  label: string;
  value: string;
  description: string;
}

export const ROMAN_PRESETS: RomanPreset[] = [
  { label: "1 → I", value: "1", description: "Smallest value." },
  { label: "4 → IV", value: "4", description: "Subtractive 4 (not IIII)." },
  { label: "9 → IX", value: "9", description: "Subtractive 9." },
  { label: "49 → XLIX", value: "49", description: "Subtractive in two places." },
  { label: "1994 → MCMXCIV", value: "1994", description: "Classic year example." },
  { label: "2024 → MMXXIV", value: "2024", description: "Current-ish year." },
  { label: "3999 → MMMCMXCIX", value: "3999", description: "Largest standard value." },
  { label: "4000 → I̅V̅", value: "4000", description: "Smallest vinculum value." },
  { label: "5000 → V̅", value: "5000", description: "Vinculum V." },
  { label: "2024 → year", value: "2024", description: "Year-mode (vinculum)." },
];

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:roman-numeral-converter:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  /** Direction of conversion. */
  direction: "to-roman" | "to-arabic";
  /** Source value (Arabic or Roman). */
  input: string;
  /** Result value (Roman or Arabic). */
  output: string;
  /** Whether vinculum was used or produced. */
  vinculum: boolean;
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

export function buildShareUrl(direction: "to-roman" | "to-arabic", input: string): string {
  const params = new URLSearchParams();
  params.set("d", direction);
  if (input) params.set("v", input);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export interface ShareParams {
  direction: "to-roman" | "to-arabic";
  input: string;
}

export function parseShareUrl(hash: string): ShareParams {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { direction: "to-roman", input: "" };
  const params = new URLSearchParams(clean);
  const d = params.get("d") ?? "to-roman";
  const direction: "to-roman" | "to-arabic" = d === "to-arabic" ? "to-arabic" : "to-roman";
  const input = params.get("v") ?? "";
  return { direction, input };
}

// ---------------------------------------------------------------------------
// Misc helpers
// ---------------------------------------------------------------------------

/** True if n is within the representable range for the given mode. */
export function isInRange(n: number, mode: ConversionMode = "standard"): boolean {
  if (!Number.isInteger(n) || n < 1) return false;
  return n <= (mode === "vinculum" ? VINCULUM_MAX : STANDARD_MAX);
}
