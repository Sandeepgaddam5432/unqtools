/**
 * JWT Debugger — pure logic.
 *
 * Parses, decodes, and (for HS256/384/512) verifies JSON Web Tokens using
 * WebCrypto HMAC. Security lint flags alg:none, algorithm confusion, expiry,
 * weak secrets, missing claims. 100% client-side, no React, no network.
 */

export type JwtAlg = "HS256" | "HS384" | "HS512" | "RS256" | "RS384" | "RS512" | "ES256" | "ES384" | "ES512" | "EdDSA" | "none";

export interface JwtHeader {
  alg?: string;
  typ?: string;
  kid?: string;
  [k: string]: unknown;
}

export type Severity = "high" | "medium" | "low" | "info";

export interface JwtLintIssue {
  severity: Severity;
  code: string;
  message: string;
  recommendation: string;
}

export interface JwtClaimInfo {
  claim: string;
  value: string;
  description: string;
  humanTime?: string;
  countdown?: string;
}

export interface JwtDecoded {
  raw: string;
  header: JwtHeader;
  payload: Record<string, unknown>;
  signature: string;
  headerJson: string;
  payloadJson: string;
  parts: { header: string; payload: string; signature: string };
  lint: JwtLintIssue[];
  isValidFormat: boolean;
  error?: string;
}

/** Base64url decode → Uint8Array. Tolerates missing padding. */
export function base64UrlDecode(input: string): Uint8Array {
  let s = input.replace(/-/g, "+").replace(/_/g, "/");
  // pad to multiple of 4
  const pad = s.length % 4;
  if (pad) s += "=".repeat(4 - pad);
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** UTF-8 bytes → string. */
export function bytesToUtf8(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

/** String → UTF-8 bytes. */
export function utf8ToBytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

/** Base64url encode (no padding). */
export function base64UrlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Format epoch seconds as ISO + human-readable. */
export function formatEpoch(seconds: number): string {
  const ms = seconds * 1000;
  const d = new Date(ms);
  const iso = d.toISOString();
  const local = d.toLocaleString();
  return `${iso} (${local})`;
}

/** Countdown from now to a target epoch; returns human-readable delta. */
export function countdownTo(seconds: number, now = Date.now()): string {
  const ms = seconds * 1000 - now;
  const abs = Math.abs(ms);
  const days = Math.floor(abs / 86400000);
  const hours = Math.floor((abs % 86400000) / 3600000);
  const mins = Math.floor((abs % 3600000) / 60000);
  const secs = Math.floor((abs % 60000) / 1000);
  let s = "";
  if (days > 0) s += `${days}d `;
  if (hours > 0 || days > 0) s += `${hours}h `;
  if (mins > 0 || hours > 0 || days > 0) s += `${mins}m `;
  s += `${secs}s`;
  return ms >= 0 ? `in ${s}` : `${s} ago`;
}

const CLAIM_DOCS: Record<string, string> = {
  iss: "Issuer — identifies the principal that issued the JWT.",
  sub: "Subject — identifies the principal that is the subject of the JWT.",
  aud: "Audience — identifies the intended recipients of the JWT.",
  exp: "Expiration time — after which the JWT must not be accepted.",
  nbf: "Not before — time before which the JWT must not be accepted.",
  iat: "Issued at — time at which the JWT was issued.",
  jti: "JWT ID — unique identifier for the JWT.",
};

/** Decode a JWT into its parts + parsed JSON. */
export function decodeJwt(token: string): JwtDecoded {
  const trimmed = token.trim();
  if (!trimmed) {
    return { raw: "", header: {}, payload: {}, signature: "", headerJson: "", payloadJson: "", parts: { header: "", payload: "", signature: "" }, lint: [], isValidFormat: false, error: "Empty token." };
  }
  const parts = trimmed.split(".");
  if (parts.length !== 3) {
    return { raw: trimmed, header: {}, payload: {}, signature: "", headerJson: "", payloadJson: "", parts: { header: "", payload: "", signature: "" }, lint: [], isValidFormat: false, error: `Expected 3 dot-separated parts, got ${parts.length}.` };
  }
  const [h, p, s] = parts as [string, string, string];
  let header: JwtHeader = {};
  let payload: Record<string, unknown> = {};
  let headerJson = "";
  let payloadJson = "";
  try {
    headerJson = bytesToUtf8(base64UrlDecode(h));
    header = JSON.parse(headerJson);
  } catch (e) {
    return { raw: trimmed, header: {}, payload: {}, signature: s, headerJson: "", payloadJson: "", parts: { header: h, payload: p, signature: s }, lint: [], isValidFormat: false, error: `Could not decode/parse header: ${(e as Error).message}` };
  }
  try {
    payloadJson = bytesToUtf8(base64UrlDecode(p));
    payload = JSON.parse(payloadJson);
  } catch (e) {
    return { raw: trimmed, header, payload: {}, signature: s, headerJson, payloadJson: "", parts: { header: h, payload: p, signature: s }, lint: [], isValidFormat: false, error: `Could not decode/parse payload: ${(e as Error).message}` };
  }
  const lint = lintJwt(header, payload, s);
  return { raw: trimmed, header, payload, signature: s, headerJson, payloadJson, parts: { header: h, payload: p, signature: s }, lint, isValidFormat: true };
}

/** Run security lint checks on a decoded JWT. */
export function lintJwt(header: JwtHeader, payload: Record<string, unknown>, signature: string): JwtLintIssue[] {
  const out: JwtLintIssue[] = [];
  const alg = (header.alg ?? "").toString();
  const now = Date.now();
  const nowSec = Math.floor(now / 1000);

  // alg:none
  if (alg === "none" || alg === "") {
    out.push({
      severity: "high",
      code: "alg-none",
      message: `Algorithm is '${alg || "(empty)"}' — this token is unsigned.`,
      recommendation: "Never accept alg:none tokens for authentication. Reject on the server.",
    });
  }
  // empty signature but alg claims signed
  if (alg !== "none" && alg !== "" && (!signature || signature.length === 0)) {
    out.push({
      severity: "high",
      code: "missing-signature",
      message: `Header claims alg='${alg}' but the signature part is empty.`,
      recommendation: "Reject — token is unsigned despite claiming to be signed.",
    });
  }
  // missing exp
  if (payload.exp === undefined) {
    out.push({
      severity: "medium",
      code: "missing-exp",
      message: "No 'exp' (expiration) claim — token may be valid forever.",
      recommendation: "Always set a short exp (e.g., 15 min for access tokens).",
    });
  }
  // expired
  if (typeof payload.exp === "number") {
    if (payload.exp < nowSec) {
      out.push({
        severity: "high",
        code: "expired",
        message: `Token expired ${countdownTo(payload.exp, now)} (${formatEpoch(payload.exp)}).`,
        recommendation: "Reject expired tokens; force re-authentication or refresh.",
      });
    } else if (payload.exp - nowSec < 60) {
      out.push({
        severity: "low",
        code: "expiring-soon",
        message: `Token expires ${countdownTo(payload.exp, now)} — within 60s.`,
        recommendation: "Refresh the token soon to avoid 401s.",
      });
    }
  }
  // nbf in the future
  if (typeof payload.nbf === "number" && payload.nbf > nowSec) {
    out.push({
      severity: "medium",
      code: "not-yet-valid",
      message: `Token not valid until ${formatEpoch(payload.nbf)} (${countdownTo(payload.nbf, now)}).`,
      recommendation: "Reject if current time is before nbf; check clock skew (≤60s tolerance).",
    });
  }
  // iat in the future
  if (typeof payload.iat === "number" && payload.iat > nowSec + 60) {
    out.push({
      severity: "low",
      code: "iat-future",
      message: `Token 'iat' is in the future (${formatEpoch(payload.iat)}) — clock skew or tampering.`,
      recommendation: "Check server clock; tolerate small skew on iat.",
    });
  }
  // asymmetric alg (cannot verify here)
  if (alg.startsWith("RS") || alg.startsWith("ES") || alg === "EdDSA") {
    out.push({
      severity: "info",
      code: "asymmetric-alg",
      message: `Algorithm '${alg}' is asymmetric — verification needs the RSA/ECDSA/EdDSA public key.`,
      recommendation: "Use a tool that supports PEM/JWK public-key verification; this tool verifies HS256/384/512 only.",
    });
  }
  return out;
}

/** Lint an HMAC secret for weakness. */
export function lintSecret(secret: string): JwtLintIssue[] {
  const out: JwtLintIssue[] = [];
  if (!secret) {
    out.push({ severity: "high", code: "empty-secret", message: "No secret provided.", recommendation: "Paste the HMAC secret to verify the signature." });
    return out;
  }
  if (secret.length < 16) {
    out.push({ severity: "medium", code: "short-secret", message: `Secret is ${secret.length} chars — HS256 secrets should be ≥32 chars (256 bits).`, recommendation: "Use a CSPRNG-generated secret of at least 32 bytes." });
  }
  if (/^\d+$/.test(secret)) {
    out.push({ severity: "medium", code: "numeric-secret", message: "Secret is numeric-only — extremely low entropy.", recommendation: "Use a random alphanumeric secret." });
  }
  if (/^(password|secret|key|test|admin|changeme|123)/i.test(secret)) {
    out.push({ severity: "high", code: "dictionary-secret", message: "Secret looks like a dictionary word or common default.", recommendation: "Rotate immediately; generate a random secret." });
  }
  return out;
}

/** Map JWT alg → WebCrypto hash name. */
function algToHash(alg: JwtAlg): "SHA-256" | "SHA-384" | "SHA-512" | null {
  if (alg === "HS256") return "SHA-256";
  if (alg === "HS384") return "SHA-384";
  if (alg === "HS512") return "SHA-512";
  return null;
}

/** Verify an HS256/384/512 JWT signature against a secret. Returns true/false; false for unsupported algs. */
export async function verifyJwt(token: string, secret: string, expectedAlg: JwtAlg = "HS256"): Promise<{ verified: boolean; reason?: string }> {
  const decoded = decodeJwt(token);
  if (!decoded.isValidFormat) return { verified: false, reason: decoded.error };
  const headerAlg = (decoded.header.alg ?? "").toString();
  // algorithm confusion: header alg differs from expected
  if (headerAlg !== expectedAlg) {
    return { verified: false, reason: `Algorithm mismatch — header says '${headerAlg}', verifier expects '${expectedAlg}'. Possible algorithm-confusion attack.` };
  }
  const hash = algToHash(expectedAlg);
  if (!hash) {
    return { verified: false, reason: `Algorithm '${expectedAlg}' is not supported for HMAC verification (only HS256/384/512).` };
  }
  // exact bytes — no whitespace stripping
  const signedPart = token.substring(0, token.lastIndexOf("."));
  const keyData = utf8ToBytes(secret);
  const key = await crypto.subtle.importKey("raw", keyData as BufferSource, { name: "HMAC", hash }, false, ["verify"]);
  const sigBytes = base64UrlDecode(decoded.signature);
  const dataBytes = utf8ToBytes(signedPart);
  const ok = await crypto.subtle.verify("HMAC", key, sigBytes as BufferSource, dataBytes as BufferSource);
  return { verified: ok, reason: ok ? undefined : "Signature does not match secret." };
}

/** Sign a payload with an HMAC secret, returning a complete JWT. */
export async function signJwt(header: JwtHeader, payload: Record<string, unknown>, secret: string, alg: JwtAlg = "HS256"): Promise<string> {
  const hash = algToHash(alg);
  if (!hash) throw new Error(`Unsupported alg: ${alg}`);
  const h = base64UrlEncode(utf8ToBytes(JSON.stringify({ alg, typ: "JWT", ...header })));
  const p = base64UrlEncode(utf8ToBytes(JSON.stringify(payload)));
  const signingInput = `${h}.${p}`;
  const keyData = utf8ToBytes(secret);
  const key = await crypto.subtle.importKey("raw", keyData as BufferSource, { name: "HMAC", hash }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, utf8ToBytes(signingInput) as BufferSource);
  const sigB64 = base64UrlEncode(new Uint8Array(sig));
  return `${signingInput}.${sigB64}`;
}

/** Build claim info list for display, with human-readable times and countdowns. */
export function describeClaims(payload: Record<string, unknown>, now = Date.now()): JwtClaimInfo[] {
  const out: JwtClaimInfo[] = [];
  for (const [k, v] of Object.entries(payload)) {
    const description = CLAIM_DOCS[k] ?? "Custom claim.";
    let value: string;
    let humanTime: string | undefined;
    let countdown: string | undefined;
    if (typeof v === "number" && (k === "exp" || k === "nbf" || k === "iat" || k === "auth_time")) {
      value = String(v);
      humanTime = formatEpoch(v);
      if (k === "exp" || k === "nbf") countdown = countdownTo(v, now);
    } else if (typeof v === "object" && v !== null) {
      value = JSON.stringify(v);
    } else {
      value = String(v);
    }
    out.push({ claim: k, value, description, humanTime, countdown });
  }
  return out;
}

/** Sample tokens for the UI. */
export const SAMPLE_TOKENS = {
  valid: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkphbmUgRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjk5OTk5OTk5OTl9.wK7jB5Tq3LpVZkz9cXfYpW8nQmR2sE1vH0aZbC4dE",
  algNone: "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiIxMjM0Iiwicm9sZSI6ImFkbWluIn0.",
  expired: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0IiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789abcdef0",
};

/** Encode a token into a shareable URL fragment (token only — never the secret). */
export function encodeShareUrl(token: string): string {
  return `#jwt=${encodeURIComponent(token)}`;
}

/** Decode a share URL fragment back into a token. */
export function decodeShareUrl(fragment: string): string | null {
  const m = /#jwt=(.+)$/.exec(fragment);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]!);
  } catch {
    return null;
  }
}

/** Pretty-print JSON with 2-space indent. */
export function prettyJson(obj: unknown): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}
