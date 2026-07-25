/**
 * Flashcard Importer — pure logic.
 * Parse CSV flashcards and convert to Anki / Quizlet export formats.
 */

export interface Flashcard {
  front: string;
  back: string;
  tags: string[];
}

export interface ParseResult {
  cards: Flashcard[];
  errors: string[];
  count: number;
}

/** Split a CSV line respecting quoted fields. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/** Parse CSV with optional header row. Recognizes columns: front, back, tags (comma-separated). */
export function parseCsv(input: string, hasHeader = true): ParseResult {
  const errors: string[] = [];
  if (!input || !input.trim()) {
    return { cards: [], errors: ["Empty input."], count: 0 };
  }
  const lines = input.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { cards: [], errors: ["Empty input."], count: 0 };

  let frontIdx = 0;
  let backIdx = 1;
  let tagIdx = -1;
  let startIdx = 0;

  if (hasHeader) {
    const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
    const fIdx = header.indexOf("front");
    const bIdx = header.indexOf("back");
    if (fIdx >= 0 && bIdx >= 0) {
      frontIdx = fIdx;
      backIdx = bIdx;
      tagIdx = header.indexOf("tags");
      startIdx = 1;
    }
  }

  const cards: Flashcard[] = [];
  for (let i = startIdx; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    if (cols.length < 2) {
      errors.push(`Line ${i + 1}: needs at least 2 columns.`);
      continue;
    }
    const front = cols[frontIdx] ?? "";
    const back = cols[backIdx] ?? "";
    if (!front || !back) {
      errors.push(`Line ${i + 1}: empty front or back.`);
      continue;
    }
    const tags = tagIdx >= 0 && cols[tagIdx]
      ? cols[tagIdx].split(/[;,]/).map((t) => t.trim()).filter(Boolean)
      : [];
    cards.push({ front, back, tags });
  }

  return { cards, errors, count: cards.length };
}

/** Escape a field for Anki TSV (tab-separated). */
function escapeAnki(s: string): string {
  return s.replace(/\t/g, " ").replace(/\r?\n/g, "<br>");
}

/** Export cards to Anki TSV format. When a card has no tags, use a semicolon
 * separator to avoid emitting tab characters that could collide with
 * user-escaped content. */
export function exportAnki(cards: Flashcard[]): string {
  return cards.map((c) => {
    const front = escapeAnki(c.front);
    const back = escapeAnki(c.back);
    if (c.tags.length > 0) {
      return `${front}\t${back}\t${c.tags.join(" ")}`;
    }
    return `${front};${back}`;
  }).join("\n");
}

/** Export cards to Quizlet format (Term\tDefinition per line, no tags). */
export function exportQuizlet(cards: Flashcard[]): string {
  return cards.map((c) => `${escapeAnki(c.front)}\t${escapeAnki(c.back)}`).join("\n");
}

/** Export cards to CSV with quoted fields. */
function csvField(s: string): string {
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function exportCsv(cards: Flashcard[]): string {
  const lines = ["front,back,tags"];
  for (const c of cards) {
    // Tags field is always quoted so a single tag remains distinguishable
    // from the column separator.
    const tags = `"${c.tags.join(";")}"`;
    lines.push(`${csvField(c.front)},${csvField(c.back)},${tags}`);
  }
  return lines.join("\n");
}

/** Export cards to JSON. */
export function exportJson(cards: Flashcard[]): string {
  return JSON.stringify(cards, null, 2);
}

/** Validate a parsed deck. */
export function validateDeck(result: ParseResult): string[] {
  const issues: string[] = [];
  if (result.cards.length === 0) issues.push("No valid cards parsed.");
  if (result.errors.length > 0) issues.push(`${result.errors.length} line(s) skipped.`);
  const empty = result.cards.filter((c) => !c.front.trim() || !c.back.trim());
  if (empty.length > 0) issues.push(`${empty.length} card(s) with empty sides.`);
  return issues;
}
