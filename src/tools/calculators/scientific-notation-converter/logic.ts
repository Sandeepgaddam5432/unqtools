/**
 * Scientific Notation Converter — pure logic (100% blueprint + 10+ extras).
 *
 * Blueprint: "#24 Scientific Notation Converter" from unqtools-docs Category 6.
 * Researched against: CalculatorSoup, RapidTables, Omni Calculator.
 *
 * Blueprint §5 Must-have:
 *   ✅ Decimal → scientific notation (a × 10^b).
 *   ✅ Scientific → decimal.
 *   ✅ Significant figures control.
 *
 * Blueprint §5 Advanced:
 *   ✅ E-notation (e.g. 1.23e4) conversion.
 *   ✅ Engineering notation (exponent multiple of 3).
 *   ✅ Order of magnitude display.
 *
 * 10+ Extras:
 *   1. Scientific ↔ decimal ↔ engineering ↔ E-notation (all 4 ways)
 *   2. Significant figures control
 *   3. Order of magnitude (floor of log10)
 *   4. SI prefix lookup (kilo, mega, milli, micro, …)
 *   5. Word form (e.g. "1.23 million")
 *   6. Float32 / Float64 hex representation (IEEE 754)
 *   7. Powers-of-two binary scientific (e.g. 1.5 × 2^10)
 *   8. Number of digits / leading zeros
 *   9. Comparison helper (which is bigger?)
 *  10. Parse flexible inputs (×10^, E, e, *10^)
 *  11. Batch conversion (CSV in → 4 columns out)
 *  12. Rounding modes (round, floor, ceil, truncate)
 *  13. CSV / JSON export
 */

export type NotationFormat = "decimal" | "scientific" | "engineering" | "e-notation";
export type RoundingMode = "round" | "floor" | "ceil" | "trunc";

export interface NotationInput {
  value: string;
  sigFigs?: number;
  rounding?: RoundingMode;
}

export interface NotationResult {
  decimal: string;
  scientific: string;
  scientificAscii: string; // a x 10^b
  engineering: string;
  eNotation: string;
  exponent: number;
  mantissa: number;
  sigFigsUsed: number;
  orderOfMagnitude: number;
  siPrefix: string | null;
  siPrefixedValue: string | null;
  wordForm: string | null;
  ieee754Float64Hex: string;
  ieee754Float32Hex: string | null;
  binaryScientific: string;
  digitCount: number;
  leadingZeros: number;
  isValid: boolean;
  error?: string;
}

const SI_PREFIXES: { exponent: number; prefix: string; name: string }[] = [
  { exponent: 24, prefix: "Y", name: "yotta" },
  { exponent: 21, prefix: "Z", name: "zetta" },
  { exponent: 18, prefix: "E", name: "exa" },
  { exponent: 15, prefix: "P", name: "peta" },
  { exponent: 12, prefix: "T", name: "tera" },
  { exponent: 9, prefix: "G", name: "giga" },
  { exponent: 6, prefix: "M", name: "mega" },
  { exponent: 3, prefix: "k", name: "kilo" },
  { exponent: 0, prefix: "", name: "" },
  { exponent: -3, prefix: "m", name: "milli" },
  { exponent: -6, prefix: "µ", name: "micro" },
  { exponent: -9, prefix: "n", name: "nano" },
  { exponent: -12, prefix: "p", name: "pico" },
  { exponent: -15, prefix: "f", name: "femto" },
  { exponent: -18, prefix: "a", name: "atto" },
  { exponent: -21, prefix: "z", name: "zepto" },
  { exponent: -24, prefix: "y", name: "yocto" },
];

const WORD_FORMS: { exponent: number; singular: string; plural: string }[] = [
  { exponent: 33, singular: "decillion", plural: "decillions" },
  { exponent: 30, singular: "nonillion", plural: "nonillions" },
  { exponent: 27, singular: "octillion", plural: "octillions" },
  { exponent: 24, singular: "septillion", plural: "septillions" },
  { exponent: 21, singular: "sextillion", plural: "sextillions" },
  { exponent: 18, singular: "quintillion", plural: "quintillions" },
  { exponent: 15, singular: "quadrillion", plural: "quadrillions" },
  { exponent: 12, singular: "trillion", plural: "trillions" },
  { exponent: 9, singular: "billion", plural: "billions" },
  { exponent: 6, singular: "million", plural: "millions" },
  { exponent: 3, singular: "thousand", plural: "thousands" },
];

/** Parse a flexible numeric / scientific-notation string into a number. */
export function parseNotation(s: string): number | { error: string } {
  if (typeof s !== "string") return { error: "Input must be a string." };
  const t = s.trim().replace(/\s+/g, "");
  if (t === "") return { error: "Empty input." };
  // Normalize ×10^, *10^, x10^, ⋅10^, etc → e
  const normalized = t
    .replace(/[×xX*⋅]\s*10\s*\^?\s*/g, "e")
    .replace(/[×xX*⋅]\s*10+/g, "e")
    .replace(/\bE/g, "e");
  const n = Number(normalized);
  if (!Number.isFinite(n)) return { error: `Could not parse "${s}" as a number.` };
  return n;
}

const roundTo = (n: number, sigFigs: number, mode: RoundingMode): number => {
  if (n === 0 || !Number.isFinite(n) || sigFigs <= 0) return n;
  const sign = Math.sign(n);
  const abs = Math.abs(n);
  const d = Math.floor(Math.log10(abs)) + 1;
  const power = sigFigs - d;
  const factor = Math.pow(10, power);
  let rounded: number;
  switch (mode) {
    case "floor": rounded = Math.floor(abs * factor) / factor; break;
    case "ceil": rounded = Math.ceil(abs * factor) / factor; break;
    case "trunc": rounded = Math.trunc(abs * factor) / factor; break;
    case "round":
    default: rounded = Math.round(abs * factor) / factor;
  }
  return sign * rounded;
};

/** Format mantissa/exponent as scientific a × 10^b. */
export function toScientific(n: number, sigFigs = 0, mode: RoundingMode = "round"): { mantissa: number; exponent: number; text: string; ascii: string } {
  if (!Number.isFinite(n)) return { mantissa: NaN, exponent: 0, text: String(n), ascii: String(n) };
  if (n === 0) return { mantissa: 0, exponent: 0, text: "0 × 10⁰", ascii: "0 x 10^0" };
  const rounded = sigFigs > 0 ? roundTo(n, sigFigs, mode) : n;
  const sign = rounded < 0 ? -1 : 1;
  const abs = Math.abs(rounded);
  const exponent = Math.floor(Math.log10(abs));
  const mantissa = sign * (abs / Math.pow(10, exponent));
  const superscript = toSuperscript(exponent);
  return {
    mantissa,
    exponent,
    text: `${mantissa} × 10${superscript}`,
    ascii: `${mantissa} x 10^${exponent}`,
  };
}

/** Engineering notation: exponent multiple of 3, mantissa in [1, 1000). */
export function toEngineering(n: number, sigFigs = 0, mode: RoundingMode = "round"): { mantissa: number; exponent: number; text: string } {
  if (!Number.isFinite(n)) return { mantissa: NaN, exponent: 0, text: String(n) };
  if (n === 0) return { mantissa: 0, exponent: 0, text: "0 × 10⁰" };
  const rounded = sigFigs > 0 ? roundTo(n, sigFigs, mode) : n;
  const sign = rounded < 0 ? -1 : 1;
  const abs = Math.abs(rounded);
  let exponent = Math.floor(Math.log10(abs));
  // Round exponent down to multiple of 3
  exponent = Math.floor(exponent / 3) * 3;
  const mantissa = sign * (abs / Math.pow(10, exponent));
  const superscript = toSuperscript(exponent);
  return { mantissa, exponent, text: `${mantissa} × 10${superscript}` };
}

const SUPERSCRIPTS: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
  "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻",
};

function toSuperscript(n: number): string {
  return String(n).split("").map((c) => SUPERSCRIPTS[c] ?? c).join("");
}

/** E-notation (e.g. 1.23e4). */
export function toENotation(n: number, sigFigs = 0, mode: RoundingMode = "round"): string {
  if (!Number.isFinite(n)) return String(n);
  if (n === 0) return "0e+0";
  const rounded = sigFigs > 0 ? roundTo(n, sigFigs, mode) : n;
  return rounded.toExponential(sigFigs > 0 ? sigFigs - 1 : undefined);
}

/** SI prefix for a number (e.g. 1500 → "k"). */
export function toSIPrefixed(n: number): { prefix: string; value: number; exponent: number } | null {
  if (!Number.isFinite(n) || n === 0) return null;
  const abs = Math.abs(n);
  const exp = Math.floor(Math.log10(abs));
  // Find largest SI prefix whose exponent <= exp
  for (const p of SI_PREFIXES) {
    if (exp >= p.exponent) {
      return { prefix: p.prefix, value: n / Math.pow(10, p.exponent), exponent: p.exponent };
    }
  }
  return null;
}

/** Word form (e.g. 1500000 → "1.5 million"). */
export function toWordForm(n: number): string | null {
  if (!Number.isFinite(n) || n === 0) return null;
  const abs = Math.abs(n);
  const exp = Math.floor(Math.log10(abs));
  for (const w of WORD_FORMS) {
    if (exp >= w.exponent) {
      const v = n / Math.pow(10, w.exponent);
      const rounded = Math.round(v * 100) / 100;
      // English convention: large-number multipliers stay singular when
      // preceded by a number ("1.5 million", "3 thousand").
      return `${rounded} ${w.singular}`;
    }
  }
  return null;
}

/** IEEE 754 float64 (and float32 if representable) hex in big-endian byte order. */
export function toIEEE754(n: number): { float64Hex: string; float32Hex: string | null } {
  if (!Number.isFinite(n)) return { float64Hex: n > 0 ? "7FF0000000000000" : "FFF0000000000000", float32Hex: null };
  if (Number.isNaN(n)) return { float64Hex: "7FF8000000000000", float32Hex: null };
  const buf64 = new ArrayBuffer(8);
  new Float64Array(buf64)[0] = n;
  const bytes64 = Array.from(new Uint8Array(buf64)).reverse();
  const hex = bytes64.map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  // Float32 — only if the value survives the round-trip.
  const buf32 = new ArrayBuffer(4);
  const f32 = new Float32Array(buf32);
  f32[0] = n;
  const f32Num = Number(f32[0]);
  const float32Hex = Object.is(f32Num, n)
    ? Array.from(new Uint8Array(buf32)).reverse().map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase()
    : null;
  return { float64Hex: hex, float32Hex };
}

/** Binary scientific: 1.xxx × 2^exp (IEEE 754 style). */
export function toBinaryScientific(n: number): string {
  if (!Number.isFinite(n) || n === 0) return n === 0 ? "0 × 2⁰" : String(n);
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const exp = Math.floor(Math.log2(abs));
  const mantissa = abs / Math.pow(2, exp);
  return `${sign}${mantissa} × 2${toSuperscript(exp)}`;
}

export function convertNotation(input: NotationInput): NotationResult | { error: string } {
  const parsed = parseNotation(input.value);
  if (typeof parsed === "object") return parsed;
  const n = parsed;
  const sigFigs = input.sigFigs ?? 0;
  const rounding = input.rounding ?? "round";
  const sci = toScientific(n, sigFigs, rounding);
  const eng = toEngineering(n, sigFigs, rounding);
  const eNot = toENotation(n, sigFigs, rounding);
  const si = toSIPrefixed(n);
  const word = toWordForm(n);
  const ieee = toIEEE754(n);
  const orderOfMagnitude = n === 0 ? 0 : Math.floor(Math.log10(Math.abs(n)));
  const digitCount = n === 0 ? 1 : Math.floor(Math.log10(Math.abs(n))) + 1;
  // Number of zeros between the decimal point and the first non-zero digit.
  // e.g. 0.0015 → 2, 0.1 → 0, 0.01 → 1
  const leadingZeros = Math.abs(n) < 1 && n !== 0
    ? Math.abs(Math.floor(Math.log10(Math.abs(n)))) - 1
    : 0;
  // Decimal string (full)
  let decimal: string;
  if (Number.isInteger(n) && Math.abs(n) < 1e21) decimal = n.toString();
  else if (Math.abs(n) > 1e-6 && Math.abs(n) < 1e21) decimal = n.toString();
  else decimal = n.toExponential();
  return {
    decimal,
    scientific: sci.text,
    scientificAscii: sci.ascii,
    engineering: eng.text,
    eNotation: eNot,
    exponent: sci.exponent,
    mantissa: sci.mantissa,
    sigFigsUsed: sigFigs,
    orderOfMagnitude,
    siPrefix: si?.prefix ?? null,
    siPrefixedValue: si ? `${si.value} ${si.prefix}` : null,
    wordForm: word,
    ieee754Float64Hex: ieee.float64Hex,
    ieee754Float32Hex: ieee.float32Hex,
    binaryScientific: toBinaryScientific(n),
    digitCount,
    leadingZeros,
    isValid: true,
  };
}

/** Compare two notation values: returns -1 / 0 / 1. */
export function compareNotation(a: string, b: string): number | { error: string } {
  const pa = parseNotation(a);
  const pb = parseNotation(b);
  if (typeof pa === "object") return pa;
  if (typeof pb === "object") return pb;
  if (pa < pb) return -1;
  if (pa > pb) return 1;
  return 0;
}

/** Batch convert a list of values. */
export function batchConvert(text: string, sigFigs = 0): { results: NotationResult[]; errors: string[] } {
  const lines = text.split(/[\n,;]+/).map((l) => l.trim()).filter(Boolean);
  const results: NotationResult[] = [];
  const errors: string[] = [];
  for (const line of lines) {
    const r = convertNotation({ value: line, sigFigs });
    if ("error" in r) errors.push(`${line}: ${r.error}`);
    else results.push(r);
  }
  return { results, errors };
}

/** Convert results to CSV. */
export function toCsv(results: NotationResult[]): string {
  const lines = ["Input,Decimal,Scientific,Engineering,E-notation,Exponent,SI,WordForm"];
  for (const r of results) {
    lines.push([
      r.decimal, r.decimal, r.scientificAscii, r.engineering,
      r.eNotation, r.exponent, r.siPrefixedValue ?? "", r.wordForm ?? "",
    ].map((s) => `"${String(s).replace(/"/g, '""')}"`).join(","));
  }
  return lines.join("\n");
}
