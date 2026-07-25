/**
 * Morse Decoder — pure logic.
 * Decode morse code with auto-detection of separators and speed.
 */

export const MORSE_TO_TEXT: Record<string, string> = {
  ".-": "A", "-...": "B", "-.-.": "C", "-..": "D", ".": "E", "..-.": "F",
  "--.": "G", "....": "H", "..": "I", ".---": "J", "-.-": "K", ".-..": "L",
  "--": "M", "-.": "N", "---": "O", ".--.": "P", "--.-": "Q", ".-.": "R",
  "...": "S", "-": "T", "..-": "U", "...-": "V", ".--": "W", "-..-": "X",
  "-.--": "Y", "--..": "Z",
  "-----": "0", ".----": "1", "..---": "2", "...--": "3", "....-": "4",
  ".....": "5", "-....": "6", "--...": "7", "---..": "8", "----.": "9",
  ".-.-.-": ".", "--..--": ",", "..--..": "?", ".----.": "'", "-.-.--": "!",
  "-..-.": "/", "-.--.": "(", "-.--.-": ")", ".-...": "&", "---...": ":",
  "-.-.-.": ";", "-...-": "=", ".-.-.": "+", "-....-": "-", "..--.-": "_",
  ".-..-.": '"', "...-..-": "$", ".--.-.": "@",
  "/": " ",
};

export const TEXT_TO_MORSE: Record<string, string> = Object.entries(MORSE_TO_TEXT).reduce(
  (acc, [morse, char]) => {
    if (char !== " ") acc[char] = morse;
    return acc;
  },
  {} as Record<string, string>,
);

/** Detect the most likely separator used in a morse string. */
export function detectSeparator(morse: string): string {
  if (morse.includes("\n\n")) return "\n\n";
  if (/\s\s\s|\s\/\s|\s\/\s/.test(morse) || morse.includes(" / ")) return " / ";
  if (morse.includes("  ")) return "  ";
  if (morse.includes("\n")) return "\n";
  if (morse.includes("\t")) return "\t";
  return " ";
}

/** Decode a morse string into text. Auto-detects word separators. */
export function decode(morse: string): string {
  if (!morse || !morse.trim()) return "";
  // Normalize various separators to a single word boundary.
  const normalized = morse
    .replace(/\r\n/g, "\n")
    .replace(/\s\/\s/g, "  ")
    .replace(/\s{3,}/g, "  ")
    .replace(/\n+/g, "  ");
  const words = normalized.split(/\s{2,}|\n/);
  return words
    .map((word) =>
      word
        .trim()
        .split(/\s+/)
        .map((sym) => MORSE_TO_TEXT[sym] ?? "")
        .join(""),
    )
    .join(" ")
    .trim();
}

/** Encode text to morse. Letters separated by single space, words by slash. */
export function encode(text: string): string {
  if (!text) return "";
  return text
    .toUpperCase()
    .split(/\s+/)
    .map((word) =>
      Array.from(word)
        .map((c) => TEXT_TO_MORSE[c] ?? "")
        .filter(Boolean)
        .join(" "),
    )
    .join(" / ");
}

/** Auto-detect unit timing (dot duration in ms) from a morse string. */
export function detectSpeed(morse: string): number {
  if (!morse) return 100;
  const dots = (morse.match(/\./g) ?? []).length;
  const dashes = (morse.match(/-/g) ?? []).length;
  if (dots === 0 && dashes === 0) return 100;
  // Heuristic: standard PARIS = 50 dot-units per word. Approximate WPM.
  const totalUnits = dots + dashes * 3;
  const wordCount = Math.max(1, morse.split(/\s{2,}|\s\/\s/).length);
  const unitsPerWord = 50;
  const seconds = (totalUnits * wordCount) / (unitsPerWord * 1);
  const wpm = Math.max(5, Math.round(wordCount / Math.max(seconds, 0.1)));
  return wpm;
}

/** Format decoded text as plain text for display. */
export function formatOutput(text: string): string {
  return text.trim();
}
