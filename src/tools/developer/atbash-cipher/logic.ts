/**
 * Atbash Cipher — encode/decode (self-inverse).
 * a↔z, b↔y, c↔x, ... Latin alphabet. Preserves case and non-alpha chars.
 */

export function atbashEncode(input: string): string {
  return input.replace(/[a-zA-Z]/g, (ch) => {
    const base = ch <= "Z" ? 65 : 97;
    return String.fromCharCode(base + 25 - (ch.charCodeAt(0) - base));
  });
}

export function atbashDecode(input: string): string {
  return atbashEncode(input); // self-inverse
}

export function atbashEncodeGrouped(input: string, groupSize: number = 5): string {
  const encoded = atbashEncode(input).replace(/[^a-zA-Z]/g, "").toLowerCase();
  return encoded.replace(new RegExp(`(.{${groupSize}})`, "g"), "$1 ").trim();
}

export function getStats(input: string, output: string) {
  return {
    inputLen: input.length,
    outputLen: output.length,
    alphaChars: (input.match(/[a-zA-Z]/g) || []).length,
    nonAlpha: input.replace(/[a-zA-Z]/g, "").length,
  };
}

export const ALPHABET = "abcdefghijklmnopqrstuvwxyz";
export const ATBASH_MAP = "zyxwvutsrqponmlkjihgfedcba";
