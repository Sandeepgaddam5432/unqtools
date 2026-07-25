/**
 * ROT13 Cipher — pure logic.
 * ROT13 plus custom ROT1-ROT25 rotation. Applies to A-Z and a-z only.
 */

/** Apply a custom rotation (1-25) to a single character. */
export function rotateChar(char: string, rot: number): string {
  const code = char.charCodeAt(0);
  const r = ((rot % 26) + 26) % 26;
  if (code >= 65 && code <= 90) {
    return String.fromCharCode(((code - 65 + r) % 26) + 65);
  }
  if (code >= 97 && code <= 122) {
    return String.fromCharCode(((code - 97 + r) % 26) + 97);
  }
  return char;
}

/** Apply rotation to an entire string. */
export function rotate(text: string, rot: number): string {
  return Array.from(text).map((c) => rotateChar(c, rot)).join("");
}

/** ROT13 convenience wrapper. */
export function rot13(text: string): string {
  return rotate(text, 13);
}

/** ROT13 is its own inverse — applying twice restores the original. */
export function encode(text: string, rot = 13): string {
  return rotate(text, rot);
}

export function decode(text: string, rot = 13): string {
  return rotate(text, 26 - (((rot % 26) + 26) % 26));
}

/** Validate rotation amount. Returns normalized rotation or an error. */
export function validateRot(rot: number): number | { error: string } {
  if (typeof rot !== "number" || Number.isNaN(rot)) {
    return { error: "Rotation must be a number" };
  }
  if (rot < 1 || rot > 25) {
    return { error: "Rotation must be between 1 and 25" };
  }
  return Math.floor(rot);
}

/** Generate all 25 ROT variants of the input. */
export function allRotations(text: string): { rot: number; text: string }[] {
  const out: { rot: number; text: string }[] = [];
  for (let r = 1; r <= 25; r++) out.push({ rot: r, text: rotate(text, r) });
  return out;
}
