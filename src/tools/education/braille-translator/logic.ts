/**
 * Braille Translator — pure logic.
 * Grade 1 (letter-by-letter) and Grade 2 (contractions) Braille with Unicode rendering.
 */

/** Unicode Braille patterns block: U+2800 to U+28FF. */
const BRAILLE_BASE = 0x2800;

/** Grade 1 Braille mappings: ASCII → dot pattern (1-8). */
const GRADE1_MAP: Record<string, number> = {
  a: 0b00000001, b: 0b00000011, c: 0b00001001, d: 0b00011001, e: 0b00010001,
  f: 0b00001011, g: 0b00011011, h: 0b00010011, i: 0b00001010, j: 0b00011010,
  k: 0b00100001, l: 0b00100011, m: 0b00101001, n: 0b00111001, o: 0b00110001,
  p: 0b00101011, q: 0b00111011, r: 0b00110011, s: 0b00101010, t: 0b00111010,
  u: 0b10100001, v: 0b10100011, w: 0b11111010, x: 0b10101001, y: 0b10111001, z: 0b10110001,
  " ": 0b00000000,
  "1": 0b00000001, "2": 0b00000011, "3": 0b00001001, "4": 0b00011001, "5": 0b00010001,
  "6": 0b00001011, "7": 0b00011011, "8": 0b00010011, "9": 0b00001010, "0": 0b00011010,
  ",": 0b00000010, ";": 0b00100010, ":": 0b00101010, ".": 0b00110010, "!": 0b00111010,
  "?": 0b00100011, "'": 0b00000010, "-": 0b00100010,
};

/** Number indicator (dot 3-4-5-6). */
const NUMBER_INDICATOR = 0b00111100;
/** Capital indicator (dot 6). */
const CAPITAL_INDICATOR = 0b00100000;

/** Convert a dot pattern bitmask to the Unicode Braille character. */
export function dotPatternToChar(dots: number): string {
  return String.fromCodePoint(BRAILLE_BASE + (dots & 0xFF));
}

/** Convert a Unicode Braille character to its dot pattern bitmask. */
export function charToDotPattern(ch: string): number {
  const cp = ch.codePointAt(0);
  if (cp === undefined || cp < BRAILLE_BASE || cp > BRAILLE_BASE + 0xFF) return 0;
  return cp - BRAILLE_BASE;
}

/** Convert a dot pattern bitmask to a dot-number string like "1-2-4". */
export function dotsToString(dots: number): string {
  const parts: string[] = [];
  for (let i = 0; i < 8; i++) {
    if (dots & (1 << i)) parts.push(String(i + 1));
  }
  return parts.join("-");
}

/** Convert a dot-number string like "1-2-4" back to a bitmask. */
export function stringToDots(s: string): number {
  let dots = 0;
  for (const part of s.split(/[-,\s]+/)) {
    const n = parseInt(part, 10);
    if (n >= 1 && n <= 8) dots |= 1 << (n - 1);
  }
  return dots;
}

/** Translate text to Grade 1 Braille (letter-by-letter). */
export function translateToGrade1(text: string): string {
  let out = "";
  let prevWasDigit = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i].toLowerCase();
    if (ch >= "a" && ch <= "z") {
      // Check if previous original char was uppercase
      if (text[i] === text[i].toUpperCase() && text[i] !== text[i].toLowerCase()) {
        out += dotPatternToChar(CAPITAL_INDICATOR);
      }
      out += dotPatternToChar(GRADE1_MAP[ch] ?? 0);
      prevWasDigit = false;
    } else if (ch >= "0" && ch <= "9") {
      if (!prevWasDigit) out += dotPatternToChar(NUMBER_INDICATOR);
      out += dotPatternToChar(GRADE1_MAP[ch] ?? 0);
      prevWasDigit = true;
    } else if (GRADE1_MAP[ch] !== undefined) {
      out += dotPatternToChar(GRADE1_MAP[ch]);
      prevWasDigit = false;
    } else {
      out += ch; // pass through unknown chars
      prevWasDigit = false;
    }
  }
  return out;
}

/** Reverse translate Grade 1 Braille back to text. */
export function translateFromGrade1(braille: string): string {
  let out = "";
  let capitalize = false;
  let inNumber = false;
  // Reverse map: dots → character (letters prioritized over digits/punctuation)
  const reverse: Record<number, string> = {};
  for (const [ch, dots] of Object.entries(GRADE1_MAP)) {
    if (/^[a-z]$/.test(ch)) {
      reverse[dots] = ch; // letters always win
    } else if (!(dots in reverse)) {
      reverse[dots] = ch;
    }
  }
  for (const ch of braille) {
    if (ch.codePointAt(0)! >= BRAILLE_BASE && ch.codePointAt(0)! <= BRAILLE_BASE + 0xFF) {
      const dots = charToDotPattern(ch);
      if (dots === CAPITAL_INDICATOR) {
        capitalize = true;
        continue;
      }
      if (dots === NUMBER_INDICATOR) {
        inNumber = true;
        continue;
      }
      let mapped = reverse[dots] ?? "?";
      // If in number mode and char is a-j, convert to 1-9-0
      if (inNumber) {
        const numMap: Record<string, string> = { a: "1", b: "2", c: "3", d: "4", e: "5", f: "6", g: "7", h: "8", i: "9", j: "0" };
        if (numMap[mapped]) mapped = numMap[mapped];
        else inNumber = false; // exit number mode on non-digit char
      }
      if (capitalize) {
        out += mapped.toUpperCase();
        capitalize = false;
      } else {
        out += mapped;
      }
    } else if (ch === " ") {
      out += " ";
      inNumber = false;
    } else {
      out += ch;
    }
  }
  return out;
}

/** Grade 2 contractions: common short-form words. */
const GRADE2_CONTRACTIONS: Record<string, string> = {
  "but": "b", "can": "c", "do": "d", "every": "e", "from": "f", "go": "g", "have": "h",
  "just": "j", "knowledge": "k", "like": "l", "more": "m", "not": "n", "people": "p",
  "quite": "q", "rather": "r", "so": "s", "that": "t", "us": "u", "very": "v", "it": "i",
  "you": "y", "as": "a", "will": "w", "and": "&", "for": "?", "of": ";", "the": "!",
  "with": "w", "in": "i", "to": "t",
};

/** Translate text to Grade 2 Braille (with contractions). */
export function translateToGrade2(text: string): string {
  let working = text;
  // Apply contractions (longest first to avoid partial matches)
  const sortedContractions = Object.entries(GRADE2_CONTRACTIONS).sort((a, b) => b[0].length - a[0].length);
  for (const [word, letter] of sortedContractions) {
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    working = working.replace(regex, letter);
  }
  return translateToGrade1(working);
}

export type BrailleGrade = "grade1" | "grade2";

export interface BrailleJob {
  text: string;
  grade: BrailleGrade;
}

export interface BrailleResult {
  input: BrailleJob;
  braille: string;
  /** Per-character dot patterns (e.g. "1-2-4"). */
  dotPatterns: string[];
  /** Reverse translation back to text. */
  reverseTranslation: string;
  warnings: string[];
  notes: string[];
}

export function translate(job: BrailleJob): BrailleResult {
  const warnings: string[] = [];
  const notes: string[] = [];

  if (!job.text) warnings.push("Input text is empty.");

  const braille = job.grade === "grade1" ? translateToGrade1(job.text) : translateToGrade2(job.text);
  const dotPatterns: string[] = [];
  for (const ch of braille) {
    if (ch.codePointAt(0)! >= BRAILLE_BASE && ch.codePointAt(0)! <= BRAILLE_BASE + 0xFF) {
      dotPatterns.push(dotsToString(charToDotPattern(ch)));
    } else {
      dotPatterns.push(ch);
    }
  }
  const reverseTranslation = job.grade === "grade1" ? translateFromGrade1(braille) : translateFromGrade1(braille);

  if (job.grade === "grade2") notes.push("Grade 2 contractions applied (e.g. 'the' → !, 'and' → &).");
  if (job.text !== reverseTranslation && job.grade === "grade2") {
    notes.push("Reverse translation may differ from original due to contractions being expanded to base form.");
  }

  return { input: job, braille, dotPatterns, reverseTranslation, warnings, notes };
}

export function translateBatch(jobs: BrailleJob[]): BrailleResult[] {
  return jobs.map(translate);
}

export function renderBatchCsv(results: BrailleResult[]): string {
  const lines: string[] = ["index,input,grade,braille,dot_patterns"];
  results.forEach((r, i) => {
    lines.push([
      String(i + 1), `"${r.input.text.replace(/"/g, '""')}"`,
      r.input.grade, r.braille, r.dotPatterns.join(" | "),
    ].join(","));
  });
  return lines.join("\n");
}

export function renderReport(r: BrailleResult): string {
  const lines: string[] = [];
  lines.push("Braille Translation Report");
  lines.push("==========================");
  lines.push(`Input: "${r.input.text}"`);
  lines.push(`Grade: ${r.input.grade}`);
  lines.push("");
  lines.push(`Braille: ${r.braille}`);
  lines.push("");
  lines.push("Dot patterns:");
  r.dotPatterns.forEach((p, i) => {
    lines.push(`  ${i + 1}. ${p}`);
  });
  lines.push("");
  lines.push(`Reverse translation: "${r.reverseTranslation}"`);
  if (r.warnings.length) { lines.push(""); lines.push("Warnings:"); r.warnings.forEach((w) => lines.push(`  ! ${w}`)); }
  if (r.notes.length) { lines.push(""); lines.push("Notes:"); r.notes.forEach((n) => lines.push(`  • ${n}`)); }
  return lines.join("\n");
}

/** Render Braille as ASCII art (3x2 dot grid per character). */
export function brailleToAsciiArt(braille: string): string {
  const lines: string[] = ["", "", ""];
  for (const ch of braille) {
    const cp = ch.codePointAt(0)!;
    if (cp < BRAILLE_BASE || cp > BRAILLE_BASE + 0xFF) {
      // Pass through non-braille char as text
      for (let i = 0; i < 3; i++) lines[i] += ch + " ";
      continue;
    }
    const dots = charToDotPattern(ch);
    // Dots 1,2,3 = col 0, rows 0,1,2; dots 4,5,6 = col 1, rows 0,1,2
    // Dot 1 = bit 0 (top-left), 2 = bit 1 (mid-left), 3 = bit 2 (bottom-left)
    // Dot 4 = bit 3 (top-right), 5 = bit 4 (mid-right), 6 = bit 5 (bottom-right)
    const grid = [
      [dots & 1 ? "●" : "○", dots & 8 ? "●" : "○"],
      [dots & 2 ? "●" : "○", dots & 16 ? "●" : "○"],
      [dots & 4 ? "●" : "○", dots & 32 ? "●" : "○"],
    ];
    lines[0] += grid[0].join(" ") + "  ";
    lines[1] += grid[1].join(" ") + "  ";
    lines[2] += grid[2].join(" ") + "  ";
  }
  return lines.join("\n");
}
