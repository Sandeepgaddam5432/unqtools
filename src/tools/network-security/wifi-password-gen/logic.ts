/**
 * WiFi Password Generator — pure logic.
 * Generates cryptographically strong WPA2/WPA3 passwords.
 * Pure: accepts a random byte source so tests can be deterministic.
 */

export type Charset = "lowercase" | "uppercase" | "numbers" | "symbols";

export interface WifiPasswordOptions {
  length: number;
  charsets: Charset[];
  excludeAmbiguous: boolean;
}

const CHARSETS: Record<Charset, string> = {
  lowercase: "abcdefghijklmnopqrstuvwxyz",
  uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  numbers: "0123456789",
  symbols: "!@#$%^&*()-_=+[]{};:,.?/",
};

const AMBIGUOUS = new Set("Il1O0o`'\"|".split(""));

export const WPA2_MIN_LENGTH = 8;
export const WPA2_MAX_LENGTH = 63;
export const WPA3_MIN_LENGTH = 12;
export const WPA3_MAX_LENGTH = 63;

export function defaultOptions(): WifiPasswordOptions {
  return { length: 16, charsets: ["lowercase", "uppercase", "numbers"], excludeAmbiguous: true };
}

export function validateOptions(opts: WifiPasswordOptions, mode: "wpa2" | "wpa3" = "wpa2"): string | null {
  const min = mode === "wpa3" ? WPA3_MIN_LENGTH : WPA2_MIN_LENGTH;
  if (!Number.isInteger(opts.length) || opts.length < min || opts.length > WPA2_MAX_LENGTH) {
    return `Length must be between ${min} and ${WPA2_MAX_LENGTH}.`;
  }
  if (!Array.isArray(opts.charsets) || opts.charsets.length === 0) {
    return "Select at least one character set.";
  }
  return null;
}

/** Build the active alphabet from selected charsets. */
export function buildAlphabet(opts: WifiPasswordOptions): string {
  let chars = "";
  for (const cs of opts.charsets) {
    chars += CHARSETS[cs] ?? "";
  }
  if (opts.excludeAmbiguous) {
    chars = Array.from(chars).filter((c) => !AMBIGUOUS.has(c)).join("");
  }
  // dedupe while preserving order
  const seen = new Set<string>();
  let out = "";
  for (const c of chars) {
    if (!seen.has(c)) {
      seen.add(c);
      out += c;
    }
  }
  return out;
}

/** Random byte source — defaults to crypto.getRandomValues when available. */
export type RandomSource = (maxExclusive: number) => number;

export function makeCryptoRandomSource(): RandomSource {
  return (max: number) => {
    if (max <= 0) return 0;
    const u32max = 0xffffffff;
    const limit = u32max - (u32max % max);
    const buf = new Uint32Array(1);
    // Loop to avoid modulo bias.
    // Pure wrt crypto; same input always yields a deterministic *call* boundary but the value is random.
    // For tests, callers pass a deterministic source instead.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (typeof globalThis !== "undefined" && globalThis.crypto?.getRandomValues) {
        globalThis.crypto.getRandomValues(buf);
      } else {
        buf[0] = Math.floor(Math.random() * u32max);
      }
      if (buf[0] < limit) return buf[0] % max;
    }
  };
}

/** Generate a single password using the provided random source. */
export function generatePassword(opts: WifiPasswordOptions, random: RandomSource): string {
  const alphabet = buildAlphabet(opts);
  if (alphabet.length === 0) return "";
  const chars: string[] = [];
  for (let i = 0; i < opts.length; i++) {
    chars.push(alphabet[random(alphabet.length)]);
  }
  return chars.join("");
}

/** Generate N passwords. */
export function generateMany(opts: WifiPasswordOptions, count: number, random: RandomSource): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) out.push(generatePassword(opts, random));
  return out;
}

/** Estimate entropy in bits for the given options. */
export function estimateEntropy(opts: WifiPasswordOptions): number {
  const alphabet = buildAlphabet(opts);
  if (alphabet.length === 0 || opts.length <= 0) return 0;
  return Math.floor(opts.length * Math.log2(alphabet.length));
}

/** Strength classification used by the UI. */
export function classifyStrength(entropy: number): "weak" | "fair" | "strong" | "very-strong" {
  if (entropy < 50) return "weak";
  if (entropy < 80) return "fair";
  if (entropy < 120) return "strong";
  return "very-strong";
}
