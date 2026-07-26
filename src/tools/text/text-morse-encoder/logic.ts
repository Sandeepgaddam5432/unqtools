/**
 * Morse Code Encoder — pure logic.
 * ITU-R M.1677 standard Morse code. Supports audio timing (WPM), prosigns, and multiple output formats.
 */

/** ITU standard Morse code map. */
export const MORSE_MAP: Record<string, string> = {
  A: ".-",
  B: "-...",
  C: "-.-.",
  D: "-..",
  E: ".",
  F: "..-.",
  G: "--.",
  H: "....",
  I: "..",
  J: ".---",
  K: "-.-",
  L: ".-..",
  M: "--",
  N: "-.",
  O: "---",
  P: ".--.",
  Q: "--.-",
  R: ".-.",
  S: "...",
  T: "-",
  U: "..-",
  V: "...-",
  W: ".--",
  X: "-..-",
  Y: "-.--",
  Z: "--..",
  "0": "-----",
  "1": ".----",
  "2": "..---",
  "3": "...--",
  "4": "....-",
  "5": ".....",
  "6": "-....",
  "7": "--...",
  "8": "---..",
  "9": "----.",
  ".": ".-.-.-",
  ",": "--..--",
  "?": "..--..",
  "'": ".----.",
  "!": "-.-.--",
  "/": "-..-.",
  "(": "-.--.",
  ")": "-.--.-",
  "&": ".-...",
  ":": "---...",
  ";": "-.-.-.",
  "=": "-...-",
  "+": ".-.-.",
  "-": "-....-",
  "_": "..--.-",
  '"': ".-..-.",
  "$": "...-..-",
  "@": ".--.-.",
};

/** Prosigns (procedural signals) — special multi-character codes. */
export const PROSIGNS: Record<string, string> = {
  AR: ".-.-.", // end of message
  AS: ".-...", // wait
  BK: "-...-.-", // break
  BT: "-...-", // new paragraph
  CT: "-.-.-", // start copying
  SK: "...-.-", // end of contact
  SN: "...-.", // understood (ve)
  SOS: "...---...",
  KN: "-.--.", // go ahead specific station
};

export interface EncodeOptions {
  /** Letter separator (default: " "). */
  letterSeparator?: string;
  /** Word separator (default: " / "). */
  wordSeparator?: string;
  /** Use prosigns for known multi-char sequences. */
  useProsigns?: boolean;
  /** Use slash-style (slash between dots and dashes for visual). */
  slashStyle?: boolean;
}

/** Encode a single character to Morse. */
export function encodeChar(ch: string): string | null {
  const upper = ch.toUpperCase();
  if (MORSE_MAP[upper] !== undefined) return MORSE_MAP[upper];
  return null;
}

/** Encode text to Morse code. */
export function encodeMorse(text: string, options: EncodeOptions = {}): string {
  const letterSep = options.letterSeparator ?? " ";
  const wordSep = options.wordSeparator ?? " / ";
  const useProsigns = options.useProsigns ?? false;

  const words = text.split(/\s+/).filter(Boolean);
  return words
    .map((word) => {
      if (useProsigns && PROSIGNS[word.toUpperCase()]) {
        return PROSIGNS[word.toUpperCase()];
      }
      return word
        .split("")
        .map((ch) => {
          const m = encodeChar(ch);
          return m ?? "";
        })
        .filter(Boolean)
        .join(letterSep);
    })
    .filter(Boolean)
    .join(wordSep);
}

/** Encode with slash style: ".-/-.../-.-." for "ABC". */
export function encodeSlashStyle(text: string): string {
  return encodeMorse(text, { letterSeparator: "/", wordSeparator: "//" });
}

/** Compute audio timing (PARIS standard: 50 dots per word). */
export interface MorseTiming {
  dotSec: number;
  dashSec: number;
  intraCharGapSec: number;
  interCharGapSec: number;
  interWordGapSec: number;
  parisWordSec: number;
}

/** Compute timing at a given WPM speed. */
export function computeTiming(wpm: number): MorseTiming {
  // PARIS = 50 dots. 1 dot duration = 1.2 / WPM seconds.
  const dot = 1.2 / wpm;
  return {
    dotSec: dot,
    dashSec: dot * 3,
    intraCharGapSec: dot,
    interCharGapSec: dot * 3,
    interWordGapSec: dot * 7,
    parisWordSec: dot * 50,
  };
}

/** Total transmission time in seconds for the given text at the given WPM. */
export function transmissionTime(text: string, wpm: number): number {
  const t = computeTiming(wpm);
  let total = 0;
  const words = text.split(/\s+/).filter(Boolean);
  for (let w = 0; w < words.length; w++) {
    const word = words[w];
    for (let c = 0; c < word.length; c++) {
      const m = encodeChar(word[c]);
      if (!m) continue;
      for (let i = 0; i < m.length; i++) {
        const sym = m[i];
        total += sym === "." ? t.dotSec : t.dashSec;
        if (i < m.length - 1) total += t.intraCharGapSec;
      }
      if (c < word.length - 1) total += t.interCharGapSec;
    }
    if (w < words.length - 1) total += t.interWordGapSec;
  }
  return total;
}

/** Generate Web Audio API schedule events for the given Morse text. */
export interface ToneEvent {
  time: number; // start time (s)
  duration: number; // duration (s)
  type: "tone" | "silence";
}

export function generateToneEvents(text: string, wpm: number, startOffset = 0): ToneEvent[] {
  const t = computeTiming(wpm);
  const events: ToneEvent[] = [];
  let cursor = startOffset;
  const words = text.split(/\s+/).filter(Boolean);
  for (let w = 0; w < words.length; w++) {
    const word = words[w];
    for (let c = 0; c < word.length; c++) {
      const m = encodeChar(word[c]);
      if (!m) continue;
      for (let i = 0; i < m.length; i++) {
        const sym = m[i];
        const dur = sym === "." ? t.dotSec : t.dashSec;
        events.push({ time: cursor, duration: dur, type: "tone" });
        cursor += dur;
        if (i < m.length - 1) {
          events.push({ time: cursor, duration: t.intraCharGapSec, type: "silence" });
          cursor += t.intraCharGapSec;
        }
      }
      if (c < word.length - 1) {
        events.push({ time: cursor, duration: t.interCharGapSec, type: "silence" });
        cursor += t.interCharGapSec;
      }
    }
    if (w < words.length - 1) {
      events.push({ time: cursor, duration: t.interWordGapSec, type: "silence" });
      cursor += t.interWordGapSec;
    }
  }
  return events;
}

/** Convert Morse events to a WAV file (audio/wav) — returns base64. */
export function morseToWavBase64(text: string, wpm: number, freqHz = 600, sampleRate = 44100): string {
  const events = generateToneEvents(text, wpm);
  const totalSec = events.reduce((sum, e) => sum + e.duration, 0);
  const numSamples = Math.ceil(totalSec * sampleRate);
  const buffer = new Float32Array(numSamples);

  let cursor = 0;
  for (const e of events) {
    if (e.type === "tone") {
      const startSample = Math.floor(e.time * sampleRate);
      const endSample = Math.min(numSamples, Math.floor((e.time + e.duration) * sampleRate));
      for (let i = startSample; i < endSample; i++) {
        const t = (i - startSample) / sampleRate;
        // Apply simple envelope to avoid clicks
        const env = Math.min(1, t * 100) * Math.min(1, (e.duration - t) * 100);
        buffer[i] = Math.sin(2 * Math.PI * freqHz * t) * env * 0.5;
      }
    }
    cursor += e.duration;
  }

  // Convert float32 samples to 16-bit PCM
  const dataLen = numSamples * 2;
  const wav = new ArrayBuffer(44 + dataLen);
  const view = new DataView(wav);
  // RIFF header
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataLen, true);
  writeString(view, 8, "WAVE");
  // fmt chunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  // data chunk
  writeString(view, 36, "data");
  view.setUint32(40, dataLen, true);
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, buffer[i]));
    view.setInt16(44 + i * 2, s * 0x7fff, true);
  }
  // ArrayBuffer to base64
  const bytes = new Uint8Array(wav);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function writeString(view: DataView, offset: number, s: string) {
  for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
}

/** Validate input text — non-Morse-encodable chars return warnings. */
export function validateInput(text: string): { valid: boolean; unsupported: string[] } {
  const unsupported: string[] = [];
  for (const ch of text) {
    if (ch === " " || ch === "\n" || ch === "\t") continue;
    if (encodeChar(ch) === null && !unsupported.includes(ch)) {
      unsupported.push(ch);
    }
  }
  return { valid: unsupported.length === 0, unsupported };
}

/** Statistics: total dots, dashes, characters, words, est. time at 20 WPM. */
export function morseStats(text: string, wpm = 20): {
  characters: number;
  words: number;
  dots: number;
  dashes: number;
  transmissionSec: number;
} {
  let dots = 0;
  let dashes = 0;
  let characters = 0;
  for (const ch of text) {
    if (ch === " ") continue;
    const m = encodeChar(ch);
    if (!m) continue;
    characters++;
    for (const sym of m) {
      if (sym === ".") dots++;
      else if (sym === "-") dashes++;
    }
  }
  return {
    characters,
    words: text.split(/\s+/).filter(Boolean).length,
    dots,
    dashes,
    transmissionSec: transmissionTime(text, wpm),
  };
}

/** Convert Morse back to text (basic decoder). */
export function decodeMorse(morse: string, options: EncodeOptions = {}): string {
  const letterSep = options.letterSeparator ?? " ";
  const wordSep = options.wordSeparator ?? " / ";
  // Reverse the Morse map
  const reverse: Record<string, string> = {};
  for (const [k, v] of Object.entries(MORSE_MAP)) reverse[v] = k;
  for (const [k, v] of Object.entries(PROSIGNS)) reverse[v] = `<${k}>`;

  return morse
    .split(wordSep)
    .map((word) =>
      word
        .split(letterSep)
        .map((code) => reverse[code.trim()] ?? "")
        .join(""),
    )
    .join(" ");
}

/** Format morse with HTML for visual representation (dots in red, dashes in blue). */
export function formatHtml(morse: string): string {
  return morse
    .split("")
    .map((ch) => {
      if (ch === ".") return `<span style="color:#ef4444">•</span>`;
      if (ch === "-") return `<span style="color:#3b82f6">—</span>`;
      if (ch === "/") return `<span style="color:#94a3b8">  ▏  </span>`;
      return ch;
    })
    .join("");
}

/** Encode with verbose mode: includes letter labels above each Morse code. */
export function encodeVerbose(text: string): string {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((word) =>
      word
        .split("")
        .map((ch) => {
          const m = encodeChar(ch);
          return m ? `${ch.toUpperCase()}→${m}` : "";
        })
        .filter(Boolean)
        .join("  "),
    )
    .join("\n");
}
