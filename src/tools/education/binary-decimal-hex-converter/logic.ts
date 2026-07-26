/**
 * Binary / Decimal / Hex Converter — pure logic.
 *
 * Converts numbers between arbitrary bases (2..36), with optional fractional
 * support, signed/unsigned modes, step-by-step explanations, batch
 * conversions, statistics, ASCII mapping, and a reference table.
 *
 * Pure only — no DOM, no I/O.
 */

export type Base = "binary" | "decimal" | "hex" | "octal";

export const BASE_RADIX: Record<Base, number> = {
  binary: 2, octal: 8, decimal: 10, hex: 16,
};

export const BASE_NAMES: Record<Base, string> = {
  binary: "Binary", octal: "Octal", decimal: "Decimal", hex: "Hexadecimal",
};

export interface ConversionInput {
  value: string;
  from: Base;
  to: Base;
  signed?: boolean;
  bitWidth?: 8 | 16 | 32 | 64;
}

export interface ConversionStep {
  description: string;
  result: string;
}

export interface ConversionResult {
  input: ConversionInput;
  output: string;
  decimalValue: number;
  isValid: boolean;
  error?: string;
  steps: ConversionStep[];
  warnings: string[];
}

/** Validate a string against a target base. Allows optional leading sign and fractional point. */
export function isValidForBase(value: string, base: Base): boolean {
  if (!value) return false;
  const radix = BASE_RADIX[base];
  const clean = value.trim().replace(/^[+-]/, "");
  if (clean.includes(".")) {
    const [intPart, fracPart] = clean.split(".");
    if (intPart === "" && fracPart === "") return false;
    const re = new RegExp(`^[0-9a-zA-Z]{0,${radix > 10 ? 36 : radix}}$`);
    // Validate each digit is below radix
    const validate = (s: string) => s === "" || [...s].every((c) => digitValue(c) < radix);
    return validate(intPart) && validate(fracPart);
  }
  return [...clean].every((c) => digitValue(c) < radix);
}

/** Convert a single character to its digit value (0..35). */
export function digitValue(c: string): number {
  const code = c.charCodeAt(0);
  if (code >= 48 && code <= 57) return code - 48; // 0..9
  if (code >= 65 && code <= 90) return code - 55; // A..Z
  if (code >= 97 && code <= 122) return code - 87; // a..z
  return 99;
}

/** Convert a digit value (0..35) back to its character. */
export function digitChar(v: number): string {
  if (v < 10) return String(v);
  return String.fromCharCode(55 + v); // 10 -> 'A'
}

/** Parse a base-N string (with optional fraction) into a decimal number. */
export function parseBaseN(value: string, radix: number): number {
  const trimmed = value.trim();
  if (!trimmed) return NaN;
  const sign = trimmed.startsWith("-") ? -1 : 1;
  const clean = trimmed.replace(/^[+-]/, "");
  const [intStr, fracStr] = clean.split(".");
  let intVal = 0;
  let fracVal = 0;
  for (let i = 0; i < intStr.length; i++) {
    const d = digitValue(intStr[i]);
    if (d >= radix) return NaN;
    intVal = intVal * radix + d;
  }
  if (fracStr) {
    let factor = 1 / radix;
    for (let i = 0; i < fracStr.length; i++) {
      const d = digitValue(fracStr[i]);
      if (d >= radix) return NaN;
      fracVal += d * factor;
      factor /= radix;
    }
  }
  return sign * (intVal + fracVal);
}

/** Format a decimal number into a base-N string with optional fraction precision. */
export function formatBaseN(value: number, radix: number, fracDigits = 8): string {
  if (!Number.isFinite(value)) return "NaN";
  if (value === 0) return "0";
  const sign = value < 0 ? "-" : "";
  let v = Math.abs(value);
  const intPart = Math.floor(v);
  let fracPart = v - intPart;
  let intStr = intPart === 0 ? "0" : "";
  let n = intPart;
  while (n > 0) {
    intStr = digitChar(n % radix) + intStr;
    n = Math.floor(n / radix);
  }
  let fracStr = "";
  if (fracPart > 0 && fracDigits > 0) {
    fracStr = ".";
    let count = 0;
    while (fracPart > 0 && count < fracDigits) {
      fracPart *= radix;
      const d = Math.floor(fracPart);
      fracStr += digitChar(d);
      fracPart -= d;
      count++;
    }
  }
  return sign + intStr + fracStr;
}

/** Generate step-by-step explanation for converting between two bases. */
export function explainConversion(value: string, from: Base, to: Base): ConversionStep[] {
  const steps: ConversionStep[] = [];
  const radixFrom = BASE_RADIX[from];
  const radixTo = BASE_RADIX[to];
  if (!isValidForBase(value, from)) {
    steps.push({ description: `Invalid input for ${BASE_NAMES[from]}`, result: "—" });
    return steps;
  }
  const dec = parseBaseN(value, radixFrom);
  steps.push({
    description: `Step 1 — Parse '${value}' as ${BASE_NAMES[from]} (base ${radixFrom})`,
    result: `${value} (${from}) = ${dec} (decimal)`,
  });
  if (to !== "decimal") {
    const out = formatBaseN(dec, radixTo);
    steps.push({
      description: `Step 2 — Re-encode ${dec} as ${BASE_NAMES[to]} (base ${radixTo})`,
      result: `${dec} (decimal) = ${out} (${to})`,
    });
  }
  return steps;
}

/** Run a full conversion. Pure — returns structured result. */
export function convert(input: ConversionInput): ConversionResult {
  const warnings: string[] = [];
  if (!isValidForBase(input.value, input.from)) {
    return {
      input, output: "", decimalValue: NaN, isValid: false,
      error: `Invalid ${BASE_NAMES[input.from]} value: '${input.value}'`,
      steps: [], warnings,
    };
  }
  const radixFrom = BASE_RADIX[input.from];
  const radixTo = BASE_RADIX[input.to];
  const dec = parseBaseN(input.value, radixFrom);
  if (input.signed && input.bitWidth) {
    const max = Math.pow(2, input.bitWidth - 1) - 1;
    if (dec > max) warnings.push(`Value exceeds signed ${input.bitWidth}-bit range (max ${max}).`);
  }
  const output = formatBaseN(dec, radixTo);
  const steps = explainConversion(input.value, input.from, input.to);
  return {
    input, output, decimalValue: dec, isValid: true,
    steps, warnings,
  };
}

/** Convert one input to all four standard bases at once. */
export function convertAll(value: string, from: Base): Record<Base, string> {
  const dec = parseBaseN(value, BASE_RADIX[from]);
  if (!Number.isFinite(dec)) return { binary: "", octal: "", decimal: "", hex: "" };
  return {
    binary: formatBaseN(dec, 2),
    octal: formatBaseN(dec, 8),
    decimal: formatBaseN(dec, 10),
    hex: formatBaseN(dec, 16),
  };
}

/** Convert a custom-radix (2..36) value to decimal. */
export function customBaseToDecimal(value: string, radix: number): number {
  if (radix < 2 || radix > 36) return NaN;
  return parseBaseN(value, radix);
}

/** Convert decimal to a custom-radix string. */
export function decimalToCustomBase(value: number, radix: number): string {
  if (radix < 2 || radix > 36) return "";
  return formatBaseN(value, radix);
}

/** Map a byte value (0..255) to its ASCII representation (control chars replaced). */
export function asciiForByte(b: number): string {
  if (b < 0 || b > 255) return "—";
  if (b < 32 || b === 127) return b === 9 ? "\\t" : b === 10 ? "\\n" : b === 13 ? "\\r" : `\\x${b.toString(16).padStart(2, "0")}`;
  if (b > 127) return `\\x${b.toString(16).padStart(2, "0")}`;
  return String.fromCharCode(b);
}

/** Build a quick reference table for bases 2..16. */
export function referenceTable(): Array<{ base: number; name: string; digits: string; example: string }> {
  const rows: Array<{ base: number; name: string; digits: string; example: string }> = [];
  for (let base = 2; base <= 16; base++) {
    const digits: string[] = [];
    for (let d = 0; d < base; d++) digits.push(digitChar(d));
    rows.push({
      base,
      name: baseNameFor(base),
      digits: digits.join(""),
      example: formatBaseN(255, base),
    });
  }
  return rows;
}

function baseNameFor(base: number): string {
  switch (base) {
    case 2: return "Binary"; case 8: return "Octal"; case 10: return "Decimal";
    case 16: return "Hexadecimal"; default: return `Base-${base}`;
  }
}

/** Batch convert multiple inputs to a target base. */
export function batchConvert(items: ConversionInput[]): ConversionResult[] {
  return items.map(convert);
}

export interface BatchStats {
  count: number; valid: number; invalid: number;
  uniqueOutputs: number;
}

/** Summarise a batch result set. */
export function batchStats(results: ConversionResult[]): BatchStats {
  const valid = results.filter((r) => r.isValid).length;
  const outputs = new Set(results.filter((r) => r.isValid).map((r) => r.output));
  return {
    count: results.length,
    valid,
    invalid: results.length - valid,
    uniqueOutputs: outputs.size,
  };
}

/** Render a plain-text report. */
export function renderReport(r: ConversionResult): string {
  const lines: string[] = [];
  lines.push("Number Base Conversion Report");
  lines.push("=".repeat(40));
  lines.push(`Input:  ${r.input.value} (${BASE_NAMES[r.input.from]})`);
  if (r.isValid) {
    lines.push(`Output: ${r.output} (${BASE_NAMES[r.input.to]})`);
    lines.push(`Decimal value: ${r.decimalValue}`);
  } else {
    lines.push(`Error:  ${r.error}`);
  }
  if (r.steps.length) {
    lines.push(""); lines.push("Steps:");
    r.steps.forEach((s, i) => { lines.push(`  ${i + 1}. ${s.description}`); lines.push(`     → ${s.result}`); });
  }
  if (r.warnings.length) {
    lines.push(""); lines.push("Warnings:");
    r.warnings.forEach((w) => lines.push(`  ! ${w}`));
  }
  return lines.join("\n");
}

/** Build a CSV string from batch results. */
export function renderBatchCsv(results: ConversionResult[]): string {
  const lines = ["index,from,to,input,output,decimal,valid"];
  results.forEach((r, i) => {
    lines.push([
      String(i + 1), r.input.from, r.input.to, r.input.value, r.output,
      Number.isFinite(r.decimalValue) ? String(r.decimalValue) : "",
      String(r.isValid),
    ].join(","));
  });
  return lines.join("\n");
}

export const CONVERSION_PRESETS = [
  { id: "bin-dec", label: "Binary → Decimal", input: { value: "1010", from: "binary" as Base, to: "decimal" as Base } },
  { id: "dec-hex", label: "Decimal → Hex", input: { value: "255", from: "decimal" as Base, to: "hex" as Base } },
  { id: "hex-bin", label: "Hex → Binary", input: { value: "FF", from: "hex" as Base, to: "binary" as Base } },
  { id: "bin-hex", label: "Binary → Hex", input: { value: "11111111", from: "binary" as Base, to: "hex" as Base } },
];

export function getConversionPresets() { return [...CONVERSION_PRESETS]; }
