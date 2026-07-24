/** Secure Random Generator — pure logic. */

export type RandomKind = "int" | "float" | "bytes" | "hex" | "password";
export type Charset = "lower" | "upper" | "digits" | "symbols";

export interface RandomOptions {
  kind: RandomKind;
  count?: number;       // length of bytes/hex/password, or count of ints
  min?: number;         // for int
  max?: number;         // for int (inclusive)
  charsets?: Charset[]; // for password
  avoidAmbiguous?: boolean;
}

export interface RandomResult {
  output: string; // human-readable representation
  values?: number[];
  warnings: string[];
}

const CHARSETS: Record<Charset, string> = {
  lower: "abcdefghijklmnopqrstuvwxyz",
  upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  digits: "0123456789",
  symbols: "!@#$%^&*()-_=+[]{}<>?/",
};
const AMBIGUOUS = new Set("Il1O0o");

function randomBytes(n: number): Uint8Array {
  const arr = new Uint8Array(n);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < n; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  return arr;
}

function randomInt(min: number, max: number): number {
  if (min > max) [min, max] = [max, min];
  const range = max - min + 1;
  const maxUint32 = 0xffffffff;
  const limit = maxUint32 - (maxUint32 % range);
  const arr = new Uint32Array(1);
  do {
    if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(arr);
    else arr[0] = Math.floor(Math.random() * (maxUint32 + 1));
  } while (arr[0]! > limit);
  return min + (arr[0]! % range);
}

export function process(options: RandomOptions): RandomResult | { error: string } {
  const warnings: string[] = [];
  switch (options.kind) {
    case "int": {
      const count = options.count ?? 1;
      const min = options.min ?? 0;
      const max = options.max ?? 100;
      if (count < 1 || count > 10000) return { error: "Count must be between 1 and 10000" };
      const values: number[] = [];
      for (let i = 0; i < count; i++) values.push(randomInt(min, max));
      return { output: values.join(", "), values, warnings };
    }
    case "float": {
      const count = options.count ?? 1;
      if (count < 1 || count > 10000) return { error: "Count must be between 1 and 10000" };
      const bytes = randomBytes(count * 8);
      const values: number[] = [];
      for (let i = 0; i < count; i++) {
        const view = new DataView(bytes.buffer, i * 8, 8);
        // Build a 53-bit integer from 26 + 27 bits → divide by 2^53 for [0, 1)
        const high = view.getUint32(0) >>> 6;   // top 26 bits
        const low = view.getUint32(4) >>> 5;    // top 27 bits
        const mantissa = high * 0x8000000 + low; // high * 2^27 + low → 53-bit max
        values.push(mantissa / 0x20000000000000); // 2^53
      }
      return { output: values.map((v) => v.toFixed(6)).join(", "), values, warnings };
    }
    case "bytes": {
      const n = options.count ?? 16;
      if (n < 1 || n > 100000) return { error: "Count must be between 1 and 100000" };
      const bytes = randomBytes(n);
      return { output: `[${[...bytes].join(", ")}]`, warnings };
    }
    case "hex": {
      const n = options.count ?? 32;
      if (n < 1 || n > 100000) return { error: "Count must be between 1 and 100000" };
      const bytes = randomBytes(Math.ceil(n / 2));
      const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
      return { output: hex.slice(0, n), warnings };
    }
    case "password": {
      const n = options.count ?? 16;
      if (n < 4 || n > 256) return { error: "Password length must be between 4 and 256" };
      const sets = options.charsets && options.charsets.length > 0 ? options.charsets : ["lower", "upper", "digits"];
      let alphabet = sets.map((s) => CHARSETS[s]).join("");
      if (!alphabet) return { error: "No character sets selected" };
      if (options.avoidAmbiguous) alphabet = [...alphabet].filter((c) => !AMBIGUOUS.has(c)).join("");
      const chars: string[] = [];
      const alphabetBytes = randomBytes(n);
      for (let i = 0; i < n; i++) {
        chars.push(alphabet[alphabetBytes[i]! % alphabet.length]!);
      }
      return { output: chars.join(""), warnings };
    }
    default:
      return { error: `Unknown kind: ${options.kind}` };
  }
}

export function toCsv(values: number[]): string {
  return ["Index,Value", ...values.map((v, i) => `${i},${v}`)].join("\n");
}
