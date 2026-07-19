/**
 * PDF Color Separation — pure logic.
 *
 * Color-space conversions, channel-intensity calculators, page-color analyzers,
 * registration-mark generators, label builders, summary stats, text/CSV reports,
 * a minimal ZIP builder (store mode), history (localStorage), and shareable URLs.
 *
 * No DOM, no pdf-lib — pure functions only. The actual PDF manipulation lives
 * in ui.tsx; this module provides the math, parsing, and serialization helpers.
 */
import type { ToolResult } from "../../../lib/tool";

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

export type SeparationMode =
  | "cmyk-4-channels"
  | "rgb-3-channels"
  | "grayscale-1-channel"
  | "custom";

export type OutputFormat = "separate-pdfs" | "combined-pdf" | "side-by-side";

export type ChannelId =
  | "cyan"
  | "magenta"
  | "yellow"
  | "black"
  | "red"
  | "green"
  | "blue"
  | "gray";

export interface RGBColor {
  /** 0–255 */
  r: number;
  g: number;
  b: number;
}

export interface CMYKColor {
  /** 0–1 each */
  c: number;
  m: number;
  y: number;
  k: number;
}

export interface PageColorAnalysis {
  pageNumber: number;
  colors: RGBColor[];
  uniqueColorCount: number;
  channelIntensities: Record<ChannelId, number>;
  topColors: { color: RGBColor; count: number; hex: string }[];
}

export interface ChannelPageDescriptor {
  pageNumber: number;
  channel: ChannelId;
  label: string;
  /** 0–1 */
  intensity: number;
  /** 0–100 percent */
  inkCoverage: number;
}

export interface RegistrationMark {
  x: number;
  y: number;
  type: "cross" | "circle" | "square";
}

export interface SeparationSummary {
  totalPages: number;
  totalChannels: number;
  pagesPerChannel: number;
  avgIntensityByChannel: Record<ChannelId, number>;
  totalInkCoverage: number;
  totalUniqueColors: number;
}

export interface SeparationOptions {
  mode: SeparationMode;
  outputFormat: OutputFormat;
  channelLabel: boolean;
  includeRegistrationMarks: boolean;
  /** Only used in custom mode. */
  customChannels?: ChannelId[];
}

export const DEFAULT_OPTIONS: SeparationOptions = {
  mode: "cmyk-4-channels",
  outputFormat: "separate-pdfs",
  channelLabel: true,
  includeRegistrationMarks: true,
};

export const CHANNEL_LABELS: Record<ChannelId, string> = {
  cyan: "Cyan",
  magenta: "Magenta",
  yellow: "Yellow",
  black: "Black",
  red: "Red",
  green: "Green",
  blue: "Blue",
  gray: "Gray",
};

/** Approximate RGB tint used to *render* each channel's separation overlay. */
export const CHANNEL_TINTS: Record<ChannelId, RGBColor> = {
  cyan: { r: 0, g: 174, b: 239 },
  magenta: { r: 236, g: 0, b: 140 },
  yellow: { r: 255, g: 221, b: 0 },
  black: { r: 0, g: 0, b: 0 },
  red: { r: 255, g: 0, b: 0 },
  green: { r: 0, g: 200, b: 0 },
  blue: { r: 0, g: 0, b: 255 },
  gray: { r: 128, g: 128, b: 128 },
};

export const SEPARATION_MODES: SeparationMode[] = [
  "cmyk-4-channels",
  "rgb-3-channels",
  "grayscale-1-channel",
  "custom",
];

export const OUTPUT_FORMATS: OutputFormat[] = [
  "separate-pdfs",
  "combined-pdf",
  "side-by-side",
];

// ---------------------------------------------------------------------------
// Color-space conversions
// ---------------------------------------------------------------------------

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** Clamp an RGB color to the 0–255 range. */
export function clampRgb(c: RGBColor): RGBColor {
  return {
    r: clamp(Math.round(c.r), 0, 255),
    g: clamp(Math.round(c.g), 0, 255),
    b: clamp(Math.round(c.b), 0, 255),
  };
}

/** Convert RGB (0–255) to CMYK (0–1 each). Pure black returns c=m=y=0, k=1. */
export function rgbToCmyk(rgb: RGBColor): CMYKColor {
  const c = clampRgb(rgb);
  const r = c.r / 255;
  const g = c.g / 255;
  const b = c.b / 255;
  const k = 1 - Math.max(r, g, b);
  if (k >= 1) return { c: 0, m: 0, y: 0, k: 1 };
  const denom = 1 - k;
  return {
    c: (1 - r - k) / denom,
    m: (1 - g - k) / denom,
    y: (1 - b - k) / denom,
    k,
  };
}

/** Convert CMYK (0–1 each) back to RGB (0–255). */
export function cmykToRgb(cmyk: CMYKColor): RGBColor {
  const { c, m, y, k } = cmyk;
  return clampRgb({
    r: 255 * (1 - c) * (1 - k),
    g: 255 * (1 - m) * (1 - k),
    b: 255 * (1 - y) * (1 - k),
  });
}

/** Per-channel intensity (0–1) of an RGB color in CMYK space. */
export function cmykChannelIntensity(rgb: RGBColor, channel: ChannelId): number {
  if (channel !== "cyan" && channel !== "magenta" && channel !== "yellow" && channel !== "black") {
    return 0;
  }
  const cmyk = rgbToCmyk(rgb);
  if (channel === "cyan") return cmyk.c;
  if (channel === "magenta") return cmyk.m;
  if (channel === "yellow") return cmyk.y;
  return cmyk.k;
}

/** Per-channel intensity (0–1) of an RGB color in RGB space. */
export function rgbChannelIntensity(rgb: RGBColor, channel: ChannelId): number {
  const c = clampRgb(rgb);
  if (channel === "red") return c.r / 255;
  if (channel === "green") return c.g / 255;
  if (channel === "blue") return c.b / 255;
  return 0;
}

/** Luminance (0–1) using the NTSC formula 0.299R + 0.587G + 0.114B. */
export function grayscaleIntensity(rgb: RGBColor): number {
  const c = clampRgb(rgb);
  return (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255;
}

/** Resolve a single channel's intensity for a color, regardless of mode. */
export function channelIntensityFor(rgb: RGBColor, channel: ChannelId): number {
  switch (channel) {
    case "cyan":
    case "magenta":
    case "yellow":
    case "black":
      return cmykChannelIntensity(rgb, channel);
    case "red":
    case "green":
    case "blue":
      return rgbChannelIntensity(rgb, channel);
    case "gray":
      return grayscaleIntensity(rgb);
  }
}

// ---------------------------------------------------------------------------
// Mode → channel resolution
// ---------------------------------------------------------------------------

/** Channels produced for a given mode. Custom mode returns customChannels or all 8. */
export function channelsForMode(mode: SeparationMode, customChannels?: ChannelId[]): ChannelId[] {
  switch (mode) {
    case "cmyk-4-channels":
      return ["cyan", "magenta", "yellow", "black"];
    case "rgb-3-channels":
      return ["red", "green", "blue"];
    case "grayscale-1-channel":
      return ["gray"];
    case "custom": {
      const picks = (customChannels ?? []).filter((c) =>
        (Object.keys(CHANNEL_LABELS) as ChannelId[]).includes(c),
      );
      return picks.length > 0 ? Array.from(new Set(picks)) : (Object.keys(CHANNEL_LABELS) as ChannelId[]);
    }
  }
}

// ---------------------------------------------------------------------------
// Color analysis & intensity calculation
// ---------------------------------------------------------------------------

function colorKey(c: RGBColor): string {
  return `${c.r},${c.g},${c.b}`;
}

/** Compute per-channel intensities (0–1) averaged across a list of colors. */
export function computeChannelIntensities(
  colors: RGBColor[],
  channels: ChannelId[],
): Record<ChannelId, number> {
  const out = {} as Record<ChannelId, number>;
  for (const ch of channels) out[ch] = 0;
  if (colors.length === 0) return out;
  const sums = {} as Record<ChannelId, number>;
  for (const ch of channels) sums[ch] = 0;
  for (const c of colors) {
    for (const ch of channels) {
      sums[ch] += channelIntensityFor(c, ch);
    }
  }
  for (const ch of channels) out[ch] = sums[ch] / colors.length;
  return out;
}

/** Return the top N colors by frequency. */
export function topColors(
  colors: RGBColor[],
  n = 10,
): { color: RGBColor; count: number; hex: string }[] {
  const counts = new Map<string, { color: RGBColor; count: number }>();
  for (const c of colors) {
    const key = colorKey(c);
    const existing = counts.get(key);
    if (existing) existing.count += 1;
    else counts.set(key, { color: { ...c }, count: 1 });
  }
  return Array.from(counts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, n)
    .map((x) => ({ color: x.color, count: x.count, hex: rgbToHex(x.color) }));
}

/** Convert an RGB color to a #rrggbb hex string. */
export function rgbToHex(c: RGBColor): string {
  const x = clampRgb(c);
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return `#${h(x.r)}${h(x.g)}${h(x.b)}`;
}

/** Parse a #rrggbb hex string into an RGB color. Returns black on parse failure. */
export function hexToRgb(hex: string): RGBColor {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex ?? "").trim());
  if (!m) return { r: 0, g: 0, b: 0 };
  const v = m[1];
  return {
    r: parseInt(v.slice(0, 2), 16),
    g: parseInt(v.slice(2, 4), 16),
    b: parseInt(v.slice(4, 6), 16),
  };
}

/** Count unique colors in a list. */
export function countUniqueColors(colors: RGBColor[]): number {
  return new Set(colors.map(colorKey)).size;
}

/** Full per-page analysis: intensities + top colors + unique count. */
export function analyzePageColors(
  pageNumber: number,
  colors: RGBColor[],
  channels: ChannelId[],
): PageColorAnalysis {
  return {
    pageNumber,
    colors: colors.map((c) => ({ ...c })),
    uniqueColorCount: countUniqueColors(colors),
    channelIntensities: computeChannelIntensities(colors, channels),
    topColors: topColors(colors, 10),
  };
}

// ---------------------------------------------------------------------------
// Ink coverage, label & registration marks
// ---------------------------------------------------------------------------

/**
 * Estimate ink coverage as a percentage (0–100).
 * `intensity` is 0–1; `areaFraction` is 0–1 (fraction of the page covered; defaults to 1).
 */
export function computeInkCoverage(intensity: number, areaFraction = 1): number {
  const i = clamp(intensity, 0, 1);
  const a = clamp(areaFraction, 0, 1);
  return Math.round(i * a * 1000) / 10;
}

/** Coverage percentage (0–100) for a single intensity value (assumes full page). */
export function coveragePercentage(intensity: number): number {
  return computeInkCoverage(intensity, 1);
}

/** Generate a label string for a channel. */
export function generateChannelLabel(channel: ChannelId, mode: SeparationMode): string {
  const base = CHANNEL_LABELS[channel];
  const modeTag =
    mode === "cmyk-4-channels" ? "CMYK"
      : mode === "rgb-3-channels" ? "RGB"
        : mode === "grayscale-1-channel" ? "GRAY"
          : "CUSTOM";
  return `${modeTag} · ${base}`;
}

/**
 * Generate registration marks at the 4 corners + center of a page.
 * Coordinates are in PDF space (origin bottom-left).
 */
export function generateRegistrationMarks(
  width: number,
  height: number,
  margin = 18,
): RegistrationMark[] {
  return [
    { x: margin, y: margin, type: "cross" },
    { x: width - margin, y: margin, type: "cross" },
    { x: margin, y: height - margin, type: "cross" },
    { x: width - margin, y: height - margin, type: "cross" },
    { x: width / 2, y: height / 2, type: "circle" },
  ];
}

// ---------------------------------------------------------------------------
// Page → channel splitter
// ---------------------------------------------------------------------------

/** Split one page's analysis into one descriptor per channel. */
export function splitPageIntoChannels(
  analysis: PageColorAnalysis,
  channels: ChannelId[],
  mode: SeparationMode,
): ChannelPageDescriptor[] {
  return channels.map((ch) => {
    const intensity = analysis.channelIntensities[ch] ?? 0;
    return {
      pageNumber: analysis.pageNumber,
      channel: ch,
      label: generateChannelLabel(ch, mode),
      intensity,
      inkCoverage: coveragePercentage(intensity),
    };
  });
}

/** Generate preview descriptors for every page × every channel. */
export function generateChannelPreview(
  analyses: PageColorAnalysis[],
  channels: ChannelId[],
  mode: SeparationMode,
): ChannelPageDescriptor[] {
  const out: ChannelPageDescriptor[] = [];
  for (const a of analyses) out.push(...splitPageIntoChannels(a, channels, mode));
  return out;
}

// ---------------------------------------------------------------------------
// Summary stats
// ---------------------------------------------------------------------------

export function computeSummaryStats(
  analyses: PageColorAnalysis[],
  channels: ChannelId[],
): SeparationSummary {
  const totalPages = analyses.length;
  const totalChannels = channels.length;
  const pagesPerChannel = totalPages;
  const avg: Record<ChannelId, number> = {} as Record<ChannelId, number>;
  for (const ch of channels) {
    const sum = analyses.reduce((acc, a) => acc + (a.channelIntensities[ch] ?? 0), 0);
    avg[ch] = totalPages > 0 ? sum / totalPages : 0;
  }
  const totalInk = channels.reduce((acc, ch) => acc + (avg[ch] ?? 0), 0);
  const totalUnique = analyses.reduce((acc, a) => acc + a.uniqueColorCount, 0);
  return {
    totalPages,
    totalChannels,
    pagesPerChannel,
    avgIntensityByChannel: avg,
    totalInkCoverage: Math.round(totalInk * 100) / 100,
    totalUniqueColors: totalUnique,
  };
}

// ---------------------------------------------------------------------------
// Renderers
// ---------------------------------------------------------------------------

/** Render analyses as a human-readable text report. */
export function renderTextReport(
  analyses: PageColorAnalysis[],
  channels: ChannelId[],
  mode: SeparationMode,
): string {
  const lines: string[] = [];
  lines.push(`PDF Color Separation Report`);
  lines.push(`Mode: ${mode}`);
  lines.push(`Channels: ${channels.map((c) => CHANNEL_LABELS[c]).join(", ")}`);
  lines.push(`Pages analyzed: ${analyses.length}`);
  lines.push("");
  for (const a of analyses) {
    lines.push(`--- Page ${a.pageNumber} ---`);
    lines.push(`  Unique colors: ${a.uniqueColorCount}`);
    for (const ch of channels) {
      const intensity = a.channelIntensities[ch] ?? 0;
      lines.push(
        `  ${CHANNEL_LABELS[ch].padEnd(8)} intensity=${intensity.toFixed(3)}  coverage=${coveragePercentage(intensity)}%`,
      );
    }
    if (a.topColors.length > 0) {
      lines.push(`  Top colors:`);
      for (const t of a.topColors.slice(0, 5)) {
        lines.push(`    ${t.hex}  ×${t.count}`);
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Render analyses as CSV: channel, page, intensity, color_count, ink_coverage. */
export function renderCsv(
  analyses: PageColorAnalysis[],
  channels: ChannelId[],
): string {
  const lines = ["channel,page,intensity,color_count,ink_coverage_percent"];
  for (const a of analyses) {
    for (const ch of channels) {
      const intensity = a.channelIntensities[ch] ?? 0;
      lines.push(
        [
          ch,
          a.pageNumber,
          intensity.toFixed(4),
          a.uniqueColorCount,
          coveragePercentage(intensity),
        ].join(","),
      );
    }
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Minimal ZIP builder (store mode, no compression) — for separate-PDFs output
// ---------------------------------------------------------------------------

/** CRC-32 table (polynomial 0xEDB88320). */
const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
})();

/** Compute CRC-32 of a byte array. */
export function crc32(bytes: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ bytes[i]) & 0xFF];
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

export function utf8Encode(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function pushU32(arr: number[], val: number): void {
  arr.push(val & 0xFF, (val >>> 8) & 0xFF, (val >>> 16) & 0xFF, (val >>> 24) & 0xFF);
}

function pushU16(arr: number[], val: number): void {
  arr.push(val & 0xFF, (val >>> 8) & 0xFF);
}

export interface ZipFile {
  name: string;
  bytes: Uint8Array;
}

/** Build a minimal valid ZIP archive (store mode, no compression). */
export function buildZip(files: ZipFile[]): Uint8Array {
  const out: number[] = [];
  const centralDir: number[] = [];
  let offset = 0;
  for (const file of files) {
    const nameBytes = utf8Encode(file.name);
    const crc = crc32(file.bytes);
    const size = file.bytes.length;
    pushU32(out, 0x04034b50);
    pushU16(out, 20);
    pushU16(out, 0);
    pushU16(out, 0);
    pushU16(out, 0);
    pushU16(out, 0);
    pushU32(out, crc);
    pushU32(out, size);
    pushU32(out, size);
    pushU16(out, nameBytes.length);
    pushU16(out, 0);
    for (const b of nameBytes) out.push(b);
    for (const b of file.bytes) out.push(b);
    pushU32(centralDir, 0x02014b50);
    pushU16(centralDir, 20);
    pushU16(centralDir, 20);
    pushU16(centralDir, 0);
    pushU16(centralDir, 0);
    pushU16(centralDir, 0);
    pushU16(centralDir, 0);
    pushU32(centralDir, crc);
    pushU32(centralDir, size);
    pushU32(centralDir, size);
    pushU16(centralDir, nameBytes.length);
    pushU16(centralDir, 0);
    pushU16(centralDir, 0);
    pushU16(centralDir, 0);
    pushU16(centralDir, 0);
    pushU32(centralDir, 0);
    pushU32(centralDir, offset);
    for (const b of nameBytes) centralDir.push(b);
    offset = out.length;
  }
  const cdStart = out.length;
  const cdSize = centralDir.length;
  for (const b of centralDir) out.push(b);
  pushU32(out, 0x06054b50);
  pushU16(out, 0);
  pushU16(out, 0);
  pushU16(out, files.length);
  pushU16(out, files.length);
  pushU32(out, cdSize);
  pushU32(out, cdStart);
  pushU16(out, 0);
  return new Uint8Array(out);
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:pdf-color-separation:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  fileName: string;
  pageCount: number;
  mode: SeparationMode;
  outputFormat: OutputFormat;
  channelCount: number;
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

const VALID_MODES = new Set<SeparationMode>(SEPARATION_MODES);
const VALID_FORMATS_SET = new Set<OutputFormat>(OUTPUT_FORMATS);
const VALID_CHANNELS = new Set<ChannelId>(Object.keys(CHANNEL_LABELS) as ChannelId[]);

export function buildShareUrl(opts: SeparationOptions): string {
  const params = new URLSearchParams();
  if (opts.mode !== DEFAULT_OPTIONS.mode) params.set("mode", opts.mode);
  if (opts.outputFormat !== DEFAULT_OPTIONS.outputFormat) params.set("fmt", opts.outputFormat);
  if (opts.channelLabel !== DEFAULT_OPTIONS.channelLabel) params.set("label", opts.channelLabel ? "1" : "0");
  if (opts.includeRegistrationMarks !== DEFAULT_OPTIONS.includeRegistrationMarks) {
    params.set("marks", opts.includeRegistrationMarks ? "1" : "0");
  }
  if (opts.mode === "custom" && opts.customChannels && opts.customChannels.length > 0) {
    params.set("ch", opts.customChannels.join(","));
  }
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<SeparationOptions> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<SeparationOptions> = {};
  const mode = params.get("mode");
  if (mode && VALID_MODES.has(mode as SeparationMode)) out.mode = mode as SeparationMode;
  const fmt = params.get("fmt");
  if (fmt && VALID_FORMATS_SET.has(fmt as OutputFormat)) out.outputFormat = fmt as OutputFormat;
  const label = params.get("label");
  if (label !== null) out.channelLabel = label !== "0";
  const marks = params.get("marks");
  if (marks !== null) out.includeRegistrationMarks = marks !== "0";
  const ch = params.get("ch");
  if (ch) {
    const picks = ch.split(",").filter((c) => VALID_CHANNELS.has(c as ChannelId)) as ChannelId[];
    if (picks.length > 0) out.customChannels = picks;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateOptions(opts: SeparationOptions): ToolResult<SeparationOptions> {
  if (!opts) return { ok: false, error: "Missing options." };
  if (!VALID_MODES.has(opts.mode)) {
    return { ok: false, error: `Unknown separation mode: ${opts.mode}` };
  }
  if (!VALID_FORMATS_SET.has(opts.outputFormat)) {
    return { ok: false, error: `Unknown output format: ${opts.outputFormat}` };
  }
  if (opts.mode === "custom") {
    const picks = opts.customChannels ?? [];
    const valid = picks.filter((c) => VALID_CHANNELS.has(c));
    if (valid.length === 0) {
      return { ok: false, error: "Custom mode requires at least one valid channel." };
    }
  }
  return { ok: true, output: { ...opts } };
}
