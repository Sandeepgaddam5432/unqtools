/** Data Storage Converter — pure logic. */

export type StorageUnit =
  | "bit" | "byte"
  | "kb" | "mb" | "gb" | "tb" | "pb"
  | "kib" | "mib" | "gib" | "tib" | "pib";

export interface StorageOptions {
  from: StorageUnit;
  to: StorageUnit;
}

export interface StorageResult {
  output: number;
  unit: StorageUnit;
  warnings: string[];
}

// Bits per unit
const TO_BITS: Record<StorageUnit, number> = {
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
  bit: "Bit (b)",
  byte: "Byte (B)",
  kb: "Kilobyte (KB)",
  mb: "Megabyte (MB)",
  gb: "Gigabyte (GB)",
  tb: "Terabyte (TB)",
  pb: "Petabyte (PB)",
  kib: "Kibibyte (KiB)",
  mib: "Mebibyte (MiB)",
  gib: "Gibibyte (GiB)",
  tib: "Tebibyte (TiB)",
  pib: "Pebibyte (PiB)",
};

export function process(input: number, options: StorageOptions): StorageResult | { error: string } {
  const warnings: string[] = [];
  if (typeof input !== "number" || Number.isNaN(input)) return { error: "Input must be a number" };
  if (input < 0) warnings.push("Negative storage is unusual.");
  const bits = input * TO_BITS[options.from];
  const out = bits / TO_BITS[options.to];
  return { output: out, unit: options.to, warnings };
}

export function convertAll(input: number, from: StorageUnit): { unit: StorageUnit; value: number }[] {
  const bits = input * TO_BITS[from];
  return (Object.keys(TO_BITS) as StorageUnit[]).map((unit) => ({ unit, value: bits / TO_BITS[unit] }));
}

export function toCsv(rows: { unit: StorageUnit; value: number }[]): string {
  const lines = ["Unit,Value"];
  for (const r of rows) lines.push(`${r.unit},${r.value}`);
  return lines.join("\n");
}
