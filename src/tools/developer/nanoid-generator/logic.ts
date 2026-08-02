/**
 * NanoID Generator — pure logic.
 */

const DEFAULT_ALPHABET = "_-0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DEFAULT_SIZE = 21;

export function generateNanoId(size: number = DEFAULT_SIZE, alphabet: string = DEFAULT_ALPHABET): string {
  const mask = (2 << 31 - Math.clz32(alphabet.length - 1 | 1)) - 1;
  let id = "";
  const bytes = crypto.getRandomValues(new Uint32Array(size));
  for (let i = 0; i < size; i++) {
    id += alphabet[bytes[i] & mask];
  }
  return id;
}

export function generateBulk(count: number, size: number = DEFAULT_SIZE, alphabet: string = DEFAULT_ALPHABET): string[] {
  return Array.from({ length: count }, () => generateNanoId(size, alphabet));
}

export function validateNanoId(id: string, alphabet: string = DEFAULT_ALPHABET): boolean {
  return id.split("").every((ch) => alphabet.includes(ch));
}

export function getAlphabets(): { name: string; value: string }[] {
  return [
    { name: "Default (URL-safe)", value: DEFAULT_ALPHABET },
    { name: "Numbers only", value: "0123456789" },
    { name: "Hexadecimal", value: "0123456789abcdef" },
    { name: "Base64", value: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/" },
    { name: "Lowercase", value: "abcdefghijklmnopqrstuvwxyz0123456789" },
    { name: "Uppercase", value: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789" },
    { name: "No lookalikes", value: "6789BCDFGHJKLMNPQRTVWbcdfghjkmnpqrtvwz" },
  ];
}

export function calculateCollisionProbability(size: number, alphabetLength: number, count: number): number {
  return 1 - Math.exp(-(count * count) / (2 * Math.pow(alphabetLength, size)));
}

export function estimateUniqueness(size: number, alphabetLength: number): number {
  return Math.log2(Math.pow(alphabetLength, size));
}

// ============================================================================
// Backward-compat stub exports (added to satisfy UI template imports).
// ============================================================================

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export function getStats(input: string, output: string): {
  inputSize: number;
  outputSize: number;
} {
  return {
    inputSize: new Blob([input]).size,
    outputSize: new Blob([output]).size,
  };
}

export function validate(input: string): string[] {
  const issues: string[] = [];
  if (!input || input.trim().length === 0) {
    issues.push("Input is empty.");
  }
  return issues;
}

export function process(input: string): { output: string; error: string | null } {
  try {
    const result = generateNanoId(input);
    if (typeof result === "string") {
      return { output: result, error: null };
    }
    if (result && typeof result === "object") {
      const r = result as Record<string, unknown>;
      const output =
        (typeof r.output === "string" && r.output) ||
        (typeof r.html === "string" && r.html) ||
        (typeof r.result === "string" && r.result) ||
        (typeof r.text === "string" && r.text) ||
        (typeof r.code === "string" && r.code) ||
        (typeof r.value === "string" && r.value) ||
        JSON.stringify(result, null, 2);
      const error =
        (typeof r.error === "string" && r.error) ||
        (r.ok === false && typeof r.message === "string" && r.message) ||
        null;
      return { output, error };
    }
    return { output: String(result), error: null };
  } catch (e) {
    return { output: "", error: (e as Error).message };
  }
}
