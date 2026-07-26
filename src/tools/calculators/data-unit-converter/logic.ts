/**
 * Data Unit Converter — pure logic.
 * Supports binary (IEC: KiB/MiB/GiB) and decimal (SI: KB/MB/GB) units,
 * plus bits and bytes. All conversions mathematically exact.
 */

export type DataUnitId =
  | "bit"
  | "byte"
  | "kib"
  | "mib"
  | "gib"
  | "tib"
  | "pib"
  | "kb"
  | "mb"
  | "gb"
  | "tb"
  | "pb";

export interface DataUnit {
  id: DataUnitId;
  name: string;
  symbol: string;
  /** Bits per 1 unit. */
  bits: number;
  system: "binary" | "decimal" | "base";
  kind: "bit" | "byte";
}

const KIB = 1024;
const K = 1000;
const BITS_PER_BYTE = 8;

export const UNITS: Record<DataUnitId, DataUnit> = {
  bit: { id: "bit", name: "Bit", symbol: "b", bits: 1, system: "base", kind: "bit" },
  byte: { id: "byte", name: "Byte", symbol: "B", bits: BITS_PER_BYTE, system: "base", kind: "byte" },
  kib: { id: "kib", name: "Kibibyte", symbol: "KiB", bits: BITS_PER_BYTE * KIB, system: "binary", kind: "byte" },
  mib: { id: "mib", name: "Mebibyte", symbol: "MiB", bits: BITS_PER_BYTE * KIB ** 2, system: "binary", kind: "byte" },
  gib: { id: "gib", name: "Gibibyte", symbol: "GiB", bits: BITS_PER_BYTE * KIB ** 3, system: "binary", kind: "byte" },
  tib: { id: "tib", name: "Tebibyte", symbol: "TiB", bits: BITS_PER_BYTE * KIB ** 4, system: "binary", kind: "byte" },
  pib: { id: "pib", name: "Pebibyte", symbol: "PiB", bits: BITS_PER_BYTE * KIB ** 5, system: "binary", kind: "byte" },
  kb: { id: "kb", name: "Kilobyte", symbol: "KB", bits: BITS_PER_BYTE * K, system: "decimal", kind: "byte" },
  mb: { id: "mb", name: "Megabyte", symbol: "MB", bits: BITS_PER_BYTE * K ** 2, system: "decimal", kind: "byte" },
  gb: { id: "gb", name: "Gigabyte", symbol: "GB", bits: BITS_PER_BYTE * K ** 3, system: "decimal", kind: "byte" },
  tb: { id: "tb", name: "Terabyte", symbol: "TB", bits: BITS_PER_BYTE * K ** 4, system: "decimal", kind: "byte" },
  pb: { id: "pb", name: "Petabyte", symbol: "PB", bits: BITS_PER_BYTE * K ** 5, system: "decimal", kind: "byte" },
};

export const UNIT_LIST: DataUnit[] = Object.values(UNITS);

/** Format a number with thousands separators and up to `precision` sig digits. */
export function formatNumber(n: number, precision = 6): string {
  if (!isFinite(n)) return "—";
  if (n === 0) return "0";
  const abs = Math.abs(n);
  if (abs >= 1e15 || abs < 1e-4) {
    return n.toExponential(precision - 1);
  }
  // Trim trailing zeros after rounding to precision sig digits.
  const rounded = Number(n.toPrecision(precision));
  const str = abs >= 1000 ? rounded.toLocaleString("en-US", { maximumFractionDigits: precision }) : String(rounded);
  return str;
}

/** Convert a value from one unit to another. */
export function convert(value: number, from: DataUnitId, to: DataUnitId): number {
  if (!UNITS[from] || !UNITS[to]) return NaN;
  if (!isFinite(value)) return NaN;
  const bits = value * UNITS[from].bits;
  return bits / UNITS[to].bits;
}

/** Build a full conversion table for the given value+unit across all units. */
export function convertAll(value: number, from: DataUnitId): { unit: DataUnit; value: number; formatted: string }[] {
  return UNIT_LIST.map((u) => {
    const v = convert(value, from, u.id);
    return { unit: u, value: v, formatted: formatNumber(v) };
  });
}

/** Parse a human data string like "1.5 GiB" or "1024B". Returns {value, unit} or null. */
export function parseDataString(input: string): { value: number; unit: DataUnitId } | null {
  const m = input.trim().match(/^([\d.]+)\s*([A-Za-z]+)$/);
  if (!m) return null;
  const value = parseFloat(m[1]);
  if (!isFinite(value)) return null;
  const sym = m[2];
  // First try exact (case-sensitive) match — needed for B vs b
  let unit = UNIT_LIST.find((u) => u.symbol === sym);
  // Fall back to case-insensitive match (e.g. "kib" or "MIB")
  if (!unit) unit = UNIT_LIST.find((u) => u.symbol.toLowerCase() === sym.toLowerCase());
  if (!unit) return null;
  return { value, unit: unit.id };
}

/** Format a value with the most appropriate unit (binary). Useful for file sizes. */
export function autoFormat(value: number, from: DataUnitId, preferBinary = true): string {
  const bits = value * UNITS[from].bits;
  const bytes = bits / BITS_PER_BYTE;
  const base = preferBinary ? KIB : K;
  const units = preferBinary
    ? ["B", "KiB", "MiB", "GiB", "TiB", "PiB"]
    : ["B", "KB", "MB", "GB", "TB", "PB"];
  if (bytes < 1) {
    const b = bits;
    return `${formatNumber(b, 4)} b`;
  }
  let i = Math.floor(Math.log(bytes) / Math.log(base));
  if (i >= units.length) i = units.length - 1;
  if (i < 0) i = 0;
  const v = bytes / Math.pow(base, i);
  return `${formatNumber(v, 4)} ${units[i]}`;
}

/** Compute the upload/download time given bandwidth. */
export function transferTime(
  dataSize: number,
  dataUnit: DataUnitId,
  bandwidth: number,
  bandwidthUnit: DataUnitId,
): { seconds: number; human: string } {
  const bits = dataSize * UNITS[dataUnit].bits;
  const bitsPerSec = bandwidth * UNITS[bandwidthUnit].bits;
  if (bitsPerSec <= 0) return { seconds: Infinity, human: "—" };
  const seconds = bits / bitsPerSec;
  return { seconds, human: humanizeDuration(seconds) };
}

/** Convert seconds → human duration (e.g., 1h 2m 3s). */
export function humanizeDuration(seconds: number): string {
  if (!isFinite(seconds)) return "—";
  if (seconds < 1) return `${(seconds * 1000).toFixed(0)} ms`;
  const s = Math.floor(seconds % 60);
  const m = Math.floor((seconds / 60) % 60);
  const h = Math.floor((seconds / 3600) % 24);
  const d = Math.floor(seconds / 86400);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (s > 0 || parts.length === 0) parts.push(`${s}s`);
  return parts.join(" ");
}

/** Compute the percentage difference between binary and decimal of the same prefix. */
export function binaryVsDecimal(prefix: "k" | "m" | "g" | "t" | "p"): {
  binary: DataUnitId;
  decimal: DataUnitId;
  ratio: number;
  pct: number;
} {
  const map: Record<string, { binary: DataUnitId; decimal: DataUnitId }> = {
    k: { binary: "kib", decimal: "kb" },
    m: { binary: "mib", decimal: "mb" },
    g: { binary: "gib", decimal: "gb" },
    t: { binary: "tib", decimal: "tb" },
    p: { binary: "pib", decimal: "pb" },
  };
  const { binary, decimal } = map[prefix];
  const binBits = UNITS[binary].bits;
  const decBits = UNITS[decimal].bits;
  const ratio = binBits / decBits;
  return { binary, decimal, ratio, pct: (ratio - 1) * 100 };
}

/** Convert a CSV batch of "value unit" rows to a target unit. */
export function batchConvert(rows: string, target: DataUnitId): string {
  return rows
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parsed = parseDataString(line);
      if (!parsed) return `${line}\tINVALID`;
      const v = convert(parsed.value, parsed.unit, target);
      return `${line}\t${formatNumber(v)} ${UNITS[target].symbol}`;
    })
    .join("\n");
}

/** Validate a numeric input string. Returns {value, error}. */
export function validateInput(input: string): { value: number; error?: string } {
  const trimmed = input.trim();
  if (!trimmed) return { value: NaN, error: "Empty input" };
  const v = parseFloat(trimmed);
  if (!isFinite(v)) return { value: NaN, error: "Not a number" };
  if (v < 0) return { value: NaN, error: "Must be ≥ 0" };
  return { value: v };
}

/** Estimate the number of media items that fit in a storage amount. */
export function mediaEstimate(
  value: number,
  unit: DataUnitId,
  itemSizeMB: number,
): { count: number; human: string } {
  const bytes = convert(value, unit, "byte");
  const itemBytes = itemSizeMB * KIB * KIB;
  if (itemBytes <= 0) return { count: 0, human: "—" };
  const count = Math.floor(bytes / itemBytes);
  return {
    count,
    human: count >= 1000 ? formatNumber(count, 4) : String(count),
  };
}

/** Calculate overhead when a file system reports "1 TB" but usable space is less. */
export function usableCapacity(
  advertised: number,
  advertisedUnit: DataUnitId,
  overheadPct: number,
): { bytes: number; human: string } {
  const bytes = convert(advertised, advertisedUnit, "byte") * (1 - overheadPct / 100);
  return { bytes, human: autoFormat(bytes, "byte") };
}
