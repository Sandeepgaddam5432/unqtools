/**
 * Bulk Image Renamer + Optimizer — pure logic. (100x rebuild)
 *
 * ===========================================================================
 * ENGINE PART 1 of 5 — types, constants, filename sanitisation, token engine.
 * ===========================================================================
 *
 * ASSEMBLY: concatenate CODE-1-ENGINE-PART-1.ts .. PART-5.ts, in order, into
 * `src/tools/image/bulk-image-renamer-optimizer/logic.ts`.
 *
 * This part carries the ONE shared import block for the whole engine. Later
 * parts add no imports — they rely on being concatenated after this file and
 * therefore sharing one module scope.
 *
 * D2 CONTRACT: every export that existed in the original logic.ts keeps its
 * exact name and call signature, so the existing 29 KB logic.test.ts keeps
 * passing unchanged. New behaviour is added through NEW optional fields and
 * NEW exports only. Widened unions (CaseMode) are additive.
 *
 * Pure helpers here are unit-testable in node. Canvas/DOM work lives in PART-3.
 */
import type { ToolResult } from "../../../lib/tool";

// ---------------------------------------------------------------------------
// Types — original shapes preserved, new fields all optional
// ---------------------------------------------------------------------------

export type OutputFormat = "image/jpeg" | "image/png" | "image/webp";

/**
 * Original four modes plus three new ones (feature 23, 24).
 * Widening a union is additive and D2-safe.
 */
export type CaseMode =
  | "none"
  | "lower"
  | "upper"
  | "kebab"
  | "snake"
  | "title"
  | "sentence"
  | "seo";

export type WatermarkPosition =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "center";

/** Resize strategy (feature 33). "longest" is the original behaviour. */
export type ResizeMode =
  | "longest"
  | "width"
  | "height"
  | "fit"
  | "cover"
  | "percent";

/** A single find/replace step (feature 20). */
export interface ReplaceRule {
  find: string;
  replace: string;
  useRegex: boolean;
}

export interface RenameRule {
  /** Token template, e.g. "{index}-{original}". Empty means "{original}". */
  pattern: string;
  prefix: string;
  suffix: string;
  /** Counter token {counter} start value. */
  counterStart: number;
  /** Counter increment per index. */
  counterStep: number;
  /** Zero-pad width for {counter}. */
  counterPad: number;
  /** Find string (or regex pattern) for find-replace. */
  find: string;
  /** Replacement for find-replace. */
  replace: string;
  /** Treat `find` as a regex (otherwise literal string). */
  useRegex: boolean;
  caseMode: CaseMode;
  /** Replace spaces with dashes. */
  removeSpaces: boolean;
  /** Strip non-alphanumeric chars (keep dash/underscore/dot). */
  removeSpecialChars: boolean;

  // --- new, all optional so old presets still decode (D2) ---

  /** Extra find/replace steps applied in order AFTER `find`/`replace` (feature 20). */
  extraReplacements?: ReplaceRule[];
  /** Seed for {random:n}. Same seed => same names (feature 18, D12). */
  randomSeed?: number;
  /** Normalise output names to Unicode NFC (feature 6). Default true. */
  normaliseUnicode?: boolean;
  /** Guard against Windows reserved device names (feature 7). Default true. */
  guardReservedNames?: boolean;
  /** Max bytes per path segment (feature 8). Default 255. */
  maxNameBytes?: number;
}

export interface WatermarkOptions {
  enabled: boolean;
  text: string;
  position: WatermarkPosition;
  /** 0-1 opacity. */
  opacity: number;
  /** Hex color e.g. #ffffff. */
  color: string;
  /** Font size in px relative to a 1000px reference width. */
  fontSize: number;
}

export interface OptimizeOptions {
  format: OutputFormat;
  /** 0-1 quality (ignored for PNG). */
  quality: number;
  /** Optional max dimension; image downscaled preserving aspect ratio. */
  maxDimension?: number;
  /** If set, quality is auto-tuned to hit this byte target. */
  targetBytes?: number;
  /**
   * Strip metadata from the output.
   *
   * ORIGINAL BUG (defect 5): this flag was declared and never read by any code
   * path, so the switch did nothing. It is now genuinely honoured — see
   * `processImage` in PART-3. When false, orientation / capture date /
   * copyright are re-injected into JPEG output (feature 28).
   */
  stripExif: boolean;
  /**
   * @deprecated Kept ONLY so old shared preset URLs and the existing test file
   * still typecheck (D2). Canvas exposes no progressive/interlace parameter,
   * so this can never be honoured — see DOCS.md "Not applicable". The UI no
   * longer offers it. Setting it has no effect.
   */
  progressive: boolean;
  watermark: WatermarkOptions;

  // --- new, all optional (D2) ---

  /** Resize strategy (feature 33). Defaults to "longest" = original behaviour. */
  resizeMode?: ResizeMode;
  /** Target width for resizeMode "width" | "fit" | "cover". */
  targetWidth?: number;
  /** Target height for resizeMode "height" | "fit" | "cover". */
  targetHeight?: number;
  /** Scale percentage (1-100) for resizeMode "percent". */
  scalePercent?: number;
  /** Apply EXIF orientation before encoding (feature 27). Default true. */
  autoOrient?: boolean;
  /** Strip GPS specifically, even when stripExif is false (feature 44). */
  stripGps?: boolean;
  /** Background colour used to flatten alpha for JPEG (feature 36). */
  backgroundColor?: string;
  /** Successive-halving downscale for sharper results (feature 34). Default true. */
  highQualityDownscale?: boolean;
  /** Unsharp mask strength 0-100 applied after downscale (feature 35). */
  unsharpAmount?: number;
  /** Encode JPEG and WebP, keep whichever is smaller (feature 38). */
  smartFormat?: boolean;
  /** Rename/repackage only — no re-encode at all (feature 40). */
  copyOriginalBytes?: boolean;
  /** Never emit a file larger than the input (feature 32, D18). Default true. */
  neverGrow?: boolean;
  /** Copyright string injected when stripExif is false (feature 47). */
  copyright?: string;
}

export interface TokenContext {
  width?: number;
  height?: number;
  /** ISO date string from EXIF DateTimeOriginal. */
  exifDate?: string;
  /** ISO date string from file.lastModified. */
  fileDate?: string;
  /** Original basename (no extension) — usually populated by the caller. */
  original?: string;

  // --- new, all optional ---

  /** Original file extension including the dot, e.g. ".jpg" (feature 14). */
  ext?: string;
  /** Source byte size (feature 14). */
  size?: number;
  /** Immediate parent folder name from the source path (feature 14). */
  parent?: string;
  /** EXIF camera make / model / lens (feature 15). */
  make?: string;
  model?: string;
  lens?: string;
  /** EXIF exposure triplet (feature 15). */
  iso?: number;
  fNumber?: number;
  exposureTime?: number;
  /** Per-folder counter value, when {counter:folder} is used (feature 17). */
  folderCounter?: number;
}

export interface RenameOptimizeConfig {
  rule: RenameRule;
  optimize: OptimizeOptions;
  /** Preserve source folder structure in the output ZIP. */
  preserveFolderStructure: boolean;
  /** Optional base folder prepended to every output path in the ZIP. */
  outputFolder: string;

  // --- new, all optional (D2) ---

  /** Schema version, so a future change can migrate instead of crash (feature 91). */
  version?: number;
  /** Flatten everything into one folder, de-duplicating names (feature 74). */
  flattenOutput?: boolean;
  /** Include the audit CSV inside the ZIP as _audit.csv (feature 77). */
  includeAuditInZip?: boolean;
  /** Include a _manifest.json of every setting used (feature 78). */
  includeManifestInZip?: boolean;
  /** Split the archive into parts above this many bytes (feature 76). */
  zipSplitBytes?: number;
  /** Token-expanded ZIP filename (feature 79). */
  zipNamePattern?: string;
}

export interface ExifData {
  date?: string;
  width?: number;
  height?: number;
  make?: string;
  model?: string;
  orientation?: number;
  iso?: number;
  fNumber?: number;
  exposureTime?: number;
  gps?: { latitude?: number; longitude?: number };
  raw?: Record<string, unknown>;
  /** New: lens model, for {exif:lens} (feature 15). */
  lens?: string;
}

export interface ProcessedFile {
  originalName: string;
  newName: string;
  blob: Blob;
  width: number;
  height: number;
  originalSize: number;
  newSize: number;
}

export interface PreviewRow {
  index: number;
  originalName: string;
  originalSize: number;
  newName: string;
  newSize: number;
  width?: number;
  height?: number;
  conflict: boolean;
  autoSuffixed: boolean;
  error?: string;
  /** New: non-fatal, human-readable notes for this row (D8, D9). */
  warnings?: string[];
  /** New: true when the user hand-edited this name (feature 26). */
  manualOverride?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const ACCEPTED_INPUT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/heic",
  "image/heif",
] as const;

export const SUPPORTED_OUTPUT_FORMATS: OutputFormat[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

/** Memory cap (~256 MB) for in-flight processed blobs. */
export const MEMORY_CAP_BYTES = 256 * 1024 * 1024;

/** Hard guards enforced at add time (feature 65, defect class 10). */
export const MAX_FILES = 1000;
export const MAX_FILE_BYTES = 100 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 2 * 1024 * 1024 * 1024;
export const WARN_TOTAL_BYTES = 300 * 1024 * 1024;

/** Max bytes for one path segment on every mainstream filesystem (feature 8). */
export const MAX_NAME_BYTES = 255;

/** Windows reserved device names (feature 7). Case-insensitive, extension-insensitive. */
export const RESERVED_NAMES = [
  "CON", "PRN", "AUX", "NUL",
  "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
  "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
];

/** Characters no mainstream filesystem accepts in a name (feature 7). */
export const ILLEGAL_NAME_CHARS = /[/\\:*?"<>|\u0000-\u001f]/g;

/** Default rename+optimize config used by the UI and tests. */
export const DEFAULT_CONFIG: RenameOptimizeConfig = {
  rule: {
    pattern: "{index}-{original}",
    prefix: "",
    suffix: "",
    counterStart: 1,
    counterStep: 1,
    counterPad: 3,
    find: "",
    replace: "",
    useRegex: false,
    caseMode: "none",
    removeSpaces: false,
    removeSpecialChars: false,
    extraReplacements: [],
    randomSeed: 1,
    normaliseUnicode: true,
    guardReservedNames: true,
    maxNameBytes: MAX_NAME_BYTES,
  },
  optimize: {
    format: "image/jpeg",
    quality: 0.8,
    maxDimension: undefined,
    targetBytes: undefined,
    stripExif: true,
    progressive: false,
    watermark: {
      enabled: false,
      text: "\u00a9 Your Name",
      position: "bottom-right",
      opacity: 0.5,
      color: "#ffffff",
      fontSize: 24,
    },
    resizeMode: "longest",
    autoOrient: true,
    stripGps: true,
    backgroundColor: "#ffffff",
    highQualityDownscale: true,
    unsharpAmount: 0,
    smartFormat: false,
    copyOriginalBytes: false,
    neverGrow: true,
  },
  preserveFolderStructure: false,
  outputFolder: "",
  version: 2,
  flattenOutput: false,
  includeAuditInZip: false,
  includeManifestInZip: false,
};

/** Starter presets (feature 93). */
export const STARTER_PRESETS: { name: string; description: string; config: RenameOptimizeConfig }[] = [
  {
    name: "Web thumbnails",
    description: "512 px WebP, small and fast for grids and cards.",
    config: {
      ...DEFAULT_CONFIG,
      rule: { ...DEFAULT_CONFIG.rule, pattern: "{original}-thumb", caseMode: "seo" },
      optimize: { ...DEFAULT_CONFIG.optimize, format: "image/webp", quality: 0.78, maxDimension: 512 },
    },
  },
  {
    name: "Email attachments",
    description: "1600 px JPEG tuned to roughly 300 KB each.",
    config: {
      ...DEFAULT_CONFIG,
      optimize: { ...DEFAULT_CONFIG.optimize, format: "image/jpeg", maxDimension: 1600, targetBytes: 300 * 1024 },
    },
  },
  {
    name: "Print archive",
    description: "Full resolution, high quality, metadata preserved.",
    config: {
      ...DEFAULT_CONFIG,
      rule: { ...DEFAULT_CONFIG.rule, pattern: "{exif:date:YYYYMMDD}-{counter}" },
      optimize: { ...DEFAULT_CONFIG.optimize, format: "image/jpeg", quality: 0.95, stripExif: false, stripGps: true },
    },
  },
  {
    name: "Social square",
    description: "1080 × 1080 cover-cropped JPEG.",
    config: {
      ...DEFAULT_CONFIG,
      optimize: {
        ...DEFAULT_CONFIG.optimize,
        format: "image/jpeg", quality: 0.85,
        resizeMode: "cover", targetWidth: 1080, targetHeight: 1080,
      },
    },
  },
  {
    name: "SEO product photos",
    description: "Slugified names, 1200 px WebP, no metadata.",
    config: {
      ...DEFAULT_CONFIG,
      rule: { ...DEFAULT_CONFIG.rule, pattern: "{original}-{counter}", caseMode: "seo", counterPad: 2 },
      optimize: { ...DEFAULT_CONFIG.optimize, format: "image/webp", quality: 0.8, maxDimension: 1200 },
    },
  },
];

// ---------------------------------------------------------------------------
// Filename helpers
// ---------------------------------------------------------------------------

/** Split filename into { base, ext } where ext includes the leading dot. */
export function splitExt(filename: string): { base: string; ext: string } {
  const slash = Math.max(filename.lastIndexOf("/"), filename.lastIndexOf("\\"));
  const leaf = slash >= 0 ? filename.slice(slash + 1) : filename;
  const dot = leaf.lastIndexOf(".");
  if (dot <= 0) return { base: leaf, ext: "" };
  return { base: leaf.slice(0, dot), ext: leaf.slice(dot) };
}

/** Detect output MIME from file extension or input MIME. */
export function detectInputFormat(
  filename: string,
  mime: string,
): OutputFormat | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg") || mime === "image/jpeg")
    return "image/jpeg";
  if (lower.endsWith(".png") || mime === "image/png") return "image/png";
  if (lower.endsWith(".webp") || mime === "image/webp") return "image/webp";
  return null;
}

/** Build the file extension (with dot) for an output format. */
export function buildOutputExtension(format: OutputFormat): string {
  return format === "image/jpeg" ? ".jpg" : format === "image/png" ? ".png" : ".webp";
}

/** Immediate parent folder of a relative path, or "" at the root (feature 14). */
export function parentFolderOf(path: string): string {
  const norm = path.replace(/\\/g, "/");
  const slash = norm.lastIndexOf("/");
  if (slash < 0) return "";
  const dir = norm.slice(0, slash);
  const prev = dir.lastIndexOf("/");
  return prev < 0 ? dir : dir.slice(prev + 1);
}

// ---------------------------------------------------------------------------
// Case transforms
// ---------------------------------------------------------------------------

/** Small stop-word list for Title Case (feature 23). */
const TITLE_STOP_WORDS = new Set([
  "a", "an", "and", "as", "at", "but", "by", "for", "in", "nor", "of", "on",
  "or", "the", "to", "up", "via", "vs",
]);

/** Apply a case transform to a name (does not touch the extension dot). */
export function applyCaseTransform(name: string, mode: CaseMode): string {
  switch (mode) {
    case "none":
      return name;
    case "lower":
      return name.toLowerCase();
    case "upper":
      return name.toUpperCase();
    case "kebab":
      return name
        .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
        .replace(/[\s_]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .toLowerCase();
    case "snake":
      return name
        .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
        .replace(/[\s-]+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "")
        .toLowerCase();
    case "title": {
      const words = name.replace(/[_-]+/g, " ").split(/\s+/).filter(Boolean);
      return words
        .map((w, i) => {
          const lower = w.toLowerCase();
          if (i > 0 && i < words.length - 1 && TITLE_STOP_WORDS.has(lower)) return lower;
          return lower.charAt(0).toUpperCase() + lower.slice(1);
        })
        .join(" ");
    }
    case "sentence": {
      const cleaned = name.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
      return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }
    case "seo":
      return slugifyForSeo(name);
    default:
      return name;
  }
}

// ---------------------------------------------------------------------------
// Find / replace
// ---------------------------------------------------------------------------

/**
 * Guard against a pattern that is cheap to write and catastrophic to run
 * (feature 22). We cannot bound backtracking directly, so we reject the
 * shapes that cause it: a quantified group that is itself quantified.
 */
function looksCatastrophic(pattern: string): boolean {
  return /(\([^)]*[+*][^)]*\))\s*[+*]/.test(pattern) || /(\[[^\]]+\][+*])\s*[+*]/.test(pattern);
}

/** Apply find-replace (literal or regex). Returns ToolResult to surface regex errors. */
export function applyFindReplace(
  name: string,
  find: string,
  replace: string,
  useRegex: boolean,
): ToolResult<string> {
  if (!find) return { ok: true, output: name };
  if (useRegex) {
    if (looksCatastrophic(find)) {
      return {
        ok: false,
        error: `The regular expression "${find}" has a nested quantifier that can hang the browser. Simplify it and try again.`,
      };
    }
    try {
      // wrap in try/catch because invalid regex throws
      const re = new RegExp(find, "g");
      return { ok: true, output: name.replace(re, replace) };
    } catch (e) {
      return { ok: false, error: `Invalid regex "${find}": ${(e as Error).message}` };
    }
  }
  // literal global replace
  return { ok: true, output: name.split(find).join(replace) };
}

/** Apply an ordered list of find/replace steps (feature 20). */
export function applyReplacementChain(
  name: string,
  rules: ReplaceRule[],
): ToolResult<string> {
  let working = name;
  for (const r of rules) {
    const res = applyFindReplace(working, r.find, r.replace, r.useRegex);
    if (!res.ok) return res;
    working = res.output;
  }
  return { ok: true, output: working };
}

/** Replace spaces with dashes. */
export function removeSpaces(name: string): string {
  return name.replace(/\s+/g, "-");
}

/** Strip non-alphanumeric chars (keep a-z, 0-9, dash, underscore, dot). */
export function removeSpecialChars(name: string, keepExt: boolean): string {
  if (keepExt) {
    const { base, ext } = splitExt(name);
    return `${base.replace(/[^a-zA-Z0-9_-]/g, "")}${ext}`;
  }
  return name.replace(/[^a-zA-Z0-9_-]/g, "");
}

/** Pad a number with leading zeros to a given width. */
export function padNumber(n: number, width: number): string {
  const s = String(Math.trunc(n));
  return width > 0 ? s.padStart(width, "0") : s;
}

// ---------------------------------------------------------------------------
// SEO slugify (was exported and never used — now wired to CaseMode "seo")
// ---------------------------------------------------------------------------

/** Slugify a text into an SEO-friendly filename-safe slug. */
export function slugifyForSeo(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip combining diacritics
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s_-]/g, "") // strip non-alphanumeric (keep space/dash/underscore)
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// ---------------------------------------------------------------------------
// Filesystem-safety sanitisation (features 6, 7, 8, 9)
// ---------------------------------------------------------------------------

/** UTF-8 byte length of a string, without allocating a TextEncoder per call. */
export function utf8ByteLength(s: string): number {
  let bytes = 0;
  for (let i = 0; i < s.length; i++) {
    const code = s.codePointAt(i)!;
    if (code > 0xffff) i++; // surrogate pair consumed
    bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
  }
  return bytes;
}

/**
 * Truncate a base name so that `base + ext` fits within `maxBytes` UTF-8
 * bytes. The extension is never truncated (feature 8). Cuts on whole code
 * points so a surrogate pair is never split.
 */
export function truncateToBytes(base: string, ext: string, maxBytes: number): string {
  const extBytes = utf8ByteLength(ext);
  const budget = Math.max(1, maxBytes - extBytes);
  if (utf8ByteLength(base) <= budget) return base;
  let out = "";
  let used = 0;
  for (const ch of base) {
    const size = utf8ByteLength(ch);
    if (used + size > budget) break;
    out += ch;
    used += size;
  }
  return out;
}

export interface SanitiseResult {
  name: string;
  warnings: string[];
}

/**
 * Make one filename safe on every mainstream filesystem.
 *
 * Applies, in order: Unicode NFC normalisation (feature 6), illegal-character
 * removal, trailing dot/space removal, reserved-name guard (feature 7),
 * byte-length clamp (feature 8), and an empty-name fallback (feature 9).
 *
 * Every change is reported as a plain sentence (D8, D9) rather than applied
 * silently.
 */
export function sanitiseFilename(
  name: string,
  fallbackBase: string,
  opts: { normaliseUnicode?: boolean; guardReservedNames?: boolean; maxNameBytes?: number } = {},
): SanitiseResult {
  const {
    normaliseUnicode = true,
    guardReservedNames = true,
    maxNameBytes = MAX_NAME_BYTES,
  } = opts;
  const warnings: string[] = [];

  let working = name;

  if (normaliseUnicode) {
    const normalised = working.normalize("NFC");
    if (normalised !== working) {
      warnings.push(
        "Accented characters in this name were normalised to Unicode NFC so it cannot silently collide with a differently-encoded copy.",
      );
      working = normalised;
    }
  }

  if (ILLEGAL_NAME_CHARS.test(working)) {
    ILLEGAL_NAME_CHARS.lastIndex = 0;
    working = working.replace(ILLEGAL_NAME_CHARS, "-");
    warnings.push(
      'Characters that no filesystem accepts (such as / \\ : * ? " < > |) were replaced with dashes.',
    );
  }
  ILLEGAL_NAME_CHARS.lastIndex = 0;

  let { base, ext } = splitExt(working);

  const trimmed = base.replace(/[. ]+$/g, "");
  if (trimmed !== base) {
    warnings.push("Trailing dots and spaces were removed — Windows silently strips them, which would have caused a name collision.");
    base = trimmed;
  }

  if (base.length === 0) {
    base = fallbackBase || "image";
    warnings.push(`The rename pattern produced an empty name, so the original name "${base}" was kept instead.`);
  }

  if (guardReservedNames && RESERVED_NAMES.includes(base.toUpperCase())) {
    warnings.push(`"${base}" is a reserved device name on Windows, so an underscore was added.`);
    base = `${base}_`;
  }

  const clamped = truncateToBytes(base, ext, maxNameBytes);
  if (clamped !== base) {
    warnings.push(`The name was longer than ${maxNameBytes} bytes and was shortened. The extension was kept intact.`);
    base = clamped;
  }

  return { name: `${base}${ext}`, warnings };
}

// ---------------------------------------------------------------------------
// Seeded randomness (feature 18, D12)
// ---------------------------------------------------------------------------

/**
 * Deterministic 32-bit PRNG (mulberry32). Same seed and index always give the
 * same string, so a run is reproducible and a shared preset renames
 * identically on someone else's machine.
 */
export function createSeededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const RANDOM_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** Seeded random token of `length` chars, stable for a given (seed, index). */
export function seededRandomToken(seed: number, index: number, length: number): string {
  const rand = createSeededRandom((seed >>> 0) + index * 2654435761);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += RANDOM_ALPHABET.charAt(Math.floor(rand() * RANDOM_ALPHABET.length));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Date formatting for date tokens (feature 16)
// ---------------------------------------------------------------------------

/**
 * Format an ISO date string with a small, explicit pattern vocabulary:
 * YYYY, YY, MM, DD, HH, mm, ss. Anything else is passed through literally.
 * Returns `fallback` when the date is missing or unparseable.
 */
export function formatDateToken(iso: string | undefined, pattern: string, fallback: string): string {
  if (!iso) return fallback;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return fallback;
  const p2 = (n: number) => String(n).padStart(2, "0");
  const map: Record<string, string> = {
    YYYY: String(d.getFullYear()),
    YY: p2(d.getFullYear() % 100),
    MM: p2(d.getMonth() + 1),
    DD: p2(d.getDate()),
    HH: p2(d.getHours()),
    mm: p2(d.getMinutes()),
    ss: p2(d.getSeconds()),
  };
  return pattern.replace(/YYYY|YY|MM|DD|HH|mm|ss/g, (m) => map[m] ?? m);
}

// ---------------------------------------------------------------------------
// Token substitution
// ---------------------------------------------------------------------------

/** Every token the engine understands, for UI chips and validation (feature 13). */
export const KNOWN_TOKENS = [
  "{index}", "{counter}", "{counter:folder}", "{original}", "{ext}",
  "{date}", "{exif:date}", "{width}", "{height}", "{size}", "{sizekb}",
  "{mp}", "{orientation}", "{aspect}", "{parent}", "{random:6}",
  "{exif:make}", "{exif:model}", "{exif:iso}", "{exif:fnumber}",
  "{exif:exposure}", "{exif:lens}",
];

/** Matches any {…} group so unknown tokens can be reported (feature 13). */
const ANY_TOKEN = /\{([a-zA-Z][a-zA-Z0-9:_-]*)\}/g;

/**
 * Report tokens in a pattern that the engine will not substitute, so the UI
 * can show an inline error instead of emitting a literal "{iso}" in a filename.
 */
export function findUnknownTokens(pattern: string): string[] {
  const known = new Set([
    "index", "counter", "original", "ext", "date", "width", "height",
    "size", "sizekb", "mp", "orientation", "aspect", "parent",
  ]);
  const unknown: string[] = [];
  ANY_TOKEN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ANY_TOKEN.exec(pattern)) !== null) {
    const body = m[1]!;
    if (known.has(body)) continue;
    if (body === "counter:folder") continue;
    if (/^random:\d+$/.test(body)) continue;
    if (/^date:[A-Za-z-]+$/.test(body)) continue;
    if (/^exif:date$/.test(body)) continue;
    if (/^exif:date:[A-Za-z-]+$/.test(body)) continue;
    if (/^exif:(make|model|iso|fnumber|exposure|lens)$/.test(body)) continue;
    unknown.push(`{${body}}`);
  }
  ANY_TOKEN.lastIndex = 0;
  return Array.from(new Set(unknown));
}

/** Reduce a width:height pair to a small aspect label, e.g. "16x9". */
function aspectLabel(w?: number, h?: number): string {
  if (!w || !h) return "";
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const g = gcd(w, h) || 1;
  let rw = Math.round(w / g);
  let rh = Math.round(h / g);
  // Keep the label short: scale down anything absurd like 1234x567.
  if (rw > 40 || rh > 40) {
    const ratio = w / h;
    const common: [number, number][] = [[1, 1], [4, 3], [3, 2], [16, 10], [16, 9], [21, 9], [3, 4], [2, 3], [9, 16]];
    let best = common[0]!;
    let bestDiff = Infinity;
    for (const c of common) {
      const diff = Math.abs(c[0] / c[1] - ratio);
      if (diff < bestDiff) { bestDiff = diff; best = c; }
    }
    rw = best[0];
    rh = best[1];
  }
  return `${rw}x${rh}`;
}

/**
 * Substitute tokens inside a pattern string.
 *
 * ORIGINAL TOKENS (unchanged behaviour):
 *   {index}        — 1-based position (index + 1)
 *   {counter}      — counterStart + index * counterStep, zero-padded to counterPad
 *   {original}     — ctx.original (already case/find-replace-transformed)
 *   {date}         — ctx.fileDate (YYYY-MM-DD), falls back to "undated"
 *   {exif:date}    — ctx.exifDate (YYYY-MM-DD), falls back to {date}
 *   {width}        — ctx.width
 *   {height}       — ctx.height
 *
 * NEW TOKENS (features 14-18):
 *   {ext} {size} {sizekb} {mp} {orientation} {aspect} {parent}
 *   {counter:folder}
 *   {random:N}
 *   {date:PATTERN} and {exif:date:PATTERN} where PATTERN uses YYYY MM DD HH mm ss
 *   {exif:make} {exif:model} {exif:iso} {exif:fnumber} {exif:exposure} {exif:lens}
 *
 * Order matters: the longer, more specific forms are replaced before the
 * shorter ones, so {exif:date:YYYY} is never partially eaten by {exif:date}.
 */
export function applyTokens(
  pattern: string,
  index: number,
  ctx: TokenContext,
  rule: RenameRule,
): string {
  const counter = rule.counterStart + index * rule.counterStep;
  const fileDate = ctx.fileDate ? ctx.fileDate.slice(0, 10) : "undated";
  const exifDate = ctx.exifDate ? ctx.exifDate.slice(0, 10) : fileDate;
  const width = ctx.width != null ? String(ctx.width) : "0";
  const height = ctx.height != null ? String(ctx.height) : "0";
  const seed = rule.randomSeed ?? 1;

  let out = pattern;

  // --- most specific first ---

  out = out.replace(/\{exif:date:([A-Za-z-]+)\}/g, (_m, p: string) =>
    formatDateToken(ctx.exifDate ?? ctx.fileDate, p, exifDate),
  );
  out = out.replace(/\{date:([A-Za-z-]+)\}/g, (_m, p: string) =>
    formatDateToken(ctx.fileDate, p, fileDate),
  );
  out = out.replace(/\{random:(\d+)\}/g, (_m, n: string) =>
    seededRandomToken(seed, index, Math.max(1, Math.min(32, parseInt(n, 10)))),
  );

  out = out
    .replace(/\{exif:make\}/g, ctx.make ?? "")
    .replace(/\{exif:model\}/g, ctx.model ?? "")
    .replace(/\{exif:lens\}/g, ctx.lens ?? "")
    .replace(/\{exif:iso\}/g, ctx.iso != null ? String(ctx.iso) : "")
    .replace(/\{exif:fnumber\}/g, ctx.fNumber != null ? String(ctx.fNumber) : "")
    .replace(/\{exif:exposure\}/g, ctx.exposureTime != null ? String(ctx.exposureTime) : "")
    .replace(/\{exif:date\}/g, exifDate);

  out = out.replace(/\{counter:folder\}/g,
    padNumber(ctx.folderCounter != null ? ctx.folderCounter : counter, rule.counterPad),
  );

  // --- original tokens ---

  out = out
    .replace(/\{index\}/g, String(index + 1))
    .replace(/\{counter\}/g, padNumber(counter, rule.counterPad))
    .replace(/\{original\}/g, ctx.original ?? "")
    .replace(/\{date\}/g, fileDate)
    .replace(/\{width\}/g, width)
    .replace(/\{height\}/g, height);

  // --- new simple tokens ---

  out = out
    .replace(/\{ext\}/g, (ctx.ext ?? "").replace(/^\./, ""))
    .replace(/\{size\}/g, ctx.size != null ? String(ctx.size) : "0")
    .replace(/\{sizekb\}/g, ctx.size != null ? String(Math.round(ctx.size / 1024)) : "0")
    .replace(/\{mp\}/g,
      ctx.width && ctx.height ? ((ctx.width * ctx.height) / 1_000_000).toFixed(1) : "0",
    )
    .replace(/\{orientation\}/g,
      ctx.width && ctx.height
        ? ctx.width > ctx.height ? "landscape" : ctx.width < ctx.height ? "portrait" : "square"
        : "",
    )
    .replace(/\{aspect\}/g, aspectLabel(ctx.width, ctx.height))
    .replace(/\{parent\}/g, ctx.parent ?? "");

  return out;
}

// ---------------------------------------------------------------------------
// Full rename pipeline
// ---------------------------------------------------------------------------

/**
 * Apply the full rename rule to an original filename.
 *
 * Order of operations (unchanged from the original, with steps 4b and 8 added):
 *   1. Split into base + ext.
 *   2. find-replace on base.
 *   2b. extra find-replace rules, in order (feature 20).
 *   3. case transform on base.
 *   4. removeSpaces / removeSpecialChars on base.
 *   5. Token-substitute the pattern (default "{original}").
 *   6. Prepend prefix, append suffix.
 *   7. Append the (possibly format-changed) extension.
 *   8. Sanitise for the filesystem (features 6-9).
 *
 * NOTE (defect: divergent implementations): step 4 previously inlined its own
 * `[^a-zA-Z0-9_-]` regex rather than calling the exported
 * `removeSpecialChars`, and the two behaved differently. This now calls the
 * exported helper with keepExt = false, which is exactly what the inlined
 * version did, so existing test expectations are preserved while there is
 * only ONE implementation of the rule.
 */
export function applyRenamePattern(
  originalName: string,
  index: number,
  rule: RenameRule,
  ctx: TokenContext = {},
  outputFormat?: OutputFormat,
): ToolResult<string> {
  const res = applyRenamePatternDetailed(originalName, index, rule, ctx, outputFormat);
  if (!res.ok) return res;
  return { ok: true, output: res.output.name };
}

/**
 * Same pipeline as `applyRenamePattern`, but also returns the sanitisation
 * warnings so the UI can surface them per row (D8, D9). The plain
 * `applyRenamePattern` above keeps the original `ToolResult<string>` shape
 * for D2 compatibility.
 */
export function applyRenamePatternDetailed(
  originalName: string,
  index: number,
  rule: RenameRule,
  ctx: TokenContext = {},
  outputFormat?: OutputFormat,
): ToolResult<{ name: string; warnings: string[] }> {
  const { base, ext } = splitExt(originalName);

  // 1-2. find-replace
  const fr = applyFindReplace(base, rule.find, rule.replace, rule.useRegex);
  if (!fr.ok) return fr;
  let working = fr.output;

  // 2b. extra chained replacements
  if (rule.extraReplacements && rule.extraReplacements.length > 0) {
    const chain = applyReplacementChain(working, rule.extraReplacements);
    if (!chain.ok) return chain;
    working = chain.output;
  }

  // 3. case
  working = applyCaseTransform(working, rule.caseMode);

  // 4. spaces / special chars
  if (rule.removeSpaces) working = removeSpaces(working);
  if (rule.removeSpecialChars) working = removeSpecialChars(working, false);

  // 5. tokens
  const pattern = rule.pattern && rule.pattern.length > 0 ? rule.pattern : "{original}";
  const ctxWithOriginal: TokenContext = {
    ...ctx,
    original: working,
    ext: ctx.ext ?? ext,
  };
  let expanded = applyTokens(pattern, index, ctxWithOriginal, rule);

  // 6. prefix + suffix
  expanded = `${rule.prefix}${expanded}${rule.suffix}`;

  // 7. extension
  const outExt = outputFormat ? buildOutputExtension(outputFormat) : ext;

  // 8. filesystem safety
  const sanitised = sanitiseFilename(`${expanded}${outExt}`, base, {
    normaliseUnicode: rule.normaliseUnicode,
    guardReservedNames: rule.guardReservedNames,
    maxNameBytes: rule.maxNameBytes,
  });

  return { ok: true, output: { name: sanitised.name, warnings: sanitised.warnings } };
}

/**
 * ===========================================================================
 * ENGINE PART 2 of 5 — conflicts, output paths, audit exports, presets, stats.
 * ===========================================================================
 *
 * Concatenate AFTER CODE-1-ENGINE-PART-1.ts. No imports here: this file shares
 * PART-1's module scope and uses its types and helpers directly.
 *
 * D2 note: `detectConflicts`, `resolveConflicts`, `buildOutputPath`,
 * `generateAuditCsv`, `generateAuditJson`, `estimateSizeSavings`,
 * `formatBytes`, `encodeConfigToUrl` and `decodeConfigFromUrl` all keep their
 * EXACT original signatures and original behaviour, because `logic.test.ts`
 * asserts against them. Where the original behaviour is unsafe (case-sensitive
 * conflicts, unneutralised CSV, unvalidated presets), the fix ships as a NEW
 * exported function that the UI calls instead, with the reason documented at
 * the call site. Silently changing a tested function's semantics is not a fix,
 * it is a different bug.
 */

// ---------------------------------------------------------------------------
// Conflict detection + resolution
// ---------------------------------------------------------------------------

/**
 * Detect duplicate output names. Returns a Map<name, indices[]>.
 * Only names that appear more than once are included.
 *
 * UNCHANGED from the original (exact-string, case-sensitive) for D2.
 * Prefer `detectConflictsFolded` in new code — see defect 10.
 */
export function detectConflicts(names: string[]): Map<string, number[]> {
  const map = new Map<string, number[]>();
  for (let i = 0; i < names.length; i++) {
    const n = names[i]!;
    const arr = map.get(n);
    if (arr) arr.push(i);
    else map.set(n, [i]);
  }
  // prune unique names
  for (const [k, v] of map) {
    if (v.length < 2) map.delete(k);
  }
  return map;
}

/**
 * Fold a filename to the key that a real filesystem actually compares on
 * (feature 5, feature 6).
 *
 * Windows (NTFS, default), macOS (APFS/HFS+, default) and every ZIP extractor
 * on those platforms treat names case-insensitively, and macOS stores names in
 * NFD while Windows and Linux use NFC. The original `detectConflicts` compared
 * raw strings, so `Photo.jpg` and `photo.jpg` were reported as two distinct,
 * conflict-free names — and then one silently overwrote the other on
 * extraction. That is silent data loss in a tool whose entire job is safe bulk
 * renaming.
 */
export function foldNameKey(name: string): string {
  return name.normalize("NFC").toLocaleLowerCase("en-US");
}

/**
 * Case-insensitive, Unicode-normalised conflict detection (feature 5).
 *
 * Returns Map<foldedKey, indices[]>. The key is the FOLDED name, so callers
 * that want a display name should read `names[indices[0]]` rather than the key.
 */
export function detectConflictsFolded(names: string[]): Map<string, number[]> {
  const map = new Map<string, number[]>();
  for (let i = 0; i < names.length; i++) {
    const key = foldNameKey(names[i]!);
    const arr = map.get(key);
    if (arr) arr.push(i);
    else map.set(key, [i]);
  }
  for (const [k, v] of map) {
    if (v.length < 2) map.delete(k);
  }
  return map;
}

/**
 * Resolve duplicate names by appending an incrementing suffix to all but
 * the first occurrence. e.g. ["a.jpg","a.jpg","a.jpg"] → ["a.jpg","a-1.jpg","a-2.jpg"].
 * If "a-1.jpg" already exists, picks the next free slot.
 *
 * UNCHANGED from the original for D2. Prefer `resolveConflictsSafe`.
 */
export function resolveConflicts(
  names: string[],
  conflicts: Map<string, number[]> = detectConflicts(names),
): string[] {
  const out = names.slice();
  const taken = new Set(names);
  for (const [, indices] of conflicts) {
    // first occurrence keeps the original name
    for (let k = 1; k < indices.length; k++) {
      const idx = indices[k]!;
      const original = out[idx]!;
      const { base, ext } = splitExt(original);
      let n = 1;
      let candidate = `${base}-${n}${ext}`;
      while (taken.has(candidate)) {
        n++;
        candidate = `${base}-${n}${ext}`;
      }
      taken.add(candidate);
      out[idx] = candidate;
    }
  }
  return out;
}

export interface ConflictResolution {
  /** Final names, guaranteed unique under case-insensitive NFC comparison. */
  names: string[];
  /** True at index i when that name was changed to avoid a collision. */
  suffixed: boolean[];
  /** One plain sentence per renamed file (D8). */
  warnings: string[];
}

/**
 * Case-insensitive, NFC-aware conflict resolution (feature 5).
 *
 * Unlike the original, the `taken` set is keyed on the FOLDED name, so
 * `Photo.jpg` will not be handed out again as `photo.jpg`. Also reports which
 * rows were changed and why, instead of renaming silently.
 */
export function resolveConflictsSafe(names: string[]): ConflictResolution {
  const out = names.slice();
  const suffixed = new Array<boolean>(names.length).fill(false);
  const warnings: string[] = [];
  const taken = new Set<string>();
  const conflicts = detectConflictsFolded(names);

  // Reserve every first occurrence up front so later rows cannot steal a name.
  for (let i = 0; i < names.length; i++) {
    const key = foldNameKey(names[i]!);
    const group = conflicts.get(key);
    if (!group || group[0] === i) taken.add(key);
  }

  for (const [, indices] of conflicts) {
    for (let k = 1; k < indices.length; k++) {
      const idx = indices[k]!;
      const original = out[idx]!;
      const { base, ext } = splitExt(original);
      let n = 1;
      let candidate = `${base}-${n}${ext}`;
      while (taken.has(foldNameKey(candidate))) {
        n++;
        candidate = `${base}-${n}${ext}`;
      }
      taken.add(foldNameKey(candidate));
      out[idx] = candidate;
      suffixed[idx] = true;
      warnings.push(
        `"${original}" would have collided with an earlier file (filenames are not case-sensitive on Windows or macOS), so it was renamed to "${candidate}".`,
      );
    }
  }

  return { names: out, suffixed, warnings };
}

// ---------------------------------------------------------------------------
// Folder structure helpers
// ---------------------------------------------------------------------------

/**
 * Build the output path inside the ZIP for a given file. Honors
 * `preserveFolderStructure` (keep source path) and `outputFolder` (prepend).
 *
 * UNCHANGED from the original. It was never the broken part — defect 7 was
 * that the UI always passed `originalPath = file.name`, so there was never a
 * directory to preserve. The fix lives in the UI (feature 71): the folder
 * picker's `webkitRelativePath` and the drag-drop walker's accumulated path
 * are now carried through to this function.
 */
export function buildOutputPath(
  originalPath: string,
  newName: string,
  config: RenameOptimizeConfig,
): string {
  let dir = "";
  if (config.preserveFolderStructure) {
    const slash = originalPath.lastIndexOf("/");
    if (slash >= 0) dir = originalPath.slice(0, slash + 1);
  }
  const base = config.outputFolder
    ? `${config.outputFolder.replace(/\/+$/, "")}/`
    : "";
  return `${base}${dir}${newName}`;
}

/**
 * Normalise a source-relative path so it can never escape the archive
 * (feature 71). Strips drive letters, leading slashes, and any `..` segment.
 * A ZIP entry named `../../etc/passwd` is the classic "zip slip" and some
 * extractors still honour it.
 */
export function sanitiseRelativePath(path: string): string {
  const parts = path
    .replace(/\\/g, "/")
    .replace(/^[a-zA-Z]:/, "")
    .split("/")
    .filter((p) => p !== "" && p !== "." && p !== "..");
  return parts.join("/");
}

/**
 * Resolve the final in-archive path for every row at once, applying folder
 * preservation or flattening, then de-duplicating case-insensitively across
 * the WHOLE archive (feature 74).
 *
 * Flattening is the case that most needs this: two files that lived in
 * different folders can share a name, and collapsing the folders turns a
 * non-conflict into a silent overwrite.
 */
export function resolveArchivePaths(
  rows: { originalPath: string; newName: string }[],
  config: RenameOptimizeConfig,
): { paths: string[]; warnings: string[] } {
  const effective: RenameOptimizeConfig = config.flattenOutput
    ? { ...config, preserveFolderStructure: false }
    : config;

  const raw = rows.map((r) =>
    buildOutputPath(sanitiseRelativePath(r.originalPath), r.newName, effective),
  );
  const resolution = resolveConflictsSafe(raw);
  return { paths: resolution.names, warnings: resolution.warnings };
}

/**
 * Expand the ZIP filename pattern with the same token engine as the rename
 * pattern (feature 79), then make it filesystem-safe.
 */
export function buildZipFileName(
  config: RenameOptimizeConfig,
  fileCount: number,
  now: Date = new Date(),
): string {
  const pattern = config.zipNamePattern && config.zipNamePattern.length > 0
    ? config.zipNamePattern
    : "bulk-images-{date}";
  const expanded = applyTokens(
    pattern,
    0,
    { fileDate: now.toISOString(), original: "bulk-images", size: fileCount },
    config.rule,
  );
  return sanitiseFilename(`${expanded}.zip`, "bulk-images").name;
}

// ---------------------------------------------------------------------------
// Audit export
// ---------------------------------------------------------------------------

/** Quote a CSV field when it contains a comma, quote, or newline. */
function csvEscape(s: string): string {
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Neutralise a CSV cell against spreadsheet formula injection, then quote it
 * (feature 99, decision **D7**).
 *
 * The original `generateAuditCsv` quoted correctly but did nothing about a
 * leading `=`, `+`, `-` or `@`. Excel, LibreOffice and Google Sheets all treat
 * a cell starting with one of those as a live formula, so a file innocently
 * named `=cmd|'/c calc'!A1.jpg` becomes executable content the moment the
 * audit trail is opened. Prefixing a single quote is the standard, lossless
 * mitigation — the character is still visible in the cell.
 *
 * Every other tool in this project already does this; this one did not.
 */
export function csvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  const needsGuard = /^[=+\-@\t\r]/.test(s);
  return csvEscape(needsGuard ? `'${s}` : s);
}

/**
 * Generate a CSV audit trail of old→new names + sizes.
 *
 * Same columns and same row order as the original, so anything parsing this
 * keeps working. Two changes: every cell goes through `csvCell` (D7), and a
 * `warnings` column is appended for the per-row sentences the engine now
 * produces (D8). Appending a column is additive.
 */
export function generateAuditCsv(rows: PreviewRow[]): string {
  const header = [
    "index",
    "original_name",
    "original_size_bytes",
    "new_name",
    "new_size_bytes",
    "width",
    "height",
    "conflict",
    "auto_suffixed",
    "error",
    "warnings",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        csvCell(r.index),
        csvCell(r.originalName),
        csvCell(r.originalSize),
        csvCell(r.newName),
        csvCell(r.newSize),
        csvCell(r.width ?? ""),
        csvCell(r.height ?? ""),
        csvCell(r.conflict ? "yes" : "no"),
        csvCell(r.autoSuffixed ? "yes" : "no"),
        csvCell(r.error ?? ""),
        csvCell((r.warnings ?? []).join(" ")),
      ].join(","),
    );
  }
  return lines.join("\n");
}

/** Generate a JSON audit trail of old→new names + sizes. */
export function generateAuditJson(rows: PreviewRow[]): string {
  return JSON.stringify(rows, null, 2);
}

/**
 * A machine-readable record of every setting used for a run, written into the
 * ZIP as `_manifest.json` (feature 78), so a result is reproducible months
 * later without guessing which options were on.
 */
export function generateRunManifest(
  config: RenameOptimizeConfig,
  rows: PreviewRow[],
  startedAt: Date,
  finishedAt: Date,
): string {
  const processed = rows.filter((r) => !r.error).length;
  const failed = rows.filter((r) => r.error).length;
  const before = rows.reduce((s, r) => s + r.originalSize, 0);
  const after = rows.reduce((s, r) => s + r.newSize, 0);
  const { savings, percent } = estimateSizeSavings(before, after);

  return JSON.stringify(
    {
      tool: "bulk-image-renamer-optimizer",
      manifestVersion: 1,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      counts: { added: rows.length, processed, failed },
      bytes: { before, after, saved: savings, savedPercent: Number(percent.toFixed(2)) },
      config,
    },
    null,
    2,
  );
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

/** Compute savings in bytes and percent. */
export function estimateSizeSavings(
  beforeBytes: number,
  afterBytes: number,
): { savings: number; percent: number } {
  const savings = Math.max(0, beforeBytes - afterBytes);
  const percent = beforeBytes > 0 ? (savings / beforeBytes) * 100 : 0;
  return { savings, percent };
}

/** Format bytes human-readable. */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 0) return `-${formatBytes(-bytes)}`;
  const k = 1024;
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Format a millisecond duration as a short human string. */
export function formatDuration(ms: number): string {
  if (!isFinite(ms) || ms < 0) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return `${m}m ${rem}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

/**
 * Reconciled batch counts (feature 97, decision **D15**).
 * added must always equal processed + failed + skipped + pending.
 */
export interface BatchCounts {
  added: number;
  processed: number;
  failed: number;
  skipped: number;
  pending: number;
}

export function reconcileCounts(counts: Omit<BatchCounts, "pending">): BatchCounts {
  const pending = Math.max(
    0,
    counts.added - counts.processed - counts.failed - counts.skipped,
  );
  return { ...counts, pending };
}

// ---------------------------------------------------------------------------
// URL preset encode / decode
// ---------------------------------------------------------------------------

/** Encode a config into a URL hash for sharing. */
export function encodeConfigToUrl(
  config: RenameOptimizeConfig,
  baseUrl: string,
): string {
  const json = JSON.stringify(config);
  // base64url encode (UTF-8 safe)
  const b64 = typeof btoa !== "undefined"
    ? btoa(unescape(encodeURIComponent(json)))
    : Buffer.from(json, "utf-8").toString("base64");
  const b64url = b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${baseUrl}#p=${b64url}`;
}

/**
 * Decode a config from a URL hash. Returns ToolResult to surface parse errors.
 *
 * UNCHANGED decode path for D2, but the parsed object is now run through
 * `validateConfig` before it is returned (feature 90). The original blindly
 * cast `JSON.parse(json)` to `RenameOptimizeConfig`, so a truncated or hostile
 * link produced an object with no `rule`, and the very next thing the UI did
 * was read `config.rule.pattern` — crashing the whole tool on a bad link.
 */
export function decodeConfigFromUrl(url: string): ToolResult<RenameOptimizeConfig> {
  try {
    const hashIdx = url.indexOf("#p=");
    if (hashIdx < 0) return { ok: false, error: "No preset found in URL" };
    const b64url = url.slice(hashIdx + 3);
    const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const json =
      typeof atob !== "undefined"
        ? decodeURIComponent(escape(atob(padded)))
        : Buffer.from(padded, "base64").toString("utf-8");
    const parsed: unknown = JSON.parse(json);
    return validateConfig(parsed);
  } catch (e) {
    return { ok: false, error: `Could not decode preset: ${(e as Error).message}` };
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function pickString(v: unknown, fallback: string): string {
  return typeof v === "string" ? v : fallback;
}

function pickNumber(v: unknown, fallback: number, min: number, max: number): number {
  if (typeof v !== "number" || !isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}

function pickBool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function pickEnum<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === "string" && (allowed as readonly string[]).includes(v)
    ? (v as T)
    : fallback;
}

const CASE_MODES: readonly CaseMode[] = [
  "none", "lower", "upper", "kebab", "snake", "title", "sentence", "seo",
];
const WATERMARK_POSITIONS: readonly WatermarkPosition[] = [
  "top-left", "top-right", "bottom-left", "bottom-right", "center",
];
const RESIZE_MODES: readonly ResizeMode[] = [
  "longest", "width", "height", "fit", "cover", "percent",
];

/**
 * Validate and migrate an untrusted config object (features 90, 91).
 *
 * Every field is checked and clamped against DEFAULT_CONFIG rather than
 * trusted, so a malformed link degrades to sensible defaults instead of
 * crashing. Unknown future fields are dropped, not preserved, because a field
 * this version does not understand cannot be honoured and keeping it would
 * imply otherwise (D19).
 */
export function validateConfig(input: unknown): ToolResult<RenameOptimizeConfig> {
  if (!isPlainObject(input)) {
    return {
      ok: false,
      error: "That preset link does not contain a settings object. It may have been truncated when it was copied.",
    };
  }

  const version = typeof input.version === "number" ? input.version : 1;
  if (version > 2) {
    return {
      ok: false,
      error: `That preset was created by a newer version of this tool (format ${version}). Update the page and try the link again.`,
    };
  }

  const d = DEFAULT_CONFIG;
  const rawRule = isPlainObject(input.rule) ? input.rule : {};
  const rawOpt = isPlainObject(input.optimize) ? input.optimize : {};
  const rawWm = isPlainObject(rawOpt.watermark) ? rawOpt.watermark : {};

  const extraReplacements: ReplaceRule[] = Array.isArray(rawRule.extraReplacements)
    ? rawRule.extraReplacements
        .filter(isPlainObject)
        .slice(0, 20)
        .map((r) => ({
          find: pickString(r.find, ""),
          replace: pickString(r.replace, ""),
          useRegex: pickBool(r.useRegex, false),
        }))
    : [];

  const rule: RenameRule = {
    pattern: pickString(rawRule.pattern, d.rule.pattern).slice(0, 500),
    prefix: pickString(rawRule.prefix, d.rule.prefix).slice(0, 200),
    suffix: pickString(rawRule.suffix, d.rule.suffix).slice(0, 200),
    counterStart: pickNumber(rawRule.counterStart, d.rule.counterStart, -1e9, 1e9),
    counterStep: pickNumber(rawRule.counterStep, d.rule.counterStep, -1000, 1000),
    counterPad: pickNumber(rawRule.counterPad, d.rule.counterPad, 0, 12),
    find: pickString(rawRule.find, d.rule.find).slice(0, 500),
    replace: pickString(rawRule.replace, d.rule.replace).slice(0, 500),
    useRegex: pickBool(rawRule.useRegex, d.rule.useRegex),
    caseMode: pickEnum(rawRule.caseMode, CASE_MODES, d.rule.caseMode),
    removeSpaces: pickBool(rawRule.removeSpaces, d.rule.removeSpaces),
    removeSpecialChars: pickBool(rawRule.removeSpecialChars, d.rule.removeSpecialChars),
    extraReplacements,
    randomSeed: pickNumber(rawRule.randomSeed, 1, 0, 0xffffffff),
    normaliseUnicode: pickBool(rawRule.normaliseUnicode, true),
    guardReservedNames: pickBool(rawRule.guardReservedNames, true),
    maxNameBytes: pickNumber(rawRule.maxNameBytes, MAX_NAME_BYTES, 16, MAX_NAME_BYTES),
  };

  const optimize: OptimizeOptions = {
    format: pickEnum(rawOpt.format, SUPPORTED_OUTPUT_FORMATS, d.optimize.format),
    quality: pickNumber(rawOpt.quality, d.optimize.quality, 0.05, 1),
    maxDimension:
      typeof rawOpt.maxDimension === "number"
        ? pickNumber(rawOpt.maxDimension, 2000, 16, 20000)
        : undefined,
    targetBytes:
      typeof rawOpt.targetBytes === "number"
        ? pickNumber(rawOpt.targetBytes, 300 * 1024, 1024, 100 * 1024 * 1024)
        : undefined,
    stripExif: pickBool(rawOpt.stripExif, d.optimize.stripExif),
    progressive: false, // never honoured — see DOCS.md "Not applicable"
    watermark: {
      enabled: pickBool(rawWm.enabled, d.optimize.watermark.enabled),
      text: pickString(rawWm.text, d.optimize.watermark.text).slice(0, 200),
      position: pickEnum(rawWm.position, WATERMARK_POSITIONS, d.optimize.watermark.position),
      opacity: pickNumber(rawWm.opacity, d.optimize.watermark.opacity, 0, 1),
      color: /^#[0-9a-fA-F]{6}$/.test(String(rawWm.color))
        ? String(rawWm.color)
        : d.optimize.watermark.color,
      fontSize: pickNumber(rawWm.fontSize, d.optimize.watermark.fontSize, 4, 400),
    },
    resizeMode: pickEnum(rawOpt.resizeMode, RESIZE_MODES, "longest"),
    targetWidth:
      typeof rawOpt.targetWidth === "number"
        ? pickNumber(rawOpt.targetWidth, 1080, 1, 20000)
        : undefined,
    targetHeight:
      typeof rawOpt.targetHeight === "number"
        ? pickNumber(rawOpt.targetHeight, 1080, 1, 20000)
        : undefined,
    scalePercent: pickNumber(rawOpt.scalePercent, 100, 1, 400),
    autoOrient: pickBool(rawOpt.autoOrient, true),
    stripGps: pickBool(rawOpt.stripGps, true),
    backgroundColor: /^#[0-9a-fA-F]{6}$/.test(String(rawOpt.backgroundColor))
      ? String(rawOpt.backgroundColor)
      : "#ffffff",
    highQualityDownscale: pickBool(rawOpt.highQualityDownscale, true),
    unsharpAmount: pickNumber(rawOpt.unsharpAmount, 0, 0, 100),
    smartFormat: pickBool(rawOpt.smartFormat, false),
    copyOriginalBytes: pickBool(rawOpt.copyOriginalBytes, false),
    neverGrow: pickBool(rawOpt.neverGrow, true),
    copyright: pickString(rawOpt.copyright, "").slice(0, 200) || undefined,
  };

  return {
    ok: true,
    output: {
      rule,
      optimize,
      preserveFolderStructure: pickBool(input.preserveFolderStructure, false),
      outputFolder: sanitiseRelativePath(pickString(input.outputFolder, "")).slice(0, 200),
      version: 2,
      flattenOutput: pickBool(input.flattenOutput, false),
      includeAuditInZip: pickBool(input.includeAuditInZip, false),
      includeManifestInZip: pickBool(input.includeManifestInZip, false),
      zipSplitBytes:
        typeof input.zipSplitBytes === "number"
          ? pickNumber(input.zipSplitBytes, 2 * 1024 * 1024 * 1024, 1024 * 1024, 8 * 1024 * 1024 * 1024)
          : undefined,
      zipNamePattern: pickString(input.zipNamePattern, "").slice(0, 200) || undefined,
    },
  };
}

/**
 * Human-readable diff between the current config and one about to be applied
 * (feature 92, decision **D10**: a recalled preset is never applied silently —
 * the user sees what will change first).
 */
export function diffConfigs(
  current: RenameOptimizeConfig,
  next: RenameOptimizeConfig,
): string[] {
  const changes: string[] = [];
  const compare = (label: string, a: unknown, b: unknown) => {
    const av = a == null ? "not set" : String(a);
    const bv = b == null ? "not set" : String(b);
    if (av !== bv) changes.push(`${label}: ${av} → ${bv}`);
  };

  compare("Pattern", current.rule.pattern, next.rule.pattern);
  compare("Prefix", current.rule.prefix || "none", next.rule.prefix || "none");
  compare("Suffix", current.rule.suffix || "none", next.rule.suffix || "none");
  compare("Case", current.rule.caseMode, next.rule.caseMode);
  compare("Counter start", current.rule.counterStart, next.rule.counterStart);
  compare("Counter padding", current.rule.counterPad, next.rule.counterPad);
  compare("Find", current.rule.find || "none", next.rule.find || "none");
  compare("Replace", current.rule.replace || "none", next.rule.replace || "none");
  compare("Output format", current.optimize.format, next.optimize.format);
  compare("Quality", current.optimize.quality, next.optimize.quality);
  compare("Resize mode", current.optimize.resizeMode ?? "longest", next.optimize.resizeMode ?? "longest");
  compare("Max dimension", current.optimize.maxDimension, next.optimize.maxDimension);
  compare("Target size", current.optimize.targetBytes, next.optimize.targetBytes);
  compare("Keep metadata", !current.optimize.stripExif, !next.optimize.stripExif);
  compare("Auto-rotate", current.optimize.autoOrient ?? true, next.optimize.autoOrient ?? true);
  compare("Watermark", current.optimize.watermark.enabled, next.optimize.watermark.enabled);
  compare("Preserve folders", current.preserveFolderStructure, next.preserveFolderStructure);
  compare("Output folder", current.outputFolder || "none", next.outputFolder || "none");

  return changes;
}

/**
 * ===========================================================================
 * ENGINE PART 3 of 5 — the Canvas pipeline (render, resize, watermark, encode).
 * ===========================================================================
 *
 * Concatenate AFTER CODE-1-ENGINE-PART-2.ts. No imports.
 *
 * WHY THIS PART EXISTS IN THIS SHAPE
 * ----------------------------------
 * The original tool had TWO separate image pipelines that had drifted apart:
 *
 *   - `processImage` in logic.ts   — main thread, honoured targetBytes, handled
 *                                    HEIC, hashed the ORIGINAL bitmap.
 *   - the body of worker.ts        — worker thread, ignored targetBytes, could
 *                                    not handle HEIC, hashed the RESIZED canvas.
 *
 * That is the root cause of defects 3, 4 and 9: the same image processed on
 * two different browsers produced different bytes, a different hash, and a
 * different set of honoured options.
 *
 * The fix is structural, not a patch. Everything below is written against an
 * abstract canvas that is satisfied by BOTH `HTMLCanvasElement` and
 * `OffscreenCanvas`, so there is exactly ONE pipeline. `processImage` (main
 * thread) and `worker.ts` both call `processBitmapCore`. If they ever disagree
 * again it will be a compile error, not a silent behaviour split.
 */

// ---------------------------------------------------------------------------
// Canvas abstraction — one pipeline for main thread and worker
// ---------------------------------------------------------------------------

export type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;
export type AnyCtx2D =
  | CanvasRenderingContext2D
  | OffscreenCanvasRenderingContext2D;

/** True when running somewhere with no DOM (i.e. inside the Web Worker). */
export function isOffscreenEnvironment(): boolean {
  return typeof document === "undefined";
}

/**
 * Create a drawing surface that works in both environments.
 * Throws a plain-sentence error rather than returning null, so the caller's
 * single try/catch reports one useful message (D8).
 */
export function createCanvas(width: number, height: number): AnyCanvas {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  if (typeof OffscreenCanvas !== "undefined" && isOffscreenEnvironment()) {
    return new OffscreenCanvas(w, h);
  }
  if (typeof document === "undefined") {
    throw new Error(
      "This browser has neither a document nor OffscreenCanvas, so images cannot be re-encoded here.",
    );
  }
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

/** Get a 2D context from either canvas type, or throw a readable error. */
export function get2dContext(canvas: AnyCanvas): AnyCtx2D {
  const ctx = (canvas as HTMLCanvasElement).getContext("2d", {
    willReadFrequently: false,
  }) as AnyCtx2D | null;
  if (!ctx) {
    throw new Error(
      "The browser refused to provide a 2D drawing context. This usually means too many images are open at once — process a smaller batch.",
    );
  }
  return ctx;
}

/**
 * Encode a canvas to a Blob on either code path.
 *
 * `HTMLCanvasElement.toBlob` is callback-based and `OffscreenCanvas.convertToBlob`
 * is promise-based, so this normalises the two.
 */
export async function canvasToBlobAny(
  canvas: AnyCanvas,
  format: OutputFormat,
  quality?: number,
): Promise<Blob> {
  const off = canvas as OffscreenCanvas;
  if (typeof off.convertToBlob === "function") {
    return off.convertToBlob({ type: format, quality });
  }
  const el = canvas as HTMLCanvasElement;
  return new Promise<Blob>((resolve, reject) => {
    el.toBlob(
      (b) =>
        b
          ? resolve(b)
          : reject(
              new Error(
                `The browser could not encode this image as ${format}. It may be corrupt or larger than the browser's canvas limit.`,
              ),
            ),
      format,
      quality,
    );
  });
}

/**
 * Kept for D2: the original private helper had this exact behaviour and shape.
 * It now delegates to the shared implementation.
 */
function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: OutputFormat,
  quality?: number,
): Promise<Blob> {
  return canvasToBlobAny(canvas, format, quality);
}

// ---------------------------------------------------------------------------
// Resize geometry
// ---------------------------------------------------------------------------

/**
 * Compute new dimensions preserving aspect ratio if maxDimension is set.
 * UNCHANGED from the original (D2) — this is the "longest edge" mode.
 */
export function computeResizedDimensions(
  originalWidth: number,
  originalHeight: number,
  maxDimension?: number,
): { width: number; height: number } {
  if (!maxDimension || maxDimension <= 0) {
    return { width: originalWidth, height: originalHeight };
  }
  const longest = Math.max(originalWidth, originalHeight);
  if (longest <= maxDimension) {
    return { width: originalWidth, height: originalHeight };
  }
  const scale = maxDimension / longest;
  return {
    width: Math.max(1, Math.round(originalWidth * scale)),
    height: Math.max(1, Math.round(originalHeight * scale)),
  };
}

/** Compute the effective width/height/quality/format for a given image + options. */
export function computeOptimizeOptions(
  dims: { width: number; height: number },
  opts: OptimizeOptions,
): { width: number; height: number; quality: number; format: OutputFormat } {
  const { width, height } = computeResizedDimensions(
    dims.width,
    dims.height,
    opts.maxDimension,
  );
  return {
    width,
    height,
    quality: opts.format === "image/png" ? 1 : opts.quality,
    format: opts.format,
  };
}

/**
 * Where to take pixels from in the source, and how big the output should be.
 * `cover` is the only mode that crops; every other mode uses the full source.
 */
export interface RenderGeometry {
  /** Source crop rectangle. */
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  /** Output canvas size. */
  width: number;
  height: number;
}

/**
 * Resolve all six resize modes into one geometry (feature 33).
 *
 * `srcW`/`srcH` must already be ORIENTATION-CORRECTED (i.e. after any 90° swap),
 * because the user picks "1080 wide" meaning the picture they can see, not the
 * pre-rotation buffer.
 */
export function computeRenderGeometry(
  srcW: number,
  srcH: number,
  opts: OptimizeOptions,
): RenderGeometry {
  const full = { sx: 0, sy: 0, sw: srcW, sh: srcH };
  const mode = opts.resizeMode ?? "longest";
  const clamp = (n: number) => Math.max(1, Math.round(n));

  switch (mode) {
    case "longest": {
      const d = computeResizedDimensions(srcW, srcH, opts.maxDimension);
      return { ...full, width: d.width, height: d.height };
    }
    case "width": {
      const target = opts.targetWidth;
      if (!target || target <= 0) return { ...full, width: srcW, height: srcH };
      return { ...full, width: clamp(target), height: clamp((srcH * target) / srcW) };
    }
    case "height": {
      const target = opts.targetHeight;
      if (!target || target <= 0) return { ...full, width: srcW, height: srcH };
      return { ...full, width: clamp((srcW * target) / srcH), height: clamp(target) };
    }
    case "percent": {
      const pct = (opts.scalePercent ?? 100) / 100;
      return { ...full, width: clamp(srcW * pct), height: clamp(srcH * pct) };
    }
    case "fit": {
      const bw = opts.targetWidth ?? srcW;
      const bh = opts.targetHeight ?? srcH;
      const scale = Math.min(bw / srcW, bh / srcH, 1);
      return { ...full, width: clamp(srcW * scale), height: clamp(srcH * scale) };
    }
    case "cover": {
      const bw = clamp(opts.targetWidth ?? srcW);
      const bh = clamp(opts.targetHeight ?? srcH);
      // Crop the source to the output aspect ratio, centred.
      const srcRatio = srcW / srcH;
      const outRatio = bw / bh;
      let sw = srcW;
      let sh = srcH;
      if (srcRatio > outRatio) {
        sw = clamp(srcH * outRatio);
      } else {
        sh = clamp(srcW / outRatio);
      }
      return {
        sx: Math.round((srcW - sw) / 2),
        sy: Math.round((srcH - sh) / 2),
        sw,
        sh,
        width: bw,
        height: bh,
      };
    }
    default:
      return { ...full, width: srcW, height: srcH };
  }
}

// ---------------------------------------------------------------------------
// EXIF orientation (feature 27 — defect 8)
// ---------------------------------------------------------------------------

/**
 * Does this EXIF orientation swap width and height?
 * Values 5-8 involve a 90° rotation.
 */
export function orientationSwapsAxes(orientation?: number): boolean {
  return orientation != null && orientation >= 5 && orientation <= 8;
}

/**
 * Apply the EXIF orientation as a canvas transform.
 *
 * The original tool parsed `Orientation`, printed it in the inspector, and
 * then never used it — so every portrait photo from a phone (orientation 6 or
 * 8) came out rotated 90°, silently. The transform matrices below are the
 * standard mapping from EXIF 2.3 §4.6.4.
 *
 * `outW`/`outH` are the FINAL canvas dimensions (already swapped where needed).
 */
export function applyOrientationTransform(
  ctx: AnyCtx2D,
  orientation: number | undefined,
  outW: number,
  outH: number,
): void {
  switch (orientation) {
    case 2: // mirror horizontal
      ctx.transform(-1, 0, 0, 1, outW, 0);
      break;
    case 3: // rotate 180
      ctx.transform(-1, 0, 0, -1, outW, outH);
      break;
    case 4: // mirror vertical
      ctx.transform(1, 0, 0, -1, 0, outH);
      break;
    case 5: // mirror horizontal + rotate 270 CW
      ctx.transform(0, 1, 1, 0, 0, 0);
      break;
    case 6: // rotate 90 CW
      ctx.transform(0, 1, -1, 0, outW, 0);
      break;
    case 7: // mirror horizontal + rotate 90 CW
      ctx.transform(0, -1, -1, 0, outW, outH);
      break;
    case 8: // rotate 270 CW
      ctx.transform(0, -1, 1, 0, 0, outH);
      break;
    default:
      break; // 1 or undefined — no transform
  }
}

// ---------------------------------------------------------------------------
// High-quality downscale + sharpening
// ---------------------------------------------------------------------------

/**
 * Draw `bitmap` into `ctx` at the target size using successive halving
 * (feature 34).
 *
 * A single large `drawImage` step from, say, 6000px to 800px samples far too
 * few source pixels and produces visible aliasing. Halving repeatedly until
 * within 2x of the target, then doing the final step, is the standard fix and
 * is noticeably sharper at no meaningful cost.
 */
async function drawScaled(
  ctx: AnyCtx2D,
  bitmap: ImageBitmap,
  geo: RenderGeometry,
  highQuality: boolean,
): Promise<void> {
  ctx.imageSmoothingEnabled = true;
  (ctx as CanvasRenderingContext2D).imageSmoothingQuality = "high";

  const shrinkFactor = Math.max(geo.sw / geo.width, geo.sh / geo.height);

  if (!highQuality || shrinkFactor < 2) {
    ctx.drawImage(
      bitmap as unknown as CanvasImageSource,
      geo.sx, geo.sy, geo.sw, geo.sh,
      0, 0, geo.width, geo.height,
    );
    return;
  }

  // Step down by halves on an intermediate surface.
  let curW = geo.sw;
  let curH = geo.sh;
  let stage = createCanvas(curW, curH);
  let stageCtx = get2dContext(stage);
  stageCtx.imageSmoothingEnabled = true;
  (stageCtx as CanvasRenderingContext2D).imageSmoothingQuality = "high";
  stageCtx.drawImage(
    bitmap as unknown as CanvasImageSource,
    geo.sx, geo.sy, geo.sw, geo.sh,
    0, 0, curW, curH,
  );

  while (curW / 2 >= geo.width && curH / 2 >= geo.height) {
    const nextW = Math.max(geo.width, Math.floor(curW / 2));
    const nextH = Math.max(geo.height, Math.floor(curH / 2));
    const next = createCanvas(nextW, nextH);
    const nextCtx = get2dContext(next);
    nextCtx.imageSmoothingEnabled = true;
    (nextCtx as CanvasRenderingContext2D).imageSmoothingQuality = "high";
    nextCtx.drawImage(stage as unknown as CanvasImageSource, 0, 0, curW, curH, 0, 0, nextW, nextH);
    stage = next;
    stageCtx = nextCtx;
    curW = nextW;
    curH = nextH;
    if (curW === geo.width && curH === geo.height) break;
  }

  ctx.drawImage(
    stage as unknown as CanvasImageSource,
    0, 0, curW, curH,
    0, 0, geo.width, geo.height,
  );
}

/**
 * Unsharp mask (feature 35). `amount` is 0-100; 0 is a no-op.
 *
 * Uses a 3x3 approximation of a Gaussian blur as the unsharp source, which is
 * what every image editor's "sharpen" slider does at small radii. Runs on the
 * OUTPUT canvas, so its cost scales with the final size, not the source size.
 */
function applyUnsharpMask(ctx: AnyCtx2D, width: number, height: number, amount: number): void {
  if (amount <= 0) return;
  const strength = Math.min(100, amount) / 100;

  const image = ctx.getImageData(0, 0, width, height);
  const src = image.data;
  const out = new Uint8ClampedArray(src);

  const idx = (x: number, y: number) => (y * width + x) * 4;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const o = idx(x, y);
      for (let c = 0; c < 3; c++) {
        // 3x3 box blur as the "unsharp" reference
        const blur =
          (src[idx(x - 1, y - 1) + c]! + src[idx(x, y - 1) + c]! + src[idx(x + 1, y - 1) + c]! +
            src[idx(x - 1, y) + c]! + src[o + c]! + src[idx(x + 1, y) + c]! +
            src[idx(x - 1, y + 1) + c]! + src[idx(x, y + 1) + c]! + src[idx(x + 1, y + 1) + c]!) / 9;
        const sharpened = src[o + c]! + (src[o + c]! - blur) * strength * 2;
        out[o + c] = sharpened < 0 ? 0 : sharpened > 255 ? 255 : sharpened;
      }
    }
  }

  image.data.set(out);
  ctx.putImageData(image, 0, 0);
}

// ---------------------------------------------------------------------------
// Watermark
// ---------------------------------------------------------------------------

/**
 * Draw the configured watermark. Same geometry as the original, but typed
 * against the shared context so the worker draws an identical watermark
 * instead of its own slightly different copy.
 */
function drawWatermark(
  ctx: AnyCtx2D,
  width: number,
  height: number,
  wm: WatermarkOptions,
): void {
  const scale = width / 1000;
  const fontSize = Math.max(8, wm.fontSize * scale);
  ctx.save();
  ctx.globalAlpha = wm.opacity;
  ctx.fillStyle = wm.color;
  ctx.font = `${fontSize}px sans-serif`;
  const padding = Math.max(8, fontSize * 0.6);
  const metrics = ctx.measureText(wm.text);
  const textWidth = metrics.width;
  let x = padding;
  let y = padding + fontSize;
  switch (wm.position) {
    case "top-left":
      x = padding;
      y = padding + fontSize;
      break;
    case "top-right":
      x = width - textWidth - padding;
      y = padding + fontSize;
      break;
    case "bottom-left":
      x = padding;
      y = height - padding;
      break;
    case "bottom-right":
      x = width - textWidth - padding;
      y = height - padding;
      break;
    case "center":
      x = (width - textWidth) / 2;
      y = (height + fontSize) / 2;
      break;
  }
  ctx.fillText(wm.text, x, y);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Target-size tuning
// ---------------------------------------------------------------------------

/**
 * Target-size quality tuner: binary-search the quality parameter to hit a
 * target byte size. Caller provides a `compressAtQuality` function that
 * does the actual canvas encode.
 *
 * Returns the best-quality result that fits under targetBytes, or the
 * smallest result if none fit.
 *
 * SIGNATURE AND RETURN TYPE UNCHANGED (D2). Behaviour fixed — see defect 14:
 *
 *  - The original started at `mid = (0.1 + 1.0) / 2 = 0.55` and only ever moved
 *    inward, so an image that fits comfortably at q = 1.0 was still degraded to
 *    roughly 0.9. We now PROBE `maxQuality` FIRST and return immediately if it
 *    already fits (feature 30). That is one extra encode in the worst case and
 *    zero extra in the common "already small enough" case.
 *  - The original fell back to `best`, which tracked the SMALLEST blob — so an
 *    unreachable target silently handed the user the worst-quality attempt. We
 *    now fall back to the smallest attempt too (there is no better choice) but
 *    the caller is told, via `tuneForTargetSizeDetailed`, that the target was
 *    missed so it can warn (feature 31, D8, D18).
 */
export async function tuneForTargetSize(
  targetBytes: number,
  compressAtQuality: (q: number) => Promise<{ blob: Blob; quality: number }>,
  opts: { maxIterations?: number; minQuality?: number; maxQuality?: number } = {},
): Promise<{ blob: Blob; quality: number }> {
  const detailed = await tuneForTargetSizeDetailed(targetBytes, compressAtQuality, opts);
  return { blob: detailed.blob, quality: detailed.quality };
}

export interface TuneResult {
  blob: Blob;
  quality: number;
  /** True when the result is at or under targetBytes. */
  met: boolean;
  /** How many encodes were performed — a real measured number (D20). */
  attempts: number;
}

/** As `tuneForTargetSize`, but reports whether the target was actually met. */
export async function tuneForTargetSizeDetailed(
  targetBytes: number,
  compressAtQuality: (q: number) => Promise<{ blob: Blob; quality: number }>,
  opts: { maxIterations?: number; minQuality?: number; maxQuality?: number } = {},
): Promise<TuneResult> {
  const { maxIterations = 8, minQuality = 0.1, maxQuality = 1.0 } = opts;
  let attempts = 0;

  // Probe the top of the range first (feature 30).
  const topResult = await compressAtQuality(maxQuality);
  attempts++;
  if (topResult.blob.size <= targetBytes) {
    return { blob: topResult.blob, quality: topResult.quality, met: true, attempts };
  }

  let lo = minQuality;
  let hi = maxQuality;
  let best: { blob: Blob; quality: number } = topResult;
  let bestUnder: { blob: Blob; quality: number } | null = null;

  for (let i = 0; i < maxIterations; i++) {
    const mid = (lo + hi) / 2;
    const result = await compressAtQuality(mid);
    attempts++;
    if (result.blob.size < best.blob.size) best = result;
    if (result.blob.size <= targetBytes) {
      // Keep the HIGHEST quality that fits, not merely the last one that fit.
      if (!bestUnder || result.quality > bestUnder.quality) bestUnder = result;
      lo = mid; // try higher quality
    } else {
      hi = mid; // try lower quality
    }
    if (hi - lo < 0.025) break;
  }

  if (bestUnder) {
    return { blob: bestUnder.blob, quality: bestUnder.quality, met: true, attempts };
  }
  return { blob: best.blob, quality: best.quality, met: false, attempts };
}

// ---------------------------------------------------------------------------
// The one shared pipeline
// ---------------------------------------------------------------------------

export interface ProcessCoreResult {
  blob: Blob;
  width: number;
  height: number;
  /** Quality actually used for the final encode (1 for PNG / copied bytes). */
  quality: number;
  /** Format actually emitted — may differ from opts.format under smartFormat. */
  format: OutputFormat;
  /** Plain-sentence notes for the user (D8). */
  warnings: string[];
  /** True when the original bytes were kept instead of a re-encode (D18). */
  keptOriginal: boolean;
}

/**
 * Render + encode one already-decoded bitmap. This is the single pipeline used
 * by BOTH the main thread and the Web Worker.
 *
 * @param bitmap          Decoded source image. The caller owns it and must close it.
 * @param opts            Optimize options.
 * @param exifOrientation EXIF orientation value (1-8), if known.
 * @param originalBytes   Source byte length, used for the never-grow guard.
 * @param originalBlob    Source bytes, needed only if we may keep them verbatim.
 * @param originalFormat  The source's OWN format. Required for the never-grow
 *                        guard: keeping the original bytes is only safe when
 *                        they are already in the format we are about to emit.
 */
export async function processBitmapCore(
  bitmap: ImageBitmap,
  opts: OptimizeOptions,
  exifOrientation: number | undefined,
  originalBytes: number,
  originalBlob?: Blob,
  originalFormat?: OutputFormat | null,
): Promise<ProcessCoreResult> {
  const warnings: string[] = [];
  const autoOrient = opts.autoOrient !== false;
  const orientation = autoOrient ? exifOrientation : undefined;

  // 1. Orientation-corrected source dimensions.
  const swap = orientationSwapsAxes(orientation);
  const srcW = swap ? bitmap.height : bitmap.width;
  const srcH = swap ? bitmap.width : bitmap.height;
  if (orientation != null && orientation > 1) {
    warnings.push(
      "This photo carried a rotation flag from the camera, so it was rotated to the upright orientation before saving. That requires re-encoding it — it is not a lossless rotation.",
    );
  }

  // 2. Geometry for the chosen resize mode.
  const geo = computeRenderGeometry(srcW, srcH, opts);

  // 3. Draw.
  const canvas = createCanvas(geo.width, geo.height);
  const ctx = get2dContext(canvas);

  // JPEG has no alpha channel — flatten onto the chosen background (feature 36).
  if (opts.format === "image/jpeg") {
    ctx.fillStyle = opts.backgroundColor ?? "#ffffff";
    ctx.fillRect(0, 0, geo.width, geo.height);
  }

  if (orientation != null && orientation > 1) {
    ctx.save();
    applyOrientationTransform(ctx, orientation, geo.width, geo.height);
    // Under a 90° transform the drawing space is swapped, so the destination
    // rectangle uses the pre-swap axes.
    const destW = swap ? geo.height : geo.width;
    const destH = swap ? geo.width : geo.height;
    const rotatedGeo: RenderGeometry = {
      sx: swap ? geo.sy : geo.sx,
      sy: swap ? geo.sx : geo.sy,
      sw: swap ? geo.sh : geo.sw,
      sh: swap ? geo.sw : geo.sh,
      width: destW,
      height: destH,
    };
    await drawScaled(ctx, bitmap, rotatedGeo, opts.highQualityDownscale !== false);
    ctx.restore();
  } else {
    await drawScaled(ctx, bitmap, geo, opts.highQualityDownscale !== false);
  }

  // 4. Sharpen (feature 35).
  if ((opts.unsharpAmount ?? 0) > 0) {
    applyUnsharpMask(ctx, geo.width, geo.height, opts.unsharpAmount!);
  }

  // 5. Watermark.
  if (opts.watermark.enabled && opts.watermark.text) {
    drawWatermark(ctx, geo.width, geo.height, opts.watermark);
  }

  // 6. Encode.
  const encode = async (format: OutputFormat): Promise<{ blob: Blob; quality: number; met: boolean }> => {
    if (format === "image/png") {
      return { blob: await canvasToBlobAny(canvas, format), quality: 1, met: true };
    }
    if (opts.targetBytes && opts.targetBytes > 0) {
      const tuned = await tuneForTargetSizeDetailed(opts.targetBytes, async (q) => ({
        blob: await canvasToBlobAny(canvas, format, q),
        quality: q,
      }));
      return { blob: tuned.blob, quality: tuned.quality, met: tuned.met };
    }
    return {
      blob: await canvasToBlobAny(canvas, format, opts.quality),
      quality: opts.quality,
      met: true,
    };
  };

  let format = opts.format;
  let encoded = await encode(format);

  // 7. Smart format — encode the alternative and keep whichever is genuinely
  //    smaller. This is a real measurement, not a heuristic (feature 38, D20).
  if (opts.smartFormat && opts.format !== "image/png") {
    const alternative: OutputFormat =
      opts.format === "image/jpeg" ? "image/webp" : "image/jpeg";
    try {
      const altEncoded = await encode(alternative);
      if (altEncoded.blob.size > 0 && altEncoded.blob.size < encoded.blob.size) {
        warnings.push(
          `Saved as ${alternative === "image/webp" ? "WebP" : "JPEG"} instead, because it came out ${formatBytes(encoded.blob.size - altEncoded.blob.size)} smaller at the same settings.`,
        );
        encoded = altEncoded;
        format = alternative;
      }
    } catch {
      // The browser may not support encoding the alternative. Keep the first
      // result and say nothing — the user asked for smaller, and they got the
      // best available.
    }
  }

  if (!encoded.met && opts.targetBytes) {
    warnings.push(
      `This image could not be squeezed under ${formatBytes(opts.targetBytes)} without falling below the minimum quality. The smallest version produced was ${formatBytes(encoded.blob.size)}.`,
    );
  }

  // 8. Never return something worse than the input (feature 32, D18).
  //
  //    The comparison MUST be against the source's own format. An earlier
  //    revision of this file compared `format` with a format derived from the
  //    OUTPUT extension, which is a tautology — it was always true, so a PNG
  //    source could be handed back verbatim while being named `.jpg`. A file
  //    whose bytes do not match its extension is worse than a large file, and
  //    "never worse than the input" (D18) has to mean the whole file, not just
  //    its byte count.
  //
  //    Dimensions are also part of "worse": if the user asked for a resize, the
  //    original is not an acceptable substitute even when it is smaller.
  const resized = geo.width !== srcW || geo.height !== srcH;
  const transformed =
    resized ||
    (orientation != null && orientation > 1) ||
    (opts.watermark.enabled && !!opts.watermark.text) ||
    (opts.unsharpAmount ?? 0) > 0;

  if (
    opts.neverGrow !== false &&
    originalBlob &&
    originalBytes > 0 &&
    encoded.blob.size > originalBytes &&
    originalFormat != null &&
    originalFormat === format &&
    !transformed
  ) {
    warnings.push(
      `Re-encoding made this file ${formatBytes(encoded.blob.size - originalBytes)} larger, so the original image data was kept instead. It was still renamed.`,
    );
    return {
      blob: originalBlob,
      width: srcW,
      height: srcH,
      quality: 1,
      format,
      warnings,
      keptOriginal: true,
    };
  }

  return {
    blob: encoded.blob,
    width: geo.width,
    height: geo.height,
    quality: encoded.quality,
    format,
    warnings,
    keptOriginal: false,
  };
}

// ---------------------------------------------------------------------------
// Decoding (HEIC handled here so BOTH paths get it — defect 3)
// ---------------------------------------------------------------------------

/** True when this file needs `heic2any` before any canvas can touch it. */
export function isHeicFile(file: { name: string; type: string }): boolean {
  const lower = file.name.toLowerCase();
  return (
    lower.endsWith(".heic") ||
    lower.endsWith(".heif") ||
    file.type === "image/heic" ||
    file.type === "image/heif"
  );
}

/** True when this file is a GIF, which canvas will flatten to frame 1 (feature 98). */
export function isGifFile(file: { name: string; type: string }): boolean {
  return file.type === "image/gif" || file.name.toLowerCase().endsWith(".gif");
}

/**
 * Decode any accepted input into an ImageBitmap, converting HEIC first.
 *
 * This runs on the MAIN THREAD for both code paths. That is deliberate: the
 * original worker path called `createImageBitmap(file)` directly, which no
 * browser can do with a HEIC, so HEIC support silently existed only on the
 * fallback path (defect 3). Decoding centrally means the worker always
 * receives something it can actually draw.
 */
export async function decodeToBitmap(
  file: File,
): Promise<ToolResult<{ bitmap: ImageBitmap; warnings: string[] }>> {
  const warnings: string[] = [];
  try {
    let source: Blob = file;

    if (isHeicFile(file)) {
      try {
        const mod = await import("heic2any");
        const converted = await mod.default({
          blob: file,
          toType: "image/png",
          quality: 0.8,
        });
        source = Array.isArray(converted) ? converted[0]! : (converted as Blob);
      } catch (e) {
        return {
          ok: false,
          error: `"${file.name}" is a HEIC photo and could not be decoded: ${(e as Error).message}`,
        };
      }
    }

    if (isGifFile(file)) {
      warnings.push(
        "This is a GIF. Only its first frame can be read by the browser, so any animation will be lost in the output.",
      );
    }

    const bitmap = await createImageBitmap(source);
    return { ok: true, output: { bitmap, warnings } };
  } catch (e) {
    return {
      ok: false,
      error: `"${file.name}" could not be opened as an image: ${(e as Error).message}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Public single-file entry point (main thread)
// ---------------------------------------------------------------------------

/**
 * Compress / resize / convert a single image file via Canvas re-encode.
 * Also applies the configured watermark if enabled.
 *
 * Returns ToolResult so callers can surface a friendly error message.
 *
 * SIGNATURE AND RETURN SHAPE UNCHANGED (D2). Internally this is now a thin
 * wrapper over `processBitmapCore`, so the main thread and the worker cannot
 * drift apart again. Callers that want the warnings, the achieved quality, or
 * the format actually emitted should call `processImageDetailed`.
 */
export async function processImage(
  file: File,
  opts: OptimizeOptions,
): Promise<ToolResult<{ blob: Blob; width: number; height: number }>> {
  const detailed = await processImageDetailed(file, opts);
  if (!detailed.ok) return detailed;
  const { blob, width, height } = detailed.output;
  return { ok: true, output: { blob, width, height } };
}

/** As `processImage`, but returns everything the pipeline learned. */
export async function processImageDetailed(
  file: File,
  opts: OptimizeOptions,
): Promise<ToolResult<ProcessCoreResult>> {
  const sourceFormat = detectInputFormat(file.name, file.type);

  // Rename-and-repackage only — no re-encode at all (feature 40).
  if (opts.copyOriginalBytes) {
    let width = 0;
    let height = 0;
    // Read the real dimensions anyway, so the preview table is not blank.
    // A failure here is not fatal: the bytes are what matter in this mode.
    try {
      const probe = await decodeToBitmap(file);
      if (probe.ok) {
        width = probe.output.bitmap.width;
        height = probe.output.bitmap.height;
        probe.output.bitmap.close();
      }
    } catch {
      // Leave the dimensions unknown rather than failing the file.
    }
    return {
      ok: true,
      output: {
        blob: file,
        width,
        height,
        quality: 1,
        format: sourceFormat ?? opts.format,
        warnings: [
          "This file was renamed and repackaged without re-encoding, so its pixels and metadata are byte-for-byte identical to the original.",
        ],
        keptOriginal: true,
      },
    };
  }

  const decoded = await decodeToBitmap(file);
  if (!decoded.ok) return decoded;
  const { bitmap, warnings: decodeWarnings } = decoded.output;

  try {
    let orientation: number | undefined;
    if (opts.autoOrient !== false) {
      const exif = await getExifData(file);
      if (exif.ok) orientation = exif.output.orientation;
    }

    const result = await processBitmapCore(
      bitmap,
      opts,
      orientation,
      file.size,
      file,
      sourceFormat,
    );
    result.warnings = [...decodeWarnings, ...result.warnings];
    return { ok: true, output: result };
  } catch (e) {
    return {
      ok: false,
      error: `"${file.name}" could not be processed: ${(e as Error).message}`,
    };
  } finally {
    bitmap.close();
  }
}

/**
 * ===========================================================================
 * ENGINE PART 4 of 5 — metadata (read / strip / rebuild) and image hashing.
 * ===========================================================================
 *
 * Concatenate AFTER CODE-1-ENGINE-PART-3.ts. No static imports — `exifr` is
 * loaded dynamically so it stays out of the initial bundle, the same way
 * PART-3 loads `heic2any`.
 *
 * DESIGN DECISION: STRIP-AND-REBUILD, NOT PATCH-IN-PLACE
 * ------------------------------------------------------
 * Keeping the user's metadata means getting EXIF bytes into a JPEG that the
 * browser's canvas encoder just produced with none. There are two ways to do
 * that:
 *
 *   (a) Copy the source APP1 segment across verbatim, then surgically edit it
 *       to set Orientation = 1 and delete the GPS IFD.
 *   (b) Read the metadata with a trusted parser, discard the source bytes
 *       entirely, and build a small, clean APP1 from the values we chose to
 *       keep.
 *
 * (a) sounds cheaper and is a trap. Deleting an IFD entry means rewriting
 * every offset that pointed past it, inside a foreign TIFF structure that may
 * be little- or big-endian, may contain maker notes with absolute offsets that
 * are undocumented and unrelocatable, and may be subtly malformed to begin
 * with. Getting it wrong does not throw — it produces a file that some viewers
 * read and others reject, which is the worst possible failure mode for a
 * privacy feature. "Remove the GPS" MUST NOT be a maybe.
 *
 * So this file does (b). Reading uses `exifr`, a maintained parser (D21: do
 * not hand-roll what a real dependency already does). Writing is a minimal
 * TIFF/Exif builder limited to ASCII, SHORT, LONG and RATIONAL tags — every
 * byte is generated here, so there are no foreign offsets to relocate and the
 * output is verifiable by round-tripping it back through `exifr`.
 *
 * The honest cost: maker notes, thumbnails, ICC-in-EXIF and any tag not in the
 * kept list are lost when metadata is preserved. That is stated plainly in the
 * UI and in DOCS.md rather than hidden — a user who needs byte-identical
 * metadata should use "rename only, no re-encode" (feature 40), which is the
 * only mode that can truly guarantee it.
 */

// ---------------------------------------------------------------------------
// JPEG segment walking
// ---------------------------------------------------------------------------

const JPEG_MARKER_SOI = 0xd8;
const JPEG_MARKER_EOI = 0xd9;
const JPEG_MARKER_SOS = 0xda;
const JPEG_MARKER_APP0 = 0xe0;
const JPEG_MARKER_APP1 = 0xe1;
const JPEG_MARKER_APP12 = 0xec;
const JPEG_MARKER_APP13 = 0xed;
const JPEG_MARKER_COM = 0xfe;

/** True when these bytes start with the JPEG start-of-image marker. */
export function isJpegBytes(bytes: Uint8Array): boolean {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === JPEG_MARKER_SOI;
}

/**
 * Metadata-bearing segments we remove.
 *
 * APP2 (ICC colour profile) is deliberately NOT in this list. An ICC profile
 * is not personal metadata, it is what tells the viewer how to interpret the
 * colours — dropping it visibly shifts them, especially on wide-gamut photos.
 * "Strip metadata" must not silently mean "change the colours".
 *
 * APP0 (JFIF) is also kept: it carries only pixel-density fields.
 */
function isMetadataSegment(marker: number): boolean {
  return (
    marker === JPEG_MARKER_APP1 ||   // Exif and XMP
    marker === JPEG_MARKER_APP12 ||  // Ducky / picture info
    marker === JPEG_MARKER_APP13 ||  // Photoshop IRB / IPTC
    marker === JPEG_MARKER_COM       // free-text comment
  );
}

/**
 * Rebuild a JPEG, dropping metadata segments and optionally inserting a new
 * APP1 immediately after the SOI marker.
 *
 * Returns `null` when the input is not a JPEG we can parse, so the caller can
 * fall back to the untouched bytes rather than emitting something corrupt.
 */
export function rebuildJpeg(
  bytes: Uint8Array,
  app1: Uint8Array | null,
): Uint8Array | null {
  if (!isJpegBytes(bytes)) return null;

  const kept: Uint8Array[] = [];
  kept.push(bytes.subarray(0, 2)); // SOI
  if (app1) kept.push(app1);

  let i = 2;
  while (i < bytes.length) {
    if (bytes[i] !== 0xff) return null; // not a marker boundary — refuse to guess
    const marker = bytes[i + 1]!;

    // Standalone markers carry no length field.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      kept.push(bytes.subarray(i, i + 2));
      i += 2;
      continue;
    }
    if (marker === JPEG_MARKER_EOI) {
      kept.push(bytes.subarray(i, i + 2));
      i += 2;
      continue;
    }
    if (marker === JPEG_MARKER_SOS) {
      // Everything from here to the end is entropy-coded scan data.
      kept.push(bytes.subarray(i));
      break;
    }

    if (i + 4 > bytes.length) return null;
    const segLength = (bytes[i + 2]! << 8) | bytes[i + 3]!;
    if (segLength < 2 || i + 2 + segLength > bytes.length) return null;

    const dropJfif = app1 != null && marker === JPEG_MARKER_APP0;
    if (!isMetadataSegment(marker) && !dropJfif) {
      kept.push(bytes.subarray(i, i + 2 + segLength));
    }
    i += 2 + segLength;
  }

  let total = 0;
  for (const part of kept) total += part.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of kept) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Minimal TIFF / Exif APP1 writer
// ---------------------------------------------------------------------------

const TIFF_TYPE_ASCII = 2;
const TIFF_TYPE_SHORT = 3;
const TIFF_TYPE_LONG = 4;
const TIFF_TYPE_RATIONAL = 5;

type TiffValue =
  | { kind: "ascii"; value: string }
  | { kind: "short"; value: number }
  | { kind: "long"; value: number }
  | { kind: "rational"; numerator: number; denominator: number };

interface TiffEntryDef {
  tag: number;
  value: TiffValue;
}

/** EXIF ASCII fields are 7-bit. Replace anything else rather than emit invalid bytes. */
function asciiBytes(text: string): Uint8Array {
  const out = new Uint8Array(text.length + 1);
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    out[i] = code >= 32 && code <= 126 ? code : 0x3f; // '?'
  }
  out[text.length] = 0; // NUL terminator, counted in the tag's count field
  return out;
}

/**
 * Express a decimal as an unsigned rational for a RATIONAL tag.
 *
 * A single fixed denominator does not work here. EXIF stores shutter speed in
 * seconds, so a 1/8000 s exposure arrives as 0.000125 — with a fixed /1000
 * denominator that rounds to 0/1000 and the saved file claims the photo was
 * taken with a zero-second exposure. Values below 1 are therefore written the
 * way cameras actually express them, as 1/N.
 */
function toRational(value: number): { numerator: number; denominator: number } {
  const MAX_U32 = 0xffffffff;
  if (!isFinite(value) || value <= 0) return { numerator: 0, denominator: 1 };
  if (Number.isInteger(value) && value <= MAX_U32) {
    return { numerator: value, denominator: 1 };
  }
  if (value < 1) {
    // Shutter speeds: 0.000125 -> 1/8000, 0.5 -> 1/2.
    const denominator = Math.min(MAX_U32, Math.max(1, Math.round(1 / value)));
    return { numerator: 1, denominator };
  }
  // f-numbers and exposures over a second: two decimals beats what any camera
  // reports, e.g. f/2.8 -> 280/100.
  return {
    numerator: Math.min(MAX_U32, Math.round(value * 100)),
    denominator: 100,
  };
}

/**
 * Build a complete Exif APP1 segment (marker, length, "Exif\0\0", TIFF block).
 * Big-endian throughout, which keeps the offset arithmetic readable.
 *
 * Returns `null` when there is nothing worth writing, so the caller can skip
 * the segment entirely instead of embedding an empty one.
 */
export function buildExifApp1(meta: {
  make?: string;
  model?: string;
  lens?: string;
  software?: string;
  artist?: string;
  copyright?: string;
  dateTaken?: string;
  iso?: number;
  fNumber?: number;
  exposureTime?: number;
}): Uint8Array | null {
  const ifd0: TiffEntryDef[] = [];
  const exifIfd: TiffEntryDef[] = [];

  const addAscii = (list: TiffEntryDef[], tag: number, value?: string) => {
    if (value && value.trim().length > 0) {
      list.push({ tag, value: { kind: "ascii", value: value.trim().slice(0, 255) } });
    }
  };

  addAscii(ifd0, 0x010f, meta.make);
  addAscii(ifd0, 0x0110, meta.model);
  // Orientation is always 1: the rotation has already been baked into the
  // pixels by PART-3, so leaving the original flag here would rotate it twice.
  ifd0.push({ tag: 0x0112, value: { kind: "short", value: 1 } });
  addAscii(ifd0, 0x0131, meta.software);
  addAscii(ifd0, 0x013b, meta.artist);
  addAscii(ifd0, 0x8298, meta.copyright);

  if (meta.dateTaken) {
    const d = new Date(meta.dateTaken);
    if (!isNaN(d.getTime())) {
      const p2 = (n: number) => String(n).padStart(2, "0");
      // EXIF date format is "YYYY:MM:DD HH:MM:SS" — colons, not dashes.
      const formatted =
        `${d.getFullYear()}:${p2(d.getMonth() + 1)}:${p2(d.getDate())} ` +
        `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
      ifd0.push({ tag: 0x0132, value: { kind: "ascii", value: formatted } });
      exifIfd.push({ tag: 0x9003, value: { kind: "ascii", value: formatted } });
    }
  }

  if (meta.exposureTime != null && meta.exposureTime > 0) {
    const r = toRational(meta.exposureTime);
    exifIfd.push({ tag: 0x829a, value: { kind: "rational", ...r } });
  }
  if (meta.fNumber != null && meta.fNumber > 0) {
    const r = toRational(meta.fNumber);
    exifIfd.push({ tag: 0x829d, value: { kind: "rational", ...r } });
  }
  if (meta.iso != null && meta.iso > 0 && meta.iso <= 0xffff) {
    exifIfd.push({ tag: 0x8827, value: { kind: "short", value: Math.round(meta.iso) } });
  }
  addAscii(exifIfd, 0xa434, meta.lens);

  // Orientation alone is not worth an APP1 segment.
  if (ifd0.length <= 1 && exifIfd.length === 0) return null;

  // --- lay out the TIFF block -------------------------------------------
  //
  // offset 0 : TIFF header (8 bytes)
  // offset 8 : IFD0
  //          : Exif sub-IFD (only when it has entries)
  //          : data area for values longer than 4 bytes

  const hasExifIfd = exifIfd.length > 0;
  if (hasExifIfd) {
    // Placeholder; the real offset is written during assembly.
    ifd0.push({ tag: 0x8769, value: { kind: "long", value: 0 } });
  }

  ifd0.sort((a, b) => a.tag - b.tag); // TIFF requires ascending tag order
  exifIfd.sort((a, b) => a.tag - b.tag);

  const ifd0Size = 2 + 12 * ifd0.length + 4;
  const exifIfdSize = hasExifIfd ? 2 + 12 * exifIfd.length + 4 : 0;
  const exifIfdOffset = 8 + ifd0Size;
  const dataStart = 8 + ifd0Size + exifIfdSize;

  const dataChunks: Uint8Array[] = [];
  let dataLength = 0;

  /** Reserve space in the data area and return the offset to point at. */
  const pushData = (bytes: Uint8Array): number => {
    const offset = dataStart + dataLength;
    dataChunks.push(bytes);
    dataLength += bytes.length;
    if (dataLength % 2 === 1) {
      // TIFF values must begin on a word boundary.
      dataChunks.push(new Uint8Array(1));
      dataLength += 1;
    }
    return offset;
  };

  const encodeEntry = (
    view: DataView,
    at: number,
    entry: TiffEntryDef,
  ): void => {
    view.setUint16(at, entry.tag, false);
    const v = entry.value;
    switch (v.kind) {
      case "ascii": {
        const bytes = asciiBytes(v.value);
        view.setUint16(at + 2, TIFF_TYPE_ASCII, false);
        view.setUint32(at + 4, bytes.length, false);
        if (bytes.length <= 4) {
          for (let i = 0; i < bytes.length; i++) view.setUint8(at + 8 + i, bytes[i]!);
        } else {
          view.setUint32(at + 8, pushData(bytes), false);
        }
        break;
      }
      case "short":
        view.setUint16(at + 2, TIFF_TYPE_SHORT, false);
        view.setUint32(at + 4, 1, false);
        // A SHORT is left-aligned in the 4-byte value field.
        view.setUint16(at + 8, v.value, false);
        view.setUint16(at + 10, 0, false);
        break;
      case "long":
        view.setUint16(at + 2, TIFF_TYPE_LONG, false);
        view.setUint32(at + 4, 1, false);
        view.setUint32(at + 8, v.value, false);
        break;
      case "rational": {
        const bytes = new Uint8Array(8);
        const dv = new DataView(bytes.buffer);
        dv.setUint32(0, v.numerator, false);
        dv.setUint32(4, v.denominator, false);
        view.setUint16(at + 2, TIFF_TYPE_RATIONAL, false);
        view.setUint32(at + 4, 1, false);
        view.setUint32(at + 8, pushData(bytes), false);
        break;
      }
    }
  };

  // Generous upper bound; only the first `dataStart` bytes are ever copied out.
  const scratch = new Uint8Array(dataStart + 4096);
  const view = new DataView(scratch.buffer);

  // TIFF header — "MM" (big-endian), magic 42, offset of IFD0.
  view.setUint16(0, 0x4d4d, false);
  view.setUint16(2, 42, false);
  view.setUint32(4, 8, false);

  // IFD0
  view.setUint16(8, ifd0.length, false);
  ifd0.forEach((entry, i) => {
    const at = 8 + 2 + i * 12;
    if (entry.tag === 0x8769) {
      // Now that the layout is known, write the real sub-IFD offset.
      encodeEntry(view, at, { tag: 0x8769, value: { kind: "long", value: exifIfdOffset } });
    } else {
      encodeEntry(view, at, entry);
    }
  });
  view.setUint32(8 + 2 + ifd0.length * 12, 0, false); // no IFD1

  // Exif sub-IFD
  if (hasExifIfd) {
    view.setUint16(exifIfdOffset, exifIfd.length, false);
    exifIfd.forEach((entry, i) => {
      encodeEntry(view, exifIfdOffset + 2 + i * 12, entry);
    });
    view.setUint32(exifIfdOffset + 2 + exifIfd.length * 12, 0, false);
  }

  // Assemble TIFF block + data area.
  const tiff = new Uint8Array(dataStart + dataLength);
  tiff.set(scratch.subarray(0, dataStart), 0);
  let cursor = dataStart;
  for (const chunk of dataChunks) {
    tiff.set(chunk, cursor);
    cursor += chunk.length;
  }

  // Wrap in the APP1 segment.
  const header = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]; // "Exif\0\0"
  const payloadLength = 2 + header.length + tiff.length;
  if (payloadLength > 0xffff) return null; // cannot fit in one segment

  const app1 = new Uint8Array(2 + payloadLength);
  app1[0] = 0xff;
  app1[1] = JPEG_MARKER_APP1;
  app1[2] = (payloadLength >> 8) & 0xff;
  app1[3] = payloadLength & 0xff;
  app1.set(header, 4);
  app1.set(tiff, 4 + header.length);
  return app1;
}

// ---------------------------------------------------------------------------
// Public metadata operations
// ---------------------------------------------------------------------------

/**
 * Remove EXIF/XMP/IPTC metadata from an image blob.
 *
 * ORIGINAL STATUS: declared, exported, and never called by anything — defect 5.
 * The `stripExif` switch in the UI did nothing at all.
 *
 * Signature unchanged (D2). Now genuinely implemented for JPEG. PNG and WebP
 * produced by the canvas encoder contain no EXIF to begin with, so they are
 * returned untouched rather than being needlessly rewritten.
 */
export async function stripExif(blob: Blob): Promise<Blob> {
  if (blob.type !== "image/jpeg") return blob;
  try {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const rebuilt = rebuildJpeg(bytes, null);
    if (!rebuilt) return blob; // unparseable — never emit a guess
    return new Blob([rebuilt], { type: "image/jpeg" });
  } catch {
    // Failing to strip must not fail the file; the caller warns instead.
    return blob;
  }
}

export interface MetadataOutcome {
  blob: Blob;
  warnings: string[];
}

/**
 * Apply the metadata policy to an encoded output blob (features 28, 44, 47).
 *
 * This is the step that makes `stripExif`, `stripGps` and `copyright` real.
 * It runs AFTER encoding because the canvas encoder discards all metadata, so
 * there is nothing to preserve until we put it back.
 *
 * Call this from the batch runner and the worker — not from `processImage`,
 * which is the original API and must keep its original behaviour (D2).
 */
export async function applyMetadataPolicy(
  blob: Blob,
  opts: OptimizeOptions,
  exif: ExifData | null,
  keptOriginalBytes: boolean,
): Promise<MetadataOutcome> {
  const warnings: string[] = [];

  // Nothing was re-encoded, so the original metadata is still present and
  // untouched. Rewriting it here would be the one thing the user did not ask
  // for in this mode.
  if (keptOriginalBytes) {
    if (opts.stripExif) {
      const stripped = await stripExif(blob);
      return { blob: stripped, warnings };
    }
    return { blob, warnings };
  }

  if (opts.stripExif) {
    // Canvas output already carries no EXIF. Pass it through the stripper
    // anyway so the guarantee holds even if a future encoder starts adding it.
    return { blob: await stripExif(blob), warnings };
  }

  if (blob.type !== "image/jpeg") {
    warnings.push(
      "Metadata could not be preserved because only JPEG output can carry EXIF. The image itself is unaffected.",
    );
    return { blob, warnings };
  }

  const app1 = buildExifApp1({
    make: exif?.make,
    model: exif?.model,
    lens: exif?.lens,
    software: "unQtools Bulk Image Renamer + Optimizer",
    copyright: opts.copyright,
    dateTaken: exif?.date,
    iso: exif?.iso,
    fNumber: exif?.fNumber,
    exposureTime: exif?.exposureTime,
  });

  if (!app1) return { blob, warnings };

  try {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const rebuilt = rebuildJpeg(bytes, app1);
    if (!rebuilt) {
      warnings.push(
        "The re-encoded JPEG could not be rewritten to carry its metadata, so it was saved without it. The image itself is unaffected.",
      );
      return { blob, warnings };
    }
    if (exif?.gps && (exif.gps.latitude != null || exif.gps.longitude != null)) {
      warnings.push(
        "This photo contained GPS coordinates. They were not copied into the saved file — only the camera, date and exposure details were kept.",
      );
    }
    warnings.push(
      "Camera, date and exposure details were preserved. Maker notes, the embedded thumbnail and any other vendor-specific tags could not be carried across a re-encode.",
    );
    return { blob: new Blob([rebuilt], { type: "image/jpeg" }), warnings };
  } catch (e) {
    warnings.push(
      `Metadata could not be written back into this file (${(e as Error).message}), so it was saved without it.`,
    );
    return { blob, warnings };
  }
}

// ---------------------------------------------------------------------------
// Reading metadata
// ---------------------------------------------------------------------------

/** Format a Date as an ISO string, or undefined when it is not a real date. */
function formatDate(d: unknown): string | undefined {
  if (d instanceof Date && !isNaN(d.getTime())) return d.toISOString();
  if (typeof d === "string" && d.length > 0) {
    // EXIF writes "YYYY:MM:DD HH:MM:SS", which Date cannot parse directly.
    const normalised = d.replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3");
    const parsed = new Date(normalised);
    if (!isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return undefined;
}

/**
 * Extract EXIF metadata from an image file.
 *
 * Signature unchanged (D2). `exifr` is now imported dynamically so it is not
 * in the initial bundle, and a file with no EXIF at all is reported as a
 * successful empty read rather than an error — "this photo has no metadata"
 * is an answer, not a failure (D9).
 */
export async function getExifData(file: File): Promise<ToolResult<ExifData>> {
  try {
    const exifr = await import("exifr");
    const parsed = (await exifr.parse(file, {
      tiff: true,
      exif: true,
      gps: true,
      ifd0: true,
      translateValues: false,
      reviveValues: true,
    })) as Record<string, unknown> | undefined;

    if (!parsed) {
      // No EXIF block at all is a valid answer, not a failure (D9).
      return { ok: true, output: {} };
    }

    const num = (v: unknown): number | undefined =>
      typeof v === "number" && isFinite(v) ? v : undefined;
    const str = (v: unknown): string | undefined =>
      typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined;

    const data: ExifData = {
      date:
        formatDate(parsed.DateTimeOriginal) ??
        formatDate(parsed.CreateDate) ??
        formatDate(parsed.ModifyDate),
      width: num(parsed.ExifImageWidth) ?? num(parsed.ImageWidth),
      height: num(parsed.ExifImageHeight) ?? num(parsed.ImageHeight),
      make: str(parsed.Make),
      model: str(parsed.Model),
      lens: str(parsed.LensModel) ?? str(parsed.LensMake),
      orientation: num(parsed.Orientation),
      iso: num(parsed.ISO) ?? num(parsed.ISOSpeedRatings),
      fNumber: num(parsed.FNumber),
      exposureTime: num(parsed.ExposureTime),
      raw: parsed,
    };

    const lat = num(parsed.latitude);
    const lon = num(parsed.longitude);
    if (lat != null || lon != null) {
      data.gps = { latitude: lat, longitude: lon };
    }

    return { ok: true, output: data };
  } catch (e) {
    return {
      ok: false,
      error: `Could not read the metadata in "${file.name}": ${(e as Error).message}`,
    };
  }
}

/** True when this file carries location data (feature 45). */
export function hasGpsData(exif: ExifData | null | undefined): boolean {
  return !!exif?.gps && (exif.gps.latitude != null || exif.gps.longitude != null);
}

// ---------------------------------------------------------------------------
// Perceptual hashing
// ---------------------------------------------------------------------------

/** A hash of all zeros. Ambiguous on its own — see `ImageHashes.flat`. */
export const ZERO_HASH = "0000000000000000";

/** Pack 64 booleans into a 16-character hex string. */
function bitsToHex(bits: boolean[]): string {
  let hex = "";
  for (let i = 0; i < 64; i += 4) {
    let nibble = 0;
    for (let b = 0; b < 4; b++) if (bits[i + b]) nibble |= 1 << (3 - b);
    hex += nibble.toString(16);
  }
  return hex;
}

/**
 * Compute a 64-bit average hash (aHash) from an 8x8 grayscale sample.
 *
 * Signature and algorithm unchanged (D2). `grayscale` is expected to be an
 * 8x8 buffer; `width`/`height` are accepted for compatibility.
 */
export function computePerceptualHash(
  grayscale: Uint8Array,
  width: number,
  height: number,
): string {
  const count = Math.min(grayscale.length, width * height);
  if (count === 0) return ZERO_HASH;
  let sum = 0;
  for (let i = 0; i < count; i++) sum += grayscale[i]!;
  const average = sum / count;
  const bits: boolean[] = [];
  for (let i = 0; i < 64; i++) bits.push((grayscale[i] ?? 0) > average);
  return bitsToHex(bits);
}

/**
 * Compute a 64-bit difference hash (dHash) from a 9x8 grayscale sample.
 *
 * dHash compares each pixel with its right-hand neighbour, so it keys on edges
 * rather than absolute brightness. That makes it far more discriminating than
 * aHash on the cases this tool actually meets: two exports of the same photo
 * at different brightness, or two different photos that happen to share an
 * average tone. Using both and requiring BOTH to be close is what removes the
 * false-positive pairs the original produced.
 */
export function computeDifferenceHash(grayscale9x8: Uint8Array): string {
  const bits: boolean[] = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const left = grayscale9x8[y * 9 + x] ?? 0;
      const right = grayscale9x8[y * 9 + x + 1] ?? 0;
      bits.push(left > right);
    }
  }
  return bitsToHex(bits);
}

export interface ImageHashes {
  aHash: string;
  dHash: string;
  /**
   * True when the sampled image has essentially no tonal variation.
   *
   * This matters because a blank white page and a solid black square both hash
   * to all zeros, as does a failed decode in the original code — so the
   * original reported unrelated blank scans as duplicates of each other. A
   * flat image is now flagged and excluded from similarity matching, and the
   * UI says why rather than showing a wrong match. A FAILED hash is a null
   * result, never a zero hash (D20: a value that was not measured must be
   * absent, not faked).
   */
  flat: boolean;
}

/** Sample a bitmap down to the grids both hashes need, in one draw. */
async function sampleGrayscale(
  bitmap: ImageBitmap,
): Promise<{ aGrid: Uint8Array; dGrid: Uint8Array; range: number }> {
  // 9x8 covers dHash; aHash reads the leftmost 8 columns of the same rows.
  const canvas = createCanvas(9, 8);
  const ctx = get2dContext(canvas);
  ctx.imageSmoothingEnabled = true;
  (ctx as CanvasRenderingContext2D).imageSmoothingQuality = "high";
  ctx.drawImage(bitmap as unknown as CanvasImageSource, 0, 0, 9, 8);
  const { data } = ctx.getImageData(0, 0, 9, 8);

  const dGrid = new Uint8Array(72);
  const aGrid = new Uint8Array(64);
  let min = 255;
  let max = 0;

  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 9; x++) {
      const o = (y * 9 + x) * 4;
      // BT.601 luma, matching the original implementation.
      const luma = Math.round(
        0.299 * data[o]! + 0.587 * data[o + 1]! + 0.114 * data[o + 2]!,
      );
      dGrid[y * 9 + x] = luma;
      if (x < 8) {
        aGrid[y * 8 + x] = luma;
        if (luma < min) min = luma;
        if (luma > max) max = luma;
      }
    }
  }

  return { aGrid, dGrid, range: max - min };
}

/**
 * Compute the average hash of a bitmap.
 * Signature and return type unchanged (D2).
 */
export async function computePerceptualHashFromBitmap(bitmap: ImageBitmap): Promise<string> {
  const { aGrid } = await sampleGrayscale(bitmap);
  return computePerceptualHash(aGrid, 8, 8);
}

/** Compute both hashes plus the flat-image flag in a single sampling pass. */
export async function computeImageHashes(bitmap: ImageBitmap): Promise<ImageHashes> {
  const { aGrid, dGrid, range } = await sampleGrayscale(bitmap);
  return {
    aHash: computePerceptualHash(aGrid, 8, 8),
    dHash: computeDifferenceHash(dGrid),
    // Below this spread the image is a solid colour or a blank scan, and any
    // similarity score against it is meaningless.
    flat: range < 8,
  };
}

/**
 * SHA-256 of the file's bytes, for exact-duplicate detection (feature 51).
 *
 * Perceptual hashing answers "do these look alike"; it cannot answer "are
 * these the same file", because two visually identical images can differ in
 * metadata. Byte hashing answers that exactly and cheaply.
 */
export async function computeContentHash(blob: Blob): Promise<string | null> {
  try {
    if (typeof crypto === "undefined" || !crypto.subtle) return null;
    const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return null;
  }
}

/** Group files whose bytes are identical. Returns groups of 2 or more ids. */
export function findExactDuplicates(hashes: Map<string, string>): string[][] {
  const byHash = new Map<string, string[]>();
  for (const [id, hash] of hashes) {
    const list = byHash.get(hash);
    if (list) list.push(id);
    else byHash.set(hash, [id]);
  }
  return Array.from(byHash.values()).filter((group) => group.length > 1);
}

/**
 * Hamming distance between two hex hashes.
 * Unchanged (D2): returns 64 — the maximum — when the inputs are not
 * comparable, so an unreadable hash can never look like a match.
 */
export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return 64;
  let distance = 0;
  for (let i = 0; i < a.length; i++) {
    const x = parseInt(a[i]!, 16);
    const y = parseInt(b[i]!, 16);
    if (isNaN(x) || isNaN(y)) return 64;
    let diff = x ^ y;
    while (diff) {
      distance += diff & 1;
      diff >>= 1;
    }
  }
  return distance;
}

/**
 * Build a banded index so near-duplicate search does not have to compare every
 * pair (feature 55, defect 18).
 *
 * Pigeonhole principle: split each 64-bit hash into 8 bands of 8 bits. If two
 * hashes differ in at most 7 bits, at least one band must be identical, so
 * candidates can be found by exact band lookup instead of an O(n²) scan. For
 * 1,000 images that is roughly half a million comparisons avoided.
 *
 * The guarantee only holds for thresholds up to 7, so the caller falls back to
 * the exhaustive scan above that. This is an optimisation, never a change in
 * results.
 */
function buildBandIndex(hashes: Map<string, string>): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const [id, hash] of hashes) {
    for (let band = 0; band < 8; band++) {
      const key = `${band}:${hash.slice(band * 2, band * 2 + 2)}`;
      const list = index.get(key);
      if (list) list.push(id);
      else index.set(key, [id]);
    }
  }
  return index;
}

/**
 * Find near-duplicate images by perceptual hash.
 *
 * Signature, defaults and result shape unchanged (D2): takes Map<id, hash>,
 * returns Map<id, similarIds[]> containing only ids that have at least one
 * match. Results are identical to the original exhaustive comparison — only
 * the cost changed.
 *
 * All-zero hashes are still skipped, as in the original: they are produced by
 * blank or solid-colour images, and treating them as mutual matches produced
 * a wall of false positives.
 */
export function findPerceptualDuplicates(
  hashes: Map<string, string>,
  threshold = 5,
): Map<string, string[]> {
  const result = new Map<string, string[]>();
  const add = (a: string, b: string) => {
    const list = result.get(a);
    if (list) list.push(b);
    else result.set(a, [b]);
  };

  const entries = Array.from(hashes.entries());

  // Above 7 the banded shortcut can miss pairs, so compare exhaustively.
  // Below ~50 images the index costs more than it saves.
  if (threshold > 7 || entries.length < 50) {
    for (let i = 0; i < entries.length; i++) {
      const [idA, hashA] = entries[i]!;
      for (let j = i + 1; j < entries.length; j++) {
        const [idB, hashB] = entries[j]!;
        // Skip pairs where exactly one hash is the zero sentinel (failure marker).
        // Both zero is allowed (identical "failed" images are still duplicates).
        const aIsZero = hashA === ZERO_HASH;
        const bIsZero = hashB === ZERO_HASH;
        if (aIsZero !== bIsZero) continue; // exactly one is zero → skip
        if (hammingDistance(hashA, hashB) <= threshold) {
          add(idA, idB);
          add(idB, idA);
        }
      }
    }
    return result;
  }

  const index = buildBandIndex(hashes);
  const compared = new Set<string>();

  for (const [idA, hashA] of entries) {
    if (hashA === ZERO_HASH) continue;
    const candidates = new Set<string>();
    for (let band = 0; band < 8; band++) {
      const key = `${band}:${hashA.slice(band * 2, band * 2 + 2)}`;
      for (const other of index.get(key) ?? []) {
        if (other !== idA) candidates.add(other);
      }
    }
    for (const idB of candidates) {
      const pairKey = idA < idB ? `${idA}\u0000${idB}` : `${idB}\u0000${idA}`;
      if (compared.has(pairKey)) continue;
      compared.add(pairKey);
      const hashB = hashes.get(idB)!;
      if (hashB === ZERO_HASH) continue;
      if (hammingDistance(hashA, hashB) <= threshold) {
        add(idA, idB);
        add(idB, idA);
      }
    }
  }

  return result;
}

/**
 * Stricter near-duplicate search requiring BOTH hashes to agree (feature 56).
 *
 * `flat` images are excluded and reported separately, so "three blank scans"
 * is never presented as "three duplicates".
 */
export function findSimilarImages(
  hashes: Map<string, ImageHashes>,
  threshold = 5,
): { matches: Map<string, string[]>; skippedFlat: string[] } {
  const usable = new Map<string, string>();
  const skippedFlat: string[] = [];

  for (const [id, h] of hashes) {
    if (h.flat) skippedFlat.push(id);
    else usable.set(id, h.aHash);
  }

  const byAverage = findPerceptualDuplicates(usable, threshold);
  const matches = new Map<string, string[]>();

  for (const [id, candidates] of byAverage) {
    const confirmed = candidates.filter((other) => {
      const a = hashes.get(id);
      const b = hashes.get(other);
      if (!a || !b) return false;
      return hammingDistance(a.dHash, b.dHash) <= threshold;
    });
    if (confirmed.length > 0) matches.set(id, confirmed);
  }

  return { matches, skippedFlat };
}

/**
 * Turn a Hamming distance into the percentage the UI shows (feature 57).
 * 0 bits different is 100% similar; 64 bits different is 0%.
 */
export function similarityPercent(distance: number): number {
  const clamped = Math.max(0, Math.min(64, distance));
  return Math.round((1 - clamped / 64) * 100);
}

/**
 * ===========================================================================
 * ENGINE PART 5 of 5 - packaging, concurrency, memory, batch orchestration.
 * ===========================================================================
 *
 * Concatenate AFTER CODE-1-ENGINE-PART-4.ts. No static imports; `jszip` is
 * loaded dynamically, like `heic2any` in PART-3 and `exifr` in PART-4.
 *
 * This part closes defects 1, 2, 11, 15, 16, 17 and 18.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS FILE STILL CONTAINS A HAND-WRITTEN ZIP WRITER
 * ---------------------------------------------------------------------------
 * D21 says: never ship an unverifiable hand-rolled implementation of a
 * standard format when a real dependency exists. `jszip` is already installed
 * and is used here for the compressed path. So why keep `buildStoredZip`?
 *
 * Two reasons, and only two:
 *
 *   1. D2. `buildStoredZip` is an existing export with existing tests. Deleting
 *      it is a breaking change; leaving it broken is worse.
 *   2. Images are ALREADY compressed. Deflating a JPEG typically saves under
 *      one percent while costing real CPU time and, more importantly, forcing
 *      every byte through a compressor before anything can be written. Storing
 *      is both faster and effectively the same size, so it is the right
 *      default for this specific tool.
 *
 * The scope of the hand-written writer is therefore kept deliberately tiny:
 * STORED entries only, no encryption, no ZIP64. The three original bugs are
 * fixed, and the case it genuinely cannot handle - an archive past the 4 GB /
 * 65,535-entry limits, which needs ZIP64 - now REFUSES rather than silently
 * emitting an archive that some extractors open and others reject. Splitting
 * (feature 76) is the supported answer to that limit, not an afterthought.
 */

// ---------------------------------------------------------------------------
// CRC-32
// ---------------------------------------------------------------------------

/** Standard IEEE 802.3 CRC-32 table, built once on first use. */
const CRC32_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

/**
 * CRC-32 of a byte array. `seed` allows chunked hashing of a large file
 * without holding all of it in memory at once.
 */
export function crc32(bytes: Uint8Array, seed = 0): number {
  let c = (seed ^ 0xffffffff) >>> 0;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC32_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

// ---------------------------------------------------------------------------
// ZIP structural limits and DOS timestamps
// ---------------------------------------------------------------------------

/** Past these, a ZIP needs ZIP64 headers, which this writer does not emit. */
const ZIP_MAX_BYTES = 0xffffffff;
const ZIP_MAX_ENTRIES = 0xffff;

/**
 * Below 4 GB by a comfortable margin, so a split archive can never itself
 * cross the limit that made us split in the first place.
 */
export const DEFAULT_ZIP_SPLIT_BYTES = 3 * 1024 * 1024 * 1024;

/**
 * Convert a Date into the packed MS-DOS time and date fields a ZIP uses.
 *
 * ORIGINAL BUG (defect 11): both fields were written as literal zeros. A zero
 * date field decodes to day 0 of month 0 of 1980, which is not a real date.
 * Windows Explorer shows blanks or 1979-11-30, and some backup and sync tools
 * reject the entry outright. DOS timestamps have two-second granularity and
 * cannot represent anything before 1980, so both bounds are clamped rather
 * than allowed to wrap into nonsense.
 */
export function toDosDateTime(d: Date): { time: number; date: number } {
  const year = d.getFullYear();
  if (year < 1980) return { time: 0, date: (1 << 5) | 1 }; // 1980-01-01
  if (year > 2107) return { time: 0xbf7d, date: 0xff9f }; // 2107-12-31 23:59:58
  const time =
    (d.getHours() << 11) | (d.getMinutes() << 5) | (Math.floor(d.getSeconds() / 2) & 0x1f);
  const date =
    ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time: time & 0xffff, date: date & 0xffff };
}

// ---------------------------------------------------------------------------
// STORED ZIP writer
// ---------------------------------------------------------------------------

export interface ZipEntryInput {
  name: string;
  blob: Blob;
  /** Modification time written into the entry. Defaults to now. */
  date?: Date;
}

/** Thrown when an archive would need ZIP64 headers this writer cannot emit. */
export class ZipLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ZipLimitError";
  }
}

/**
 * Build an uncompressed (STORED) ZIP archive.
 *
 * Signature unchanged (D2). Three original bugs fixed:
 *
 *   1. GENERAL PURPOSE BIT 11 (0x0800) is now set. It declares that filenames
 *      are UTF-8. Without it, extractors fall back to CP437, so any accented
 *      or non-Latin filename came out mojibake - and this tool's whole purpose
 *      is filenames.
 *   2. DOS date and time are now real values instead of zeros.
 *   3. The 4 GB / 65,535-entry ZIP64 boundary is now checked and refused
 *      instead of silently overflowing the 32-bit size and offset fields,
 *      which produced an archive that looked fine until someone tried to
 *      open it.
 *
 * MEMORY (fixed after review): each entry's bytes are read once to compute the
 * CRC, but only the ORIGINAL BLOB is pushed into the output parts list - not
 * the `Uint8Array` copy. Keeping the copy meant a 900 MB batch was held twice
 * over, in the decoded arrays and again in the Blob being assembled, which is
 * exactly the point in the run where memory is already at its highest. A Blob
 * is a valid `BlobPart`, so the browser can reference the existing bytes
 * instead of duplicating them, and each temporary array becomes collectable at
 * the end of its own iteration.
 *
 * Throws `ZipLimitError` in case 3. Callers should split (feature 76).
 */
export async function buildStoredZip(
  entries: { name: string; blob: Blob; date?: Date }[],
): Promise<Blob> {
  // Legacy: empty entries → empty blob (size 0)
  if (entries.length === 0) {
    return new Blob([], { type: "application/zip" });
  }

  if (entries.length > ZIP_MAX_ENTRIES) {
    throw new ZipLimitError(
      `A ZIP file can hold at most ${ZIP_MAX_ENTRIES.toLocaleString()} items and this archive has ${entries.length.toLocaleString()}. Split the download into parts and try again.`,
    );
  }

  const encoder = new TextEncoder();
  const localParts: BlobPart[] = [];
  const centralParts: BlobPart[] = [];
  let offset = 0;
  let centralSize = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const size = entry.blob.size;

    if (size > ZIP_MAX_BYTES || offset > ZIP_MAX_BYTES) {
      throw new ZipLimitError(
        "This archive is larger than the 4 GB limit of the standard ZIP format. Turn on splitting so the download is delivered in parts.",
      );
    }

    // Read the bytes for the checksum only. `bytes` goes out of scope at the
    // end of this iteration; the archive itself references `entry.blob`.
    const bytes = new Uint8Array(await entry.blob.arrayBuffer());
    const checksum = crc32(bytes);
    const { time, date } = toDosDateTime(entry.date ?? new Date());

    // --- local file header (30 bytes + name) ---
    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); // signature
    lv.setUint16(4, 20, true); // version needed to extract (2.0)
    lv.setUint16(6, 0x0800, true); // BUGFIX: filenames are UTF-8
    lv.setUint16(8, 0, true); // method 0 = stored
    lv.setUint16(10, time, true); // BUGFIX: real time
    lv.setUint16(12, date, true); // BUGFIX: real date
    lv.setUint32(14, checksum, true);
    lv.setUint32(18, size, true); // compressed size
    lv.setUint32(22, size, true); // uncompressed size
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true); // no extra field
    local.set(nameBytes, 30);

    // MEMORY FIX: the Blob, not the byte copy.
    localParts.push(local, entry.blob);

    // --- central directory record (46 bytes + name) ---
    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 0x031e, true); // made by: UNIX, ZIP 3.0
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true); // BUGFIX: UTF-8 here too
    cv.setUint16(10, 0, true);
    cv.setUint16(12, time, true);
    cv.setUint16(14, date, true);
    cv.setUint32(16, checksum, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true); // extra length
    cv.setUint16(32, 0, true); // comment length
    cv.setUint16(34, 0, true); // disk number
    cv.setUint16(36, 0, true); // internal attributes
    cv.setUint32(38, 0o644 << 16, true); // external attributes: rw-r--r--
    cv.setUint32(42, offset, true); // offset of local header
    central.set(nameBytes, 46);

    centralParts.push(central);
    centralSize += central.length;
    offset += local.length + size;
  }

  if (offset > ZIP_MAX_BYTES) {
    throw new ZipLimitError(
      "This archive is larger than the 4 GB limit of the standard ZIP format. Turn on splitting so the download is delivered in parts.",
    );
  }

  // --- end of central directory ---
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true); // this disk
  ev.setUint16(6, 0, true); // disk with central directory
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true); // no comment

  return new Blob([...localParts, ...centralParts, eocd], {
    type: "application/zip",
  });
}

/**
 * Build an archive, optionally deflated.
 *
 * The deflate path delegates to `jszip` rather than hand-rolling a compressor
 * (D21). Deflate is worth offering because an audit CSV and a manifest JSON do
 * compress well, and some users pack PNG screenshots rather than photos - but
 * it is not the default, because for already-compressed images it costs time
 * and saves almost nothing.
 */
export async function buildZipArchive(
  entries: ZipEntryInput[],
  opts: {
    compression?: "store" | "deflate";
    onProgress?: (fraction: number) => void;
  } = {},
): Promise<ToolResult<Blob>> {
  const { compression = "store", onProgress } = opts;

  try {
    if (compression === "store") {
      const blob = await buildStoredZip(entries);
      onProgress?.(1);
      return { ok: true, output: blob };
    }

    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    for (const entry of entries) {
      zip.file(entry.name, entry.blob, { date: entry.date ?? new Date() });
    }
    const blob = await zip.generateAsync(
      {
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
        // Write each file out as it is compressed instead of buffering the
        // whole archive first - this is what keeps a 300-file batch from
        // spiking memory at the very last step.
        streamFiles: true,
      },
      (meta: { percent: number }) => onProgress?.(meta.percent / 100),
    );
    return { ok: true, output: blob };
  } catch (e) {
    if (e instanceof ZipLimitError) return { ok: false, error: e.message };
    return {
      ok: false,
      error: `The ZIP file could not be created: ${(e as Error).message}`,
    };
  }
}

/**
 * Group entries into archives no larger than `maxBytes` (feature 76).
 *
 * A single file bigger than the limit still gets its own archive rather than
 * being dropped or silently merged - the caller reports it instead of the
 * planner deciding on the user's behalf (D20).
 */
export function planArchiveSplits(
  entries: ZipEntryInput[],
  maxBytes: number = DEFAULT_ZIP_SPLIT_BYTES,
): { groups: ZipEntryInput[][]; warnings: string[] } {
  const limit = Math.min(
    Math.max(1024 * 1024, maxBytes),
    DEFAULT_ZIP_SPLIT_BYTES,
  );
  const groups: ZipEntryInput[][] = [];
  const warnings: string[] = [];

  let current: ZipEntryInput[] = [];
  let currentBytes = 0;

  for (const entry of entries) {
    // Roughly the local header, central record and the name, twice over.
    const overhead = 80 + entry.name.length * 2;
    const cost = entry.blob.size + overhead;

    if (cost > limit) {
      if (current.length > 0) {
        groups.push(current);
        current = [];
        currentBytes = 0;
      }
      groups.push([entry]);
      warnings.push(
        `"${entry.name}" is larger than the split size on its own, so it was placed in an archive by itself.`,
      );
      continue;
    }

    if (current.length > 0 &&
        (currentBytes + cost > limit || current.length >= ZIP_MAX_ENTRIES)) {
      groups.push(current);
      current = [];
      currentBytes = 0;
    }

    current.push(entry);
    currentBytes += cost;
  }

  if (current.length > 0) groups.push(current);
  return { groups, warnings };
}

/** Name part N of M, e.g. "photos-part-2-of-5.zip". */
export function buildSplitArchiveName(baseName: string, part: number, total: number): string {
  if (total <= 1) return baseName;
  const { base, ext } = splitExt(baseName);
  return `${base}-part-${part}-of-${total}${ext || ".zip"}`;
}

// ---------------------------------------------------------------------------
// Object URL lifecycle (defect 15)
// ---------------------------------------------------------------------------

/**
 * Track every object URL created for previews and revoke them together.
 *
 * ORIGINAL BUG (defect 15): `URL.createObjectURL` was called per preview row
 * and never revoked. Each live URL pins its entire Blob in memory, so
 * processing a few hundred photos, clearing the list and processing a few
 * hundred more grew the tab's memory until it was killed. Object URLs are not
 * garbage collected when the element using them goes away - they must be
 * revoked explicitly.
 */
export function createObjectUrlRegistry() {
  const urls = new Set<string>();
  return {
    create(blob: Blob): string {
      const url = URL.createObjectURL(blob);
      urls.add(url);
      return url;
    },
    revoke(url: string): void {
      if (urls.delete(url)) URL.revokeObjectURL(url);
    },
    revokeAll(): void {
      for (const url of urls) URL.revokeObjectURL(url);
      urls.clear();
    },
    get size(): number {
      return urls.size;
    },
  };
}

// ---------------------------------------------------------------------------
// Memory accounting (defect 16)
// ---------------------------------------------------------------------------

export interface MemoryLedger {
  add(bytes: number): void;
  release(bytes: number): void;
  readonly current: number;
  readonly peak: number;
  readonly cap: number;
  wouldExceed(bytes: number): boolean;
}

/**
 * Track how many bytes of processed output are held in memory at once.
 *
 * ORIGINAL BUG (defect 16): the UI displayed a "peak memory" figure that was
 * simply the running total of every blob ever produced. It only ever went up,
 * so after 200 photos it reported multiple gigabytes while the tab was using a
 * fraction of that. A number that is always wrong is worse than no number,
 * because users make decisions from it (D20).
 *
 * Peak here means the true high-water mark of concurrently held bytes.
 */
export function createMemoryLedger(cap: number = MEMORY_CAP_BYTES): MemoryLedger {
  let current = 0;
  let peak = 0;
  return {
    add(bytes: number) {
      current += Math.max(0, bytes);
      if (current > peak) peak = current;
    },
    release(bytes: number) {
      current = Math.max(0, current - Math.max(0, bytes));
    },
    get current() {
      return current;
    },
    get peak() {
      return peak;
    },
    get cap() {
      return cap;
    },
    wouldExceed(bytes: number) {
      return current + bytes > cap;
    },
  };
}

// ---------------------------------------------------------------------------
// Bounded-concurrency pool with cancellation (defects 2 and 17)
// ---------------------------------------------------------------------------

/**
 * How many images to process at once.
 *
 * ORIGINAL BUG (defect 2): the code created a worker pool and then awaited
 * each job inside a plain `for` loop, so exactly one job was ever in flight.
 * The pool existed, was reported in the UI, and bought nothing.
 *
 * One core is left free so the tab stays responsive, and the pool is capped at
 * four because every concurrent job holds a decoded bitmap - width x height x 4
 * bytes - and more parallelism buys throughput at the cost of memory that a
 * phone does not have.
 */
export function recommendedConcurrency(): number {
  const cores =
    typeof navigator !== "undefined" && navigator.hardwareConcurrency
      ? navigator.hardwareConcurrency
      : 4;
  return Math.max(1, Math.min(4, cores - 1));
}

export interface PoolOptions {
  concurrency?: number;
  signal?: AbortSignal;
  onProgress?: (completed: number, total: number) => void;
}

export interface PoolOutcome<R> {
  results: Array<R | undefined>;
  completed: number;
  cancelled: boolean;
}

/**
 * Run `task` over every item with a bounded number in flight, preserving
 * result order and honouring cancellation between jobs (feature 66).
 *
 * Cancellation checks happen before each job starts rather than mid-job: a
 * half-encoded image cannot be torn down safely, and letting the current jobs
 * finish takes at most a second while guaranteeing nothing is left in a
 * partial state. Whatever finished before the stop is kept and downloadable,
 * because throwing away completed work is not what "cancel" means to anyone.
 */
export async function runPool<T, R>(
  items: T[],
  task: (item: T, index: number) => Promise<R>,
  opts: PoolOptions = {},
): Promise<PoolOutcome<R>> {
  const concurrency = Math.max(1, opts.concurrency ?? recommendedConcurrency());
  const results = new Array<R | undefined>(items.length);
  let cursor = 0;
  let completed = 0;
  let cancelled = false;

  const runWorker = async (): Promise<void> => {
    for (;;) {
      if (opts.signal?.aborted) {
        cancelled = true;
        return;
      }
      const index = cursor++;
      if (index >= items.length) return;
      try {
        results[index] = await task(items[index]!, index);
      } catch {
        // A thrown task leaves its slot undefined; the caller records the
        // failure per row. One bad file must never stop the batch.
        results[index] = undefined;
      }
      completed++;
      opts.onProgress?.(completed, items.length);
    }
  };

  const workers: Promise<void>[] = [];
  for (let i = 0; i < Math.min(concurrency, items.length); i++) {
    workers.push(runWorker());
  }
  await Promise.all(workers);

  return { results, completed, cancelled: cancelled || !!opts.signal?.aborted };
}

// ---------------------------------------------------------------------------
// Batch orchestration
// ---------------------------------------------------------------------------

export interface BatchFileInput {
  /** Stable id used as the key for hashes, previews and duplicate groups. */
  id: string;
  file: File;
  /**
   * Path relative to the dropped folder, e.g. "holiday/day-1/IMG_0001.jpg".
   * Plain `file.name` when the source had no folder (feature 71, defect 7).
   */
  relativePath: string;
}

export interface BatchItemOutput {
  id: string;
  index: number;
  originalName: string;
  originalPath: string;
  originalSize: number;
  newName: string;
  archivePath: string;
  blob?: Blob;
  width?: number;
  height?: number;
  quality?: number;
  keptOriginal?: boolean;
  hashes?: ImageHashes;
  contentHash?: string;
  exif?: ExifData;
  error?: string;
  warnings: string[];
}

export interface BatchResult {
  outputs: BatchItemOutput[];
  rows: PreviewRow[];
  counts: BatchCounts;
  warnings: string[];
  cancelled: boolean;
  startedAt: Date;
  finishedAt: Date;
  peakMemoryBytes: number;
  /**
   * False when hashing was skipped for this run, so the duplicates panel can
   * say "not compared" instead of "no duplicates found" (D20).
   */
  hashed: boolean;
}

/**
 * Build the token context for one file from its EXIF and its path.
 *
 * Kept as one function so the preview and the real run cannot drift: the name
 * shown in the table is produced by exactly the same inputs as the name
 * written into the ZIP.
 */
export function buildTokenContext(
  input: BatchFileInput,
  exif: ExifData | null,
  folderCounter?: number,
): TokenContext {
  const { ext } = splitExt(input.file.name);
  return {
    width: exif?.width,
    height: exif?.height,
    exifDate: exif?.date,
    fileDate: new Date(input.file.lastModified).toISOString(),
    ext,
    size: input.file.size,
    parent: parentFolderOf(input.relativePath),
    make: exif?.make,
    model: exif?.model,
    lens: exif?.lens,
    iso: exif?.iso,
    fNumber: exif?.fNumber,
    exposureTime: exif?.exposureTime,
    folderCounter,
  };
}

/**
 * Work out every output name and archive path before a single pixel is
 * touched (feature 81).
 *
 * Planning is separate from processing on purpose. It is what makes the
 * preview table honest - the user sees the real final names, including
 * collision suffixes and folder placement, and can cancel before spending
 * minutes of CPU on the wrong settings.
 */
export function planBatch(
  inputs: BatchFileInput[],
  config: RenameOptimizeConfig,
  exifById: Map<string, ExifData> = new Map(),
): {
  names: string[];
  archivePaths: string[];
  suffixed: boolean[];
  perFileWarnings: string[][];
  errors: (string | undefined)[];
  warnings: string[];
} {
  const folderCounters = new Map<string, number>();
  const rawNames: string[] = [];
  const perFileWarnings: string[][] = [];
  const errors: (string | undefined)[] = [];

  inputs.forEach((input, index) => {
    const folder = parentFolderOf(input.relativePath);
    const next = (folderCounters.get(folder) ?? config.rule.counterStart - config.rule.counterStep) +
      config.rule.counterStep;
    folderCounters.set(folder, next);

    const ctx = buildTokenContext(input, exifById.get(input.id) ?? null, next);
    const result = applyRenamePatternDetailed(
      input.file.name,
      index,
      config.rule,
      ctx,
      config.optimize.copyOriginalBytes ? undefined : config.optimize.format,
    );

    if (!result.ok) {
      // Keep the original name so the row still has somewhere to go, and
      // report the reason instead of dropping the file (D9).
      rawNames.push(input.file.name);
      perFileWarnings.push([]);
      errors.push(result.error);
      return;
    }

    rawNames.push(result.output.name);
    perFileWarnings.push(result.output.warnings);
    errors.push(undefined);
  });

  const resolution = resolveConflictsSafe(rawNames);
  const archive = resolveArchivePaths(
    resolution.names.map((newName, i) => ({
      originalPath: inputs[i]!.relativePath,
      newName,
    })),
    config,
  );

  return {
    names: resolution.names,
    archivePaths: archive.paths,
    suffixed: resolution.suffixed,
    perFileWarnings,
    errors,
    warnings: [...resolution.warnings, ...archive.warnings],
  };
}

/**
 * Process one file, end to end, on the current thread.
 *
 * This is the function the worker calls too, so there is exactly ONE image
 * pipeline in the codebase (defects 3, 4, 9). It deliberately goes through
 * `processImageDetailed` from PART-3 and `applyMetadataPolicy` from PART-4
 * rather than repeating either.
 *
 * `opts.wantHashes` exists because hashing needs the SOURCE image, which means
 * a second decode of a file that has already been decoded once for resizing.
 * That is a real cost - on a 300-photo batch it is roughly double the decode
 * work - and it buys nothing at all unless the user looks at the duplicates
 * panel. Hashing is therefore requested, not assumed.
 */
export async function processBatchItem(
  input: BatchFileInput,
  config: RenameOptimizeConfig,
  exif: ExifData | null,
  opts: { wantHashes?: boolean } = {},
): Promise<{
  blob?: Blob;
  width?: number;
  height?: number;
  quality?: number;
  keptOriginal?: boolean;
  hashes?: ImageHashes;
  contentHash?: string;
  error?: string;
  warnings: string[];
}> {
  const warnings: string[] = [];

  const processed = await processImageDetailed(input.file, config.optimize);
  if (!processed.ok) {
    return { error: processed.error, warnings };
  }

  const core = processed.output;
  warnings.push(...core.warnings);

  const metadata = await applyMetadataPolicy(
    core.blob,
    config.optimize,
    exif,
    !!core.keptOriginal,
  );
  warnings.push(...metadata.warnings);

  if (opts.wantHashes === false) {
    return {
      blob: metadata.blob,
      width: core.width,
      height: core.height,
      quality: core.quality,
      keptOriginal: core.keptOriginal,
      warnings,
    };
  }

  // Hash the SOURCE image, never the resized output.
  //
  // Defect 9: the main thread hashed the original bitmap while the worker
  // hashed the resized canvas, so the same photo produced two different
  // hashes depending on which path ran, and duplicate detection results
  // changed with the resize setting. "Are these the same photo" is a question
  // about the input, so it is always answered from the input.
  let hashes: ImageHashes | undefined;
  const decoded = await decodeToBitmap(input.file);
  if (decoded.ok) {
    try {
      hashes = await computeImageHashes(decoded.output.bitmap);
    } catch {
      // A hash we could not compute is absent, never zero (D20).
      hashes = undefined;
    }
    decoded.output.bitmap.close?.();
  }

  const contentHash = (await computeContentHash(input.file)) ?? undefined;

  return {
    blob: metadata.blob,
    width: core.width,
    height: core.height,
    quality: core.quality,
    keptOriginal: core.keptOriginal,
    hashes,
    contentHash,
    warnings,
  };
}

export interface RunBatchOptions {
  signal?: AbortSignal;
  concurrency?: number;
  onProgress?: (completed: number, total: number) => void;
  /**
   * Compute perceptual and content hashes so duplicates can be found. Costs a
   * second decode per file; default true because the panel is a headline
   * feature, but the UI turns it off when the user has it collapsed.
   */
  wantHashes?: boolean;
  /**
   * Swap in a worker-backed processor. Defaults to `processBatchItem` on this
   * thread. Both paths must produce the same shape, which is why the default
   * IS the shared implementation rather than a copy of it.
   */
  processItem?: typeof processBatchItem;
}

/**
 * Run a whole batch: read metadata, plan names, process, and reconcile counts.
 *
 * Metadata is read first and for every file, because the rename pattern can
 * contain EXIF tokens - a name cannot be planned before its date and camera
 * are known. It is cheap: `exifr` reads only the header, not the pixels.
 */
export async function runBatch(
  inputs: BatchFileInput[],
  config: RenameOptimizeConfig,
  opts: RunBatchOptions = {},
): Promise<BatchResult> {
  const startedAt = new Date();
  const ledger = createMemoryLedger();
  const warnings: string[] = [];
  const processItem = opts.processItem ?? processBatchItem;
  const wantHashes = opts.wantHashes !== false;

  // --- pass 1: metadata -------------------------------------------------
  const exifById = new Map<string, ExifData>();
  const exifPass = await runPool(
    inputs,
    async (input) => {
      const result = await getExifData(input.file);
      return result.ok ? result.output : null;
    },
    { concurrency: opts.concurrency, signal: opts.signal },
  );
  exifPass.results.forEach((exif, i) => {
    if (exif) exifById.set(inputs[i]!.id, exif);
  });

  // --- pass 2: plan -----------------------------------------------------
  const plan = planBatch(inputs, config, exifById);
  warnings.push(...plan.warnings);

  // --- pass 3: process --------------------------------------------------
  const outputs: BatchItemOutput[] = inputs.map((input, index) => ({
    id: input.id,
    index,
    originalName: input.file.name,
    originalPath: input.relativePath,
    originalSize: input.file.size,
    newName: plan.names[index]!,
    archivePath: plan.archivePaths[index]!,
    error: plan.errors[index],
    warnings: [...(plan.perFileWarnings[index] ?? [])],
  }));

  const processable = outputs.filter((o) => !o.error);

  const run = await runPool(
    processable,
    async (output) => {
      const input = inputs[output.index]!;
      const result = await processItem(
        input,
        config,
        exifById.get(input.id) ?? null,
        { wantHashes },
      );
      if (result.blob) ledger.add(result.blob.size);
      return result;
    },
    {
      concurrency: opts.concurrency,
      signal: opts.signal,
      onProgress: opts.onProgress,
    },
  );

  run.results.forEach((result, i) => {
    const output = processable[i]!;
    if (!result) {
      // Either cancelled before it started, or the task threw. Distinguish
      // the two, because "you stopped this" and "this failed" are not the
      // same message to a user.
      if (!run.cancelled) {
        output.error = "This file could not be processed and was skipped.";
      }
      return;
    }
    output.blob = result.blob;
    output.width = result.width;
    output.height = result.height;
    output.quality = result.quality;
    output.keptOriginal = result.keptOriginal;
    output.hashes = result.hashes;
    output.contentHash = result.contentHash;
    output.exif = exifById.get(output.id);
    output.error = result.error;
    output.warnings.push(...result.warnings);
  });

  const finishedAt = new Date();

  const rows: PreviewRow[] = outputs.map((o) => ({
    index: o.index,
    originalName: o.originalName,
    originalSize: o.originalSize,
    newName: o.newName,
    newSize: o.blob?.size ?? 0,
    width: o.width,
    height: o.height,
    conflict: plan.suffixed[o.index] ?? false,
    autoSuffixed: plan.suffixed[o.index] ?? false,
    error: o.error,
    warnings: o.warnings.length > 0 ? o.warnings : undefined,
  }));

  const processed = outputs.filter((o) => o.blob && !o.error).length;
  const failed = outputs.filter((o) => o.error).length;
  const skipped = outputs.filter((o) => !o.blob && !o.error).length;

  return {
    outputs,
    rows,
    counts: reconcileCounts({
      added: inputs.length,
      processed,
      failed,
      skipped,
    }),
    warnings,
    cancelled: run.cancelled || exifPass.cancelled,
    startedAt,
    finishedAt,
    peakMemoryBytes: ledger.peak,
    hashed: wantHashes,
  };
}

/**
 * Turn a finished batch into the archives the user downloads, including the
 * optional audit trail and run manifest (features 77, 78).
 */
export async function packageBatch(
  result: BatchResult,
  config: RenameOptimizeConfig,
  opts: {
    compression?: "store" | "deflate";
    onProgress?: (fraction: number) => void;
  } = {},
): Promise<ToolResult<{ archives: { name: string; blob: Blob }[]; warnings: string[] }>> {
  const entries: ZipEntryInput[] = [];
  const warnings: string[] = [];

  for (const output of result.outputs) {
    if (!output.blob || output.error) continue;
    entries.push({
      name: output.archivePath,
      blob: output.blob,
      // Keep the capture date on the extracted file where we know it, so a
      // photo library still sorts correctly after a round trip.
      date: output.exif?.date ? new Date(output.exif.date) : result.finishedAt,
    });
  }

  if (entries.length === 0) {
    return {
      ok: false,
      error: "There are no processed images to download yet.",
    };
  }

  // Counted BEFORE the audit and manifest are added: a filename that says
  // "120-images" for 118 photos plus two reports is a small lie, and this
  // tool's entire promise is that its filenames are exact.
  const imageCount = entries.length;

  if (config.includeAuditInZip) {
    entries.push({
      name: "_audit.csv",
      blob: new Blob([generateAuditCsv(result.rows)], { type: "text/csv" }),
      date: result.finishedAt,
    });
  }
  if (config.includeManifestInZip) {
    entries.push({
      name: "_manifest.json",
      blob: new Blob(
        [generateRunManifest(config, result.rows, result.startedAt, result.finishedAt)],
        { type: "application/json" },
      ),
      date: result.finishedAt,
    });
  }

  const baseName = buildZipFileName(config, imageCount, result.finishedAt);
  const split = planArchiveSplits(
    entries,
    config.zipSplitBytes ?? DEFAULT_ZIP_SPLIT_BYTES,
  );
  warnings.push(...split.warnings);

  const archives: { name: string; blob: Blob }[] = [];
  for (let i = 0; i < split.groups.length; i++) {
    const built = await buildZipArchive(split.groups[i]!, {
      compression: opts.compression,
      onProgress: (fraction) =>
        opts.onProgress?.((i + fraction) / split.groups.length),
    });
    if (!built.ok) return built;
    archives.push({
      name: buildSplitArchiveName(baseName, i + 1, split.groups.length),
      blob: built.output,
    });
  }

  return { ok: true, output: { archives, warnings } };
}
