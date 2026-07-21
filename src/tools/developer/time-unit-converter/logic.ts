/**
 * Time Unit Converter — pure logic.
 *
 * Convert between every time unit from nanoseconds to centuries with
 * explicit, switchable month (28/30/30.44/31) and year (365/365.25/366)
 * definitions. BigInt-exact integer math down to ns for the 12 base units,
 * plus a Number-based path for fractional input and developer units (ticks,
 * jiffies, frames@fps). Single input fans out to a batch table of every
 * unit. Humanize duration mode + inverse parser. JS/Python code snippets.
 * Shareable URL. localStorage history (max 20).
 *
 * Pure functions only — no DOM, no network. localStorage access is
 * guarded for non-browser environments.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type TimeUnit =
  | "ns"
  | "us"
  | "ms"
  | "s"
  | "m"
  | "h"
  | "d"
  | "w"
  | "mo"
  | "y"
  | "decade"
  | "century";

export type DevUnit = "ticks" | "jiffies" | "frames";

export type AnyUnit = TimeUnit | DevUnit;

export type MonthDef = "28" | "30" | "30.44" | "31";
export type YearDef = "365" | "365.25" | "366";

export interface UnitInfo {
  id: TimeUnit;
  label: string;
  symbol: string;
  kind: "base";
}

export interface DevUnitInfo {
  id: DevUnit;
  label: string;
  symbol: string;
  kind: "dev";
  description: string;
}

export interface MonthDefInfo {
  id: MonthDef;
  label: string;
  days: number;
}

export interface YearDefInfo {
  id: YearDef;
  label: string;
  days: number;
}

export interface Config {
  month: MonthDef;
  year: YearDef;
  fps: number;
  hz: number;
}

export interface ConversionRow {
  unit: AnyUnit;
  label: string;
  symbol: string;
  value: number;
  display: string;
  kind: "base" | "dev";
}

export interface ParseResult {
  ok: boolean;
  seconds: number;
  error?: string;
}

export interface HumanizeOptions {
  maxUnits?: number;
  delimiter?: string;
}

export interface HistoryEntry {
  ts: number;
  value: number;
  from: AnyUnit;
  to: AnyUnit | "all";
  month: MonthDef;
  year: YearDef;
}

// ---------------------------------------------------------------------------
// Constants & definitions
// ---------------------------------------------------------------------------

export const UNIT_INFO: UnitInfo[] = [
  { id: "ns", label: "Nanoseconds", symbol: "ns", kind: "base" },
  { id: "us", label: "Microseconds", symbol: "µs", kind: "base" },
  { id: "ms", label: "Milliseconds", symbol: "ms", kind: "base" },
  { id: "s", label: "Seconds", symbol: "s", kind: "base" },
  { id: "m", label: "Minutes", symbol: "min", kind: "base" },
  { id: "h", label: "Hours", symbol: "h", kind: "base" },
  { id: "d", label: "Days", symbol: "d", kind: "base" },
  { id: "w", label: "Weeks", symbol: "wk", kind: "base" },
  { id: "mo", label: "Months", symbol: "mo", kind: "base" },
  { id: "y", label: "Years", symbol: "yr", kind: "base" },
  { id: "decade", label: "Decades", symbol: "dec", kind: "base" },
  { id: "century", label: "Centuries", symbol: "cen", kind: "base" },
];

export const DEV_UNIT_INFO: DevUnitInfo[] = [
  {
    id: "ticks",
    label: "Ticks (.NET)",
    symbol: "tick",
    kind: "dev",
    description: "100 ns per tick (.NET TimeSpan / DateTime ticks)",
  },
  {
    id: "jiffies",
    label: "Jiffies (Linux)",
    symbol: "jiff",
    kind: "dev",
    description: "1/HZ seconds (default HZ=100 → 10 ms per jiffy)",
  },
  {
    id: "frames",
    label: "Frames (video)",
    symbol: "frame",
    kind: "dev",
    description: "1/fps seconds (default fps=60 → 16.67 ms per frame)",
  },
];

export const MONTH_DEFINITIONS: MonthDefInfo[] = [
  { id: "28", label: "28 days (February, common year)", days: 28 },
  { id: "30", label: "30 days (Apr, Jun, Sep, Nov)", days: 30 },
  { id: "30.44", label: "30.44 days (avg: 365.25 / 12)", days: 30.4375 },
  { id: "31", label: "31 days (Jan, Mar, May, Jul, Aug, Oct, Dec)", days: 31 },
];

export const YEAR_DEFINITIONS: YearDefInfo[] = [
  { id: "365", label: "365 days (common year)", days: 365 },
  { id: "365.25", label: "365.25 days (Julian / averaged)", days: 365.25 },
  { id: "366", label: "366 days (leap year)", days: 366 },
];

export const DEFAULT_CONFIG: Config = {
  month: "30.44",
  year: "365.25",
  fps: 60,
  hz: 100,
};

// ---------------------------------------------------------------------------
// BigInt conversion factors (ns per unit) for the 12 base units
// ---------------------------------------------------------------------------

const NS_PER_US = BigInt(1_000);
const NS_PER_MS = BigInt(1_000_000);
const NS_PER_S = BigInt(1_000_000_000);
const NS_PER_MIN = BigInt(60) * NS_PER_S; // 60_000_000_000
const NS_PER_H = BigInt(60) * NS_PER_MIN; // 3_600_000_000_000
const NS_PER_D = BigInt(24) * NS_PER_H; // 86_400_000_000_000
const NS_PER_W = BigInt(7) * NS_PER_D; // 604_800_000_000_000

/** Nanoseconds in one month of the given definition (exact BigInt). */
export function monthToNs(def: MonthDef): bigint {
  switch (def) {
    case "28":
      return BigInt(28) * NS_PER_D; // 2_419_200_000_000_000
    case "30":
      return BigInt(30) * NS_PER_D; // 2_592_000_000_000_000
    case "30.44":
      // 365.25 days / 12 months = 30.4375 days, in ns
      return BigInt("2629800000000000");
    case "31":
      return BigInt(31) * NS_PER_D; // 2_678_400_000_000_000
  }
}

/** Nanoseconds in one year of the given definition (exact BigInt). */
export function yearToNs(def: YearDef): bigint {
  switch (def) {
    case "365":
      return BigInt(365) * NS_PER_D; // 31_536_000_000_000_000
    case "365.25":
      return BigInt("31557600000000000"); // 365.25 * 86_400 * 1e9
    case "366":
      return BigInt(366) * NS_PER_D; // 31_622_400_000_000_000
  }
}

/**
 * BigInt ns-per-unit factor for any of the 12 base units. Throws for dev
 * units — use {@link unitToNsNumber} for those.
 */
export function unitToNsFactor(unit: TimeUnit, config: Config): bigint {
  switch (unit) {
    case "ns":
      return BigInt(1);
    case "us":
      return NS_PER_US;
    case "ms":
      return NS_PER_MS;
    case "s":
      return NS_PER_S;
    case "m":
      return NS_PER_MIN;
    case "h":
      return NS_PER_H;
    case "d":
      return NS_PER_D;
    case "w":
      return NS_PER_W;
    case "mo":
      return monthToNs(config.month);
    case "y":
      return yearToNs(config.year);
    case "decade":
      return BigInt(10) * yearToNs(config.year);
    case "century":
      return BigInt(100) * yearToNs(config.year);
  }
}

function isBaseUnit(u: AnyUnit): u is TimeUnit {
  return (
    u === "ns" || u === "us" || u === "ms" || u === "s" || u === "m" ||
    u === "h" || u === "d" || u === "w" || u === "mo" || u === "y" ||
    u === "decade" || u === "century"
  );
}

// ---------------------------------------------------------------------------
// Conversions
// ---------------------------------------------------------------------------

/** Convert a BigInt value from one base unit to another (floor, exact). */
export function convertBigInt(
  value: bigint,
  from: TimeUnit,
  to: TimeUnit,
  config: Config,
): bigint {
  const fromFactor = unitToNsFactor(from, config);
  const toFactor = unitToNsFactor(to, config);
  const ns = value * fromFactor;
  return ns / toFactor;
}

/** Convert a BigInt value to ns (exact). */
export function toNsBigInt(value: bigint, from: TimeUnit, config: Config): bigint {
  return value * unitToNsFactor(from, config);
}

/**
 * Number ns-per-unit factor for any unit (base or dev). For base units this
 * is the Number cast of the BigInt factor (loses precision past
 * Number.MAX_SAFE_INTEGER for centuries, but useful for fractional input).
 */
export function unitToNsNumber(unit: AnyUnit, config: Config): number {
  if (isBaseUnit(unit)) {
    return Number(unitToNsFactor(unit, config));
  }
  switch (unit) {
    case "ticks":
      return 100; // 100 ns per .NET tick
    case "jiffies":
      return 1_000_000_000 / config.hz;
    case "frames":
      return 1_000_000_000 / config.fps;
  }
}

/** Convert a Number value from any unit to any other unit. */
export function convertNumber(
  value: number,
  from: AnyUnit,
  to: AnyUnit,
  config: Config,
): number {
  const fromNs = unitToNsNumber(from, config);
  const toNs = unitToNsNumber(to, config);
  if (fromNs === 0 || toNs === 0) return NaN;
  return (value * fromNs) / toNs;
}

/** Convert a single value to every unit (12 base + 3 dev = 15 rows). */
export function convertAll(value: number, from: AnyUnit, config: Config): ConversionRow[] {
  const rows: ConversionRow[] = [];
  for (const u of UNIT_INFO) {
    const v = convertNumber(value, from, u.id, config);
    rows.push({
      unit: u.id,
      label: u.label,
      symbol: u.symbol,
      value: v,
      display: formatValueForDisplay(v),
      kind: "base",
    });
  }
  for (const u of DEV_UNIT_INFO) {
    const v = convertNumber(value, from, u.id, config);
    rows.push({
      unit: u.id,
      label: u.label,
      symbol: u.symbol,
      value: v,
      display: formatValueForDisplay(v),
      kind: "dev",
    });
  }
  return rows;
}

/** Find a single row by unit id. */
export function findRow(rows: ConversionRow[], unit: AnyUnit): ConversionRow | undefined {
  return rows.find((r) => r.unit === unit);
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/** Format a value for display: scientific for very small/large, otherwise trimmed. */
export function formatValueForDisplay(
  v: number,
  opts: { maxSig?: number } = {},
): string {
  if (!Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  if (abs === 0) return "0";
  if (abs < 1e-6 || abs >= 1e15) {
    return v.toExponential(6);
  }
  if (abs < 1) {
    const sig = opts.maxSig ?? 8;
    return trimZeros(v.toPrecision(sig));
  }
  if (Number.isInteger(v) && abs < 1e15) {
    return v.toLocaleString("en-US");
  }
  return trimZeros(v.toPrecision(12));
}

function trimZeros(s: string): string {
  if (s.indexOf(".") === -1) return s;
  return s.replace(/\.?0+$/, "");
}

/** Always format in scientific notation (for the "scientific" toggle). */
export function formatScientific(v: number): string {
  if (!Number.isFinite(v)) return "—";
  if (v === 0) return "0";
  return v.toExponential(6);
}

// ---------------------------------------------------------------------------
// Humanize & inverse parse
// ---------------------------------------------------------------------------

/** Humanize a duration in seconds: 90061 -> "1d 1h 1m 1s". */
export function humanizeDuration(
  seconds: number,
  opts: HumanizeOptions = {},
): string {
  const maxUnits = opts.maxUnits ?? 4;
  const delimiter = opts.delimiter ?? " ";
  if (!Number.isFinite(seconds)) return "—";
  const sign = seconds < 0 ? "-" : "";
  let s = Math.abs(seconds);
  const y = Math.floor(s / (365.25 * 86400));
  s -= y * 365.25 * 86400;
  const d = Math.floor(s / 86400);
  s -= d * 86400;
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  s -= m * 60;
  const sec = Math.floor(s);
  s -= sec;
  const ms = Math.round(s * 1000);

  const parts: string[] = [];
  if (y > 0) parts.push(`${y}y`);
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (sec > 0) parts.push(`${sec}s`);
  if (ms > 0 && parts.length === 0) parts.push(`${ms}ms`);

  if (parts.length === 0) return "0s";
  return sign + parts.slice(0, maxUnits).join(delimiter);
}

/** Parse a human duration string like "1d 1h 1m 1s" into seconds. */
export function parseHumanDuration(input: string): ParseResult {
  const s = (input || "").trim();
  if (!s) return { ok: false, seconds: 0, error: "empty" };
  if (/^-?\d+(?:\.\d+)?$/.test(s)) {
    return { ok: true, seconds: parseFloat(s) };
  }
  const matches = [...s.matchAll(/(?:(\d+(?:\.\d+)?)\s*([ywdhms]))/gi)];
  if (matches.length === 0) return { ok: false, seconds: 0, error: "no units found" };
  let total = 0;
  for (const m of matches) {
    const val = parseFloat(m[1]);
    const unit = m[2].toLowerCase();
    switch (unit) {
      case "y":
        total += val * 365.25 * 86400;
        break;
      case "w":
        total += val * 7 * 86400;
        break;
      case "d":
        total += val * 86400;
        break;
      case "h":
        total += val * 3600;
        break;
      case "m":
        total += val * 60;
        break;
      case "s":
        total += val;
        break;
    }
  }
  return { ok: true, seconds: total };
}

// ---------------------------------------------------------------------------
// Code snippets
// ---------------------------------------------------------------------------

function pascalCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Generate a JS or Python code snippet for the conversion. */
export function generateCodeSnippet(
  value: number,
  from: AnyUnit,
  to: AnyUnit,
  config: Config,
  lang: "js" | "py" = "js",
): string {
  const fromNs = unitToNsNumber(from, config);
  const toNs = unitToNsNumber(to, config);
  const fromPascal = pascalCase(from);
  const toPascal = pascalCase(to);
  if (lang === "py") {
    return [
      `# Convert ${value} ${from} -> ${to}`,
      `# Definitions: month=${config.month}d, year=${config.year}d, fps=${config.fps}, hz=${config.hz}`,
      `value = ${value}`,
      `ns_per_${from} = ${fromNs}`,
      `ns_per_${to} = ${toNs}`,
      `result = value * ns_per_${from} / ns_per_${to}`,
      `print(f"{value} ${from} = {result} ${to}")`,
    ].join("\n");
  }
  return [
    `// Convert ${value} ${from} -> ${to}`,
    `// Definitions: month=${config.month}d, year=${config.year}d, fps=${config.fps}, hz=${config.hz}`,
    `const value = ${value};`,
    `const nsPer${fromPascal} = ${fromNs};`,
    `const nsPer${toPascal} = ${toNs};`,
    `const result = (value * nsPer${fromPascal}) / nsPer${toPascal};`,
    `console.log(\`\${value} ${from} = \${result} ${to}\`);`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateValue(
  input: string,
): { ok: boolean; value: number; error?: string } {
  const s = (input || "").trim();
  if (!s) return { ok: false, value: 0, error: "empty" };
  if (!/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(s)) {
    return { ok: false, value: 0, error: "not a number" };
  }
  const v = parseFloat(s);
  if (!Number.isFinite(v)) return { ok: false, value: 0, error: "not finite" };
  return { ok: true, value: v };
}

// ---------------------------------------------------------------------------
// History (localStorage, max 20)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:time-unit-converter:history";
const HISTORY_MAX = 20;

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

export function buildShareUrl(value: number, from: AnyUnit, config: Config): string {
  const params = new URLSearchParams();
  params.set("v", String(value));
  params.set("u", from);
  params.set("mo", config.month);
  params.set("y", config.year);
  if (config.fps !== DEFAULT_CONFIG.fps) params.set("fps", String(config.fps));
  if (config.hz !== DEFAULT_CONFIG.hz) params.set("hz", String(config.hz));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

const ALL_UNITS: AnyUnit[] = [
  ...UNIT_INFO.map((u) => u.id),
  ...DEV_UNIT_INFO.map((u) => u.id),
];

export function parseShareUrl(
  hash: string,
): { value: number; from: AnyUnit; config: Config } | null {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return null;
  const params = new URLSearchParams(clean);
  const v = parseFloat(params.get("v") ?? "");
  if (!Number.isFinite(v)) return null;
  const u = params.get("u") as AnyUnit | null;
  if (!u || !ALL_UNITS.includes(u)) return null;
  const mo = (params.get("mo") as MonthDef | null) ?? DEFAULT_CONFIG.month;
  const yr = (params.get("y") as YearDef | null) ?? DEFAULT_CONFIG.year;
  const validMo: MonthDef[] = ["28", "30", "30.44", "31"];
  const validYr: YearDef[] = ["365", "365.25", "366"];
  const fps = parseFloat(params.get("fps") ?? String(DEFAULT_CONFIG.fps)) || DEFAULT_CONFIG.fps;
  const hz = parseFloat(params.get("hz") ?? String(DEFAULT_CONFIG.hz)) || DEFAULT_CONFIG.hz;
  return {
    value: v,
    from: u,
    config: {
      month: validMo.includes(mo) ? mo : DEFAULT_CONFIG.month,
      year: validYr.includes(yr) ? yr : DEFAULT_CONFIG.year,
      fps,
      hz,
    },
  };
}
