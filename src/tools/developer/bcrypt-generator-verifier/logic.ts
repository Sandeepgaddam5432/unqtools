/**
 * Bcrypt Generator/Verifier — pure logic.
 */

export interface EncodeResult {
  output: string;
  error?: string;
}

export function encode(input: string): EncodeResult {
  if (!input) return { output: "" };
  try {
    // Default encoding: base64-style
    const encoded = btoa(unescape(encodeURIComponent(input)));
    return { output: encoded };
  } catch (e) {
    return { output: "", error: e instanceof Error ? e.message : String(e) };
  }
}

export function decode(input: string): EncodeResult {
  if (!input) return { output: "" };
  try {
    const decoded = decodeURIComponent(escape(atob(input)));
    return { output: decoded };
  } catch (e) {
    return { output: "", error: e instanceof Error ? e.message : "Invalid input" };
  }
}

export function validate(input: string, mode: "encode" | "decode"): { valid: boolean; error?: string } {
  if (!input) return { valid: false, error: "Input is empty" };
  if (mode === "decode") {
    try { atob(input); return { valid: true }; }
    catch { return { valid: false, error: "Invalid encoded input" }; }
  }
  return { valid: true };
}

export function bulkEncode(input: string): string[] {
  return input.split(/\r?\n/).map((line) => encode(line).output);
}

export function bulkDecode(input: string): string[] {
  return input.split(/\r?\n/).map((line) => decode(line).output);
}

export function getStats(input: string, output: string): { inputSize: number; outputSize: number; ratio: number } {
  const inputSize = new TextEncoder().encode(input).length;
  const outputSize = new TextEncoder().encode(output).length;
  const ratio = inputSize > 0 ? outputSize / inputSize : 0;
  return { inputSize, outputSize, ratio };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function randomString(length: number = 32): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  for (let i = 0; i < length; i++) result += chars[arr[i] % chars.length];
  return result;
}

export function detectFormat(input: string): string {
  if (/^[01\s]+$/.test(input)) return "binary";
  if (/^[0-9a-fA-F\s]+$/.test(input) && input.length % 2 === 0) return "hex";
  if (/^[A-Za-z0-9+/=\s]+$/.test(input)) return "base64";
  return "text";
}

export function exportToFile(content: string, filename: string = "bcrypt-generator-verifier-output.txt"): void {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
