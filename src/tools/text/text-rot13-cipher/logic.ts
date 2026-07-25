/**
 * ROT13 Cipher — pure logic.
 *
 * ROT13 plus custom ROT1-ROT25 rotation. Applies to A-Z and a-z only.
 * Non-letters are preserved. Case is preserved. The same operation with
 * the same rotation decodes an encoded string.
 */

export interface RotationOptions {
  /** Rotation amount 1-25. */
  rot: number;
  /** When true, also rotate digits 0-9 (mod 10). Default false. */
  rotateDigits?: boolean;
}

export interface RotationStats {
  chars: number;
  lettersRotated: number;
  digitsRotated: number;
  preserved: number;
  rot: number;
  durationMs: number;
}

export interface RotationHistoryEntry {
  ts: number;
  rot: number;
  input: string;
  output: string;
}

/** Common named presets. */
export const ROT_PRESETS: { name: string; rot: number; description: string }[] = [
  { name: "ROT1 (Caesar)", rot: 1, description: "Shift by 1 — classic Caesar cipher." },
  { name: "ROT5", rot: 5, description: "Shift by 5." },
  { name: "ROT13", rot: 13, description: "Self-inverse Usenet cipher." },
  { name: "ROT18", rot: 13, description: "ROT13 + ROT5 for letters and digits." },
  { name: "ROT47", rot: 13, description: "ROT13 variant covering ASCII 33-126 (treated as ROT13 here)." },
  { name: "ROT23", rot: 23, description: "Shift by 23 (= ROT-3 / decode Caesar)." },
];

/** Normalize a rotation value to the range 0-25. */
export function normalizeRot(rot: number): number {
  if (!Number.isFinite(rot)) return 0;
  return ((Math.floor(rot) % 26) + 26) % 26;
}

/** Apply a custom rotation (1-25) to a single character. */
export function rotateChar(char: string, rot: number, rotateDigits = false): string {
  const code = char.charCodeAt(0);
  const r = normalizeRot(rot);
  if (code >= 65 && code <= 90) {
    return String.fromCharCode(((code - 65 + r) % 26) + 65);
  }
  if (code >= 97 && code <= 122) {
    return String.fromCharCode(((code - 97 + r) % 26) + 97);
  }
  if (rotateDigits && code >= 48 && code <= 57) {
    return String.fromCharCode(((code - 48 + r) % 10) + 48);
  }
  return char;
}

/** Apply rotation to an entire string. */
export function rotate(text: string, rot: number, rotateDigits = false): string {
  if (!text) return "";
  return Array.from(text).map((c) => rotateChar(c, rot, rotateDigits)).join("");
}

/** ROT13 convenience wrapper. */
export function rot13(text: string): string {
  return rotate(text, 13);
}

/** ROT13 is its own inverse — applying twice restores the original. */
export function encode(text: string, rot = 13, rotateDigits = false): string {
  return rotate(text, rot, rotateDigits);
}

export function decode(text: string, rot = 13, rotateDigits = false): string {
  const r = normalizeRot(rot);
  return rotate(text, 26 - r, rotateDigits);
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
export function allRotations(text: string, rotateDigits = false): { rot: number; text: string }[] {
  const out: { rot: number; text: string }[] = [];
  for (let r = 1; r <= 25; r++) out.push({ rot: r, text: rotate(text, r, rotateDigits) });
  return out;
}

/** Run rotation over multiple inputs (batch mode). */
export function rotateBatch(inputs: string[], rot: number, rotateDigits = false): string[] {
  return inputs.map((s) => rotate(s, rot, rotateDigits));
}

/** Compute statistics about a rotation operation. */
export function computeStats(input: string, rot: number, rotateDigits = false): RotationStats {
  const start = typeof performance !== "undefined" ? performance.now() : Date.now();
  let lettersRotated = 0;
  let digitsRotated = 0;
  let preserved = 0;
  for (const ch of input) {
    const code = ch.charCodeAt(0);
    if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) {
      lettersRotated++;
    } else if (rotateDigits && code >= 48 && code <= 57) {
      digitsRotated++;
    } else {
      preserved++;
    }
  }
  const end = typeof performance !== "undefined" ? performance.now() : Date.now();
  return {
    chars: input.length,
    lettersRotated,
    digitsRotated,
    preserved,
    rot: normalizeRot(rot),
    durationMs: Math.max(0, end - start),
  };
}

/** Detect the most likely rotation used to produce `cipher` from `plain`. */
export function detectRotation(plain: string, cipher: string): number | null {
  if (!plain || !cipher) return null;
  const p = plain[0]!;
  const c = cipher[0]!;
  const pc = p.charCodeAt(0);
  const cc = c.charCodeAt(0);
  if ((pc < 65 || pc > 122 || (pc > 90 && pc < 97)) || (cc < 65 || cc > 122 || (cc > 90 && cc < 97))) {
    return null;
  }
  const pa = pc >= 97 ? 97 : 65;
  const ca = cc >= 97 ? 97 : 65;
  const diff = ((cc - ca) - (pc - pa) + 26) % 26;
  return diff === 0 ? 26 : diff;
}

/** Render the rotation alphabet map for display. */
export function rotationTable(rot: number): { from: string; to: string }[] {
  const r = normalizeRot(rot);
  const out: { from: string; to: string }[] = [];
  for (let i = 0; i < 26; i++) {
    out.push({
      from: String.fromCharCode(65 + i),
      to: String.fromCharCode(65 + ((i + r) % 26)),
    });
  }
  return out;
}

/** Serialize history entries to CSV. */
export function historyToCsv(history: RotationHistoryEntry[]): string {
  const lines = ["Timestamp,Rotation,Input,Output"];
  for (const h of history) {
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    lines.push(`${new Date(h.ts).toISOString()},${h.rot},${esc(h.input)},${esc(h.output)}`);
  }
  return lines.join("\n");
}

/** Format a single history entry as a human-readable line. */
export function formatHistoryEntry(entry: RotationHistoryEntry): string {
  return `[ROT${entry.rot}] ${new Date(entry.ts).toLocaleString()} → ${entry.output.slice(0, 60)}${entry.output.length > 60 ? "…" : ""}`;
}
