/**
 * Barcode Generator — pure logic + lazy-loaded renderers.
 *
 * Pure functions (validation, checksum, GS1 builder, CSV parser, sequence
 * generator, quiet-zone calculator, color contrast, Code128 auto-subset
 * analyser, manifest exporter) are fully testable in Node — they touch no
 * DOM. The renderers (`renderToCanvas`, `renderToSvg`, `renderToPngBlob`,
 * `renderToPdf`) dynamically `import("bwip-js")` / `import("jspdf")` on first
 * call so the ~600KB + ~250KB bundles stay off the initial page weight.
 *
 * Reference symbology specs:
 *  - EAN-13 / EAN-8 / UPC-A / ITF-14: ISO/IEC 15420 — Mod-10 weighted check.
 *  - Code128: ISO/IEC 15417 — subsets A/B/C, mod-103 symbol check.
 *  - Code39: ISO/IEC 16388 — mod-43 optional check.
 *  - Codabar: BS 6264 — no checksum.
 *  - MSI Plessey: mod-10 Luhn-style check.
 *  - Pharmacode: 3-131070 integer, no check.
 */
import type { ToolResult } from "../../../lib/tool";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type BarcodeFormat =
  // 1D / linear
  | "code128"
  | "code39"
  | "code93"
  | "ean13"
  | "ean8"
  | "upca"
  | "upce"
  | "itf14"
  | "gs1-128"
  | "codabar"
  | "msi"
  | "pharmacode"
  // 2D bonus
  | "qrcode"
  | "datamatrix"
  | "pdf417"
  | "aztec";

export type FormatGroup = "retail" | "logistics" | "generic" | "2d";

export interface BarcodeOptions {
  /** Bar width (X-dimension) in pixels per module — bwip-js `scaleX`. */
  scale?: number;
  /** Bar height in millimetres — bwip-js `height`. */
  height?: number;
  /** Padding/quiet zone in pixels — bwip-js `paddingwidth` / `paddingheight`. */
  paddingX?: number;
  paddingY?: number;
  /** Foreground colour as #RRGGBB. */
  foreground?: string;
  /** Background colour as #RRGGBB, or "transparent". */
  background?: string;
  /** Show human-readable text under the bars. */
  showText?: boolean;
  /** Font for human-readable text. */
  textFont?: string;
  /** Text size in points. */
  textSize?: number;
  /** Position of text: "below" | "above" | "center". */
  textYAlign?: "below" | "above" | "center";
  /** For Code128: force subset ("A" | "B" | "C") or "auto". */
  code128Subset?: "A" | "B" | "C" | "auto";
  /** PNG export DPI (default 300). */
  dpi?: number;
}

export interface BarcodeResult {
  format: BarcodeFormat;
  value: string;
  checksum: string;
  widthPx: number;
  heightPx: number;
  widthMm: number;
  heightMm: number;
  /** PNG data URL — populated by renderToPngBlob. */
  dataUrl?: string;
  /** Suggested filename. */
  filename: string;
}

export interface BulkBarcodeRow {
  format: BarcodeFormat;
  value: string;
  /** Optional label name (used for ZIP filenames). */
  label?: string;
}

export interface LabelSheetSpec {
  id: string;
  name: string;
  /** Paper size: A4, Letter, Legal. */
  paper: "A4" | "Letter" | "Legal";
  paperWidthMm: number;
  paperHeightMm: number;
  marginMm: { top: number; bottom: number; left: number; right: number };
  columns: number;
  rows: number;
  labelWidthMm: number;
  labelHeightMm: number;
  gapMm: { horizontal: number; vertical: number };
  /** Show crop marks around each label. */
  cropMarks: boolean;
}

/* ------------------------------------------------------------------ */
/* Format metadata                                                     */
/* ------------------------------------------------------------------ */

export interface FormatMeta {
  format: BarcodeFormat;
  group: FormatGroup;
  label: string;
  bwipId: string;
  /** Expected input length (without check digit) or null for variable. */
  length: number | "variable";
  /** Sample valid value (without check digit) for the placeholder. */
  sample: string;
  /** Human-readable description for the cheat-sheet. */
  description: string;
  bestFor: string;
}

export const FORMAT_REGISTRY: Record<BarcodeFormat, FormatMeta> = {
  code128: {
    format: "code128",
    group: "generic",
    label: "Code 128",
    bwipId: "code128",
    length: "variable",
    sample: "ABC-1234",
    description:
      "High-density 1D symbology supporting all 128 ASCII characters. Auto-subset switching uses C for digit pairs to maximise density.",
    bestFor: "Shipping cartons, logistics labels, serial numbers.",
  },
  code39: {
    format: "code39",
    group: "generic",
    label: "Code 39",
    bwipId: "code39",
    length: "variable",
    sample: "ABC123",
    description:
      "Self-checking discrete symbology. Supports A-Z, 0-9 and a few special chars (- . $ / + % SPACE).",
    bestFor: "Industrial, automotive, defence (legacy).",
  },
  code93: {
    format: "code93",
    group: "generic",
    label: "Code 93",
    bwipId: "code93",
    length: "variable",
    sample: "ABC123",
    description:
      "Compact successor to Code 39 with two check characters and full ASCII via shift codes.",
    bestFor: "Postal, package tracking (higher density than Code 39).",
  },
  ean13: {
    format: "ean13",
    group: "retail",
    label: "EAN-13",
    bwipId: "ean13",
    length: 12,
    sample: "400638133393",
    description:
      "13-digit retail barcode (12 data + 1 mod-10 check). Used worldwide for consumer products.",
    bestFor: "Retail products sold outside North America.",
  },
  ean8: {
    format: "ean8",
    group: "retail",
    label: "EAN-8",
    bwipId: "ean8",
    length: 7,
    sample: "7351353",
    description:
      "Compact 8-digit retail barcode (7 data + 1 mod-10 check). Used on small items where EAN-13 won't fit.",
    bestFor: "Small retail items (chewing gum, cosmetics).",
  },
  upca: {
    format: "upca",
    group: "retail",
    label: "UPC-A",
    bwipId: "upca",
    length: 11,
    sample: "03600029145",
    description:
      "12-digit North-American retail barcode (11 data + 1 mod-10 check).",
    bestFor: "Retail products sold in the US and Canada.",
  },
  upce: {
    format: "upce",
    group: "retail",
    label: "UPC-E",
    bwipId: "upce",
    length: 6,
    sample: "123456",
    description:
      "Zero-suppressed compact UPC for very small packages. Input is the 6-digit compressed form.",
    bestFor: "Very small retail items.",
  },
  itf14: {
    format: "itf14",
    group: "logistics",
    label: "ITF-14",
    bwipId: "itf14",
    length: 13,
    sample: "1541234567890",
    description:
      "14-digit Interleaved 2-of-5 used on outer cartons (13 data + 1 mod-10 check). Encodes the GTIN-14.",
    bestFor: "Logistic cartons, pallet labels.",
  },
  "gs1-128": {
    format: "gs1-128",
    group: "logistics",
    label: "GS1-128",
    bwipId: "gs1-128",
    length: "variable",
    sample: "(01)15412345678905(17)251231",
    description:
      "Code 128 subset with GS1 application identifiers in parentheses. Used for trade items with expiry / batch / serial data.",
    bestFor: "Healthcare, food expiry, SSCC pallet labels.",
  },
  codabar: {
    format: "codabar",
    group: "generic",
    label: "Codabar",
    bwipId: "codabar",
    length: "variable",
    sample: "A12345B",
    description:
      "Self-checking symbology. Digits 0-9 plus - $ : / . and start/stop chars A B C D E * N T.",
    bestFor: "Library cards, blood banks, FedEx parcels.",
  },
  msi: {
    format: "msi",
    group: "generic",
    label: "MSI Plessey",
    bwipId: "msi",
    length: "variable",
    sample: "1234567",
    description:
      "Continuous symbology with a mod-10 Luhn-style check digit. Numeric only.",
    bestFor: "Supermarket shelf labels, warehouse bin tags.",
  },
  pharmacode: {
    format: "pharmacode",
    group: "generic",
    label: "Pharmacode",
    bwipId: "pharmacode",
    length: "variable",
    sample: "1300",
    description:
      "Single-integer code (3 to 131070) used in pharmaceutical packaging for in-line process control.",
    bestFor: "Pharmaceutical packaging verification.",
  },
  qrcode: {
    format: "qrcode",
    group: "2d",
    label: "QR Code",
    bwipId: "qrcode",
    length: "variable",
    sample: "https://unqtools.example",
    description:
      "2D matrix symbology with strong error correction. Encodes URLs, contacts, Wi-Fi, etc.",
    bestFor: "Marketing, payments, contact sharing.",
  },
  datamatrix: {
    format: "datamatrix",
    group: "2d",
    label: "Data Matrix",
    bwipId: "datamatrix",
    length: "variable",
    sample: "SN-2026-0001",
    description:
      "Compact 2D symbology used on small items. Strong ECC200 error correction.",
    bestFor: "Direct part marking, electronics, pharma blister packs.",
  },
  pdf417: {
    format: "pdf417",
    group: "2d",
    label: "PDF417",
    bwipId: "pdf417",
    length: "variable",
    sample: "Passport data line 1",
    description:
      "Stacked linear 2D symbology with high capacity (up to ~1.8KB per symbol).",
    bestFor: "Boarding passes, IDs, transport documents.",
  },
  aztec: {
    format: "aztec",
    group: "2d",
    label: "Aztec Code",
    bwipId: "azteccode",
    length: "variable",
    sample: "Ticket #A12345",
    description:
      "Compact 2D symbology with central finder pattern. No quiet zone required.",
    bestFor: "Transport tickets, government IDs.",
  },
};

export const FORMATS_BY_GROUP: Record<FormatGroup, BarcodeFormat[]> = {
  retail: ["ean13", "ean8", "upca", "upce"],
  logistics: ["itf14", "gs1-128"],
  generic: ["code128", "code39", "code93", "codabar", "msi", "pharmacode"],
  "2d": ["qrcode", "datamatrix", "pdf417", "aztec"],
};

/* ------------------------------------------------------------------ */
/* Built-in label sheet templates                                      */
/* ------------------------------------------------------------------ */

export const BUILTIN_LABEL_SHEETS: LabelSheetSpec[] = [
  {
    id: "avery-5160",
    name: "Avery 5160 / 8160",
    paper: "Letter",
    paperWidthMm: 215.9,
    paperHeightMm: 279.4,
    marginMm: { top: 12.7, bottom: 12.7, left: 4.7, right: 4.7 },
    columns: 3,
    rows: 10,
    labelWidthMm: 66.7,
    labelHeightMm: 25.4,
    gapMm: { horizontal: 3.1, vertical: 0 },
    cropMarks: false,
  },
  {
    id: "avery-l7160",
    name: "Avery L7160 (A4)",
    paper: "A4",
    paperWidthMm: 210,
    paperHeightMm: 297,
    marginMm: { top: 7.1, bottom: 7.1, left: 7.1, right: 7.1 },
    columns: 3,
    rows: 7,
    labelWidthMm: 63.5,
    labelHeightMm: 38.1,
    gapMm: { horizontal: 2.5, vertical: 0 },
    cropMarks: false,
  },
  {
    id: "avery-5167",
    name: "Avery 5167 (Return Address)",
    paper: "Letter",
    paperWidthMm: 215.9,
    paperHeightMm: 279.4,
    marginMm: { top: 12.7, bottom: 12.7, left: 4.7, right: 4.7 },
    columns: 4,
    rows: 20,
    labelWidthMm: 50.8,
    labelHeightMm: 12.7,
    gapMm: { horizontal: 0, vertical: 0 },
    cropMarks: false,
  },
];

/* ------------------------------------------------------------------ */
/* Format normalisation                                                */
/* ------------------------------------------------------------------ */

/** Map our format id to the bwip-js bcid string. */
export function normalizeFormat(format: BarcodeFormat): string {
  const meta = FORMAT_REGISTRY[format];
  if (!meta) {
    throw new Error(`Unknown barcode format: ${format}`);
  }
  return meta.bwipId;
}

/* ------------------------------------------------------------------ */
/* Checksum computation                                                */
/* ------------------------------------------------------------------ */

/**
 * Compute the mod-10 weighted check digit used by EAN-13, EAN-8, UPC-A,
 * UPC-E and ITF-14. The data string must contain only digits and the
 * length must match the symbology's data length (without check).
 *
 * Algorithm: reverse the digits; weight the rightmost digit by 3, the
 * next by 1, alternating; sum all products; check = (10 - sum % 10) % 10.
 */
export function computeMod10CheckDigit(data: string): string {
  if (!/^\d+$/.test(data)) {
    throw new Error(`Mod-10 checksum requires digits only, got: ${data}`);
  }
  const digits = data.split("").map(Number);
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    // i=0 → rightmost digit (after reverse, the rightmost is at index 0)
    const fromRight = digits.length - 1 - i;
    const d = digits[fromRight]!;
    const weight = i % 2 === 0 ? 3 : 1;
    sum += d * weight;
  }
  const check = (10 - (sum % 10)) % 10;
  return String(check);
}

/**
 * Compute the MSI Plessey mod-10 check digit (Luhn-style):
 *   reverse → double digits at positions 1, 3, 5... (rightmost first)
 *   → split doubled results into single digits → sum → check = (10 - sum%10) % 10.
 */
export function computeMsiCheckDigit(data: string): string {
  if (!/^\d+$/.test(data)) {
    throw new Error(`MSI checksum requires digits only, got: ${data}`);
  }
  const digits = data.split("").map(Number);
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    const fromRight = digits.length - 1 - i;
    const d = digits[fromRight]!;
    if (i % 2 === 0) {
      // Rightmost, 3rd from right, ... → double
      const doubled = d * 2;
      sum += doubled < 10 ? doubled : Math.floor(doubled / 10) + (doubled % 10);
    } else {
      sum += d;
    }
  }
  const check = (10 - (sum % 10)) % 10;
  return String(check);
}

/**
 * Compute the check digit for a given symbology. Returns "" for symbologies
 * without a check digit (Codabar, Pharmacode, Code39 optional, 2D formats).
 *
 * For EAN/UPC/ITF the input is the DATA digits (without check). For MSI the
 * input is the data digits. For Code128 the function returns "" because the
 * mod-103 symbol check is computed during encoding by bwip-js.
 */
export function computeChecksum(format: BarcodeFormat, value: string): string {
  switch (format) {
    case "ean13":
    case "ean8":
    case "upca":
    case "upce":
    case "itf14":
      return computeMod10CheckDigit(value);
    case "msi":
      return computeMsiCheckDigit(value);
    default:
      return "";
  }
}

/* ------------------------------------------------------------------ */
/* Input validation                                                    */
/* ------------------------------------------------------------------ */

/**
 * Validate input for a given symbology. On success returns the cleaned
 * value (with check digit appended for EAN/UPC/ITF/MSI when the user
 * supplied only the data portion). On failure returns a human-readable
 * reason.
 */
export function validateInput(
  format: BarcodeFormat,
  rawValue: string,
): ToolResult<{ cleaned: string }> {
  const meta = FORMAT_REGISTRY[format];
  if (!meta) {
    return { ok: false, error: `Unknown format: ${format}` };
  }

  // Trim unicode whitespace and zero-width chars (per blueprint edge case).
  const value = (rawValue ?? "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim();

  if (value.length === 0) {
    return { ok: false, error: "Input is empty." };
  }

  switch (format) {
    case "ean13":
    case "ean8":
    case "upca":
    case "upce":
    case "itf14": {
      if (!/^\d+$/.test(value)) {
        return { ok: false, error: `${meta.label} accepts digits only.` };
      }
      const expected = meta.length as number;
      if (value.length === expected) {
        // Data only — append check digit.
        return { ok: true, output: { cleaned: value + computeChecksum(format, value) } };
      }
      if (value.length === expected + 1) {
        // User supplied check digit — verify it.
        const data = value.slice(0, expected);
        const userCheck = value.slice(expected);
        const computed = computeChecksum(format, data);
        if (userCheck !== computed) {
          return {
            ok: false,
            error: `Wrong check digit: expected ${computed}, got ${userCheck}.`,
          };
        }
        return { ok: true, output: { cleaned: value } };
      }
      return {
        ok: false,
        error: `${meta.label} needs ${expected} data digits (or ${expected + 1} with check); got ${value.length}.`,
      };
    }

    case "msi": {
      if (!/^\d+$/.test(value)) {
        return { ok: false, error: "MSI Plessey accepts digits only." };
      }
      if (value.length < 1) {
        return { ok: false, error: "MSI needs at least 1 digit." };
      }
      // Always append check digit.
      return { ok: true, output: { cleaned: value + computeMsiCheckDigit(value) } };
    }

    case "code128": {
      if (value.length > 80) {
        return {
          ok: false,
          error:
            "Code 128 input is very long (>80 chars) — most 1D scanners cannot decode beyond ~10cm field width.",
        };
      }
      // Code128 supports all 128 ASCII chars. bwip-js will reject non-encodable.
      // We allow any printable ASCII + tab.
      if (!/^[\x09\x20-\x7E]*$/.test(value)) {
        return {
          ok: false,
          error:
            "Code 128 supports ASCII 32-126 and tab. Unicode characters are not encodable.",
        };
      }
      return { ok: true, output: { cleaned: value } };
    }

    case "code39": {
      if (!/^[A-Z0-9\-. $/+% ]+$/.test(value)) {
        return {
          ok: false,
          error:
            "Code 39 supports A-Z, 0-9 and - . $ / + % SPACE only (uppercase).",
        };
      }
      return { ok: true, output: { cleaned: value } };
    }

    case "code93": {
      if (!/^[A-Z0-9\-. $/+% ]+$/.test(value)) {
        return {
          ok: false,
          error: "Code 93 supports the same charset as Code 39 (A-Z, 0-9, - . $ / + % SPACE).",
        };
      }
      return { ok: true, output: { cleaned: value } };
    }

    case "codabar": {
      if (!/^[0-9\-. $/:]+[A-E*NT]?[A-E*NT]?$/.test(value)) {
        return {
          ok: false,
          error:
            "Codabar supports digits and - . $ / : with start/stop chars A-E, *, N or T.",
        };
      }
      return { ok: true, output: { cleaned: value } };
    }

    case "pharmacode": {
      if (!/^\d+$/.test(value)) {
        return { ok: false, error: "Pharmacode accepts a single integer." };
      }
      const n = Number(value);
      if (!Number.isInteger(n) || n < 3 || n > 131070) {
        return {
          ok: false,
          error: "Pharmacode value must be an integer from 3 to 131070.",
        };
      }
      return { ok: true, output: { cleaned: value } };
    }

    case "gs1-128": {
      // Must contain at least one (NN) AI.
      if (!/\(\d+\)/.test(value)) {
        return {
          ok: false,
          error:
            'GS1-128 input must use application identifiers in parentheses, e.g. (01)15412345678905(17)251231',
        };
      }
      return { ok: true, output: { cleaned: value } };
    }

    case "qrcode":
    case "datamatrix":
    case "pdf417":
    case "aztec": {
      if (value.length > 2000) {
        return { ok: false, error: "2D barcode input is too long (max 2000 chars)." };
      }
      return { ok: true, output: { cleaned: value } };
    }

    default:
      return { ok: false, error: `Validation not implemented for ${format}.` };
  }
}

/* ------------------------------------------------------------------ */
/* Code 128 auto-subset analysis                                       */
/* ------------------------------------------------------------------ */

export interface Code128Segment {
  subset: "A" | "B" | "C";
  chars: string;
}

/**
 * Analyse Code 128 input and determine the auto-subset switching that
 * maximises density. Subset C encodes digit pairs in a single symbol,
 * so 4+ consecutive digits switch to C. We also use C if the run of
 * digits is even-length and >= 4.
 *
 * This mirrors the encoding decision bwip-js makes for `code128`; the
 * returned segments are used for the UI cheat-sheet and the test suite
 * (so we can verify digit-pair runs switch to subset C).
 */
export function analyzeCode128Subsets(input: string): Code128Segment[] {
  const segments: Code128Segment[] = [];
  let i = 0;
  while (i < input.length) {
    // Count consecutive digits from current position.
    let digitRun = 0;
    while (
      i + digitRun < input.length &&
      /\d/.test(input[i + digitRun]!)
    ) {
      digitRun++;
    }
    if (digitRun >= 4) {
      // Use subset C for as many digit pairs as possible.
      const pairs = Math.floor(digitRun / 2);
      const take = pairs * 2;
      segments.push({ subset: "C", chars: input.slice(i, i + take) });
      i += take;
      // If a single odd digit remains, fall through to B for that one.
      if (digitRun % 2 === 1 && i < input.length && /\d/.test(input[i]!)) {
        segments.push({ subset: "B", chars: input[i]! });
        i += 1;
      }
    } else {
      // Use subset B for non-digit chars (B is preferred over A in modern use).
      let j = i;
      while (j < input.length && !/\d/.test(input[j]!)) j++;
      if (j === i) {
        // 1-3 digit run — also subset B.
        j = i + digitRun;
      }
      segments.push({ subset: "B", chars: input.slice(i, j) });
      i = j;
    }
  }
  return segments;
}

/* ------------------------------------------------------------------ */
/* GS1 string builder                                                   */
/* ------------------------------------------------------------------ */

/**
 * Build a GS1 application-identifier string in the
 * `(AI)value(AI)value` format that bwip-js `gs1-128` parses.
 *
 * Example:
 *   buildGs1String([{ai:"01", value:"15412345678905"}, {ai:"17", value:"251231"}])
 *   → "(01)15412345678905(17)251231"
 */
export function buildGs1String(ais: { ai: string; value: string }[]): string {
  return ais
    .map(({ ai, value }) => {
      const cleanAi = ai.replace(/[^\d]/g, "");
      const cleanValue = value.trim();
      return `(${cleanAi})${cleanValue}`;
    })
    .join("");
}

/* ------------------------------------------------------------------ */
/* Bulk CSV parser                                                     */
/* ------------------------------------------------------------------ */

/**
 * Parse bulk CSV input. Accepts two shapes:
 *  1. `value\nvalue\n...` — one barcode per line (caller supplies format).
 *  2. `format,value[,label]\n...` — CSV with per-row format.
 *
 * Each value is trimmed of unicode whitespace and zero-width chars. Empty
 * lines are skipped. Malformed rows (bad format id) cause a single error
 * listing every bad row index (1-based) — partial parses are NOT returned.
 */
export function parseBulkCsv(csvText: string): ToolResult<BulkBarcodeRow[]> {
  if (!csvText || !csvText.trim()) {
    return { ok: false, error: "CSV input is empty." };
  }
  const knownFormats = new Set(Object.keys(FORMAT_REGISTRY) as BarcodeFormat[]);
  const lines = csvText.split(/\r?\n/);
  const rows: BulkBarcodeRow[] = [];
  const errors: number[] = [];

  lines.forEach((line, idx) => {
    const lineNo = idx + 1;
    // Allow leading/trailing spaces in cells, strip BOM/zero-width.
    const clean = line.replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
    if (clean.length === 0) return;

    // Detect delimiter: comma if present, else single-column.
    const cells = clean.includes(",")
      ? clean.split(",").map((c) => c.trim())
      : [clean];

    if (cells.length === 1) {
      rows.push({ format: "code128", value: cells[0]! });
    } else {
      const fmt = cells[0]!.toLowerCase() as BarcodeFormat;
      if (!knownFormats.has(fmt)) {
        errors.push(lineNo);
        return;
      }
      const value = cells[1] ?? "";
      const label = cells[2];
      rows.push({ format: fmt, value, label });
    }
  });

  if (errors.length > 0) {
    return {
      ok: false,
      error: `Unknown barcode format on line(s): ${errors.join(", ")}. Valid formats: ${[...knownFormats].join(", ")}.`,
    };
  }
  if (rows.length === 0) {
    return { ok: false, error: "CSV had no non-empty rows." };
  }
  return { ok: true, output: rows };
}

/* ------------------------------------------------------------------ */
/* Sequence generator                                                  */
/* ------------------------------------------------------------------ */

/**
 * Generate a sequence of barcode values from a starting value, incrementing
 * by `step` for `count` iterations. Designed for EAN-13 / UPC-A / ITF-14
 * product runs. The check digit is recomputed for each value (the start
 * value may be supplied with or without a check digit; if supplied with one,
 * it is stripped and re-computed for the sequence).
 *
 * Returns the data values WITHOUT the check digit, so the caller can pass
 * them through `validateInput` (which will append the check).
 */
export function generateSequence(
  format: BarcodeFormat,
  startValue: string,
  step: number,
  count: number,
): string[] {
  if (!Number.isFinite(step) || step <= 0) {
    throw new Error("step must be a positive number");
  }
  if (!Number.isInteger(count) || count <= 0 || count > 100_000) {
    throw new Error("count must be a positive integer <= 100000");
  }
  const meta = FORMAT_REGISTRY[format];
  if (!meta) throw new Error(`Unknown format: ${format}`);

  // For numeric retail/logistics formats, treat as integer + step.
  if (typeof meta.length === "number") {
    const expected = meta.length as number;
    // Strip check digit if user supplied the full length.
    const startDigits = startValue.replace(/\D/g, "");
    if (startDigits.length < expected) {
      throw new Error(
        `Start value needs at least ${expected} digits (data) for ${meta.label}.`,
      );
    }
    const data = startDigits.slice(0, expected);
    const startNum = BigInt(data);
    const stepBig = BigInt(Math.floor(step));
    const result: string[] = [];
    for (let i = 0; i < count; i++) {
      const v = (startNum + stepBig * BigInt(i)).toString();
      const padded = v.padStart(expected, "0");
      result.push(padded);
    }
    return result;
  }
  // Variable-length format — increment by step in plain numeric space.
  const startNum = Number(startValue.replace(/\D/g, "")) || 0;
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    result.push(String(startNum + step * i));
  }
  return result;
}

/* ------------------------------------------------------------------ */
/* Quiet zone calculator (per ISO/IEC spec)                            */
/* ------------------------------------------------------------------ */

/**
 * Compute the minimum quiet-zone width in millimetres for a given X-dimension
 * (module width in mm). Per ISO/IEC 15420 (EAN/UPC), ISO/IEC 15417 (Code128),
 * etc., the quiet zone is at least 10× the X-dimension for most symbologies.
 *
 * References:
 *  - EAN-13 / EAN-8 / UPC-A: left 11×X, right 7×X (per ISO/IEC 15420).
 *  - ITF-14: 10×X both sides.
 *  - Code128: 10×X both sides.
 *  - Code39: 16×X (recommended) / 10×X (minimum).
 *  - Codabar: 10×X minimum.
 *  - MSI: 12×X minimum.
 *  - Pharmacode: 2mm fixed.
 *  - 2D formats: minimum 4×X for QR / DataMatrix (per their ISO specs).
 *
 * Returns the larger of left/right minimum (so the caller can apply it to
 * both sides uniformly).
 */
export function computeQuietZone(
  xDimensionMm: number,
  format: BarcodeFormat = "code128",
): number {
  if (!Number.isFinite(xDimensionMm) || xDimensionMm <= 0) {
    throw new Error("xDimension must be a positive number (mm).");
  }
  const multipliers: Partial<Record<BarcodeFormat, number>> = {
    ean13: 11,
    ean8: 11,
    upca: 11,
    upce: 11,
    itf14: 10,
    "gs1-128": 10,
    code128: 10,
    code39: 16,
    code93: 10,
    codabar: 10,
    msi: 12,
    pharmacode: 2 / Math.max(xDimensionMm, 0.1), // 2mm fixed → expressed in X
    qrcode: 4,
    datamatrix: 4,
    pdf417: 4,
    aztec: 0, // No quiet zone required (central finder pattern)
  };
  const mult = multipliers[format] ?? 10;
  if (format === "pharmacode") return 2; // 2mm fixed
  const zone = mult * xDimensionMm;
  // Round to 2 decimal places for clean display.
  return Math.round(zone * 100) / 100;
}

/* ------------------------------------------------------------------ */
/* Colour contrast checker                                             */
/* ------------------------------------------------------------------ */

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1]!;
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return { r, g, b };
}

function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }): number {
  const f = (c: number) => {
    const cs = c / 255;
    return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/**
 * Check whether two colours have enough luminance contrast for a scanner
 * to read reliably. Most 1D scanners require >= 0.50 contrast ratio
 * (per ISO/IEC 15426-1 PCS — Print Contrast Signal). We use a slightly
 * stricter 0.60 threshold to give margin for ink spread.
 *
 * Returns:
 *   - delta: contrast ratio (0-1, where 1 = max).
 *   - passes: true if delta >= 0.60.
 *
 * For "transparent" background we treat it as white (paper) since the
 * barcode will be printed on white label stock in 99% of cases.
 */
export function checkColorContrast(
  fg: string,
  bg: string,
): { passes: boolean; delta: number; reason: string } {
  const fgRgb = parseHex(fg);
  const bgRgb = bg.toLowerCase() === "transparent" ? parseHex("#ffffff") : parseHex(bg);
  if (!fgRgb || !bgRgb) {
    return {
      passes: false,
      delta: 0,
      reason: "Invalid colour format — use #RRGGBB.",
    };
  }
  const l1 = relativeLuminance(fgRgb);
  const l2 = relativeLuminance(bgRgb);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  const ratio = (lighter + 0.05) / (darker + 0.05);
  // Convert WCAG ratio (1-21) to PCS-style 0-1 delta.
  const delta = Math.max(0, Math.min(1, (ratio - 1) / 20));
  const passes = delta >= 0.6;
  return {
    passes,
    delta: Math.round(delta * 100) / 100,
    reason: passes
      ? "Contrast is high enough for reliable scanner reading."
      : "Low contrast — scanners may fail to read. Use black-on-white or another high-contrast pair.",
  };
}

/* ------------------------------------------------------------------ */
/* Manifest exporter                                                   */
/* ------------------------------------------------------------------ */

function csvEscape(s: string): string {
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Build a CSV manifest from a list of BarcodeResults. Columns:
 *   filename, format, value, checksum, width_px, height_px, width_mm, height_mm, data_uri
 */
export function csvManifestExport(rows: BarcodeResult[]): string {
  const header = [
    "filename",
    "format",
    "value",
    "checksum",
    "width_px",
    "height_px",
    "width_mm",
    "height_mm",
    "data_uri",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        csvEscape(r.filename),
        csvEscape(r.format),
        csvEscape(r.value),
        csvEscape(r.checksum),
        String(r.widthPx),
        String(r.heightPx),
        String(r.widthMm),
        String(r.heightMm),
        csvEscape(r.dataUrl ?? ""),
      ].join(","),
    );
  }
  return lines.join("\n");
}

/** Build a JSON manifest (used by the manifest-export extra). */
export function jsonManifestExport(rows: BarcodeResult[]): string {
  return JSON.stringify(rows, null, 2);
}

/* ------------------------------------------------------------------ */
/* Lazy-loaded renderers (browser-only)                                */
/* ------------------------------------------------------------------ */

/** Internal: build the bwip-js RenderOptions object. */
function buildBwipOptions(
  format: BarcodeFormat,
  value: string,
  opts: BarcodeOptions = {},
): Record<string, unknown> {
  const meta = FORMAT_REGISTRY[format];
  const bcid = meta.bwipId;
  const scale = opts.scale ?? 2;
  const height = opts.height ?? 10;
  const foreground = (opts.foreground ?? "#000000").replace("#", "");
  const background =
    opts.background && opts.background.toLowerCase() !== "transparent"
      ? opts.background.replace("#", "")
      : undefined;
  const optsObj: Record<string, unknown> = {
    bcid,
    text: value,
    scale,
    height,
    includetext: opts.showText ?? true,
    textfont: opts.textFont ?? "Inconsolata",
    textsize: opts.textSize ?? 9,
    textyalign: opts.textYAlign ?? "below",
    paddingwidth: opts.paddingX ?? 10,
    paddingheight: opts.paddingY ?? 5,
    barcolor: foreground,
  };
  if (background) optsObj.backgroundcolor = background;
  if (opts.textYAlign) optsObj.textyalign = opts.textYAlign;
  // GS1-128 needs parsefnc so (NN) is interpreted as AI markers.
  if (format === "gs1-128") {
    optsObj.parsefnc = true;
  }
  // Code128 subset forcing.
  if (format === "code128" && opts.code128Subset && opts.code128Subset !== "auto") {
    optsObj.parse = true;
    // bwip-js uses ^A, ^B, ^C as subset-switch markers when parse=1.
    optsObj.text = `^${opts.code128Subset}${value}`;
  }
  return optsObj;
}

/**
 * Render a barcode to an HTMLCanvasElement (browser only). bwip-js is
 * dynamically imported on first call — keeps the ~600KB bundle off the
 * initial page weight.
 */
export async function renderToCanvas(
  format: BarcodeFormat,
  value: string,
  options: BarcodeOptions = {},
): Promise<ToolResult<HTMLCanvasElement>> {
  try {
    const validation = validateInput(format, value);
    if (!validation.ok) {
      return { ok: false, error: validation.error };
    }
    const bwip = await import("bwip-js/browser");
    const canvas = document.createElement("canvas");
    bwip.toCanvas(canvas, buildBwipOptions(format, validation.output.cleaned, options) as never);
    return { ok: true, output: canvas };
  } catch (e) {
    return { ok: false, error: `bwip-js render failed: ${(e as Error).message}` };
  }
}

/**
 * Render a barcode to an SVG string (browser or Node — uses bwip-js
 * `toSVG` which requires no canvas).
 */
export async function renderToSvg(
  format: BarcodeFormat,
  value: string,
  options: BarcodeOptions = {},
): Promise<ToolResult<string>> {
  try {
    const validation = validateInput(format, value);
    if (!validation.ok) {
      return { ok: false, error: validation.error };
    }
    const bwip = await import("bwip-js/browser");
    const svg = bwip.toSVG(buildBwipOptions(format, validation.output.cleaned, options) as never);
    return { ok: true, output: svg };
  } catch (e) {
    return { ok: false, error: `bwip-js SVG render failed: ${(e as Error).message}` };
  }
}

/**
 * Render a barcode to a PNG Blob (browser only — uses Canvas toBlob).
 */
export async function renderToPngBlob(
  format: BarcodeFormat,
  value: string,
  options: BarcodeOptions = {},
): Promise<ToolResult<Blob>> {
  try {
    const canvasResult = await renderToCanvas(format, value, options);
    if (!canvasResult.ok) {
      return { ok: false, error: canvasResult.error };
    }
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvasResult.output.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Canvas toBlob returned null"))),
        "image/png",
      );
    });
    return { ok: true, output: blob };
  } catch (e) {
    return { ok: false, error: `PNG render failed: ${(e as Error).message}` };
  }
}

/**
 * Render a list of barcodes to a print-ready label-sheet PDF. Uses jsPDF
 * (lazy-loaded ~250KB) and a LabelSheetSpec to lay out each barcode on
 * the page. Adds crop marks when `spec.cropMarks` is true.
 *
 * Browser-only — requires canvas rendering via bwip-js.
 */
export async function renderToPdf(
  barcodes: BulkBarcodeRow[],
  labelSpec?: LabelSheetSpec,
): Promise<ToolResult<Blob>> {
  try {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return { ok: false, error: "PDF rendering requires a browser environment." };
    }
    const spec = labelSpec ?? BUILTIN_LABEL_SHEETS[0]!;
    const { jsPDF } = await import("jspdf");
    const bwip = await import("bwip-js/browser");

    const pdf = new jsPDF({
      unit: "mm",
      format: spec.paper === "A4" ? "a4" : spec.paper === "Letter" ? "letter" : "legal",
      orientation: "portrait",
    });

    const pageWidthMm = spec.paperWidthMm;
    const pageHeightMm = spec.paperHeightMm;
    const perPage = spec.columns * spec.rows;
    const cellWidth = spec.labelWidthMm;
    const cellHeight = spec.labelHeightMm;

    let placed = 0;
    for (let i = 0; i < barcodes.length; i++) {
      const row = barcodes[i]!;
      if (i > 0 && i % perPage === 0) {
        pdf.addPage();
        placed = 0;
      }
      const col = placed % spec.columns;
      const rowIdx = Math.floor(placed / spec.columns);
      const xMm =
        spec.marginMm.left + col * (cellWidth + spec.gapMm.horizontal);
      const yMm =
        spec.marginMm.top + rowIdx * (cellHeight + spec.gapMm.vertical);

      // Validate input first — skip bad rows with a small placeholder.
      const validation = validateInput(row.format, row.value);
      if (!validation.ok) {
        pdf.setFontSize(7);
        pdf.text(`INVALID: ${row.value}`, xMm + 2, yMm + cellHeight / 2);
        placed++;
        continue;
      }

      try {
        const canvas = document.createElement("canvas");
        bwip.toCanvas(canvas, buildBwipOptions(row.format, validation.output.cleaned, {
          scale: 2,
          height: cellHeight * 0.6,
          paddingX: 2,
          paddingY: 1,
          showText: true,
        }) as never);
        const dataUrl = canvas.toDataURL("image/png");
        const imgW = cellWidth - 4;
        const imgH = cellHeight * 0.7;
        pdf.addImage(dataUrl, "PNG", xMm + 2, yMm + 1, imgW, imgH);
      } catch {
        pdf.setFontSize(7);
        pdf.text(`ERR: ${row.value}`, xMm + 2, yMm + cellHeight / 2);
      }

      if (spec.cropMarks) {
        // Draw 4 corner crop marks (2mm each).
        const markLen = 2;
        pdf.setDrawColor(0, 0, 0);
        pdf.setLineWidth(0.1);
        // Top-left
        pdf.line(xMm, yMm, xMm + markLen, yMm);
        pdf.line(xMm, yMm, xMm, yMm + markLen);
        // Top-right
        pdf.line(xMm + cellWidth, yMm, xMm + cellWidth - markLen, yMm);
        pdf.line(xMm + cellWidth, yMm, xMm + cellWidth, yMm + markLen);
        // Bottom-left
        pdf.line(xMm, yMm + cellHeight, xMm + markLen, yMm + cellHeight);
        pdf.line(xMm, yMm + cellHeight, xMm, yMm + cellHeight - markLen);
        // Bottom-right
        pdf.line(xMm + cellWidth, yMm + cellHeight, xMm + cellWidth - markLen, yMm + cellHeight);
        pdf.line(xMm + cellWidth, yMm + cellHeight, xMm + cellWidth, yMm + cellHeight - markLen);
      }
      placed++;
    }

    const blob = pdf.output("blob");
    return { ok: true, output: blob };
  } catch (e) {
    return { ok: false, error: `PDF render failed: ${(e as Error).message}` };
  }
}

/* ------------------------------------------------------------------ */
/* Helpers for the UI                                                  */
/* ------------------------------------------------------------------ */

/** Compute output dimensions in millimetres given pixels + DPI. */
export function pixelsToMm(px: number, dpi: number): number {
  if (!Number.isFinite(dpi) || dpi <= 0) return 0;
  return Math.round((px / dpi) * 25.4 * 100) / 100;
}

/** Build a PNG data URL from a Blob (used for copy-as-data-URI extra). */
export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Build a sensible filename for a barcode. */
export function buildBarcodeFilename(format: BarcodeFormat, value: string, ext: string): string {
  const safeValue = value
    .replace(/[^\w.-]+/g, "_")
    .slice(0, 40)
    .replace(/_+$/g, "");
  return `barcode-${format}-${safeValue || "value"}.${ext}`;
}
