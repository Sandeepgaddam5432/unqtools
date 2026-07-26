/**
 * Word Search Maker — pure logic.
 * Grid generation, word placement in 8 directions, fill blanks.
 */

export type Direction = "E" | "W" | "N" | "S" | "NE" | "NW" | "SE" | "SW";

export const DIRECTIONS: Direction[] = ["E", "W", "N", "S", "NE", "NW", "SE", "SW"];

export const DIRECTION_VECTORS: Record<Direction, [number, number]> = {
  E: [0, 1],
  W: [0, -1],
  N: [-1, 0],
  S: [1, 0],
  NE: [-1, 1],
  NW: [-1, -1],
  SE: [1, 1],
  SW: [1, -1],
};

export interface PlacedWord {
  word: string;
  row: number;
  col: number;
  direction: Direction;
}

export interface WordSearchPuzzle {
  size: number;
  grid: string[][];
  placed: PlacedWord[];
  unplaced: string[];
}

/** Normalize a word: uppercase, strip non-letters. */
export function normalizeWord(word: string): string {
  return word.toUpperCase().replace(/[^A-Z]/g, "");
}

/** Validate a word list — return [valid, invalid reasons]. */
export function validateWords(words: string[], size: number): { valid: string[]; invalid: Array<{ word: string; reason: string }> } {
  const valid: string[] = [];
  const invalid: Array<{ word: string; reason: string }> = [];
  for (const w of words) {
    const n = normalizeWord(w);
    if (n.length < 2) {
      invalid.push({ word: w, reason: "Too short (min 2 letters)" });
    } else if (n.length > size) {
      invalid.push({ word: w, reason: `Too long (max ${size} letters)` });
    } else {
      valid.push(n);
    }
  }
  return { valid, invalid };
}

/** Try to place a word on the grid; return placement or null. */
function tryPlace(grid: string[][], word: string, size: number, allowReverse = true, rng: () => number = Math.random): PlacedWord | null {
  const dirs: Direction[] = allowReverse ? DIRECTIONS : ["E", "S", "SE", "NE"];
  const attempts = 100;
  for (let a = 0; a < attempts; a++) {
    const dir = dirs[Math.floor(rng() * dirs.length)];
    const [dr, dc] = DIRECTION_VECTORS[dir];
    const endRow = (word.length - 1) * dr;
    const endCol = (word.length - 1) * dc;
    const minRow = Math.min(0, endRow);
    const maxRow = Math.max(0, endRow);
    const minCol = Math.min(0, endCol);
    const maxCol = Math.max(0, endCol);
    const startRow = Math.floor(rng() * (size - (maxRow - minRow))) - minRow;
    const startCol = Math.floor(rng() * (size - (maxCol - minCol))) - minCol;
    let r = startRow;
    let c = startCol;
    let fits = true;
    for (let i = 0; i < word.length; i++) {
      if (r < 0 || r >= size || c < 0 || c >= size) {
        fits = false;
        break;
      }
      const existing = grid[r][c];
      if (existing !== "" && existing !== word[i]) {
        fits = false;
        break;
      }
      r += dr;
      c += dc;
    }
    if (fits) {
      return { word, row: startRow, col: startCol, direction: dir };
    }
  }
  return null;
}

/** Generate a word search puzzle. */
export function generatePuzzle(words: string[], size: number, allowReverse = true, fillBlanks = true, rng: () => number = Math.random): WordSearchPuzzle {
  const grid: string[][] = Array.from({ length: size }, () => Array.from({ length: size }, () => ""));
  const placed: PlacedWord[] = [];
  const unplaced: string[] = [];
  const normalized = words.map(normalizeWord);
  // Sort longest-first for better fit.
  const sorted = [...normalized].sort((a, b) => b.length - a.length);
  for (const w of sorted) {
    const p = tryPlace(grid, w, size, allowReverse, rng);
    if (p) {
      const [dr, dc] = DIRECTION_VECTORS[p.direction];
      let r = p.row;
      let c = p.col;
      for (let i = 0; i < w.length; i++) {
        grid[r][c] = w[i];
        r += dr;
        c += dc;
      }
      placed.push(p);
    } else {
      unplaced.push(w);
    }
  }
  if (fillBlanks) {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (grid[r][c] === "") grid[r][c] = letters[Math.floor(rng() * letters.length)];
      }
    }
  }
  return { size, grid, placed, unplaced };
}

/** Render puzzle as plain text. */
export function puzzleAsText(puzzle: WordSearchPuzzle): string {
  return puzzle.grid.map((row) => row.join(" ")).join("\n");
}

/** Render puzzle as HTML grid string for export. */
export function puzzleAsHTML(puzzle: WordSearchPuzzle): string {
  const cellSize = 28;
  const rows = puzzle.grid.map((row, r) =>
    `<tr>${row.map((ch, c) => `<td style="width:${cellSize}px;height:${cellSize}px;text-align:center;border:1px solid #999;font-family:monospace">${ch}</td>`).join("")}</tr>`,
  ).join("");
  return `<table style="border-collapse:collapse">${rows}</table>`;
}

/** Solution key as text. */
export function solutionKey(puzzle: WordSearchPuzzle): string {
  return puzzle.placed
    .map((p) => `${p.word}: row ${p.row + 1}, col ${p.col + 1}, ${p.direction}`)
    .join("\n");
}

/** Export as CSV. */
export function exportPuzzleCSV(puzzle: WordSearchPuzzle): string {
  const header = ["position", ...Array.from({ length: puzzle.size }, (_, i) => `col${i + 1}`)];
  const rows = puzzle.grid.map((row, i) => [`row${i + 1}`, ...row].join(","));
  return [header.join(","), ...rows].join("\n");
}

/** Count how many of each letter appears in the puzzle. */
export function letterFrequency(puzzle: WordSearchPuzzle): Record<string, number> {
  const freq: Record<string, number> = {};
  for (const row of puzzle.grid) {
    for (const ch of row) {
      if (ch) freq[ch] = (freq[ch] ?? 0) + 1;
    }
  }
  return freq;
}

/** Difficulty rating based on grid size and direction usage. */
export function rateDifficulty(puzzle: WordSearchPuzzle, allowReverse: boolean): string {
  const dirsUsed = new Set(puzzle.placed.map((p) => p.direction));
  const score = puzzle.size + puzzle.placed.length + dirsUsed.size + (allowReverse ? 4 : 0);
  if (score < 20) return "Easy";
  if (score < 32) return "Medium";
  if (score < 45) return "Hard";
  return "Expert";
}

/** Validate grid size. */
export function validateSize(size: number): string[] {
  const w: string[] = [];
  if (size < 5) w.push("Size must be at least 5.");
  if (size > 30) w.push("Size above 30 produces very large puzzles.");
  return w;
}

/** Mask a cell for answer-key export (replaces non-word letters with _). */
export function buildAnswerMask(puzzle: WordSearchPuzzle): string[][] {
  const mask: string[][] = Array.from({ length: puzzle.size }, () => Array.from({ length: puzzle.size }, () => "_"));
  for (const p of puzzle.placed) {
    const [dr, dc] = DIRECTION_VECTORS[p.direction];
    let r = p.row;
    let c = p.col;
    for (let i = 0; i < p.word.length; i++) {
      mask[r][c] = puzzle.grid[r][c];
      r += dr;
      c += dc;
    }
  }
  return mask;
}

/** Word list as comma-separated string. */
export function wordListString(words: string[]): string {
  return words.map(normalizeWord).join(", ");
}

/** Reverse-lookup word position by word text. */
export function findWord(puzzle: WordSearchPuzzle, word: string): PlacedWord | null {
  const n = normalizeWord(word);
  return puzzle.placed.find((p) => p.word === n) ?? null;
}

/** Compute fill percentage of grid by placed words. */
export function fillPercentage(puzzle: WordSearchPuzzle): number {
  const total = puzzle.size * puzzle.size;
  let filled = 0;
  for (const p of puzzle.placed) {
    filled += p.word.length;
  }
  return Math.round((filled / total) * 100);
}
