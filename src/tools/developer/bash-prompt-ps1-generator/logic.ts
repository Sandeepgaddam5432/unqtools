/**
 * Bash Prompt (PS1) Generator — pure logic.
 *
 * Visually compose a Bash (or Zsh) prompt from draggable elements
 * (username, hostname, cwd, git branch, time, exit code, prompt symbol,
 * custom text, Nerd Font glyphs …), each with per-element FG/BG color
 * in 16/256/truecolor modes plus SGR styles, and emit:
 *
 *   - The PS1 string for Bash with proper `\[ \]` non-printing wrappers.
 *   - The equivalent PROMPT (and optional RPROMPT) for Zsh.
 *   - A working `parse_git_branch` helper to paste into .bashrc / .zshrc.
 *   - PS2 / PS3 / PS4 secondary prompts.
 *   - Title-bar xterm escape, reset-at-end, two-line support.
 *   - Live preview segments for terminal-style rendering.
 *
 * Pure functions only — no DOM, no network.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type Shell = "bash" | "zsh";

export type ColorMode = "none" | "standard16" | "bright16" | "x256" | "truecolor";

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
  /** Index 0–15 for standard16/bright16; 0–255 for x256; ignored for none/truecolor. */
  index: number;
  /** RGB triplet 0–255 each — used only when mode === "truecolor". */
  rgb: { r: number; g: number; b: number };
}

export type ElementType =
  | "username"
  | "hostname-short"
  | "hostname-full"
  | "cwd-full"
  | "cwd-basename"
  | "git-branch"
  | "time-24"
  | "time-12"
  | "date"
  | "exit-status"
  | "prompt-symbol"
  | "custom-text"
  | "newline"
  | "nerdfont-glyph"
  | "separator"
  | "job-count"
  | "history-number";

export interface PromptElement {
  id: string;
  type: ElementType;
  fg: ColorSpec;
  bg: ColorSpec;
  styles: SgrStyle[];
  /** For custom-text. */
  text?: string;
  /** For nerdfont-glyph (the glyph char itself). */
  glyph?: string;
  /** For separator (e.g. ":", "@", " ", "|", "→"). */
  separator?: string;
  /** For prompt-symbol: color green on exit==0, red otherwise. */
  exitAwareColor?: boolean;
}

export interface PromptOptions {
  shell: Shell;
  /** Prepend xterm title-bar escape `\[\e]0;\u@\h\a\]`. */
  titleBar: boolean;
  /** Append `\[\\033[0m\]` reset to avoid color bleed. */
  resetAtEnd: boolean;
  /** Wrap prompt in a two-line layout (forces trailing newline before symbol). */
  twoLine: boolean;
  /** Use RPROMPT for Zsh (right-side prompt). */
  useRprompt: boolean;
}

export interface MockData {
  user: string;
  host: string;
  cwd: string;
  gitBranch: string;
  exitCode: number;
  jobCount: number;
  historyNum: number;
  isRoot: boolean;
  /** ISO time used for preview substitution. */
  time: string;
}

export interface PreviewSegment {
  text: string;
  fg: { r: number; g: number; b: number } | null;
  bg: { r: number; g: number; b: number } | null;
  bold: boolean;
  faint: boolean;
  italic: boolean;
  underline: boolean;
  blink: boolean;
  inverse: boolean;
  hidden: boolean;
  strikethrough: boolean;
}

export interface PreviewResult {
  /** Plain visible text (no escapes). */
  text: string;
  /** Styled segments for HTML rendering. */
  segments: PreviewSegment[];
}

export interface HistoryEntry {
  ts: number;
  shell: Shell;
  elementCount: number;
  preview: string;
}

export interface Preset {
  id: string;
  label: string;
  description: string;
  elements: PromptElement[];
  options: PromptOptions;
}

export interface ElementTypeDef {
  type: ElementType;
  label: string;
  bashEscape: string;
  zshEscape: string;
  needsGitHelper: boolean;
  description: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const ESC: string = "\x1b";

export interface StandardColor {
  name: string;
  hex: string;
  fg: number;
  bg: number;
  bright: boolean;
}

/** Standard 16 + bright 16 colors with canonical ANSI indices. */
export const STANDARD_16_COLORS: StandardColor[] = [
  { name: "Black",          hex: "#000000", fg: 30,  bg: 40,  bright: false },
  { name: "Red",            hex: "#aa0000", fg: 31,  bg: 41,  bright: false },
  { name: "Green",          hex: "#00aa00", fg: 32,  bg: 42,  bright: false },
  { name: "Yellow",         hex: "#aa5500", fg: 33,  bg: 43,  bright: false },
  { name: "Blue",           hex: "#0000aa", fg: 34,  bg: 44,  bright: false },
  { name: "Magenta",        hex: "#aa00aa", fg: 35,  bg: 45,  bright: false },
  { name: "Cyan",           hex: "#00aaaa", fg: 36,  bg: 46,  bright: false },
  { name: "White",          hex: "#aaaaaa", fg: 37,  bg: 47,  bright: false },
  { name: "Bright Black",   hex: "#555555", fg: 90,  bg: 100, bright: true  },
  { name: "Bright Red",     hex: "#ff5555", fg: 91,  bg: 101, bright: true  },
  { name: "Bright Green",   hex: "#55ff55", fg: 92,  bg: 102, bright: true  },
  { name: "Bright Yellow",  hex: "#ffff55", fg: 93,  bg: 103, bright: true  },
  { name: "Bright Blue",    hex: "#5555ff", fg: 94,  bg: 104, bright: true  },
  { name: "Bright Magenta", hex: "#ff55ff", fg: 95,  bg: 105, bright: true  },
  { name: "Bright Cyan",    hex: "#55ffff", fg: 96,  bg: 106, bright: true  },
  { name: "Bright White",   hex: "#ffffff", fg: 97,  bg: 107, bright: true  },
];

export interface StyleDef {
  id: SgrStyle;
  label: string;
  setCode: number;
  resetCode: number;
}

export const SGR_STYLE_DEFS: StyleDef[] = [
  { id: "bold",          label: "Bold",          setCode: 1, resetCode: 22 },
  { id: "faint",         label: "Faint / Dim",   setCode: 2, resetCode: 22 },
  { id: "italic",        label: "Italic",        setCode: 3, resetCode: 23 },
  { id: "underline",     label: "Underline",     setCode: 4, resetCode: 24 },
  { id: "blink",         label: "Blink",         setCode: 5, resetCode: 25 },
  { id: "inverse",       label: "Inverse",       setCode: 7, resetCode: 27 },
  { id: "hidden",        label: "Hidden",        setCode: 8, resetCode: 28 },
  { id: "strikethrough", label: "Strikethrough", setCode: 9, resetCode: 29 },
];

export const NERDFONT_GLYPHS: { glyph: string; name: string }[] = [
  { glyph: "\uf1d3", name: "git branch" },
  { glyph: "\uf07b", name: "folder" },
  { glyph: "\uf121", name: "code" },
  { glyph: "\uf0e7", name: "root / bolt" },
  { glyph: "\uf021", name: "refresh" },
  { glyph: "\uf0c0", name: "user" },
  { glyph: "\uf233", name: "server" },
  { glyph: "\uf017", name: "clock" },
  { glyph: "\uf00c", name: "check" },
  { glyph: "\uf00d", name: "x / fail" },
  { glyph: "\uf126", name: "git branch alt" },
  { glyph: "\uf418", name: "linux penguin" },
];

export const PROMPT_ELEMENT_TYPES: ElementTypeDef[] = [
  { type: "username",        label: "Username",        bashEscape: "\\u",      zshEscape: "%n",      needsGitHelper: false, description: "Current user name ($USER)." },
  { type: "hostname-short",  label: "Hostname (short)",bashEscape: "\\h",      zshEscape: "%m",      needsGitHelper: false, description: "Short hostname up to first dot." },
  { type: "hostname-full",   label: "Hostname (full)", bashEscape: "\\H",      zshEscape: "%M",      needsGitHelper: false, description: "Full qualified hostname." },
  { type: "cwd-full",        label: "CWD (full)",      bashEscape: "\\w",      zshEscape: "%~",      needsGitHelper: false, description: "Current working directory (~ for home)." },
  { type: "cwd-basename",    label: "CWD (basename)",  bashEscape: "\\W",      zshEscape: "%c",      needsGitHelper: false, description: "Last path segment of CWD." },
  { type: "git-branch",      label: "Git branch",      bashEscape: "\\$(parse_git_branch)", zshEscape: "$(git_branch_zsh)", needsGitHelper: true,  description: "Current git branch (requires helper function)." },
  { type: "time-24",         label: "Time (24h)",      bashEscape: "\\t",      zshEscape: "%D{%H:%M:%S}", needsGitHelper: false, description: "24-hour clock HH:MM:SS." },
  { type: "time-12",         label: "Time (12h)",      bashEscape: "\\T",      zshEscape: "%D{%I:%M:%S %p}", needsGitHelper: false, description: "12-hour clock HH:MM:SS AM/PM." },
  { type: "date",            label: "Date",            bashEscape: "\\d",      zshEscape: "%D{%Y-%m-%d}", needsGitHelper: false, description: "Weekday Month Day." },
  { type: "exit-status",     label: "Exit status",     bashEscape: "\\$?",     zshEscape: "%?",       needsGitHelper: false, description: "Last command's exit code (green=0, red=non-zero)." },
  { type: "prompt-symbol",   label: "Prompt symbol",   bashEscape: "\\$",      zshEscape: "%#",       needsGitHelper: false, description: "'$' for user, '#' for root." },
  { type: "custom-text",     label: "Custom text",     bashEscape: "",         zshEscape: "",         needsGitHelper: false, description: "Literal text you type yourself." },
  { type: "newline",         label: "Newline",         bashEscape: "\\n",      zshEscape: "\n",       needsGitHelper: false, description: "Forces a line break (two-line prompt)." },
  { type: "nerdfont-glyph",  label: "Nerd Font glyph", bashEscape: "",         zshEscape: "",         needsGitHelper: false, description: "A Nerd Font symbol (requires a Nerd Font in your terminal)." },
  { type: "separator",       label: "Separator",       bashEscape: "",         zshEscape: "",         needsGitHelper: false, description: "A literal separator like ': ', '@', ' ', '→'." },
  { type: "job-count",       label: "Job count",       bashEscape: "\\j",      zshEscape: "%j",       needsGitHelper: false, description: "Number of background jobs." },
  { type: "history-number",  label: "History #",       bashEscape: "\\!",      zshEscape: "%!",       needsGitHelper: false, description: "Current history entry number." },
];

export const SEPARATORS: string[] = [":", ": ", "@", " ", " | ", " → ", " ❯ ", " » "];

export const DEFAULT_OPTIONS: PromptOptions = {
  shell: "bash",
  titleBar: false,
  resetAtEnd: true,
  twoLine: false,
  useRprompt: false,
};

export const DEFAULT_MOCK_DATA: MockData = {
  user: "alice",
  host: "wonderland",
  cwd: "~/projects/devtool",
  gitBranch: "main",
  exitCode: 0,
  jobCount: 0,
  historyNum: 42,
  isRoot: false,
  time: "2025-01-15T14:30:45",
};

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
  if (idx < 16) {
    const c = STANDARD_16_COLORS[idx];
    const rgb = hexToRgb(c.hex);
    return rgb ?? { r: 0, g: 0, b: 0 };
  }
  if (idx < 232) {
    const j = idx - 16;
    const r = Math.floor(j / 36);
    const g = Math.floor((j % 36) / 6);
    const b = j % 6;
    const conv = (v: number) => (v === 0 ? 0 : 55 + v * 40);
    return { r: conv(r), g: conv(g), b: conv(b) };
  }
  const v = 8 + (idx - 232) * 10;
  return { r: v, g: v, b: v };
}

/** Convert a ColorSpec to an RGB approximation (for preview rendering). */
export function colorSpecToRgb(spec: ColorSpec): { r: number; g: number; b: number } | null {
  if (spec.mode === "none") return null;
  if (spec.mode === "truecolor") return { ...spec.rgb };
  if (spec.mode === "x256") return x256ToRgb(spec.index);
  // standard16 or bright16
  const idx = Math.max(0, Math.min(15, Math.floor(spec.index)));
  const c = STANDARD_16_COLORS[idx];
  return hexToRgb(c.hex);
}

// ---------------------------------------------------------------------------
// Color sequence builders
// ---------------------------------------------------------------------------

/** Build the SGR parameter list for a color spec + styles (Bash). */
function bashSgrParams(fg: ColorSpec, bg: ColorSpec, styles: SgrStyle[]): number[] {
  const codes: number[] = [];
  for (const s of styles) {
    const def = SGR_STYLE_DEFS.find((d) => d.id === s);
    if (def) codes.push(def.setCode);
  }
  if (fg.mode === "standard16") codes.push(STANDARD_16_COLORS[fg.index % 16].fg);
  else if (fg.mode === "bright16") codes.push(STANDARD_16_COLORS[fg.index % 16].fg);
  else if (fg.mode === "x256") codes.push(38, 5, Math.max(0, Math.min(255, Math.floor(fg.index))));
  else if (fg.mode === "truecolor") codes.push(38, 2, fg.rgb.r, fg.rgb.g, fg.rgb.b);
  if (bg.mode === "standard16") codes.push(STANDARD_16_COLORS[bg.index % 16].bg);
  else if (bg.mode === "bright16") codes.push(STANDARD_16_COLORS[bg.index % 16].bg);
  else if (bg.mode === "x256") codes.push(48, 5, Math.max(0, Math.min(255, Math.floor(bg.index))));
  else if (bg.mode === "truecolor") codes.push(48, 2, bg.rgb.r, bg.rgb.g, bg.rgb.b);
  return codes;
}

/** Build the `\[\\033[…m\]` wrapped color sequence for Bash PS1. Empty string if no styles/colors. */
export function buildBashColorSeq(fg: ColorSpec, bg: ColorSpec, styles: SgrStyle[]): string {
  const params = bashSgrParams(fg, bg, styles);
  if (params.length === 0) return "";
  return `\\[\\033[${params.join(";")}m\\]`;
}

/** Build the Zsh `%F{}`/`%K{}`/`%B` color sequence. */
export function buildZshColorSeq(fg: ColorSpec, bg: ColorSpec, styles: SgrStyle[]): string {
  let out = "";
  for (const s of styles) {
    if (s === "bold") out += "%B";
    else if (s === "faint") out += "%F{8}"; // approx — zsh has no native faint
    else if (s === "italic") out += "%G";   // italic — terminal-dependent
    else if (s === "underline") out += "%U";
    else if (s === "blink") out += "%E";    // no native blink in zsh
    else if (s === "inverse") out += "%S";
    else if (s === "hidden") out += "%G";   // not directly supported
    else if (s === "strikethrough") out += "%G"; // not directly supported
  }
  if (fg.mode === "standard16" || fg.mode === "bright16") {
    const idx = fg.index % 16;
    const names = ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white",
                   "black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"];
    out += `%F{${names[idx]}}`;
  } else if (fg.mode === "x256") {
    out += `%F{${Math.max(0, Math.min(255, Math.floor(fg.index)))}}`;
  } else if (fg.mode === "truecolor") {
    out += `%F{#${[fg.rgb.r, fg.rgb.g, fg.rgb.b].map((v) => v.toString(16).padStart(2, "0")).join("")}}`;
  }
  if (bg.mode === "standard16" || bg.mode === "bright16") {
    const idx = bg.index % 16;
    const names = ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white",
                   "black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"];
    out += `%K{${names[idx]}}`;
  } else if (bg.mode === "x256") {
    out += `%K{${Math.max(0, Math.min(255, Math.floor(bg.index)))}}`;
  } else if (bg.mode === "truecolor") {
    out += `%K{#${[bg.rgb.r, bg.rgb.g, bg.rgb.b].map((v) => v.toString(16).padStart(2, "0")).join("")}}`;
  }
  return out;
}

/** Reset sequence for Bash (`\[\\033[0m\]`). */
export function bashReset(): string {
  return "\\[\\033[0m\\]";
}

/** Reset sequence for Zsh (`%f%k%b%u%s`). */
export function zshReset(): string {
  return "%f%k%b%u%s";
}

// ---------------------------------------------------------------------------
// Element rendering
// ---------------------------------------------------------------------------

/** Look up the element type definition. */
export function getElementType(type: ElementType): ElementTypeDef | undefined {
  return PROMPT_ELEMENT_TYPES.find((t) => t.type === type);
}

/** Get the bash escape token for an element type (without colors). */
export function getElementBashEscape(type: ElementType): string {
  return getElementType(type)?.bashEscape ?? "";
}

/** Get the zsh escape token for an element type (without colors). */
export function getElementZshEscape(type: ElementType): string {
  return getElementType(type)?.zshEscape ?? "";
}

/** Render a single element as a Bash string (with color wrappers). */
export function renderBashElement(el: PromptElement): string {
  const typeDef = getElementType(el.type);
  if (!typeDef) return "";

  // Compute the visible/content portion
  let content: string;
  if (el.type === "custom-text") {
    content = el.text ?? "";
  } else if (el.type === "nerdfont-glyph") {
    content = el.glyph ?? "";
  } else if (el.type === "separator") {
    content = el.separator ?? " ";
  } else if (el.type === "exit-status") {
    // For bash, $? is evaluated at prompt time. Wrap with color chooser.
    if (el.exitAwareColor) {
      const greenSeq = buildBashColorSeq(
        { mode: "standard16", index: 2, rgb: { r: 0, g: 170, b: 0 } },
        { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } },
        el.styles,
      );
      const redSeq = buildBashColorSeq(
        { mode: "standard16", index: 1, rgb: { r: 170, g: 0, b: 0 } },
        { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } },
        el.styles,
      );
      // Build: `if [ $? -eq 0 ]; then echo "GREEN"; else echo "RED"; fi`$?RESET
      // Using string concat to keep the backtick literal clear.
      return "`if [ \\$? -eq 0 ]; then echo \"" + greenSeq + "\"; else echo \"" + redSeq + "\"; fi`\\$?" + bashReset();
    }
    content = typeDef.bashEscape;
  } else if (el.type === "prompt-symbol") {
    if (el.exitAwareColor) {
      const greenSeq = buildBashColorSeq(
        { mode: "standard16", index: 2, rgb: { r: 0, g: 170, b: 0 } },
        { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } },
        el.styles,
      );
      const redSeq = buildBashColorSeq(
        { mode: "standard16", index: 1, rgb: { r: 170, g: 0, b: 0 } },
        { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } },
        el.styles,
      );
      return "`if [ \\$? -eq 0 ]; then echo \"" + greenSeq + "\"; else echo \"" + redSeq + "\"; fi`\\$" + bashReset();
    }
    content = typeDef.bashEscape;
  } else {
    content = typeDef.bashEscape;
  }

  const colorSeq = buildBashColorSeq(el.fg, el.bg, el.styles);
  if (!colorSeq) return content;
  return `${colorSeq}${content}${bashReset()}`;
}

/** Render a single element as a Zsh string (with color wrappers). */
export function renderZshElement(el: PromptElement): string {
  const typeDef = getElementType(el.type);
  if (!typeDef) return "";

  let content: string;
  if (el.type === "custom-text") {
    // Escape % as %%
    content = (el.text ?? "").replace(/%/g, "%%");
  } else if (el.type === "nerdfont-glyph") {
    content = el.glyph ?? "";
  } else if (el.type === "separator") {
    content = (el.separator ?? " ").replace(/%/g, "%%");
  } else if (el.type === "exit-status") {
    content = typeDef.zshEscape;
  } else if (el.type === "prompt-symbol") {
    content = typeDef.zshEscape;
  } else {
    content = typeDef.zshEscape;
  }

  const colorSeq = buildZshColorSeq(el.fg, el.bg, el.styles);
  if (!colorSeq) return content;
  return `${colorSeq}${content}${zshReset()}`;
}

// ---------------------------------------------------------------------------
// Full prompt rendering
// ---------------------------------------------------------------------------

/** Render the full Bash PS1 string from elements + options. */
export function renderBashPrompt(elements: PromptElement[], opts: PromptOptions): string {
  const parts: string[] = [];
  if (opts.titleBar) parts.push("\\[\\e]0;\\u@\\h\\a\\]");
  for (const el of elements) {
    parts.push(renderBashElement(el));
  }
  if (opts.resetAtEnd) parts.push(bashReset());
  return parts.join("");
}

/** Render the full Zsh PROMPT string from elements + options. */
export function renderZshPrompt(elements: PromptElement[], opts: PromptOptions): string {
  const parts: string[] = [];
  for (const el of elements) {
    parts.push(renderZshElement(el));
  }
  parts.push("%f%k%b");
  return parts.join("");
}

/** Render the Zsh RPROMPT (right prompt) from elements. */
export function renderZshRprompt(elements: PromptElement[]): string {
  return elements.map((el) => renderZshElement(el)).join("");
}

// ---------------------------------------------------------------------------
// Preview
// ---------------------------------------------------------------------------

/** Substitute bash escapes with mock data values. Returns string with raw ANSI codes (no `\[ \]`). */
function substituteBashEscapes(ps1: string, mock: MockData): string {
  let out = ps1;
  // Strip bash \[ \] wrappers
  out = out.replace(/\\\[/g, "").replace(/\\\]/g, "");
  // Substitute the bash escape sequences with mock values
  out = out.replace(/\\u/g, mock.user);
  out = out.replace(/\\H/g, mock.host);
  out = out.replace(/\\h/g, mock.host.split(".")[0]);
  out = out.replace(/\\w/g, mock.cwd);
  out = out.replace(/\\W/g, mock.cwd.split("/").pop() ?? mock.cwd);
  out = out.replace(/\\t/g, "14:30:45");
  out = out.replace(/\\T/g, "02:30:45");
  out = out.replace(/\\d/g, "Wed Jan 15");
  out = out.replace(/\\j/g, String(mock.jobCount));
  out = out.replace(/\\!/g, String(mock.historyNum));
  out = out.replace(/\\\$/g, mock.isRoot ? "#" : "$");
  // $?\b — exit code (literal $? followed by ? — rare; we handle \\\\? separately)
  // Substitute `\\$?` (literal $? exit status)
  out = out.replace(/\\\$\?/g, String(mock.exitCode));
  // Substitute $(parse_git_branch) — render as branch in parens
  out = out.replace(/\$\(parse_git_branch\)/g, `(${mock.gitBranch})`);
  // Substitute backtick-style exit-aware blocks: `if [...]; then echo "..."; else echo "..."; fi`
  // For preview, just pick the green (success) branch if exit==0, red otherwise.
  out = out.replace(/`if \[ \\\$\? -eq 0 \]; then echo "([^"]*)"; else echo "([^"]*)"; fi`/g,
    (_m, green, red) => (mock.exitCode === 0 ? green : red));
  // Convert \\033 → actual ESC
  out = out.replace(/\\033/g, ESC);
  // Convert \\e → ESC (for title bar \e]0;...\a)
  out = out.replace(/\\e/g, ESC);
  // Convert \\a → BEL (often invisible)
  out = out.replace(/\\a/g, "\x07");
  // Convert \\n → newline
  out = out.replace(/\\n/g, "\n");
  return out;
}

/** Substitute zsh escapes with mock data values. Returns string with raw ANSI codes. */
function substituteZshEscapes(prompt: string, mock: MockData): string {
  let out = prompt;
  out = out.replace(/%n/g, mock.user);
  out = out.replace(/%M/g, mock.host);
  out = out.replace(/%m/g, mock.host.split(".")[0]);
  out = out.replace(/%~g/g, mock.cwd); // %~ — but careful not to clobber %~
  out = out.replace(/%~(?=\W|$|%)|%~$/g, mock.cwd);
  out = out.replace(/%c(?=\W|$|%)|%c$/g, mock.cwd.split("/").pop() ?? mock.cwd);
  out = out.replace(/%\/(?=\W|$|%)|%\/$/g, mock.cwd);
  out = out.replace(/%\?/g, String(mock.exitCode));
  out = out.replace(/%j/g, String(mock.jobCount));
  out = out.replace(/%!/g, String(mock.historyNum));
  out = out.replace(/%#/g, mock.isRoot ? "#" : "%");
  out = out.replace(/%D\{([^}]*)\}/g, (_m, fmt) => {
    // Very basic strftime substitution
    let s = fmt;
    s = s.replace(/%Y/g, "2025");
    s = s.replace(/%m/g, "01");
    s = s.replace(/%d/g, "15");
    s = s.replace(/%H/g, "14");
    s = s.replace(/%M/g, "30");
    s = s.replace(/%S/g, "45");
    s = s.replace(/%I/g, "02");
    s = s.replace(/%p/g, "PM");
    return s;
  });
  // Zsh color escapes: %F{...}, %K{...}, %f, %k, %B, %b, %U, %u, %S, %s
  // We replace %F{...} with a sentinel that the parser understands.
  // For preview we convert to ANSI escapes.
  out = convertZshColorsToAnsi(out);
  // Substitute $(git_branch_zsh)
  out = out.replace(/\$\(git_branch_zsh\)/g, `(${mock.gitBranch})`);
  // Convert %% to %
  out = out.replace(/%%/g, "%");
  return out;
}

/** Convert zsh color escapes to ANSI escapes for preview. */
function convertZshColorsToAnsi(s: string): string {
  let out = s;
  // %F{name} — 16 named colors
  const named: Record<string, number> = {
    black: 30, red: 31, green: 32, yellow: 33, blue: 34, magenta: 35, cyan: 36, white: 37,
  };
  out = out.replace(/%F\{([^}]+)\}/g, (_m, val) => {
    if (/^\d+$/.test(val)) return `${ESC}[38;5;${val}m`;
    if (val.startsWith("#")) {
      const r = parseInt(val.slice(1, 3), 16);
      const g = parseInt(val.slice(3, 5), 16);
      const b = parseInt(val.slice(5, 7), 16);
      return `${ESC}[38;2;${r};${g};${b}m`;
    }
    const code = named[val.toLowerCase()];
    return code ? `${ESC}[${code}m` : "";
  });
  out = out.replace(/%K\{([^}]+)\}/g, (_m, val) => {
    if (/^\d+$/.test(val)) return `${ESC}[48;5;${val}m`;
    if (val.startsWith("#")) {
      const r = parseInt(val.slice(1, 3), 16);
      const g = parseInt(val.slice(3, 5), 16);
      const b = parseInt(val.slice(5, 7), 16);
      return `${ESC}[48;2;${r};${g};${b}m`;
    }
    const namedBg: Record<string, number> = {
      black: 40, red: 41, green: 42, yellow: 43, blue: 44, magenta: 45, cyan: 46, white: 47,
    };
    const code = namedBg[val.toLowerCase()];
    return code ? `${ESC}[${code}m` : "";
  });
  out = out.replace(/%f/g, `${ESC}[39m`);
  out = out.replace(/%k/g, `${ESC}[49m`);
  out = out.replace(/%B/g, `${ESC}[1m`);
  out = out.replace(/%b/g, `${ESC}[22m`);
  out = out.replace(/%U/g, `${ESC}[4m`);
  out = out.replace(/%u/g, `${ESC}[24m`);
  out = out.replace(/%S/g, `${ESC}[7m`);
  out = out.replace(/%s/g, `${ESC}[27m`);
  return out;
}

/** Parse a string with ANSI escape codes into styled segments. */
function parseAnsiSegments(s: string): PreviewSegment[] {
  const segments: PreviewSegment[] = [];
  let state: PreviewSegment = {
    text: "",
    fg: null,
    bg: null,
    bold: false,
    faint: false,
    italic: false,
    underline: false,
    blink: false,
    inverse: false,
    hidden: false,
    strikethrough: false,
  };
  let current = "";
  const flush = () => {
    if (current.length > 0) {
      segments.push({ ...state, text: current });
      current = "";
    }
  };
  // Match SGR escape sequences: \x1b[...m
  const re = /\x1b\[([0-9;]*)m/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    // Push text before escape
    if (m.index > last) {
      current += s.slice(last, m.index);
    }
    flush();
    // Apply SGR
    const params = m[1] === "" ? [0] : m[1].split(";").map((p) => parseInt(p, 10) || 0);
    for (const p of params) {
      if (p === 0) {
        state = {
          text: "",
          fg: null, bg: null,
          bold: false, faint: false, italic: false, underline: false,
          blink: false, inverse: false, hidden: false, strikethrough: false,
        };
      } else if (p === 1) state.bold = true;
      else if (p === 2) state.faint = true;
      else if (p === 3) state.italic = true;
      else if (p === 4) state.underline = true;
      else if (p === 5) state.blink = true;
      else if (p === 7) state.inverse = true;
      else if (p === 8) state.hidden = true;
      else if (p === 9) state.strikethrough = true;
      else if (p === 22) { state.bold = false; state.faint = false; }
      else if (p === 23) state.italic = false;
      else if (p === 24) state.underline = false;
      else if (p === 25) state.blink = false;
      else if (p === 27) state.inverse = false;
      else if (p === 28) state.hidden = false;
      else if (p === 29) state.strikethrough = false;
      else if (p >= 30 && p <= 37) state.fg = hexToRgb(STANDARD_16_COLORS[p - 30].hex);
      else if (p === 39) state.fg = null;
      else if (p >= 40 && p <= 47) state.bg = hexToRgb(STANDARD_16_COLORS[p - 40].hex);
      else if (p === 49) state.bg = null;
      else if (p >= 90 && p <= 97) state.fg = hexToRgb(STANDARD_16_COLORS[p - 90 + 8].hex);
      else if (p >= 100 && p <= 107) state.bg = hexToRgb(STANDARD_16_COLORS[p - 100 + 8].hex);
      else if (p === 38) {
        // 38;5;N or 38;2;r;g;b — handled by lookahead
      } else if (p === 48) {
        // 48;5;N or 48;2;r;g;b
      }
    }
    // Handle 38;5;N and 38;2;r;g;b (multi-param)
    if (params[0] === 38 && params[1] === 5) {
      state.fg = x256ToRgb(params[2]);
    } else if (params[0] === 38 && params[1] === 2) {
      state.fg = { r: params[2], g: params[3], b: params[4] };
    } else if (params[0] === 48 && params[1] === 5) {
      state.bg = x256ToRgb(params[2]);
    } else if (params[0] === 48 && params[1] === 2) {
      state.bg = { r: params[2], g: params[3], b: params[4] };
    }
    last = m.index + m[0].length;
  }
  if (last < s.length) current += s.slice(last);
  flush();
  return segments;
}

/** Render a live preview of the prompt using mock data. */
export function renderPreview(
  elements: PromptElement[],
  opts: PromptOptions,
  mock: MockData = DEFAULT_MOCK_DATA,
): PreviewResult {
  const raw = opts.shell === "bash"
    ? renderBashPrompt(elements, opts)
    : renderZshPrompt(elements, opts);
  const substituted = opts.shell === "bash"
    ? substituteBashEscapes(raw, mock)
    : substituteZshEscapes(raw, mock);
  const segments = parseAnsiSegments(substituted);
  const text = segments.map((s) => s.text).join("");
  return { text, segments };
}

// ---------------------------------------------------------------------------
// Git helper & shell rc snippets
// ---------------------------------------------------------------------------

/** Generate a `parse_git_branch` function for Bash. */
export function generateGitHelper(shell: Shell): string {
  if (shell === "bash") {
    return [
      "parse_git_branch() {",
      "  local branch",
      "  branch=$(git symbolic-ref --short HEAD 2>/dev/null) || return 0",
      '  echo " ($branch)"',
      "}",
    ].join("\n");
  }
  return [
    "git_branch_zsh() {",
    "  local branch",
    '  branch=$(git symbolic-ref --short HEAD 2>/dev/null) || return 0',
    '  echo " ($branch)"',
    "}",
  ].join("\n");
}

/** Generate a full .bashrc snippet including the git helper + PS1 export. */
export function generateBashrcSnippet(ps1: string, opts: PromptOptions): string {
  const lines: string[] = [];
  lines.push("# Add this to your ~/.bashrc (or ~/.bash_profile):");
  lines.push("");
  if (opts.titleBar) {
    lines.push("# Set xterm window title to user@host");
    lines.push('PS1="\\[\\e]0;\\u@\\h\\a\\]"');
    lines.push("");
  }
  lines.push("# Git branch helper (used by \\$(parse_git_branch) in the prompt)");
  lines.push(generateGitHelper("bash"));
  lines.push("");
  lines.push("# The prompt itself");
  // Use single quotes to preserve backslashes; escape single quotes inside
  const escaped = ps1.replace(/'/g, "'\\''");
  lines.push(`PS1='${escaped}'`);
  lines.push("");
  if (opts.twoLine) {
    lines.push("# Two-line prompt — the \\n forces a line break before the prompt symbol.");
  }
  return lines.join("\n");
}

/** Generate a full .zshrc snippet including the git helper + PROMPT export. */
export function generateZshrcSnippet(
  prompt: string,
  rprompt: PromptElement[] | null,
  opts: PromptOptions,
): string {
  const lines: string[] = [];
  lines.push("# Add this to your ~/.zshrc:");
  lines.push("");
  lines.push("# Git branch helper");
  lines.push(generateGitHelper("zsh"));
  lines.push("");
  lines.push("# The prompt");
  lines.push(`PROMPT='${prompt.replace(/'/g, "'\\''")}'`);
  if (rprompt && rprompt.length > 0 && opts.useRprompt) {
    lines.push(`RPROMPT='${renderZshRprompt(rprompt).replace(/'/g, "'\\''")}'`);
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Secondary prompts (PS2 / PS3 / PS4)
// ---------------------------------------------------------------------------

/** Generate PS2 (continuation prompt). */
export function generatePs2(opts: PromptOptions): string {
  // PS2 is typically "> " with optional styling
  if (opts.shell === "bash") {
    const colorSeq = buildBashColorSeq(
      { mode: "standard16", index: 3, rgb: { r: 170, g: 85, b: 0 } },
      { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } },
      [],
    );
    return `${colorSeq}>${bashReset()} `;
  }
  return "%F{yellow}>%f ";
}

/** Generate PS3 (select prompt). */
export function generatePs3(opts: PromptOptions): string {
  if (opts.shell === "bash") {
    const colorSeq = buildBashColorSeq(
      { mode: "standard16", index: 4, rgb: { r: 0, g: 0, b: 170 } },
      { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } },
      [],
    );
    return `${colorSeq}#${bashReset()} `;
  }
  return "%F{blue}#%f ";
}

/** Generate PS4 (debug prompt, used by `set -x`). */
export function generatePs4(opts: PromptOptions): string {
  if (opts.shell === "bash") {
    const colorSeq = buildBashColorSeq(
      { mode: "standard16", index: 2, rgb: { r: 0, g: 170, b: 0 } },
      { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } },
      [],
    );
    return `${colorSeq}+ ${bashReset()}`;
  }
  return "%F{green}+ %f";
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface ValidationIssue {
  level: "warning" | "info";
  message: string;
}

/** Validate a prompt configuration and return any issues. */
export function validatePrompt(elements: PromptElement[], opts: PromptOptions): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (elements.length === 0) {
    issues.push({ level: "warning", message: "Prompt has no elements — add at least one component." });
  }
  if (!opts.resetAtEnd && opts.shell === "bash") {
    issues.push({ level: "info", message: "Reset-at-end is off — trailing colors may bleed into your input." });
  }
  if (!elements.some((e) => e.type === "prompt-symbol")) {
    issues.push({ level: "info", message: "No prompt-symbol ($) — your shell may render the default after your PS1." });
  }
  if (elements.some((e) => e.type === "git-branch")) {
    issues.push({
      level: "info",
      message: "Git-branch element requires the parse_git_branch helper — included in the generated snippet.",
    });
  }
  if (elements.some((e) => e.type === "nerdfont-glyph")) {
    issues.push({
      level: "info",
      message: "Nerd Font glyphs require a Nerd Font installed in your terminal (e.g. JetBrains Mono Nerd Font).",
    });
  }
  if (opts.twoLine && !elements.some((e) => e.type === "newline")) {
    issues.push({ level: "warning", message: "Two-line option is on but no newline element is present." });
  }
  return issues;
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

function defaultColorSpec(mode: ColorMode, index: number, hex: string): ColorSpec {
  const rgb = hexToRgb(hex) ?? { r: 0, g: 0, b: 0 };
  return { mode, index, rgb };
}

let presetIdCounter = 0;
function makeElement(type: ElementType, fg: ColorSpec, bg: ColorSpec = { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } }, styles: SgrStyle[] = [], extra: Partial<PromptElement> = {}): PromptElement {
  presetIdCounter += 1;
  return { id: `preset-${presetIdCounter}`, type, fg, bg, styles, ...extra };
}

export const PRESETS: Preset[] = [
  {
    id: "classic-ubuntu",
    label: "Classic Ubuntu",
    description: "Green user@host, blue cwd, $ symbol — the distro default.",
    options: { shell: "bash", titleBar: false, resetAtEnd: true, twoLine: false, useRprompt: false },
    elements: [
      makeElement("username", defaultColorSpec("standard16", 2, "#00aa00"), { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } }, ["bold"]),
      makeElement("separator", { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } }, { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } }, [], { separator: "@" }),
      makeElement("hostname-short", defaultColorSpec("standard16", 2, "#00aa00"), { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } }, ["bold"]),
      makeElement("separator", { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } }, { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } }, [], { separator: ":" }),
      makeElement("cwd-full", defaultColorSpec("standard16", 4, "#0000aa"), { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } }, ["bold"]),
      makeElement("prompt-symbol", { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } }, { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } }, [], { separator: "$ " }),
    ],
  },
  {
    id: "minimal-arrow",
    label: "Minimal Arrow",
    description: "Just cwd basename + colored arrow — minimalism.",
    options: { shell: "bash", titleBar: false, resetAtEnd: true, twoLine: false, useRprompt: false },
    elements: [
      makeElement("cwd-basename", defaultColorSpec("standard16", 6, "#00aaaa"), { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } }, ["bold"]),
      makeElement("separator", defaultColorSpec("standard16", 2, "#00aa00"), { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } }, [], { separator: " ❯ " }),
    ],
  },
  {
    id: "two-line-powerline",
    label: "Two-Line Powerline",
    description: "Two-line with git branch — top has user@host + cwd, bottom has git + symbol.",
    options: { shell: "bash", titleBar: true, resetAtEnd: true, twoLine: true, useRprompt: false },
    elements: [
      makeElement("username", defaultColorSpec("bright16", 7, "#ffffff"), { mode: "standard16", index: 4, rgb: { r: 0, g: 0, b: 170 } }, ["bold"]),
      makeElement("separator", { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } }, { mode: "standard16", index: 4, rgb: { r: 0, g: 0, b: 170 } }, [], { separator: " " }),
      makeElement("hostname-short", defaultColorSpec("bright16", 7, "#ffffff"), { mode: "standard16", index: 4, rgb: { r: 0, g: 0, b: 170 } }, ["bold"]),
      makeElement("separator", { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } }, { mode: "standard16", index: 4, rgb: { r: 0, g: 0, b: 170 } }, [], { separator: " " }),
      makeElement("cwd-full", defaultColorSpec("bright16", 7, "#ffffff"), { mode: "standard16", index: 5, rgb: { r: 170, g: 0, b: 170 } }, ["bold"]),
      makeElement("newline", { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } }),
      makeElement("git-branch", defaultColorSpec("standard16", 3, "#aa5500"), { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } }, ["bold"]),
      makeElement("prompt-symbol", defaultColorSpec("standard16", 2, "#00aa00"), { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } }, ["bold"], { separator: "$ ", exitAwareColor: true }),
    ],
  },
  {
    id: "zsh-romkatv2",
    label: "Zsh Powerlevel-ish",
    description: "Zsh PROMPT with username + cwd + git + RPROMPT for time.",
    options: { shell: "zsh", titleBar: false, resetAtEnd: true, twoLine: false, useRprompt: true },
    elements: [
      makeElement("username", defaultColorSpec("x256", 39, "#00afff"), { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } }, ["bold"]),
      makeElement("separator", { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } }, { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } }, [], { separator: " " }),
      makeElement("cwd-full", defaultColorSpec("x256", 208, "#ff8700"), { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } }, ["bold"]),
      makeElement("separator", { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } }, { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } }, [], { separator: " " }),
      makeElement("git-branch", defaultColorSpec("x256", 2, "#00aa00"), { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } }, []),
      makeElement("prompt-symbol", defaultColorSpec("x256", 2, "#00aa00"), { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } }, [], { separator: " ❯ " }),
    ],
  },
  {
    id: "truecolor-neon",
    label: "Truecolor Neon",
    description: "24-bit magenta/cyan italic — modern terminal flair.",
    options: { shell: "bash", titleBar: false, resetAtEnd: true, twoLine: false, useRprompt: false },
    elements: [
      makeElement("nerdfont-glyph", defaultColorSpec("truecolor", 0, "#ff00ff"), { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } }, [], { glyph: "\uf1d3" }),
      makeElement("separator", { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } }, { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } }, [], { separator: " " }),
      makeElement("username", defaultColorSpec("truecolor", 0, "#ff00ff"), { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } }, ["italic"]),
      makeElement("separator", { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } }, { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } }, [], { separator: ":" }),
      makeElement("cwd-basename", defaultColorSpec("truecolor", 0, "#00ffff"), { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } }, ["italic", "underline"]),
      makeElement("prompt-symbol", defaultColorSpec("truecolor", 0, "#ffff00"), { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } }, ["bold"], { separator: " ❯ " }),
    ],
  },
];

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:bash-prompt-ps1-generator:history";
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

export function buildShareUrl(
  elements: PromptElement[],
  opts: PromptOptions,
): string {
  const params = new URLSearchParams();
  params.set("shell", opts.shell);
  params.set("titleBar", String(opts.titleBar));
  params.set("resetAtEnd", String(opts.resetAtEnd));
  params.set("twoLine", String(opts.twoLine));
  params.set("useRprompt", String(opts.useRprompt));
  // Encode elements as compact JSON
  params.set("e", JSON.stringify(elements));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(
  hash: string,
): { elements: PromptElement[]; options: PromptOptions } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { elements: [], options: { ...DEFAULT_OPTIONS } };
  const params = new URLSearchParams(clean);
  const opts: PromptOptions = {
    shell: params.get("shell") === "zsh" ? "zsh" : "bash",
    titleBar: params.get("titleBar") === "true",
    resetAtEnd: params.get("resetAtEnd") !== "false",
    twoLine: params.get("twoLine") === "true",
    useRprompt: params.get("useRprompt") === "true",
  };
  let elements: PromptElement[] = [];
  const e = params.get("e");
  if (e) {
    try {
      const parsed = JSON.parse(e);
      if (Array.isArray(parsed)) elements = parsed as PromptElement[];
    } catch {
      // ignore
    }
  }
  return { elements, options: opts };
}

// ---------------------------------------------------------------------------
// Element factory
// ---------------------------------------------------------------------------

let elementIdCounter = 0;
export function makeNewElement(type: ElementType): PromptElement {
  elementIdCounter += 1;
  const base: PromptElement = {
    id: `el-${Date.now()}-${elementIdCounter}`,
    type,
    fg: { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } },
    bg: { mode: "none", index: 0, rgb: { r: 0, g: 0, b: 0 } },
    styles: [],
  };
  if (type === "custom-text") base.text = "text";
  if (type === "nerdfont-glyph") base.glyph = NERDFONT_GLYPHS[0].glyph;
  if (type === "separator") base.separator = ": ";
  if (type === "prompt-symbol") base.separator = "$ ";
  if (type === "prompt-symbol" || type === "exit-status") base.exitAwareColor = false;
  return base;
}
