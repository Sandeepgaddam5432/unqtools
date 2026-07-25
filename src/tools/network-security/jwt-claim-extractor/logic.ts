/**
 * JWT Claim Extractor — decode JWT payload (base64url → JSON).
 */
export interface JwtParts {
  header: string;
  payload: string;
  signature: string;
}

export interface JwtDecoded {
  header: unknown;
  payload: unknown;
  signature: string;
  raw: JwtParts;
}

/** Split a JWT into its 3 dot-separated parts. */
export function splitJwt(jwt: string): JwtParts | { error: string } {
  const parts = jwt.trim().split(".");
  if (parts.length !== 3) return { error: "JWT must have 3 dot-separated parts" };
  return { header: parts[0]!, payload: parts[1]!, signature: parts[2]! };
}

/** Base64url decode to a UTF-8 string. */
export function base64urlDecode(s: string): string {
  let b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  // Pad with '=' to length multiple of 4
  while (b64.length % 4 !== 0) b64 += "=";
  if (typeof atob !== "undefined") {
    return decodeURIComponent(escape(atob(b64)));
  }
  return Buffer.from(b64, "base64").toString("utf8");
}

/** Parse JSON safely. Returns null on failure. */
export function safeJsonParse(s: string): unknown {
  try { return JSON.parse(s); } catch { return null; }
}

/** Decode a JWT header + payload. Does NOT verify the signature. */
export function decodeJwt(jwt: string): JwtDecoded | { error: string } {
  const parts = splitJwt(jwt);
  if ("error" in parts) return parts;
  try {
    const header = safeJsonParse(base64urlDecode(parts.header));
    const payload = safeJsonParse(base64urlDecode(parts.payload));
    return { header, payload, signature: parts.signature, raw: parts };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/** Extract standard claims from a decoded payload. */
export function extractClaims(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object") return {};
  const obj = payload as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of ["iss", "sub", "aud", "exp", "nbf", "iat", "jti"]) {
    if (k in obj) out[k] = obj[k];
  }
  return out;
}

/** Convert a numeric epoch (seconds) to an ISO string. */
export function epochToIso(epoch: number): string {
  return new Date(epoch * 1000).toISOString();
}
