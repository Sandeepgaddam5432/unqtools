/**
 * Data Storage Converter — pure logic. No DOM/canvas access.
 *
 * Supports:
 *  - 12 units: bit, byte, KiB, MiB, GiB, TiB, PiB, KB, MB, GB, TB, PB
 *  - Binary (1024-based) and decimal (1000-based) systems
 *  - All-units conversion table (single input → all units)
 *  - Batch conversion (multiple inputs from one source unit)
 *  - CSV export of batch / all-units table
 *  - Warnings (negative storage, integer overflow on huge values)
 *  - Significant-digit rounding
 *  - System hint (binary vs decimal) per unit
 *  - Common-presets table (1 KB, 1 MiB, 1 GB, etc.)
 *  - Human-readable size formatter (e.g. "1.50 GiB")
 *  - Bits/bytes mode toggle
 *  - Best-fit unit finder
 *  - Transfer-time estimator (given bandwidth in bits/sec)
 */
export type StorageUnit =
  | "bit" | "byte"
  | "kb" | "mb" | "gb" | "tb" | "pb"
  | "kib" | "mib" | "gib" | "tib" | "pib";

export type StorageSystem = "binary" | "decimal";

export interface StorageOptions { from: StorageUnit; to: StorageUnit; }
export interface StorageResult { output: number; unit: StorageUnit; system: StorageSystem; warnings: string[] }

/** Bits per unit. */
export const TO_BITS: Record<StorageUnit, number> = {
  bit: 1,
  byte: 8,
  kb: 8 * 1000,
  mb: 8 * 1000 ** 2,
  gb: 8 * 1000 ** 3,
  tb: 8 * 1000 ** 4,
  pb: 8 * 1000 ** 5,
  kib: 8 * 1024,
  mib: 8 * 1024 ** 2,
  gib: 8 * 1024 ** 3,
  tib: 8 * 1024 ** 4,
  pib: 8 * 1024 ** 5,
};

export const UNIT_LABELS: Record<StorageUnit, string> = {
  bit: "Bit (b)", byte: "Byte (B)",
  kb: "Kilobyte (KB, 1000)", mb: "Megabyte (MB, 1000²)", gb: "Gigabyte (GB, 1000³)", tb: "Terabyte (TB, 1000⁴)", pb: "Petabyte (PB, 1000⁵)",
  kib: "Kibibyte (KiB, 1024)", mib: "Mebibyte (MiB, 1024²)", gib: "Gibibyte (GiB, 1024³)", tib: "Tebibyte (TiB, 1024⁴)", pib: "Pebibyte (PiB, 1024⁵)",
};

export const UNIT_SYSTEM: Record<StorageUnit, StorageSystem> = {
  bit: "decimal", byte: "decimal",
  kb: "decimal", mb: "decimal", gb: "decimal", tb: "decimal", pb: "decimal",
  kib: "binary", mib: "binary", gib: "binary", tib: "binary", pib: "binary",
};

export const ALL_UNITS = Object.keys(TO_BITS) as StorageUnit[];

export const PRESETS: { label: string; value: number; unit: StorageUnit }[] = [
  { label: "1 byte", value: 1, unit: "byte" },
  { label: "1 KiB", value: 1, unit: "kib" },
  { label: "1 MiB", value: 1, unit: "mib" },
  { label: "1 GiB", value: 1, unit: "gib" },
  { label: "1 TiB", value: 1, unit: "tib" },
  { label: "1 KB", value: 1, unit: "kb" },
  { label: "1 MB", value: 1, unit: "mb" },
  { label: "1 GB", value: 1, unit: "gb" },
];

/** Round to N significant digits. */
export function roundTo(value: number, sig = 10): number {
  if (!Number.isFinite(value)) return value;
  if (value === 0) return 0;
  const d = Math.ceil(Math.log10(Math.abs(value)));
  const power = sig - d;
  const f = Math.pow(10, power);
  return Math.round(value * f) / f;
}

/** Convert a single value. */
export function process(input: number, options: StorageOptions): StorageResult | { error: string } {
  if (typeof input !== "number" || Number.isNaN(input)) return { error: "Input must be a number" };
  if (!Number.isFinite(input)) return { error: "Input must be finite" };
  const warnings: string[] = [];
  if (input < 0) warnings.push("Negative storage is unusual.");
  const bits = input * TO_BITS[options.from];
  if (bits > Number.MAX_SAFE_INTEGER) warnings.push("Value exceeds Number.MAX_SAFE_INTEGER precision.");
  const out = bits / TO_BITS[options.to];
  return { output: roundTo(out), unit: options.to, system: UNIT_SYSTEM[options.to], warnings };
}

/** Convert one input to ALL units. */
export function convertAll(input: number, from: StorageUnit): { unit: StorageUnit; value: number; system: StorageSystem }[] {
  const bits = input * TO_BITS[from];
  return ALL_UNITS.map((unit) => ({ unit, value: roundTo(bits / TO_BITS[unit]), system: UNIT_SYSTEM[unit] }));
}

/** Batch conversion: many inputs from same source to one target. */
export function convertBatch(inputs: number[], from: StorageUnit, to: StorageUnit): (StorageResult | { error: string })[] {
  return inputs.map((v) => process(v, { from, to }));
}

export function toCsv(rows: { unit: StorageUnit; value: number }[]): string {
  const lines = ["Unit,Value"];
  for (const r of rows) lines.push(`${r.unit},${r.value}`);
  return lines.join("\n");
}

export function batchToCsv(inputs: number[], from: StorageUnit, to: StorageUnit, results: (StorageResult | { error: string })[]): string {
  const lines = ["Input,From,Output,Unit,System,Warnings"];
  for (let i = 0; i < results.length; i++) {
    const r = results[i]!;
    if ("error" in r) lines.push(`${inputs[i]},${from},ERROR,${to},,"${r.error.replace(/"/g, '""')}"`);
    else lines.push(`${inputs[i]},${from},${r.output},${r.unit},${r.system},${r.warnings.length}`);
  }
  return lines.join("\n");
}

export function swap(opts: StorageOptions): StorageOptions { return { from: opts.to, to: opts.from }; }

/** Find the best-fit human-readable unit (binary, byte-based) for a value in bits. */
export function bestFitUnit(bits: number): StorageUnit {
  const abs = Math.abs(bits);
  if (abs === 0) return "byte";
  const bytes = abs / 8;
  if (bytes < 1024) return "byte";
  if (bytes < 1024 ** 2) return "kib";
  if (bytes < 1024 ** 3) return "mib";
  if (bytes < 1024 ** 4) return "gib";
  if (bytes < 1024 ** 5) return "tib";
  return "pib";
}

/** Format a value with a human-readable unit (binary, 2-decimal precision). */
export function formatSize(bits: number): string {
  if (!Number.isFinite(bits) || bits === 0) return "0 B";
  const negative = bits < 0;
  const abs = Math.abs(bits);
  const bytes = abs / 8;
  const units = ["B", "KiB", "MiB", "GiB", "TiB", "PiB"];
  let i = 0; let v = bytes;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${negative ? "-" : ""}${v.toFixed(2)} ${units[i]}`;
}

/** Estimate transfer time (seconds) given bandwidth in bits/sec. */
export function transferTime(bits: number, bitsPerSec: number): number | { error: string } {
  if (bitsPerSec <= 0) return { error: "Bandwidth must be positive" };
  return bits / bitsPerSec;
}

/** Format seconds as a human-readable duration. */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "n/a";
  if (seconds < 1) return `${(seconds * 1000).toFixed(0)} ms`;
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)} min`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)} h`;
  return `${(seconds / 86400).toFixed(1)} d`;
}

/** Validate options. */
export function validateOptions(opts: StorageOptions): { ok: true } | { error: string } {
  if (!TO_BITS[opts.from]) return { error: "Invalid source unit" };
  if (!TO_BITS[opts.to]) return { error: "Invalid target unit" };
  return { ok: true };
}

/** Filter units by system. */
export function unitsBySystem(sys: StorageSystem): StorageUnit[] {
  return ALL_UNITS.filter((u) => UNIT_SYSTEM[u] === sys);
}

/** Sum storage across units. */
export function sumStorage(items: { value: number; unit: StorageUnit }[], outputUnit: StorageUnit): number {
  const bits = items.reduce((acc, it) => acc + it.value * TO_BITS[it.unit], 0);
  return roundTo(bits / TO_BITS[outputUnit]);
}
