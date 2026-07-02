/**
 * Base64 — pure logic. UTF-8 safe.
 *
 * The built-in btoa/atob only handle Latin1; we use TextEncoder/TextDecoder
 * to round-trip UTF-8 bytes through Base64. URL-safe variant per RFC 4648 §5.
 */

export type Base64Variant = "standard" | "urlsafe";

/** Encode a UTF-8 string to Base64. */
export function encodeBase64(input: string, variant: Base64Variant = "standard"): string {
  if (!input) return "";
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  let encoded = btoa(binary);
  if (variant === "urlsafe") {
    encoded = encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  return encoded;
}

/** Decode Base64 (standard or URL-safe) to a UTF-8 string. */
export function decodeBase64(
  input: string,
): { ok: true; output: string } | { ok: false; error: string } {
  if (!input.trim()) return { ok: false, error: "Input is empty." };
  try {
    // Convert URL-safe back to standard
    let standard = input.trim().replace(/-/g, "+").replace(/_/g, "/");
    // Re-add padding if missing
    const pad = standard.length % 4;
    if (pad === 2) standard += "==";
    else if (pad === 3) standard += "=";
    else if (pad === 1)
      return { ok: false, error: "Invalid Base64 length (cannot have remainder of 1)." };

    const binary = atob(standard);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const output = new TextDecoder().decode(bytes);
    return { ok: true, output };
  } catch (e) {
    return { ok: false, error: (e as Error).message ?? "Invalid Base64" };
  }
}

/** Encode a Uint8Array (e.g. from a file) to Base64. */
export function encodeBytes(bytes: Uint8Array, variant: Base64Variant = "standard"): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  let encoded = btoa(binary);
  if (variant === "urlsafe") {
    encoded = encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  return encoded;
}

/** Decode Base64 to a Uint8Array (useful for binary data). */
export function decodeToBytes(
  input: string,
): { ok: true; output: Uint8Array } | { ok: false; error: string } {
  if (!input.trim()) return { ok: false, error: "Input is empty." };
  try {
    let standard = input.trim().replace(/-/g, "+").replace(/_/g, "/");
    const pad = standard.length % 4;
    if (pad === 2) standard += "==";
    else if (pad === 3) standard += "=";
    else if (pad === 1) return { ok: false, error: "Invalid Base64 length." };
    const binary = atob(standard);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return { ok: true, output: bytes };
  } catch (e) {
    return { ok: false, error: (e as Error).message ?? "Invalid Base64" };
  }
}

/** Build a data: URL from Base64 (useful for embedding in HTML/CSS). */
export function toDataUrl(base64: string, mime: string): string {
  // Detect if input is URL-safe and convert
  const standard = base64.replace(/-/g, "+").replace(/_/g, "/");
  return `data:${mime};base64,${standard}`;
}
