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

// === Backward-compat stubs ===

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
    const result = encode(input);
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
