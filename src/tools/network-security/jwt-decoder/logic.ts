/**
 * JWT Decoder — pure logic.
 *
 * Decodes JSON Web Tokens (RFC 7519) into header + payload objects.
 * Does NOT verify signatures (would require secret/key, intentionally
 * out of scope). All functions are pure and testable.
 */

export interface JwtParts {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signature: string; // raw base64url string, as-is
  raw: {
    header: string;
    payload: string;
    signature: string;
  };
}

/** Standard JWT registered claims (RFC 7519 §4.1). */
export const REGISTERED_CLAIMS = new Set([
  "iss", // issuer
  "sub", // subject
  "aud", // audience
  "exp", // expiration time
  "nbf", // not before
  "iat", // issued at
  "jti", // JWT ID
]);

/** Convert base64url to base64 (add padding, replace - _ with + /). */
export function base64UrlToBase64(b64url: string): string {
  let b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  // Pad to length multiple of 4
  while (b64.length % 4 !== 0) b64 += "=";
  return b64;
}

/** Decode a base64url string to a UTF-8 string. Throws on invalid input. */
export function base64UrlDecode(b64url: string): string {
  const b64 = base64UrlToBase64(b64url);
  // Use atob in browser, Buffer in Node
  if (typeof atob === "function") {
    const binary = atob(b64);
    // Convert binary string to UTF-8
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder("utf-8").decode(bytes);
  }
  // Node fallback
  if (typeof Buffer !== "undefined") {
    return Buffer.from(b64, "base64").toString("utf-8");
  }
  throw new Error("No base64 decoder available in this environment.");
}

/** Parse a JSON object from a base64url-encoded string. */
function decodeJsonObject(b64url: string, partName: string): Record<string, unknown> {
  let json: string;
  try {
    json = base64UrlDecode(b64url);
  } catch (e) {
    throw new Error(`Could not base64url-decode ${partName}: ${(e as Error).message}`);
  }
  try {
    const parsed = JSON.parse(json);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error(`${partName} is not a JSON object`);
    }
    return parsed as Record<string, unknown>;
  } catch (e) {
    if (e instanceof SyntaxError) {
      throw new Error(`${partName} is not valid JSON: ${e.message}`);
    }
    throw e;
  }
}

/** Validate JWT structure (3 dot-separated base64url parts). */
export function validateJwtStructure(token: string): string | null {
  if (!token || typeof token !== "string") return "Token is empty.";
  const trimmed = token.trim();
  if (trimmed !== token) return "Token has leading/trailing whitespace.";
  const parts = token.split(".");
  if (parts.length !== 3) {
    return `Expected 3 parts separated by dots, got ${parts.length}.`;
  }
  if (!parts[0] || !parts[1] || !parts[2]) {
    return "One or more parts are empty.";
  }
  // Base64url charset: A-Z a-z 0-9 - _
  const validChars = /^[A-Za-z0-9_-]+$/;
  if (!validChars.test(parts[0])) return "Header contains invalid base64url characters.";
  if (!validChars.test(parts[1])) return "Payload contains invalid base64url characters.";
  if (!validChars.test(parts[2])) return "Signature contains invalid base64url characters.";
  return null;
}

/** Decode a JWT into its three parts. Throws on invalid input. */
export function decodeJwt(token: string): JwtParts {
  const err = validateJwtStructure(token);
  if (err) throw new Error(err);
  const [rawHeader, rawPayload, rawSignature] = token.split(".");
  return {
    header: decodeJsonObject(rawHeader, "header"),
    payload: decodeJsonObject(rawPayload, "payload"),
    signature: rawSignature,
    raw: {
      header: rawHeader,
      payload: rawPayload,
      signature: rawSignature,
    },
  };
}

/** Get the algorithm name from the header. */
export function getAlgorithm(parts: JwtParts): string | undefined {
  const alg = parts.header.alg;
  return typeof alg === "string" ? alg : undefined;
}

/** Format a Unix timestamp (seconds) as ISO string. Returns null if invalid. */
export function formatTimestamp(unixSeconds: number): string | null {
  if (typeof unixSeconds !== "number" || !Number.isFinite(unixSeconds)) return null;
  // JWT uses seconds, JS Date uses milliseconds
  const ms = unixSeconds * 1000;
  if (ms < 0 || ms > 8.64e15) return null; // out of valid Date range
  try {
    return new Date(ms).toISOString();
  } catch {
    return null;
  }
}

/** Check if a JWT is currently expired based on its 'exp' claim. */
export function isExpired(parts: JwtParts, now: Date = new Date()): boolean {
  const exp = parts.payload.exp;
  if (typeof exp !== "number") return false; // no exp claim → not expired
  const expMs = exp * 1000;
  return now.getTime() >= expMs;
}

/** Pretty-print a JSON object with 2-space indent. */
export function prettyPrint(obj: unknown): string {
  return JSON.stringify(obj, null, 2);
}
