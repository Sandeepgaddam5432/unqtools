/**
 * Crossword Clue Generator — pure logic.
 * Generate crossword clues from a word list with difficulty levels and hint types.
 */

export interface Clue {
  word: string;
  clue: string;
  hint: string;
  difficulty: "easy" | "medium" | "hard";
  hintType: "definition" | "fill-in-blank" | "anagram" | "letter-pattern" | "category";
  length: number;
}

export interface WordEntry {
  word: string;
  category?: string;
  customDefinition?: string;
}

/** Normalize a word: uppercase, strip non-letters. */
export function normalizeWord(word: string): string {
  return word.toUpperCase().replace(/[^A-Z]/g, "");
}

/** Build a clue from a word entry. */
export function generateClue(entry: WordEntry, difficulty: Clue["difficulty"] = "medium"): Clue {
  const word = normalizeWord(entry.word);
  const definition = entry.customDefinition?.trim() || guessDefinition(word, entry.category);
  const hintType = pickHintType(difficulty);
  const hint = buildHint(word, hintType, entry.category);
  const clue = buildClueText(word, definition, hintType, difficulty);
  return { word, clue, hint, difficulty, hintType, length: word.length };
}

/** Generate clues for a list of words. */
export function generateClues(entries: WordEntry[], difficulty: Clue["difficulty"] = "medium"): Clue[] {
  return entries.map((e) => generateClue(e, difficulty));
}

/** Pick a hint type based on difficulty. */
export function pickHintType(difficulty: Clue["difficulty"]): Clue["hintType"] {
  const easy: Clue["hintType"][] = ["definition", "fill-in-blank", "category"];
  const medium: Clue["hintType"][] = ["definition", "fill-in-blank", "letter-pattern", "category"];
  const hard: Clue["hintType"][] = ["letter-pattern", "anagram", "definition"];
  const pool = difficulty === "easy" ? easy : difficulty === "hard" ? hard : medium;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Guess a definition from the word + category. */
export function guessDefinition(word: string, category?: string): string {
  if (category) return `${capitalize(category.toLowerCase())} — ${word.length} letters`;
  return `Word with ${word.length} letters`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Build the actual clue text shown to the solver. */
export function buildClueText(word: string, definition: string, hintType: Clue["hintType"], difficulty: Clue["difficulty"]): string {
  switch (hintType) {
    case "definition":
      return `${definition} (${word.length} letters)`;
    case "fill-in-blank":
      return `Fill in the blank: ${"_".repeat(word.length)} — ${definition}`;
    case "anagram":
      return `Anagram of "${shuffleWord(word)}" — ${definition}`;
    case "letter-pattern":
      return `${definition}. Pattern: ${buildLetterPattern(word)}`;
    case "category":
      return `Belongs to this category. (${word.length} letters)`;
    default:
      return definition;
  }
}

/** Build the secondary hint (more revealing than the clue). */
export function buildHint(word: string, hintType: Clue["hintType"], category?: string): string {
  switch (hintType) {
    case "definition":
      return `Starts with "${word[0]}", ends with "${word[word.length - 1]}".`;
    case "fill-in-blank":
      return `First letter: ${word[0]}`;
    case "anagram":
      return `Contains letters: ${word.split("").sort().join("")}`;
    case "letter-pattern":
      return `Length: ${word.length}. Vowels: ${countVowels(word)}`;
    case "category":
      return category ? `Category: ${category}` : "Vowel count: " + countVowels(word);
    default:
      return "";
  }
}

/** Build a letter pattern like "A _ _ _ E _" (reveals first & last letter). */
export function buildLetterPattern(word: string): string {
  return word.split("").map((ch, i) => (i === 0 || i === word.length - 1 ? ch : "_")).join(" ");
}

/** Shuffle letters in a word for anagram clues. */
export function shuffleWord(word: string): string {
  const arr = word.split("");
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  const shuffled = arr.join("");
  return shuffled === word ? word.split("").reverse().join("") : shuffled;
}

/** Count vowels (A,E,I,O,U). */
export function countVowels(word: string): number {
  return (word.match(/[AEIOU]/g) || []).length;
}

/** Validate a word entry. */
export function validateEntry(entry: WordEntry): string[] {
  const w: string[] = [];
  const n = normalizeWord(entry.word);
  if (n.length < 2) w.push("Word must have at least 2 letters.");
  if (n.length > 20) w.push("Word longer than 20 letters — too hard for crosswords.");
  if (!/^[A-Z]+$/.test(n)) w.push("Word must contain only letters.");
  return w;
}

/** Export clues as CSV. */
export function exportCluesCSV(clues: Clue[]): string {
  const header = ["word", "clue", "hint", "difficulty", "hint_type", "length"];
  const rows = clues.map((c) =>
    [c.word, `"${c.clue.replace(/"/g, '""')}"`, `"${c.hint.replace(/"/g, '""')}"`, c.difficulty, c.hintType, c.length].join(","),
  );
  return [header.join(","), ...rows].join("\n");
}

/** Export as printable puzzle text. */
export function exportCluesText(clues: Clue[]): string {
  const lines = clues.map((c, i) => `${i + 1}. ${c.clue}  [hint: ${c.hint}]`);
  return lines.join("\n");
}

/** Filter clues by difficulty. */
export function filterByDifficulty(clues: Clue[], difficulty: Clue["difficulty"]): Clue[] {
  return clues.filter((c) => c.difficulty === difficulty);
}

/** Sort clues alphabetically by word. */
export function sortCluesAlpha(clues: Clue[]): Clue[] {
  return [...clues].sort((a, b) => a.word.localeCompare(b.word));
}

/** Sort clues by length (shortest first). */
export function sortCluesByLength(clues: Clue[]): Clue[] {
  return [...clues].sort((a, b) => a.length - b.length);
}

/** Estimate solve difficulty score (0..100). */
export function solveDifficultyScore(clues: Clue[]): number {
  if (clues.length === 0) return 0;
  const scoreMap = { easy: 20, medium: 50, hard: 80 };
  const total = clues.reduce((s, c) => s + scoreMap[c.difficulty], 0);
  return Math.round(total / clues.length);
}

/** Group clues by hint type. */
export function groupByHintType(clues: Clue[]): Record<Clue["hintType"], Clue[]> {
  const out: Record<Clue["hintType"], Clue[]> = {
    definition: [],
    "fill-in-blank": [],
    anagram: [],
    "letter-pattern": [],
    category: [],
  };
  for (const c of clues) out[c.hintType].push(c);
  return out;
}

/** Create a fill-in-blank clue variant for a word. */
export function makeFillInBlank(word: string, definition: string): Clue {
  return {
    word: normalizeWord(word),
    clue: `Fill in the blank: ${"_".repeat(word.length)} — ${definition}`,
    hint: `First letter: ${word[0]}`,
    difficulty: "easy",
    hintType: "fill-in-blank",
    length: normalizeWord(word).length,
  };
}
