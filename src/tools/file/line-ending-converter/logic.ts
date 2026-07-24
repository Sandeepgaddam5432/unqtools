/**
 * Line Ending Converter — pure logic.
 */

export type LineEnding = "crlf" | "lf" | "cr";

export interface LineEndingInfo {
  crlfCount: number;
  lfCount: number;
  crCount: number;
  detected: LineEnding | "mixed" | "none";
  totalLines: number;
  hasBom: boolean;
  warnings: string[];
}

export interface ConvertOptions {
  target: LineEnding;
  /** Preserve UTF-8 BOM if present. Default true. */
  preserveBom?: boolean;
  /** Strip BOM regardless of source. Default false. */
  stripBom?: boolean;
}

export interface ConvertResult {
  output: string;
  source: LineEndingInfo;
  target: LineEnding;
  convertedCount: number;
  sizeBefore: number;
  sizeAfter: number;
  sizeDelta: number;
}

const BOM = "\uFEFF";

export function detectLineEndings(text: string): LineEndingInfo {
  let crlfCount = 0;
  let lfCount = 0;
  let crCount = 0;
  // Count LF not preceded by CR (true LF), CRLF (paired), CR not followed by LF (true CR).
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === "\r" && next === "\n") {
      crlfCount++;
      i++; // skip the \n
    } else if (ch === "\n") {
      lfCount++;
    } else if (ch === "\r") {
      crCount++;
    }
  }
  const totalLines = crlfCount + lfCount + crCount;
  const counts = { crlf: crlfCount, lf: lfCount, cr: crCount };
  const nonZero = (Object.entries(counts).filter(([, v]) => v > 0));
  let detected: LineEndingInfo["detected"];
  if (nonZero.length === 0) detected = "none";
  else if (nonZero.length === 1) detected = nonZero[0]![0] as LineEnding;
  else detected = "mixed";

  const hasBom = text.charCodeAt(0) === 0xFEFF;
  const warnings: string[] = [];
  if (detected === "mixed") {
    warnings.push(`Mixed line endings detected: CRLF=${crlfCount}, LF=${lfCount}, CR=${crCount}.`);
  }
  if (hasBom) {
    warnings.push("UTF-8 BOM detected. Use 'Strip BOM' option to remove.");
  }

  return { crlfCount, lfCount, crCount, detected, totalLines, hasBom, warnings };
}

export function convertLineEndings(text: string, options: ConvertOptions): ConvertResult {
  const source = detectLineEndings(text);
  const sizeBefore = new Blob([text]).size;

  // Normalize: strip all CR and LF, then split by LF (which catches the LF part of CRLF after CR removal)
  // Better: replace CRLF → LF first, then CR → LF, so we end up with only LF.
  let normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  // Now normalized has only LF. Replace with target.
  const targetChar = options.target === "crlf" ? "\r\n" : options.target === "cr" ? "\r" : "\n";
  let output = normalized.replace(/\n/g, targetChar);

  // Handle BOM
  const hasBom = output.charCodeAt(0) === 0xFEFF;
  if (options.stripBom && hasBom) {
    output = output.slice(1);
  } else if (options.preserveBom !== false && source.hasBom && !hasBom) {
    output = BOM + output;
  } else if (options.stripBom && hasBom) {
    output = output.slice(1);
  }

  const sizeAfter = new Blob([output]).size;
  const convertedCount = source.totalLines;

  return {
    output,
    source,
    target: options.target,
    convertedCount,
    sizeBefore,
    sizeAfter,
    sizeDelta: sizeAfter - sizeBefore,
  };
}

/** Generate .gitattributes for a given target line ending. */
export function generateGitattributes(target: LineEnding): string {
  const eol = target === "crlf" ? "crlf" : "lf";
  return `# Auto-detect text files and perform LF/CRLF normalization\n* text=auto\n\n# Default line ending for text files\n* text eol=${eol}\n\n# Common binary files (no line ending normalization)\n*.png binary\n*.jpg binary\n*.jpeg binary\n*.gif binary\n*.pdf binary\n*.zip binary\n*.tar binary\n*.gz binary\n*.7z binary\n*.exe binary\n*.dll binary\n*.so binary\n*.dylib binary\n*.woff binary\n*.woff2 binary\n*.ttf binary\n*.otf binary\n*.eot binary\n*.mp3 binary\n*.mp4 binary\n*.webm binary\n*.ogg binary\n*.wav binary\n`;
}

/** Generate EditorConfig snippet for a given target line ending. */
export function generateEditorConfig(target: LineEnding): string {
  const eol = target === "crlf" ? "crlf" : target === "cr" ? "cr" : "lf";
  return `root = true\n\n[*]\ncharset = utf-8\nend_of_line = ${eol}\ninsert_final_newline = true\ntrim_trailing_whitespace = true\nindent_style = space\nindent_size = 2\n\n[*.md]\ntrim_trailing_whitespace = false\n`;
}

/** Generate byte-level diff for first line (helps debug BOM/CR/LF issues). */
export function byteDiffFirstLine(before: string, after: string): string {
  const beforeBytes = Array.from(before.slice(0, 80)).map((c) => c.charCodeAt(0).toString(16).padStart(2, "0")).join(" ");
  const afterBytes = Array.from(after.slice(0, 80)).map((c) => c.charCodeAt(0).toString(16).padStart(2, "0")).join(" ");
  return `BEFORE (first 80 bytes):\\n  ${beforeBytes}\\n\\nAFTER (first 80 bytes):\\n  ${afterBytes}`;
}

/** Preview first N lines of source + converted. */
export function previewLines(before: string, after: string, n = 5): { before: string[]; after: string[] } {
  const beforeLines = before.split(/\r\n|\r|\n/).slice(0, n);
  const afterLines = after.split(/\r\n|\r|\n/).slice(0, n);
  return { before: beforeLines, after: afterLines };
}
