/**
 * URL-safe Base64 — pure logic.
 */
const STD = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const URLSAFE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
export function encode(input: string, padding: boolean = false): string {
  const bytes = new TextEncoder().encode(input);
  let result = "", bits = 0, value = 0;
  for (const byte of bytes) { value = (value << 8) | byte; bits += 8; while (bits >= 6) { result += URLSAFE[(value >>> (bits - 6)) & 63]; bits -= 6; } }
  if (bits > 0) result += URLSAFE[(value << (6 - bits)) & 63];
  if (padding) while (result.length % 4 !== 0) result += "=";
  return result;
}
export function decode(input: string): string {
  const cleaned = input.replace(/=+$/, "").replace(/\s+/g, "");
  let bits = 0, value = 0;
  const bytes: number[] = [];
  for (const ch of cleaned) {
    const idx = URLSAFE.indexOf(ch); if (idx === -1) continue;
    value = (value << 6) | idx; bits += 6;
    if (bits >= 8) { bytes.push((value >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}
export function standardToUrlSafe(input: string): string { return input.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
export function urlSafeToStandard(input: string): string { let s = input.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4 !== 0) s += "="; return s; }
export function isValidUrlSafeBase64(input: string): boolean { return /^[A-Za-z0-9_-]*={0,2}$/.test(input); }
