/**
 * JWT Claim Extractor — decode JWT header + payload (base64url → JSON).
 *
 * Features:
 *  - Splits a JWT into 3 parts and decodes header/payload
 *  - Extracts registered claims (iss, sub, aud, exp, nbf, iat, jti)
 *  - Detects the algorithm from the header
 *  - Checks expiry / not-before against current time
 *  - Surfaces security warnings (alg=none, weak algorithms, missing exp)
 *  - Batch mode (one JWT per line) with CSV export
 *  - Pretty-prints JSON payloads
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

export type JwtAlg =
  | "HS256" | "HS384" | "HS512"
  | "RS256" | "RS384" | "RS512"
  | "ES256" | "ES384" | "ES512"
  | "PS256" | "PS384" | "PS512"
  | "none"
  | "unknown";

export interface ExpiryInfo {
  expired: boolean;
  notYetValid: boolean;
  expiresAt?: string;
  issuedAt?: string;
  notBefore?: string;
  secondsUntilExpiry?: number;
}

export interface SecurityWarning {
  level: "info" | "warning" | "danger";
  message: string;
}

/** Registered claim metadata for display. */
export const REGISTERED_CLAIMS: Record<string, { name: string; description: string }> = {
  iss: { name: "Issuer", description: "Principal that issued the JWT." },
  sub: { name: "Subject", description: "Principal that is the subject of the JWT." },
  aud: { name: "Audience", description: "Intended recipient(s) of the JWT." },
  exp: { name: "Expiration", description: "Expiration time (seconds since epoch)." },
  nbf: { name: "Not Before", description: "Time before which JWT must not be accepted." },
  iat: { name: "Issued At", description: "Time the JWT was issued." },
  jti: { name: "JWT ID", description: "Unique identifier for the JWT." },
};

/** Split a JWT into its 3 dot-separated parts. */
export function splitJwt(jwt: string): JwtParts | { error: string } {
  const trimmed = jwt.trim();
  if (!trimmed) return { error: "JWT is empty" };
  const parts = trimmed.split(".");
  if (parts.length !== 3) return { error: "JWT must have 3 dot-separated parts" };
  if (!parts[0] || !parts[1]) return { error: "JWT header and payload cannot be empty" };
  return { header: parts[0]!, payload: parts[1]!, signature: parts[2] ?? "" };
}

/** Base64url decode to a UTF-8 string. */
export function base64urlDecode(s: string): string {
  let b64 = s.replace(/-/g, "+").replace(/_/g, "/");
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
    if (header == null || payload == null) return { error: "Header or payload is not valid JSON" };
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
  for (const k of Object.keys(REGISTERED_CLAIMS)) {
    if (k in obj) out[k] = obj[k];
  }
  return out;
}

/** Extract non-registered (custom) claims from a decoded payload. */
export function extractCustomClaims(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object") return {};
  const obj = payload as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(obj)) {
    if (!(k in REGISTERED_CLAIMS)) out[k] = obj[k];
  }
  return out;
}

/** Convert a numeric epoch (seconds) to an ISO string. */
export function epochToIso(epoch: number): string {
  return new Date(epoch * 1000).toISOString();
}

/** Detect the algorithm from the header. Returns "unknown" if not recognized. */
export function detectAlg(header: unknown): JwtAlg {
  if (!header || typeof header !== "object") return "unknown";
  const alg = (header as Record<string, unknown>).alg;
  if (typeof alg !== "string") return "unknown";
  const known: JwtAlg[] = [
    "HS256", "HS384", "HS512",
    "RS256", "RS384", "RS512",
    "ES256", "ES384", "ES512",
    "PS256", "PS384", "PS512",
    "none",
  ];
  return known.includes(alg as JwtAlg) ? (alg as JwtAlg) : "unknown";
}

/** Inspect exp / nbf / iat to determine validity at the given time. */
export function checkExpiry(payload: unknown, now: number = Date.now()): ExpiryInfo {
  const info: ExpiryInfo = { expired: false, notYetValid: false };
  if (!payload || typeof payload !== "object") return info;
  const obj = payload as Record<string, unknown>;
  const nowSec = Math.floor(now / 1000);
  if (typeof obj.exp === "number") {
    info.expiresAt = epochToIso(obj.exp);
    info.secondsUntilExpiry = obj.exp - nowSec;
    if (obj.exp < nowSec) info.expired = true;
  }
  if (typeof obj.iat === "number") info.issuedAt = epochToIso(obj.iat);
  if (typeof obj.nbf === "number") {
    info.notBefore = epochToIso(obj.nbf);
    if (obj.nbf > nowSec) info.notYetValid = true;
  }
  return info;
}

/** Produce security warnings for a decoded JWT. */
export function securityWarnings(decoded: JwtDecoded): SecurityWarning[] {
  const warnings: SecurityWarning[] = [];
  const alg = detectAlg(decoded.header);
  if (alg === "none") {
    warnings.push({ level: "danger", message: 'Algorithm is "none" — token is NOT signed.' });
  }
  if (alg === "unknown") {
    warnings.push({ level: "warning", message: "Algorithm is missing or unrecognized." });
  }
  if (alg.startsWith("HS")) {
    warnings.push({ level: "info", message: "HMAC algorithm — verify the shared secret is strong and rotated." });
  }
  if (!decoded.signature) {
    warnings.push({ level: "warning", message: "Signature is empty — token integrity cannot be checked." });
  }
  if (decoded.payload && typeof decoded.payload === "object") {
    const obj = decoded.payload as Record<string, unknown>;
    if (!("exp" in obj)) {
      warnings.push({ level: "warning", message: "Token has no `exp` claim — it never expires." });
    }
    const info = checkExpiry(decoded.payload);
    if (info.expired) warnings.push({ level: "danger", message: "Token is expired." });
    if (info.notYetValid) warnings.push({ level: "warning", message: "Token is not yet valid (nbf in the future)." });
  }
  return warnings;
}

export interface BatchRow {
  index: number;
  ok: boolean;
  error?: string;
  alg?: JwtAlg;
  sub?: string;
  expired?: boolean;
}

/** Decode multiple JWTs and return a summary row per JWT. */
export function batchDecode(jwts: string[]): { rows: BatchRow[]; decoded: (JwtDecoded | { error: string })[] } {
  const decoded = jwts.map((j) => decodeJwt(j));
  const rows: BatchRow[] = decoded.map((d, i) => {
    if ("error" in d) return { index: i, ok: false, error: d.error };
    const alg = detectAlg(d.header);
    const payload = d.payload as Record<string, unknown> | null;
    const sub = payload && typeof payload.sub === "string" ? payload.sub : undefined;
    const expired = checkExpiry(d.payload).expired;
    return { index: i, ok: true, alg, sub, expired };
  });
  return { rows, decoded };
}

/** Serialize batch summary rows to CSV. */
export function batchToCsv(rows: BatchRow[]): string {
  const lines = ["Index,OK,Algorithm,Subject,Expired,Error"];
  for (const r of rows) {
    const err = r.error ? `"${r.error.replace(/"/g, '""')}"` : "";
    const sub = r.sub ? `"${r.sub.replace(/"/g, '""')}"` : "";
    lines.push(`${r.index},${r.ok ? "yes" : "no"},${r.alg ?? ""},${sub},${r.expired ? "yes" : "no"},${err}`);
  }
  return lines.join("\n");
}

/** Pretty-print a JSON payload with stable key ordering. */
export function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/** Parse a multi-line text input into a list of JWT strings. */
export function parseBatchInput(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}
