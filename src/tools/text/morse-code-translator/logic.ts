/**
 * Morse Code Translator — pure logic.
 */

export const MORSE_CODE: Record<string, string> = {
  A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-.", G: "--.",
  H: "....", I: "..", J: ".---", K: "-.-", L: ".-..", M: "--", N: "-.",
  O: "---", P: ".--.", Q: "--.-", R: ".-.", S: "...", T: "-", U: "..-",
  V: "...-", W: ".--", X: "-..-", Y: "-.--", Z: "--..",
  "0": "-----", "1": ".----", "2": "..---", "3": "...--", "4": "....-",
  "5": ".....", "6": "-....", "7": "--...", "8": "---..", "9": "----.",
  ".": ".-.-.-", ",": "--..--", "?": "..--..", "'": ".----.", "!": "-.-.--",
  "/": "-..-.", "(": "-.--.", ")": "-.--.-", "&": ".-...", ":": "---...",
  ";": "-.-.-.", "=": "-...-", "+": ".-.-.", "-": "-....-", "_": "..--.-",
  '"': ".-..-.", "$": "...-..-", "@": ".--.-.",
};

export const REVERSE_MORSE: Record<string, string> = Object.fromEntries(
  Object.entries(MORSE_CODE).map(([k, v]) => [v, k]),
);

// Phonetic alphabet (NATO)
export const PHONETIC_ALPHABET: Record<string, string> = {
  A: "Alpha", B: "Bravo", C: "Charlie", D: "Delta", E: "Echo", F: "Foxtrot",
  G: "Golf", H: "Hotel", I: "India", J: "Juliet", K: "Kilo", L: "Lima",
  M: "Mike", N: "November", O: "Oscar", P: "Papa", Q: "Quebec", R: "Romeo",
  S: "Sierra", T: "Tango", U: "Uniform", V: "Victor", W: "Whiskey", X: "X-ray",
  Y: "Yankee", Z: "Zulu",
  "0": "Zero", "1": "One", "2": "Two", "3": "Three", "4": "Four",
  "5": "Five", "6": "Six", "7": "Seven", "8": "Eight", "9": "Niner",
};

export interface MorseOptions {
  /** Use '/' for word separator instead of '  ' (7 spaces). */
  useSlashForWord?: boolean;
  /** Use '·' (middle dot) instead of '.' for visual distinction. */
  useMiddleDot?: boolean;
}

/** Convert text to Morse code. */
export function textToMorse(text: string, options: MorseOptions = {}): string {
  if (!text) return "";
  const upper = text.toUpperCase();
  const words = upper.split(/\s+/);
  const morseWords = words.map((word) => {
    return Array.from(word).map((ch) => {
      const morse = MORSE_CODE[ch];
      if (morse) {
        if (options.useMiddleDot) return morse.replace(/\./g, "·");
        return morse;
      }
      return ""; // Skip unknown chars
    }).filter(Boolean).join(" ");
  });
  return morseWords.join(options.useSlashForWord ? " / " : "   ");
}

/** Convert Morse code to text. */
export function morseToText(morse: string): string {
  if (!morse) return "";
  // Normalize: convert · to ., treat / as word separator
  const normalized = morse.replace(/·/g, ".").replace(/\//g, "   ");
  const words = normalized.split(/\s{3,}|\s+\/\s+/);
  return words.map((word) => {
    const letters = word.trim().split(/\s+/);
    return letters.map((letter) => REVERSE_MORSE[letter] ?? "").join("");
  }).join(" ").trim();
}

/** Get character-by-character breakdown. */
export function getCharBreakdown(text: string): { char: string; morse: string; phonetic: string }[] {
  const result: { char: string; morse: string; phonetic: string }[] = [];
  for (const ch of text.toUpperCase()) {
    if (ch === " ") {
      result.push({ char: "␣", morse: "/", phonetic: "" });
    } else {
      const morse = MORSE_CODE[ch];
      const phonetic = PHONETIC_ALPHABET[ch];
      if (morse) result.push({ char: ch, morse, phonetic: phonetic ?? "" });
    }
  }
  return result;
}

/** Audio timing in milliseconds for given WPM. */
export function getTiming(wpm: number): {
  dit: number; dah: number; intraCharGap: number; letterGap: number; wordGap: number;
} {
  // PARIS standard: 50 dits per word at WPM
  // dit duration (ms) = 1200 / WPM
  const dit = 1200 / wpm;
  return {
    dit,
    dah: dit * 3,
    intraCharGap: dit,
    letterGap: dit * 3,
    wordGap: dit * 7,
  };
}

/** Generate a beep pattern for audio playback (timings in ms, frequency in Hz). */
export function generateBeepPattern(morse: string, wpm: number, frequencyHz: number): { on: boolean; durationMs: number; frequency: number }[] {
  const timing = getTiming(wpm);
  const pattern: { on: boolean; durationMs: number; frequency: number }[] = [];
  const normalized = morse.replace(/·/g, ".");

  // Split by word separator (3+ spaces or /)
  const words = normalized.split(/\s{3,}|\s+\/\s+/);

  for (let w = 0; w < words.length; w++) {
    const word = words[w]!.trim();
    if (!word) continue;
    const letters = word.split(/\s+/);
    for (let l = 0; l < letters.length; l++) {
      const letter = letters[l]!;
      if (!letter) continue;
      for (let c = 0; c < letter.length; c++) {
        const ch = letter[c]!;
        if (ch === ".") {
          pattern.push({ on: true, durationMs: timing.dit, frequency: frequencyHz });
        } else if (ch === "-") {
          pattern.push({ on: true, durationMs: timing.dah, frequency: frequencyHz });
        }
        if (c < letter.length - 1) {
          pattern.push({ on: false, durationMs: timing.intraCharGap, frequency: 0 });
        }
      }
      if (l < letters.length - 1) {
        pattern.push({ on: false, durationMs: timing.letterGap, frequency: 0 });
      }
    }
    if (w < words.length - 1) {
      pattern.push({ on: false, durationMs: timing.wordGap, frequency: 0 });
    }
  }
  return pattern;
}

/** Common Morse abbreviations and prosigns. */
export const MORSE_PROSIGNS: Record<string, string> = {
  SOS: "...---...",
  AR: ".-.-.", // End of message
  AS: ".-...", // Wait
  BK: "-...-.-", // Break
  BT: "-...-", // New paragraph
  CT: "-.-.-", // Start copying
  SK: "...-.-", // End of contact
  SN: "...-.", // Understood (ve)
};

/** Validate Morse string. */
export function validateMorse(morse: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  const validChars = /^[.\-·/\s]+$/;
  if (!validChars.test(morse)) {
    errors.push("Morse code should only contain '.', '-', '·', '/', and whitespace.");
  }
  // Check for unknown sequences
  const tokens = morse.replace(/·/g, ".").split(/\s+/);
  for (const token of tokens) {
    if (token === "/" || token === "") continue;
    if (!REVERSE_MORSE[token]) {
      errors.push(`Unknown Morse sequence: '${token}'`);
    }
  }
  return { isValid: errors.length === 0, errors };
}
