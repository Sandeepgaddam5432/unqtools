/**
 * ANSI Escape Code Terminal Color Generator — pure logic.
 *
 * Compose terminal text styling — FG/BG color in 16/256/24-bit truecolor
 * plus all 8 SGR styles — and emit the exact ANSI escape sequence in
 * multiple formats. Includes a reverse decoder, hex→256 / hex→truecolor
 * conversion, a 256-color palette grid, strip-ANSI helper, language
 * snippets, and terminal-support notes.
 *
 * Pure functions only — no DOM, no network.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ColorMode = "none" | "standard16" | "bright16" | "x256" | "truecolor";

export type EscapeFormat = "x1b" | "octal" | "e" | "u001b" | "raw";

export type SgrStyle =
  | "bold"
  | "faint"
  | "italic"
  | "underline"
  | "blink"
  | "inverse"
  | "hidden"
  | "strikethrough";

export interface ColorSpec {
  mode: ColorMode;
  /** Index 0–15 for standard16/bright16; 0–255 for x256; ignored for none. */
  index: number;
  /** RGB triplet 0–255 each — used only when mode === "truecolor". */
  rgb: { r: number; g: number; b: number };
}

export interface AnsiConfig {
  text: string;
  fg: ColorSpec;
  bg: ColorSpec;
  styles: SgrStyle[];
  escapeFormat: EscapeFormat;
  /** Auto-append \\x1b[0m reset. */
  appendReset: boolean;
  /** Wrap in bash `\\[ … \\]` non-printing markers (for PS1). */
  wrapBash: boolean;
  /** Show a visible ^[ marker in the rendered escape string. */
  showVisibleEsc: boolean;
}

export interface DecodeResult {
  ok: boolean;
  segments: DecodedSegment[];
  errors: string[];
  strippedText: string;
}

export interface DecodedSegment {
  /** Raw escape sequence as found in the input. */
  raw: string;
  /** The SGR parameter list (e.g. ["1","38","5","208"]). */
  params: string[];
  /** Human-readable description of the change. */
  description: string;
}

export interface HistoryEntry {
  ts: number;
  text: string;
  fgMode: ColorMode;
  bgMode: ColorMode;
  styleCount: number;
  escapeFormat: EscapeFormat;
}

export interface LanguageSnippet {
  id: string;
  label: string;
  code: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const ESC: string = "\x1b";

export const ESCAPE_PREFIXES: Record<EscapeFormat, string> = {
  x1b: "\\x1b",
  octal: "\\033",
  e: "\\e",
  u001b: "\\u001b",
  raw: ESC,
};

export const ESCAPE_LABELS: Record<EscapeFormat, string> = {
  x1b: "\\x1b  (JS / C / Go)",
  octal: "\\033  (printf / shell)",
  e: "\\e  (bash echo -e)",
  u001b: "\\u001b  (JS template / JSON)",
  raw: "Raw ESC byte (0x1B)",
};

export interface StyleDef {
  id: SgrStyle;
  label: string;
  setCode: number;
  resetCode: number;
}

export const STYLE_DEFS: StyleDef[] = [
  { id: "bold", label: "Bold", setCode: 1, resetCode: 22 },
  { id: "faint", label: "Faint / Dim", setCode: 2, resetCode: 22 },
  { id: "italic", label: "Italic", setCode: 3, resetCode: 23 },
  { id: "underline", label: "Underline", setCode: 4, resetCode: 24 },
  { id: "blink", label: "Blink", setCode: 5, resetCode: 25 },
  { id: "inverse", label: "Inverse / Reverse", setCode: 7, resetCode: 27 },
  { id: "hidden", label: "Hidden / Conceal", setCode: 8, resetCode: 28 },
  { id: "strikethrough", label: "Strikethrough", setCode: 9, resetCode: 29 },
];

export interface StandardColor {
  name: string;
  hex: string;
  fg: number;
  bg: number;
  bright: boolean;
}

/** Standard 16 + bright 16 colors with canonical ANSI indices. */
export const STANDARD_16_COLORS: StandardColor[] = [
  { name: "Black",       hex: "#000000", fg: 30, bg: 40, bright: false },
  { name: "Red",         hex: "#aa0000", fg: 31, bg: 41, bright: false },
  { name: "Green",       hex: "#00aa00", fg: 32, bg: 42, bright: false },
  { name: "Yellow",      hex: "#aa5500", fg: 33, bg: 43, bright: false },
  { name: "Blue",        hex: "#0000aa", fg: 34, bg: 44, bright: false },
  { name: "Magenta",     hex: "#aa00aa", fg: 35, bg: 45, bright: false },
  { name: "Cyan",        hex: "#00aaaa", fg: 36, bg: 46, bright: false },
  { name: "White",       hex: "#aaaaaa", fg: 37, bg: 47, bright: false },
  { name: "Bright Black",   hex: "#555555", fg: 90,  bg: 100, bright: true },
  { name: "Bright Red",     hex: "#ff5555", fg: 91,  bg: 101, bright: true },
  { name: "Bright Green",   hex: "#55ff55", fg: 92,  bg: 102, bright: true },
  { name: "Bright Yellow",  hex: "#ffff55", fg: 93,  bg: 103, bright: true },
  { name: "Bright Blue",    hex: "#5555ff", fg: 94,  bg: 104, bright: true },
  { name: "Bright Magenta", hex: "#ff55ff", fg: 95,  bg: 105, bright: true },
  { name: "Bright Cyan",    hex: "#55ffff", fg: 96,  bg: 106, bright: true },
  { name: "Bright White",   hex: "#ffffff", fg: 97,  bg: 107, bright: true },
];

export interface TerminalSupportNote {
  id: string;
  feature: string;
  note: string;
}

export const TERMINAL_SUPPORT_NOTES: TerminalSupportNote[] = [
  { id: "truecolor",  feature: "24-bit Truecolor", note: "Supported by modern terminals (iTerm2, Windows Terminal, Alacritty, kitty, GNOME Terminal 3.12+). Not supported by macOS Terminal.app or older xterm builds — falls back to nearest 16/256." },
  { id: "italic",     feature: "Italic (SGR 3)",   note: "Many terminals render italic as reverse-video or ignore it entirely. tmux/screen may also swallow it." },
  { id: "blink",      feature: "Blink (SGR 5)",    note: "Widely unsupported; some terminals render it as a bright background instead. Avoid for accessibility." },
  { id: "hidden",     feature: "Hidden (SGR 8)",   note: "Conceals text but still copies to clipboard. Rarely supported outside xterm-family terminals." },
  { id: "faint",      feature: "Faint (SGR 2)",    note: "Supported by most modern terminals; renders as a dimmer version of the foreground color." },
  { id: "strikethrough", feature: "Strikethrough (SGR 9)", note: "Supported by xterm-iterm2 family; ignored by some older terminals." },
];

export const DEFAULT_CONFIG: AnsiConfig = {
  text: "Hello, ANSI!",
  fg: { mode: "truecolor", index: 0, rgb: { r: 255, g: 128, b: 0 } },
  bg: { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } },
  styles: ["bold"],
  escapeFormat: "x1b",
  appendReset: true,
  wrapBash: false,
  showVisibleEsc: false,
};

export interface Preset {
  id: string;
  label: string;
  description: string;
  config: AnsiConfig;
}

export const PRESETS: Preset[] = [
  {
    id: "error-bold-red",
    label: "Bold Red Error",
    description: "Bold red text on default background — classic error message.",
    config: {
      text: "ERROR: something went wrong",
      fg: { mode: "standard16", index: 1, rgb: { r: 170, g: 0, b: 0 } },
      bg: { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } },
      styles: ["bold"],
      escapeFormat: "x1b",
      appendReset: true,
      wrapBash: false,
      showVisibleEsc: false,
    },
  },
  {
    id: "success-green",
    label: "Green Success",
    description: "Plain green text — success / OK messages.",
    config: {
      text: "✓ done",
      fg: { mode: "standard16", index: 2, rgb: { r: 0, g: 170, b: 0 } },
      bg: { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } },
      styles: [],
      escapeFormat: "x1b",
      appendReset: true,
      wrapBash: false,
      showVisibleEsc: false,
    },
  },
  {
    id: "warning-yellow-bg",
    label: "Yellow on Black",
    description: "Yellow text on black background — high-contrast warning.",
    config: {
      text: "WARNING",
      fg: { mode: "bright16", index: 11, rgb: { r: 255, g: 255, b: 0 } },
      bg: { mode: "standard16", index: 0, rgb: { r: 0, g: 0, b: 0 } },
      styles: ["bold"],
      escapeFormat: "octal",
      appendReset: true,
      wrapBash: false,
      showVisibleEsc: false,
    },
  },
  {
    id: "neon-truecolor",
    label: "Neon Truecolor",
    description: "24-bit magenta/cyan italic — modern truecolor flair.",
    config: {
      text: "truecolor lives",
      fg: { mode: "truecolor", index: 0, rgb: { r: 255, g: 0, b: 200 } },
      bg: { mode: "truecolor", index: 0, rgb: { r: 10, g: 20, b: 40 } },
      styles: ["italic", "underline"],
      escapeFormat: "x1b",
      appendReset: true,
      wrapBash: false,
      showVisibleEsc: false,
    },
  },
  {
    id: "rainbow-256",
    label: "256-color Orange",
    description: "256-color cube (orange 208) — wide compatibility.",
    config: {
      text: "256 cube",
      fg: { mode: "x256", index: 208, rgb: { r: 255, g: 135, b: 0 } },
      bg: { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } },
      styles: ["bold"],
      escapeFormat: "octal",
      appendReset: true,
      wrapBash: false,
      showVisibleEsc: false,
    },
  },
];

// ---------------------------------------------------------------------------
// Color math
// ---------------------------------------------------------------------------

/** Parse a hex string (#rgb / #rrggbb) into an RGB triplet. Returns null on bad input. */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = (hex || "").trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]+$/.test(clean)) return null;
  let r: number, g: number, b: number;
  if (clean.length === 3) {
    r = parseInt(clean[0] + clean[0], 16);
    g = parseInt(clean[1] + clean[1], 16);
    b = parseInt(clean[2] + clean[2], 16);
  } else if (clean.length === 6) {
    r = parseInt(clean.slice(0, 2), 16);
    g = parseInt(clean.slice(2, 4), 16);
    b = parseInt(clean.slice(4, 6), 16);
  } else {
    return null;
  }
  if ([r, g, b].some((v) => Number.isNaN(v))) return null;
  return { r, g, b };
}

/** Convert an RGB triplet to a #rrggbb hex string. */
export function rgbToHex(rgb: { r: number; g: number; b: number }): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  const h = (n: number) => clamp(n).toString(16).padStart(2, "0");
  return `#${h(rgb.r)}${h(rgb.g)}${h(rgb.b)}`;
}

/** Convert a 256-cube index to its RGB approximation. */
export function x256ToRgb(n: number): { r: number; g: number; b: number } {
  const idx = Math.max(0, Math.min(255, Math.floor(n)));
  // 0–15: standard 16 (use the STANDARD_16_COLORS table)
  if (idx < 16) {
    const c = STANDARD_16_COLORS[idx];
    const rgb = hexToRgb(c.hex);
    return rgb ?? { r: 0, g: 0, b: 0 };
  }
  // 16–231: 6×6×6 cube — 16 + 36r + 6g + b
  if (idx < 232) {
    const i = idx - 16;
    const r = Math.floor(i / 36) % 6;
    const g = Math.floor(i / 6) % 6;
    const b = i % 6;
    const ramp = [0, 95, 135, 175, 215, 255];
    return { r: ramp[r], g: ramp[g], b: ramp[b] };
  }
  // 232–255: grayscale ramp 8–238
  const v = 8 + (idx - 232) * 10;
  return { r: v, g: v, b: v };
}

/** Find the nearest 256-color index for an RGB triplet (Euclidean). */
export function nearestX256(rgb: { r: number; g: number; b: number }): number {
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < 256; i++) {
    const cand = x256ToRgb(i);
    const dr = cand.r - rgb.r;
    const dg = cand.g - rgb.g;
    const db = cand.b - rgb.b;
    const dist = dr * dr + dg * dg + db * db;
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/** Convert a hex string to its nearest 256-color index. Returns 0 on bad input. */
export function hexToX256(hex: string): number {
  const rgb = hexToRgb(hex);
  return rgb ? nearestX256(rgb) : 0;
}

/** Convert a hex string to a truecolor SGR triplet string "r;g;b". */
export function hexToTruecolor(hex: string): string | null {
  const rgb = hexToRgb(hex);
  return rgb ? `${rgb.r};${rgb.g};${rgb.b}` : null;
}

/** Build the full 256-color palette grid as {id, rgb} pairs. */
export function x256Grid(): { id: number; rgb: { r: number; g: number; b: number }; hex: string }[] {
  const out: { id: number; rgb: { r: number; g: number; b: number }; hex: string }[] = [];
  for (let i = 0; i < 256; i++) {
    const rgb = x256ToRgb(i);
    out.push({ id: i, rgb, hex: rgbToHex(rgb) });
  }
  return out;
}

// ---------------------------------------------------------------------------
// SGR parameter construction
// ---------------------------------------------------------------------------

/**
 * Build the SGR parameter list (joined with ";") for a color spec used as
 * foreground (38) or background (48). Returns [] for "none".
 */
export function colorToSgrParams(spec: ColorSpec, isBackground: boolean): string[] {
  const base = isBackground ? 48 : 38;
  switch (spec.mode) {
    case "none":
      return [];
    case "standard16": {
      const c = STANDARD_16_COLORS[spec.index] ?? STANDARD_16_COLORS[0];
      return [String(isBackground ? c.bg : c.fg)];
    }
    case "bright16": {
      const c = STANDARD_16_COLORS[spec.index] ?? STANDARD_16_COLORS[8];
      // The bright variant is index 8–15 in our table.
      const bright = STANDARD_16_COLORS[(spec.index % 8) + 8] ?? c;
      return [String(isBackground ? bright.bg : bright.fg)];
    }
    case "x256":
      return [String(base), "5", String(Math.max(0, Math.min(255, spec.index)))];
    case "truecolor": {
      const r = Math.max(0, Math.min(255, Math.round(spec.rgb.r)));
      const g = Math.max(0, Math.min(255, Math.round(spec.rgb.g)));
      const b = Math.max(0, Math.min(255, Math.round(spec.rgb.b)));
      return [String(base), "2", String(r), String(g), String(b)];
    }
    default:
      return [];
  }
}

/** Build the full SGR parameter list for the given config. */
export function generateSgrParams(config: AnsiConfig): string[] {
  const params: string[] = [];
  for (const style of config.styles) {
    const def = STYLE_DEFS.find((s) => s.id === style);
    if (def) params.push(String(def.setCode));
  }
  params.push(...colorToSgrParams(config.fg, false));
  params.push(...colorToSgrParams(config.bg, true));
  return params;
}

// ---------------------------------------------------------------------------
// Escape rendering
// ---------------------------------------------------------------------------

/** Render the CSI escape for a parameter list (without trailing "m"). */
export function renderEscapePrefix(format: EscapeFormat, showVisibleEsc: boolean): string {
  if (showVisibleEsc) return "^[";
  return ESCAPE_PREFIXES[format];
}

/** Render a full SGR escape for a parameter list, e.g. "\\x1b[1;31m". */
export function renderSgr(params: string[], format: EscapeFormat, showVisibleEsc: boolean): string {
  const prefix = renderEscapePrefix(format, showVisibleEsc);
  const body = params.length > 0 ? params.join(";") : "0";
  return `${prefix}[${body}m`;
}

/** Render the reset escape, e.g. "\\x1b[0m". */
export function renderReset(format: EscapeFormat, showVisibleEsc: boolean): string {
  return renderSgr(["0"], format, showVisibleEsc);
}

/** Generate the complete escape sequence (escape + text + reset). */
export function generateEscape(config: AnsiConfig): string {
  const params = generateSgrParams(config);
  const prefix = renderEscapePrefix(config.escapeFormat, config.showVisibleEsc);
  const open = params.length > 0 ? `${prefix}[${params.join(";")}m` : "";
  const close = config.appendReset ? `${prefix}[0m` : "";
  let body = open + (config.text || "") + close;
  if (config.wrapBash) body = `\\[${open}\\]${config.text || ""}\\[${close}\\]`;
  return body;
}

/** Generate the full escape string including the inner text (alias for generateEscape). */
export function generateSequence(config: AnsiConfig): string {
  return generateEscape(config);
}

// ---------------------------------------------------------------------------
// Language snippets
// ---------------------------------------------------------------------------

/** Build copy-ready language snippets for the current config. */
export function generateLanguageSnippets(config: AnsiConfig): LanguageSnippet[] {
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  // Use raw escape character (0x1B) for language strings — languages handle it differently.
  const params = generateSgrParams(config);
  const text = config.text || "";
  // Build language-specific escape forms
  const bashEsc = params.length > 0 ? `\\033[${params.join(";")}m` : "";
  const bashReset = "\\033[0m";
  const pyEsc = params.length > 0 ? `\\033[${params.join(";")}m` : "";
  const pyReset = "\\033[0m";
  const jsEsc = params.length > 0 ? `\\x1b[${params.join(";")}m` : "";
  const jsReset = "\\x1b[0m";
  const goEsc = params.length > 0 ? `\\x1b[${params.join(";")}m` : "";
  const goReset = "\\x1b[0m";
  const rustEsc = params.length > 0 ? `\\x1b[${params.join(";")}m` : "";
  const rustReset = "\\x1b[0m";
  const cEsc = params.length > 0 ? `\\033[${params.join(";")}m` : "";
  const cReset = "\\033[0m";
  const reset = config.appendReset;

  return [
    {
      id: "bash-printf",
      label: "Bash (printf)",
      code: `printf '${reset ? `${bashEsc}${text}${bashReset}` : `${bashEsc}${text}`}'\n`,
    },
    {
      id: "bash-echo",
      label: "Bash (echo -e)",
      code: `echo -e '${reset ? `${bashEsc}${text}${bashReset}` : `${bashEsc}${text}`}'\n`,
    },
    {
      id: "python",
      label: "Python 3",
      code: `print("${reset ? `${pyEsc}${esc(text)}${pyReset}` : `${pyEsc}${esc(text)}`}")\n`,
    },
    {
      id: "nodejs",
      label: "Node.js",
      code: `process.stdout.write("${reset ? `${jsEsc}${esc(text)}${jsReset}` : `${jsEsc}${esc(text)}"}");\n`,
    },
    {
      id: "go",
      label: "Go",
      code: `fmt.Printf("${reset ? `${goEsc}${esc(text)}${goReset}` : `${goEsc}${esc(text)}`}\\n")\n`,
    },
    {
      id: "rust",
      label: "Rust",
      code: `print!("${reset ? `${rustEsc}${esc(text)}${rustReset}` : `${rustEsc}${esc(text)}`}");\n`,
    },
    {
      id: "c",
      label: "C (printf)",
      code: `printf("${reset ? `${cEsc}${esc(text)}${cReset}` : `${cEsc}${esc(text)}"}\\n");\n`,
    },
  ];
}

// ---------------------------------------------------------------------------
// Reverse decoder
// ---------------------------------------------------------------------------

const CSI_RE = /\x1b\[([\x30-\x3f]*)([\x20-\x2f]*[\x40-\x7e])/g;
const VISIBLE_CSI_RE = /\^\[\[([\x30-\x3f]*?)m/g;
// Also accept escaped forms like \x1b[..m, \033[..m, \e[..m, \u001b[..m
const LITERAL_CSI_RE = /\\(?:x1b|033|e|u001b)\[([0-9;?]*)m/g;

/** Decode an ANSI-escaped string into a list of applied SGR segments. */
export function decodeAnsi(input: string): DecodeResult {
  if (!input) return { ok: true, segments: [], errors: [], strippedText: "" };
  const segments: DecodedSegment[] = [];
  const errors: string[] = [];
  let stripped = input;

  // Normalize literal-escaped forms to real ESC sequences for uniform parsing.
  const normalized = input
    .replace(/\\x1b/g, ESC)
    .replace(/\\u001b/g, ESC)
    .replace(/\\033/g, ESC)
    .replace(/\\e/g, ESC)
    .replace(/\^\[/g, ESC);

  const re = new RegExp(CSI_RE);
  let match: RegExpExecArray | null;
  while ((match = re.exec(normalized)) !== null) {
    const raw = match[0];
    const finalByte = match[2];
    const paramString = match[1];
    stripped = stripped.replace(raw, "");
    if (finalByte !== "m") {
      // Non-SGR CSI (e.g. cursor movement) — record but don't decode.
      segments.push({
        raw,
        params: [paramString],
        description: `Non-SGR CSI (final byte '${finalByte}') — not a color/style change.`,
      });
      continue;
    }
    const params = paramString === "" ? ["0"] : paramString.split(";");
    for (const desc of describeSgrParams(params)) {
      segments.push({ raw, params, description: desc });
    }
  }

  // Detect malformed sequences (lone ESC or unclosed [)
  if (/\x1b[^\[]/.test(normalized)) {
    errors.push("Found a lone ESC byte not followed by '[' — possibly malformed.");
  }
  if (/\x1b\[[^\x40-\x7e]*$/.test(normalized)) {
    errors.push("Found an unterminated CSI sequence (missing final byte).");
  }

  return {
    ok: errors.length === 0,
    segments,
    errors,
    strippedText: stripped,
  };
}

/** Describe a list of SGR parameters in plain English. */
export function describeSgrParams(params: string[]): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < params.length) {
    const p = params[i];
    const n = Number(p);
    if (p === "" || n === 0) {
      out.push("Reset all attributes.");
      i++;
      continue;
    }
    if (n === 1) { out.push("Bold."); i++; continue; }
    if (n === 2) { out.push("Faint / dim."); i++; continue; }
    if (n === 3) { out.push("Italic."); i++; continue; }
    if (n === 4) { out.push("Underline."); i++; continue; }
    if (n === 5) { out.push("Blink (slow)."); i++; continue; }
    if (n === 6) { out.push("Blink (rapid)."); i++; continue; }
    if (n === 7) { out.push("Inverse / reverse video."); i++; continue; }
    if (n === 8) { out.push("Hidden / concealed."); i++; continue; }
    if (n === 9) { out.push("Strikethrough."); i++; continue; }
    if (n === 22) { out.push("Reset bold + faint."); i++; continue; }
    if (n === 23) { out.push("Reset italic."); i++; continue; }
    if (n === 24) { out.push("Reset underline."); i++; continue; }
    if (n === 25) { out.push("Reset blink."); i++; continue; }
    if (n === 27) { out.push("Reset inverse."); i++; continue; }
    if (n === 28) { out.push("Reset hidden."); i++; continue; }
    if (n === 29) { out.push("Reset strikethrough."); i++; continue; }
    if (n >= 30 && n <= 37) {
      const name = STANDARD_16_COLORS[n - 30]?.name ?? "?";
      out.push(`Foreground: ${name} (standard 16, code ${n}).`);
      i++; continue;
    }
    if (n === 39) { out.push("Default foreground."); i++; continue; }
    if (n >= 40 && n <= 47) {
      const name = STANDARD_16_COLORS[n - 40]?.name ?? "?";
      out.push(`Background: ${name} (standard 16, code ${n}).`);
      i++; continue;
    }
    if (n === 49) { out.push("Default background."); i++; continue; }
    if (n >= 90 && n <= 97) {
      const name = STANDARD_16_COLORS[(n - 90) + 8]?.name ?? "?";
      out.push(`Foreground: ${name} (bright 16, code ${n}).`);
      i++; continue;
    }
    if (n >= 100 && n <= 107) {
      const name = STANDARD_16_COLORS[(n - 100) + 8]?.name ?? "?";
      out.push(`Background: ${name} (bright 16, code ${n}).`);
      i++; continue;
    }
    if (n === 38 || n === 48) {
      const which = n === 38 ? "Foreground" : "Background";
      const next = params[i + 1];
      if (next === "5") {
        const idx = Number(params[i + 2]);
        if (!Number.isNaN(idx)) {
          const rgb = x256ToRgb(idx);
          out.push(`${which}: 256-color index ${idx} (~${rgbToHex(rgb)}).`);
          i += 3; continue;
        }
      }
      if (next === "2") {
        const r = params[i + 2];
        const g = params[i + 3];
        const b = params[i + 4];
        if (r !== undefined && g !== undefined && b !== undefined) {
          out.push(`${which}: truecolor RGB(${r}, ${g}, ${b}).`);
          i += 5; continue;
        }
      }
      out.push(`${which}: malformed extended color sequence.`);
      i++; continue;
    }
    out.push(`Unknown SGR code: ${p}.`);
    i++;
  }
  return out;
}

/** Remove all ANSI escape sequences from a string. */
export function stripAnsi(input: string): string {
  if (!input) return "";
  // Strip raw CSI sequences and OSC sequences.
  return input
    .replace(/\x1b\][^\x07]*\x07/g, "")            // OSC terminated by BEL
    .replace(/\x1b\][^\x1b]*\x1b\\/g, "")          // OSC terminated by ST
    .replace(/\x1b\[[\x30-\x3f]*[\x20-\x2f]*[\x40-\x7e]/g, "") // CSI
    .replace(/\x1b[@-_]/g, "");                    // 2-byte escapes
}

// ---------------------------------------------------------------------------
// Preview / validation / stats
// ---------------------------------------------------------------------------

export interface PreviewSegment {
  text: string;
  styles: SgrStyle[];
  fg: ColorSpec;
  bg: ColorSpec;
}

/** Build preview segments for the UI terminal preview. */
export function buildPreviewSegments(config: AnsiConfig): PreviewSegment[] {
  return [
    {
      text: config.text || " ",
      styles: [...config.styles],
      fg: { ...config.fg },
      bg: { ...config.bg },
    },
  ];
}

/** Compute CSS color for a ColorSpec (used by UI preview). Returns null for "none". */
export function colorToCss(spec: ColorSpec): string | null {
  switch (spec.mode) {
    case "none": return null;
    case "standard16":
    case "bright16": {
      const c = STANDARD_16_COLORS[spec.index] ?? STANDARD_16_COLORS[0];
      return c.hex;
    }
    case "x256": {
      const rgb = x256ToRgb(spec.index);
      return rgbToHex(rgb);
    }
    case "truecolor": {
      return rgbToHex(spec.rgb);
    }
    default: return null;
  }
}

export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

export function validateConfig(config: AnsiConfig): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if ((config.fg.mode === "truecolor" || config.bg.mode === "truecolor")) {
    const { r, g, b } = config.fg.mode === "truecolor" ? config.fg.rgb : config.bg.rgb;
    if (r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255) {
      errors.push("RGB values must be 0–255.");
    }
  }
  if (config.styles.includes("blink")) {
    warnings.push("Blink is widely unsupported and may harm accessibility.");
  }
  if (config.styles.includes("hidden")) {
    warnings.push("Hidden text still copies to the clipboard and is rarely supported.");
  }
  if (!config.appendReset) {
    warnings.push("Reset not appended — color bleed will affect subsequent output.");
  }
  if (config.styles.includes("italic")) {
    warnings.push("Italic is unsupported by many terminals (e.g. macOS Terminal.app).");
  }
  return { errors, warnings };
}

export interface Stats {
  styleCount: number;
  hasFg: boolean;
  hasBg: boolean;
  totalSgrParams: number;
}

export function computeStats(config: AnsiConfig): Stats {
  const params = generateSgrParams(config);
  return {
    styleCount: config.styles.length,
    hasFg: config.fg.mode !== "none",
    hasBg: config.bg.mode !== "none",
    totalSgrParams: params.length,
  };
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:ansi-escape-color-generator:history";
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

export function buildShareUrl(config: AnsiConfig): string {
  const params = new URLSearchParams();
  if (config.text) params.set("t", config.text);
  params.set("fgm", config.fg.mode);
  if (config.fg.mode !== "none" && config.fg.mode !== "truecolor") params.set("fgi", String(config.fg.index));
  if (config.fg.mode === "truecolor") params.set("fgrgb", `${config.fg.rgb.r},${config.fg.rgb.g},${config.fg.rgb.b}`);
  params.set("bgm", config.bg.mode);
  if (config.bg.mode !== "none" && config.bg.mode !== "truecolor") params.set("bgi", String(config.bg.index));
  if (config.bg.mode === "truecolor") params.set("bgrgb", `${config.bg.rgb.r},${config.bg.rgb.g},${config.bg.rgb.b}`);
  if (config.styles.length > 0) params.set("s", config.styles.join(","));
  params.set("fmt", config.escapeFormat);
  params.set("reset", config.appendReset ? "1" : "0");
  params.set("wrap", config.wrapBash ? "1" : "0");
  params.set("vis", config.showVisibleEsc ? "1" : "0");
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

const VALID_STYLES: SgrStyle[] = STYLE_DEFS.map((s) => s.id);
const VALID_FORMATS: EscapeFormat[] = ["x1b", "octal", "e", "u001b", "raw"];
const VALID_MODES: ColorMode[] = ["none", "standard16", "bright16", "x256", "truecolor"];

function parseRgb(s: string | null): { r: number; g: number; b: number } {
  if (!s) return { r: 0, g: 0, b: 0 };
  const parts = s.split(",").map((n) => Number(n));
  return {
    r: parts[0] ?? 0,
    g: parts[1] ?? 0,
    b: parts[2] ?? 0,
  };
}

export function parseShareUrl(hash: string): AnsiConfig | null {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return null;
  const params = new URLSearchParams(clean);
  if (params.toString() === "") return null;
  const fgMode = (params.get("fgm") ?? "none") as ColorMode;
  const bgMode = (params.get("bgm") ?? "none") as ColorMode;
  const fmt = (params.get("fmt") ?? "x1b") as EscapeFormat;
  const styles = (params.get("s") ?? "")
    .split(",")
    .filter((s) => VALID_STYLES.includes(s as SgrStyle)) as SgrStyle[];
  return {
    text: params.get("t") ?? "",
    fg: {
      mode: VALID_MODES.includes(fgMode) ? fgMode : "none",
      index: Number(params.get("fgi") ?? 0),
      rgb: parseRgb(params.get("fgrgb")),
    },
    bg: {
      mode: VALID_MODES.includes(bgMode) ? bgMode : "none",
      index: Number(params.get("bgi") ?? 0),
      rgb: parseRgb(params.get("bgrgb")),
    },
    styles,
    escapeFormat: VALID_FORMATS.includes(fmt) ? fmt : "x1b",
    appendReset: params.get("reset") !== "0",
    wrapBash: params.get("wrap") === "1",
    showVisibleEsc: params.get("vis") === "1",
  };
}
