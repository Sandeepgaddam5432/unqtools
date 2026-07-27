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
