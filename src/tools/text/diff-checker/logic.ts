/**
 * Diff Checker v2 — Flagship diff engine.
 *
 * Implements the Myers diff algorithm for line-level diffing,
 * with word-level and character-level refinement.
 * Pure TS, zero dependencies.
 */

export type DiffGranularity = "line" | "word" | "char";
export type DiffView = "unified" | "split";
export type DiffOp = "equal" | "add" | "del" | "change";

export interface DiffLine {
  type: DiffOp;
  oldNumber: number | null;
  newNumber: number | null;
  content: string;
  // For word/char-level inline diff within a changed line
  inlineParts?: { type: DiffOp; text: string }[];
}

export interface DiffOptions {
  ignoreWhitespace: boolean;
  ignoreCase: boolean;
  trimLines: boolean;
  granularity: DiffGranularity;
}

export const DEFAULT_OPTIONS: DiffOptions = {
  ignoreWhitespace: false,
  ignoreCase: false,
  trimLines: false,
  granularity: "line",
};

export interface DiffStats {
  additions: number;
  deletions: number;
  changes: number;
  totalLines: number;
}

/**
 * Myers diff algorithm — computes the shortest edit script between two sequences.
 * Returns a list of operations: { op: "equal" | "add" | "del", lines: string[] }
 */
interface MyersOp {
  op: "equal" | "add" | "del";
  lines: string[];
}

function myersDiff(a: string[], b: string[]): MyersOp[] {
  const n = a.length;
  const m = b.length;
  const max = n + m;
  const v: number[] = new Array(2 * max + 1).fill(0);
  const trace: number[][] = [];

  for (let d = 0; d <= max; d++) {
    trace.push([...v]);
    for (let k = -d; k <= d; k += 2) {
      let x: number;
      if (k === -d || (k !== d && v[k - 1 + max]! < v[k + 1 + max]!)) {
        x = v[k + 1 + max]!;
      } else {
        x = v[k - 1 + max]! + 1;
      }
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x++;
        y++;
      }
      v[k + max] = x;
      if (x >= n && y >= m) {
        // Backtrack to build the edit script
        return backtrack(trace, a, b, max, d);
      }
    }
  }
  return [];
}

function backtrack(
  trace: number[][],
  a: string[],
  b: string[],
  max: number,
  finalD: number,
): MyersOp[] {
  const ops: MyersOp[] = [];
  let x = a.length;
  let y = b.length;

  for (let d = finalD; d > 0; d--) {
    const v = trace[d]!;
    const k = x - y;
    let prevK: number;
    if (k === -d || (k !== d && v[k - 1 + max]! < v[k + 1 + max]!)) {
      prevK = k + 1;
    } else {
      prevK = k - 1;
    }
    const prevX = v[prevK + max]!;
    const prevY = prevX - prevK;

    // Diagonal (equal)
    while (x > prevX && y > prevY) {
      ops.unshift({ op: "equal", lines: [a[x - 1]!] });
      x--;
      y--;
    }

    if (d > 0) {
      if (x === prevX) {
        // Addition (down)
        ops.unshift({ op: "add", lines: [b[y - 1]!] });
        y--;
      } else {
        // Deletion (left)
        ops.unshift({ op: "del", lines: [a[x - 1]!] });
        x--;
      }
    }
  }

  // Handle remaining diagonal at d=0
  while (x > 0 && y > 0 && a[x - 1] === b[y - 1]) {
    ops.unshift({ op: "equal", lines: [a[x - 1]!] });
    x--;
    y--;
  }

  // Merge consecutive same-op lines
  const merged: MyersOp[] = [];
  for (const op of ops) {
    const last = merged[merged.length - 1];
    if (last && last.op === op.op) {
      last.lines.push(...op.lines);
    } else {
      merged.push({ ...op, lines: [...op.lines] });
    }
  }

  return merged;
}

/**
 * Normalize a line based on options (trim, ignore case, ignore whitespace).
 */
function normalizeLine(line: string, opts: DiffOptions): string {
  let result = line;
  if (opts.trimLines) result = result.trim();
  if (opts.ignoreWhitespace) result = result.replace(/\s+/g, " ").trim();
  if (opts.ignoreCase) result = result.toLowerCase();
  return result;
}

/**
 * Compute word-level inline diff between two lines.
 */
function diffWords(oldLine: string, newLine: string): { type: DiffOp; text: string }[] {
  const oldWords = oldLine.split(/(\s+)/);
  const newWords = newLine.split(/(\s+)/);
  const ops = myersDiff(oldWords, newWords);
  const parts: { type: DiffOp; text: string }[] = [];
  for (const op of ops) {
    for (const line of op.lines) {
      parts.push({
        type: op.op === "equal" ? "equal" : op.op === "add" ? "add" : "del",
        text: line,
      });
    }
  }
  return parts;
}

/**
 * Compute character-level inline diff between two lines.
 */
function diffChars(oldLine: string, newLine: string): { type: DiffOp; text: string }[] {
  const oldChars = Array.from(oldLine);
  const newChars = Array.from(newLine);
  const ops = myersDiff(oldChars, newChars);
  const parts: { type: DiffOp; text: string }[] = [];
  for (const op of ops) {
    for (const c of op.lines) {
      parts.push({ type: op.op === "equal" ? "equal" : op.op === "add" ? "add" : "del", text: c });
    }
  }
  return parts;
}

/**
 * Main entry point — computes the diff between two texts.
 * Returns DiffLine[] for rendering.
 */
export function computeDiff(oldText: string, newText: string, opts: DiffOptions): DiffLine[] {
  if (!oldText && !newText) return [];

  const o = { ...DEFAULT_OPTIONS, ...opts };

  // Normalize line endings
  const oldLines = oldText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const newLines = newText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

  // For comparison, normalize lines per options
  const oldNorm = oldLines.map((l) => normalizeLine(l, o));
  const newNorm = newLines.map((l) => normalizeLine(l, o));

  // Run Myers diff on normalized lines
  const ops = myersDiff(oldNorm, newNorm);

  const result: DiffLine[] = [];
  let oldNum = 1;
  let newNum = 1;

  for (const op of ops) {
    for (const line of op.lines) {
      switch (op.op) {
        case "equal":
          result.push({
            type: "equal",
            oldNumber: oldNum++,
            newNumber: newNum++,
            content: line,
          });
          break;
        case "add":
          result.push({
            type: "add",
            oldNumber: null,
            newNumber: newNum++,
            content: line,
          });
          break;
        case "del":
          result.push({
            type: "del",
            oldNumber: oldNum++,
            newNumber: null,
            content: line,
          });
          break;
      }
    }
  }

  // For word/char granularity, compute inline diffs on adjacent add/del pairs
  if (o.granularity !== "line") {
    for (let i = 0; i < result.length; i++) {
      if (result[i]!.type === "del" && i + 1 < result.length && result[i + 1]!.type === "add") {
        const oldContent = result[i]!.content;
        const newContent = result[i + 1]!.content;
        if (o.granularity === "word") {
          result[i]!.inlineParts = diffWords(oldContent, newContent).filter(
            (p) => p.type !== "add",
          );
          result[i + 1]!.inlineParts = diffWords(oldContent, newContent).filter(
            (p) => p.type !== "del",
          );
        } else {
          result[i]!.inlineParts = diffChars(oldContent, newContent).filter(
            (p) => p.type !== "add",
          );
          result[i + 1]!.inlineParts = diffChars(oldContent, newContent).filter(
            (p) => p.type !== "del",
          );
        }
      }
    }
  }

  return result;
}

export function getDiffStats(lines: DiffLine[]): DiffStats {
  let additions = 0;
  let deletions = 0;
  let changes = 0;
  for (const line of lines) {
    if (line.type === "add") additions++;
    else if (line.type === "del") deletions++;
  }
  // Count changes = adjacent del+add pairs
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.type === "del" && i + 1 < lines.length && lines[i + 1]!.type === "add") {
      changes++;
    }
  }
  return {
    additions,
    deletions,
    changes,
    totalLines: lines.length,
  };
}

/**
 * Generate a unified diff (.patch) string.
 */
export function toUnifiedPatch(
  oldText: string,
  newText: string,
  opts: DiffOptions,
  oldFilename = "original",
  newFilename = "modified",
): string {
  const lines = computeDiff(oldText, newText, opts);
  if (lines.length === 0 || lines.every((l) => l.type === "equal")) return "";

  const patches: string[] = [];
  patches.push(`--- ${oldFilename}`);
  patches.push(`+++ ${newFilename}`);

  // Group into hunks
  let hunkStart = 0;
  while (hunkStart < lines.length) {
    // Find the start of a change
    while (hunkStart < lines.length && lines[hunkStart]!.type === "equal") hunkStart++;
    if (hunkStart >= lines.length) break;

    // Include 3 lines of context before
    const hunkBegin = Math.max(0, hunkStart - 3);
    // Find the end of the change + 3 lines context
    let hunkEnd = hunkStart;
    while (hunkEnd < lines.length && lines[hunkEnd]!.type !== "equal") hunkEnd++;
    hunkEnd = Math.min(lines.length, hunkEnd + 3);

    // Calculate line numbers
    let oldStart = 0;
    let newStart = 0;
    let oldCount = 0;
    let newCount = 0;
    for (let i = hunkBegin; i < hunkEnd; i++) {
      const line = lines[i]!;
      if (line.oldNumber !== null) {
        if (oldStart === 0) oldStart = line.oldNumber;
        oldCount++;
      }
      if (line.newNumber !== null) {
        if (newStart === 0) newStart = line.newNumber;
        newCount++;
      }
    }

    patches.push(`@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`);

    for (let i = hunkBegin; i < hunkEnd; i++) {
      const line = lines[i]!;
      const prefix = line.type === "add" ? "+" : line.type === "del" ? "-" : " ";
      patches.push(prefix + line.content);
    }

    hunkStart = hunkEnd;
  }

  return patches.join("\n") + "\n";
}
