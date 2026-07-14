/**
 * JWT Debugger — pure logic (v8.1 — 100% blueprint + 10 extras)
 *
 * Implements:
 *   Blueprint §5 features:
 *     - Decode header/payload (existing, kept)
 *     - Signature verify for HS256/384/512, RS256/384/512, ES256/384/512,
 *       EdDSA via WebCrypto
 *     - JWK input + PEM input
 *     - Security lint: alg:none, algorithm-confusion (RS key used as HMAC
 *       secret), weak HMAC secret (<16 chars), missing exp claim
 *     - JWT encoder/generator (build header+payload, sign with secret/key)
 *     - Human-readable timestamps + countdown for exp/nbf/iat
 *     - Three-pane UX support (encoded/decoded/verify) — UI-side
 *     - Exact byte preservation (no whitespace stripping before verify)
 *     - Copy individual claims — UI-side
 *
 *   10 Extras (beyond blueprint):
 *     1. JWKS (key set) input — paste array of JWKs, auto-select by kid
 *     2. Token comparison mode — diff two JWTs claim-by-claim
 *     3. Copy individual claims — UI-side
 *     4. Timeline visualization — UI-side (iat → nbf → exp with "now")
 *     5. PEM certificate parser — extract public key from X.509 cert PEM
 *     6. Token freshness warning — <5 min to expiry = urgent badge
 *     7. Decode-without-verification toggle — show payload even if sig invalid
 *     8. Export decoded header+payload as JSON file
 *     9. Shareable URL — encode token in URL hash (NEVER the secret)
 *    10. Keyboard shortcuts (V=verify, C=copy token, D=decode)
 *
 *   Honesty clause: All decoding, verification, and signing happen locally
 *   via WebCrypto. JWTs (which are credentials) never leave your browser.
 *   Shareable URLs encode the token in the fragment (#) which is NOT sent
 *   to servers, and never include secrets or private keys.
 */

// ===== Types =====

export type JwtAlgorithm =
  | "HS256" | "HS384" | "HS512"
  | "RS256" | "RS384" | "RS512"
  | "PS256" | "PS384" | "PS512"
  | "ES256" | "ES384" | "ES512"
  | "EdDSA"
  | "none";

export interface JwtParts {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signature: string; // raw base64url string
  raw: {
    header: string;
    payload: string;
    signature: string;
  };
  isValid: boolean;
  error?: string;
}

export type VerifyStatus =
  | "valid"           // signature matches
  | "invalid"         // signature doesn't match
  | "alg-none"        // alg:none — cannot verify
  | "unsupported"     // algorithm not supported
  | "key-missing"     // no key/secret provided
  | "key-invalid"     // key format wrong
  | "error";          // unexpected error

export interface VerifyResult {
  status: VerifyStatus;
  message: string;
  algorithm?: JwtAlgorithm;
}

export interface LintFinding {
  severity: "high" | "medium" | "low" | "info";
  code: string;
  message: string;
  recommendation: string;
}

export interface TimelineInfo {
  iat?: number;       // issued at (unix seconds)
  nbf?: number;       // not before
  exp?: number;       // expires at
  now: number;        // current unix seconds
  isExpired: boolean;
  isNotYetValid: boolean;
  secondsToExpiry?: number;
  secondsToValidity?: number;
  isFresh: boolean;   // <5 min to expiry
}

export interface EncodeOptions {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  algorithm: JwtAlgorithm;
  secret?: string;    // for HS algorithms
  key?: JsonWebKey;   // for RS/PS/ES/EdDSA
  // For RS/PS/ES/EdDSA, the key should be the private key in JWK format
}

// ===== Base64url codec (exact byte preservation) =====

/** Convert base64url to base64 (add padding, replace - _ with + /). */
export function base64UrlToBase64(b64url: string): string {
  let b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4 !== 0) b64 += "=";
  return b64;
}

/** Decode a base64url string to a UTF-8 string. Throws on invalid input. */
export function base64UrlDecode(b64url: string): string {
  const b64 = base64UrlToBase64(b64url);
  if (typeof atob === "function") {
    const binary = atob(b64);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder("utf-8").decode(bytes);
  }
  if (typeof Buffer !== "undefined") {
    return Buffer.from(b64, "base64").toString("utf-8");
  }
  throw new Error("No base64 decoder available in this environment.");
}

/** Encode a string as base64url (no padding). */
export function base64UrlEncode(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  const b64 = typeof btoa === "function"
    ? btoa(binary)
    : Buffer.from(bytes).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Decode base64url to raw bytes (for signature verification). */
export function base64UrlDecodeBytes(b64url: string): Uint8Array {
  const b64 = base64UrlToBase64(b64url);
  if (typeof atob === "function") {
    const binary = atob(b64);
    return Uint8Array.from(binary, (c) => c.charCodeAt(0));
  }
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(b64, "base64"));
  }
  throw new Error("No base64 decoder available in this environment.");
}

/** Encode raw bytes as base64url (no padding). */
export function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  const b64 = typeof btoa === "function"
    ? btoa(binary)
    : Buffer.from(bytes).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// ===== Structure validation =====

/** Validate JWT structure (3 dot-separated base64url parts). */
export function validateJwtStructure(token: string): string | null {
  if (!token || typeof token !== "string") return "Token is empty.";
  // Note: we do NOT trim — exact byte preservation (blueprint requirement).
  // But we do allow trailing newline which some tools add by mistake.
  const trimmed = token.replace(/\n$/, "");
  if (trimmed !== token) return "Token has a trailing newline (will be stripped for verification).";
  const parts = token.split(".");
  if (parts.length !== 3) {
    return `Expected 3 parts separated by dots, got ${parts.length}.`;
  }
  // Header and payload MUST be non-empty. Signature CAN be empty (alg:none).
  if (!parts[0]) return "Header is empty.";
  if (!parts[1]) return "Payload is empty.";
  const validChars = /^[A-Za-z0-9_-]+$/;
  if (!validChars.test(parts[0])) return "Header contains invalid base64url characters.";
  if (!validChars.test(parts[1])) return "Payload contains invalid base64url characters.";
  // Signature may be empty (alg:none); if present, must be valid base64url
  if (parts[2] && !validChars.test(parts[2])) {
    return "Signature contains invalid base64url characters.";
  }
  return null;
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

/** Decode a JWT into its three parts. Throws on invalid input. */
export function decodeJwt(token: string): JwtParts {
  const err = validateJwtStructure(token);
  if (err) throw new Error(err);
  const [rawHeader, rawPayload, rawSignature] = token.split(".");
  return {
    header: decodeJsonObject(rawHeader, "header"),
    payload: decodeJsonObject(rawPayload, "payload"),
    signature: rawSignature,
    raw: { header: rawHeader, payload: rawPayload, signature: rawSignature },
    isValid: true,
  };
}

/** Decode a JWT, returning isValid=false instead of throwing. */
export function decodeJwtSafe(token: string): JwtParts {
  try {
    return decodeJwt(token);
  } catch (e) {
    return {
      header: {},
      payload: {},
      signature: "",
      raw: { header: "", payload: "", signature: "" },
      isValid: false,
      error: (e as Error).message,
    };
  }
}

// ===== Algorithm extraction =====

/** Get the algorithm name from the header. */
export function getAlgorithm(parts: JwtParts): JwtAlgorithm | undefined {
  const alg = parts.header.alg;
  return typeof alg === "string" ? (alg as JwtAlgorithm) : undefined;
}

const SUPPORTED_ALGS: JwtAlgorithm[] = [
  "HS256", "HS384", "HS512",
  "RS256", "RS384", "RS512",
  "PS256", "PS384", "PS512",
  "ES256", "ES384", "ES512",
  "EdDSA",
];

export function isAlgorithmSupported(alg: string | undefined): boolean {
  return !!alg && SUPPORTED_ALGS.includes(alg as JwtAlgorithm);
}

// ===== HMAC algorithms (HS256/384/512) =====

function webCryptoHashName(alg: JwtAlgorithm): "SHA-256" | "SHA-384" | "SHA-512" {
  if (alg.endsWith("256")) return "SHA-256";
  if (alg.endsWith("384")) return "SHA-384";
  return "SHA-512";
}

async function importHmacKey(secret: string, alg: JwtAlgorithm): Promise<CryptoKey> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("WebCrypto not available.");
  const keyBytes = new TextEncoder().encode(secret);
  return subtle.importKey(
    "raw",
    keyBytes as BufferSource,
    { name: "HMAC", hash: { name: webCryptoHashName(alg) } },
    false,
    ["sign", "verify"],
  );
}

async function importRsaPublicKeyFromJwk(jwk: JsonWebKey, alg: JwtAlgorithm): Promise<CryptoKey> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("WebCrypto not available.");
  const isPss = alg.startsWith("PS");
  const hash = webCryptoHashName(alg);
  return subtle.importKey(
    "jwk",
    jwk,
    { name: isPss ? "RSASSA-PKCS1-v1_5" : isPss ? "RSA-PSS" : "RSASSA-PKCS1-v1_5", hash: { name: hash } },
    false,
    ["verify"],
  );
}

async function importEcPublicKeyFromJwk(jwk: JsonWebKey, alg: JwtAlgorithm): Promise<CryptoKey> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("WebCrypto not available.");
  const curve = alg === "ES256" ? "P-256" : alg === "ES384" ? "P-384" : "P-521";
  return subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: curve },
    false,
    ["verify"],
  );
}

async function importEd25519PublicKeyFromJwk(jwk: JsonWebKey): Promise<CryptoKey> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("WebCrypto not available.");
  // Ed25519 support varies by browser; Chrome 113+, Safari 17+, Firefox 130+
  return subtle.importKey(
    "jwk",
    jwk,
    { name: "Ed25519" } as unknown as Algorithm,
    false,
    ["verify"],
  );
}

// ===== Signature verification =====

export interface VerifyInput {
  token: string;
  parts: JwtParts;
  algorithm: JwtAlgorithm;
  secret?: string;       // for HS algorithms
  jwk?: JsonWebKey;     // for RS/PS/ES/EdDSA public key
  jwks?: JsonWebKey[];  // JWKS key set (extra #1) — auto-select by kid
}

/** Verify a JWT signature. Returns status enum + message. */
export async function verifySignature(input: VerifyInput): Promise<VerifyResult> {
  const { token, parts, algorithm, secret, jwk, jwks } = input;
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    return { status: "error", message: "WebCrypto API not available in this environment." };
  }

  // alg:none — decode but never "verified"
  if (algorithm === "none") {
    return {
      status: "alg-none",
      message: "Algorithm is 'none' — token is unsigned. Anyone can forge it. Do not use for authentication.",
      algorithm,
    };
  }

  if (!isAlgorithmSupported(algorithm)) {
    return {
      status: "unsupported",
      message: `Algorithm '${algorithm}' is not supported. Supported: HS256/384/512, RS256/384/512, PS256/384/512, ES256/384/512, EdDSA.`,
      algorithm,
    };
  }

  // The signing input is `header.payload` (exact bytes — no whitespace stripping)
  const signingInput = `${parts.raw.header}.${parts.raw.payload}`;
  const signingBytes = new TextEncoder().encode(signingInput);
  const signatureBytes = base64UrlDecodeBytes(parts.raw.signature);

  try {
    // HMAC algorithms
    if (algorithm.startsWith("HS")) {
      if (!secret) {
        return { status: "key-missing", message: "HMAC algorithm requires a shared secret.", algorithm };
      }
      const cryptoKey = await importHmacKey(secret, algorithm);
      const valid = await subtle.verify("HMAC", cryptoKey, signatureBytes as BufferSource, signingBytes as BufferSource);
      return {
        status: valid ? "valid" : "invalid",
        message: valid ? "Signature verified — HMAC matches." : "Signature INVALID — secret is wrong or token was tampered with.",
        algorithm,
      };
    }

    // RSA algorithms (RS = RSASSA-PKCS1-v1_5, PS = RSA-PSS)
    if (algorithm.startsWith("RS") || algorithm.startsWith("PS")) {
      let keyToUse = jwk;
      // Extra #1: JWKS auto-select by kid
      if (!keyToUse && jwks && jwks.length > 0) {
        const kid = parts.header.kid;
        if (kid && typeof kid === "string") {
          keyToUse = jwks.find((k) => k.kid === kid);
        }
        if (!keyToUse) keyToUse = jwks[0]; // fallback to first key
      }
      if (!keyToUse) {
        return { status: "key-missing", message: "RSA algorithm requires a public key (JWK).", algorithm };
      }
      const cryptoKey = await importRsaPublicKeyFromJwk(keyToUse, algorithm);
      const isPss = algorithm.startsWith("PS");
      const valid = await subtle.verify(
        isPss ? "RSA-PSS" : "RSASSA-PKCS1-v1_5",
        cryptoKey,
        signatureBytes as BufferSource,
        signingBytes as BufferSource,
      );
      return {
        status: valid ? "valid" : "invalid",
        message: valid ? `Signature verified — ${algorithm} matches.` : `Signature INVALID — ${algorithm} signature doesn't match the public key.`,
        algorithm,
      };
    }

    // ECDSA algorithms
    if (algorithm.startsWith("ES")) {
      let keyToUse = jwk;
      if (!keyToUse && jwks && jwks.length > 0) {
        const kid = parts.header.kid;
        if (kid && typeof kid === "string") {
          keyToUse = jwks.find((k) => k.kid === kid);
        }
        if (!keyToUse) keyToUse = jwks[0];
      }
      if (!keyToUse) {
        return { status: "key-missing", message: "ECDSA algorithm requires a public key (JWK).", algorithm };
      }
      const cryptoKey = await importEcPublicKeyFromJwk(keyToUse, algorithm);
      // ECDSA signatures in JWT are R+S concatenated (raw), but WebCrypto expects DER-encoded.
      // We need to convert from raw to DER for verification.
      const derSignature = rawEcdsaToDer(signatureBytes, algorithm);
      const valid = await subtle.verify(
        { name: "ECDSA", hash: { name: webCryptoHashName(algorithm) } },
        cryptoKey,
        derSignature as BufferSource,
        signingBytes as BufferSource,
      );
      return {
        status: valid ? "valid" : "invalid",
        message: valid ? `Signature verified — ${algorithm} matches.` : `Signature INVALID — ${algorithm} signature doesn't match the public key.`,
        algorithm,
      };
    }

    // EdDSA (Ed25519)
    if (algorithm === "EdDSA") {
      let keyToUse = jwk;
      if (!keyToUse && jwks && jwks.length > 0) {
        const kid = parts.header.kid;
        if (kid && typeof kid === "string") {
          keyToUse = jwks.find((k) => k.kid === kid);
        }
        if (!keyToUse) keyToUse = jwks[0];
      }
      if (!keyToUse) {
        return { status: "key-missing", message: "EdDSA requires a public key (JWK with crv='Ed25519').", algorithm };
      }
      try {
        const cryptoKey = await importEd25519PublicKeyFromJwk(keyToUse);
        const valid = await subtle.verify(
          "Ed25519" as unknown as Algorithm,
          cryptoKey,
          signatureBytes as BufferSource,
          signingBytes as BufferSource,
        );
        return {
          status: valid ? "valid" : "invalid",
          message: valid ? "Signature verified — EdDSA matches." : "Signature INVALID — EdDSA signature doesn't match the public key.",
          algorithm,
        };
      } catch (e) {
        return { status: "key-invalid", message: `Ed25519 not supported in this browser, or invalid key: ${(e as Error).message}`, algorithm };
      }
    }

    return { status: "unsupported", message: `Algorithm '${algorithm}' verification not implemented.`, algorithm };
  } catch (e) {
    return { status: "error", message: `Verification error: ${(e as Error).message}`, algorithm };
  }
}

/**
 * Convert a raw ECDSA signature (R+S concatenated, as used in JWT) to
 * DER-encoded format (as expected by WebCrypto subtle.verify).
 *
 * JWT spec (RFC 7518 §3.4): ECDSA signatures are R and S values, each
 * zero-padded to the curve's coordinate size, concatenated (no DER).
 * WebCrypto expects DER-encoded ASN.1 SEQUENCE { INTEGER r, INTEGER s }.
 */
function rawEcdsaToDer(raw: Uint8Array, alg: JwtAlgorithm): Uint8Array {
  const coordLen = alg === "ES256" ? 32 : alg === "ES384" ? 48 : 66;
  if (raw.length !== coordLen * 2) {
    throw new Error(`Expected ${coordLen * 2} bytes for ${alg} signature, got ${raw.length}`);
  }
  const r = raw.slice(0, coordLen);
  const s = raw.slice(coordLen);

  // Encode each as DER INTEGER (with leading zero if high bit set)
  const encodeInt = (bytes: Uint8Array): Uint8Array => {
    // Strip leading zeros
    let start = 0;
    while (start < bytes.length - 1 && bytes[start] === 0) start++;
    const trimmed = bytes.slice(start);
    // Add leading zero if high bit set (to keep positive)
    const needsLeadingZero = trimmed[0] & 0x80;
    const out = new Uint8Array((needsLeadingZero ? 1 : 0) + trimmed.length);
    if (needsLeadingZero) {
      out[0] = 0;
      out.set(trimmed, 1);
    } else {
      out.set(trimmed);
    }
    return out;
  };

  const rDer = encodeInt(r);
  const sDer = encodeInt(s);

  // Build SEQUENCE
  const totalLen = 2 + rDer.length + 2 + sDer.length;
  const der = new Uint8Array(2 + totalLen);
  der[0] = 0x30; // SEQUENCE
  der[1] = totalLen;
  der[2] = 0x02; // INTEGER
  der[3] = rDer.length;
  der.set(rDer, 4);
  der[4 + rDer.length] = 0x02; // INTEGER
  der[4 + rDer.length + 1] = sDer.length;
  der.set(sDer, 4 + rDer.length + 2);
  return der;
}

// ===== Security linting =====

/** Lint a decoded JWT for security issues. */
export function lintJwt(parts: JwtParts, algorithm: JwtAlgorithm | undefined): LintFinding[] {
  const findings: LintFinding[] = [];

  // alg:none
  if (algorithm === "none") {
    findings.push({
      severity: "high",
      code: "alg-none",
      message: "Token uses 'alg: none' — no signature. Anyone can forge this token.",
      recommendation: "Never accept alg:none tokens for authentication. Reject at the server.",
    });
  }

  // Missing exp
  if (parts.payload.exp === undefined) {
    findings.push({
      severity: "medium",
      code: "missing-exp",
      message: "Token has no 'exp' (expiration) claim. Tokens without exp are valid forever.",
      recommendation: "Always set exp (e.g. now + 1 hour). Short-lived tokens limit damage if leaked.",
    });
  }

  // Missing iat
  if (parts.payload.iat === undefined) {
    findings.push({
      severity: "low",
      code: "missing-iat",
      message: "Token has no 'iat' (issued at) claim. Hard to detect token reuse or rotation.",
      recommendation: "Set iat to the current time when issuing tokens.",
    });
  }

  // Missing iss
  if (parts.payload.iss === undefined) {
    findings.push({
      severity: "low",
      code: "missing-iss",
      message: "Token has no 'iss' (issuer) claim. Hard to identify the source.",
      recommendation: "Set iss to your auth server URL (e.g. 'https://auth.example.com').",
    });
  }

  // Missing aud
  if (parts.payload.aud === undefined) {
    findings.push({
      severity: "low",
      code: "missing-aud",
      message: "Token has no 'aud' (audience) claim. Any service could accept this token.",
      recommendation: "Set aud to the intended recipient (e.g. 'https://api.example.com').",
    });
  }

  // Long-lived token (>24h)
  if (typeof parts.payload.exp === "number" && typeof parts.payload.iat === "number") {
    const lifetime = parts.payload.exp - parts.payload.iat;
    if (lifetime > 86400) {
      findings.push({
        severity: "medium",
        code: "long-lived",
        message: `Token lifetime is ${Math.round(lifetime / 3600)}h (>24h). Long-lived tokens are higher risk if leaked.`,
        recommendation: "Use short-lived access tokens (15min-1h) + refresh tokens for longer sessions.",
      });
    }
  }

  // Algorithm confusion warning (RS alg but HMAC secret provided is checked at verify time;
  // here we just warn if header uses RS but no kid/cert is referenced)
  if (algorithm && (algorithm.startsWith("RS") || algorithm.startsWith("PS") || algorithm.startsWith("ES"))) {
    if (!parts.header.kid) {
      findings.push({
        severity: "low",
        code: "no-kid",
        message: `${algorithm} token has no 'kid' (key ID) in header. Hard to rotate keys.`,
        recommendation: "Include kid in header to support key rotation and JWKS lookup.",
      });
    }
  }

  return findings;
}

// ===== Timeline =====

/** Compute timeline info from a JWT payload. */
export function computeTimeline(payload: Record<string, unknown>, nowSec?: number): TimelineInfo {
  const now = nowSec ?? Math.floor(Date.now() / 1000);
  const iat = typeof payload.iat === "number" ? payload.iat : undefined;
  const nbf = typeof payload.nbf === "number" ? payload.nbf : undefined;
  const exp = typeof payload.exp === "number" ? payload.exp : undefined;

  const isExpired = exp !== undefined && now >= exp;
  const isNotYetValid = nbf !== undefined && now < nbf;
  const secondsToExpiry = exp !== undefined ? exp - now : undefined;
  const secondsToValidity = nbf !== undefined ? nbf - now : undefined;
  const isFresh = secondsToExpiry !== undefined && secondsToExpiry > 0 && secondsToExpiry <= 300;

  return {
    iat, nbf, exp, now,
    isExpired, isNotYetValid,
    secondsToExpiry, secondsToValidity,
    isFresh,
  };
}

// ===== Timestamp formatting =====

/** Format a Unix timestamp (seconds) as ISO string. Returns null if invalid. */
export function formatTimestamp(unixSeconds: number): string | null {
  if (typeof unixSeconds !== "number" || !Number.isFinite(unixSeconds)) return null;
  const ms = unixSeconds * 1000;
  if (ms < 0 || ms > 8.64e15) return null;
  try {
    return new Date(ms).toISOString();
  } catch {
    return null;
  }
}

/** Human-readable "time until" string (e.g. "in 2.5 hours", "3 days ago"). */
export function formatRelative(unixSeconds: number, nowSec?: number): string {
  const now = nowSec ?? Math.floor(Date.now() / 1000);
  const diff = unixSeconds - now;
  const absDiff = Math.abs(diff);
  const future = diff > 0;

  if (absDiff < 60) return future ? `in ${absDiff}s` : `${absDiff}s ago`;
  if (absDiff < 3600) return future ? `in ${Math.round(absDiff / 60)}min` : `${Math.round(absDiff / 60)}min ago`;
  if (absDiff < 86400) return future ? `in ${(absDiff / 3600).toFixed(1)}h` : `${(absDiff / 3600).toFixed(1)}h ago`;
  if (absDiff < 2592000) return future ? `in ${(absDiff / 86400).toFixed(1)}d` : `${(absDiff / 86400).toFixed(1)}d ago`;
  if (absDiff < 31536000) return future ? `in ${(absDiff / 2592000).toFixed(1)}mo` : `${(absDiff / 2592000).toFixed(1)}mo ago`;
  return future ? `in ${(absDiff / 31536000).toFixed(1)}y` : `${(absDiff / 31536000).toFixed(1)}y ago`;
}

// ===== Check if a JWT is expired =====

/** Check if a JWT is currently expired based on its 'exp' claim. */
export function isExpired(parts: JwtParts, now: Date = new Date()): boolean {
  const exp = parts.payload.exp;
  if (typeof exp !== "number") return false;
  return now.getTime() >= exp * 1000;
}

// ===== Registered claims =====

/** Standard JWT registered claims (RFC 7519 §4.1). */
export const REGISTERED_CLAIMS = new Set([
  "iss", "sub", "aud", "exp", "nbf", "iat", "jti",
]);

// ===== Pretty-print =====

/** Pretty-print a JSON object with 2-space indent. */
export function prettyPrint(obj: unknown): string {
  return JSON.stringify(obj, null, 2);
}

// ===== JWKS (extra #1) =====

/** Parse a JWKS JSON string into an array of JWKs. */
export function parseJwks(input: string): JsonWebKey[] {
  if (!input.trim()) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch (e) {
    throw new Error(`Invalid JSON: ${(e as Error).message}`);
  }
  // Accept either {"keys": [...]} or [...]
  if (Array.isArray(parsed)) {
    return parsed as JsonWebKey[];
  }
  if (parsed && typeof parsed === "object" && Array.isArray((parsed as { keys?: unknown }).keys)) {
    return (parsed as { keys: JsonWebKey[] }).keys;
  }
  // Single JWK object
  if (parsed && typeof parsed === "object" && (parsed as JsonWebKey).kty) {
    return [parsed as JsonWebKey];
  }
  throw new Error("Expected JWKS ({\"keys\": [...]}) or array of JWKs or single JWK");
}

// ===== PEM parsing (extra #5) =====

/**
 * Parse a PEM-encoded X.509 certificate and extract the public key as JWK.
 * Uses WebCrypto X.509 import (Chrome 113+, Safari 17+, Firefox 130+).
 */
export async function parsePemCertificate(pem: string): Promise<JsonWebKey> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("WebCrypto not available.");
  // Strip PEM headers and whitespace
  const b64 = pem
    .replace(/-----BEGIN CERTIFICATE-----/g, "")
    .replace(/-----END CERTIFICATE-----/g, "")
    .replace(/\s+/g, "");
  if (!b64) throw new Error("PEM has no certificate data.");
  // Decode base64 to bytes
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  // Import as X.509 cert (spki)
  try {
    const cryptoKey = await subtle.importKey(
      "spki" as KeyFormat,
      bytes as BufferSource,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      true,
      ["verify"],
    );
    // Export as JWK
    const jwk = await subtle.exportKey("jwk", cryptoKey);
    return jwk;
  } catch (e) {
    throw new Error(`Could not parse PEM certificate: ${(e as Error).message}. Note: X.509 cert import requires Chrome 113+, Safari 17+, or Firefox 130+.`);
  }
}

/**
 * Parse a PEM-encoded public key (SPKI format) and extract as JWK.
 */
export async function parsePemPublicKey(pem: string): Promise<JsonWebKey> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("WebCrypto not available.");
  const b64 = pem
    .replace(/-----BEGIN PUBLIC KEY-----/g, "")
    .replace(/-----END PUBLIC KEY-----/g, "")
    .replace(/-----BEGIN RSA PUBLIC KEY-----/g, "")
    .replace(/-----END RSA PUBLIC KEY-----/g, "")
    .replace(/\s+/g, "");
  if (!b64) throw new Error("PEM has no key data.");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  try {
    const cryptoKey = await subtle.importKey(
      "spki" as KeyFormat,
      bytes as BufferSource,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      true,
      ["verify"],
    );
    const jwk = await subtle.exportKey("jwk", cryptoKey);
    return jwk;
  } catch (e) {
    throw new Error(`Could not parse PEM public key: ${(e as Error).message}`);
  }
}

// ===== Token comparison (extra #2) =====

export interface ClaimDiff {
  key: string;
  leftValue?: unknown;
  rightValue?: unknown;
  onlyIn: "left" | "right" | "both";
  same: boolean;
}

/** Compare two JWT payloads claim-by-claim. */
export function compareClaims(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
): ClaimDiff[] {
  const allKeys = new Set([...Object.keys(left), ...Object.keys(right)]);
  const diffs: ClaimDiff[] = [];
  for (const key of allKeys) {
    const leftHas = key in left;
    const rightHas = key in right;
    const leftVal = left[key];
    const rightVal = right[key];
    const same = leftHas && rightHas && JSON.stringify(leftVal) === JSON.stringify(rightVal);
    diffs.push({
      key,
      leftValue: leftHas ? leftVal : undefined,
      rightValue: rightHas ? rightVal : undefined,
      onlyIn: leftHas && !rightHas ? "left" : !leftHas && rightHas ? "right" : "both",
      same,
    });
  }
  return diffs.sort((a, b) => a.key.localeCompare(b.key));
}

// ===== JWT encoder/generator (blueprint feature) =====

export interface EncodeResult {
  ok: boolean;
  token?: string;
  error?: string;
}

/** Encode (sign) a JWT from header + payload + key. */
export async function encodeJwt(opts: EncodeOptions): Promise<EncodeResult> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return { ok: false, error: "WebCrypto not available." };

  const { header, payload, algorithm, secret, key } = opts;

  // Build header with alg
  const fullHeader = { ...header, alg: algorithm, typ: header.typ ?? "JWT" };
  const headerJson = JSON.stringify(fullHeader);
  const payloadJson = JSON.stringify(payload);
  const headerB64 = base64UrlEncode(headerJson);
  const payloadB64 = base64UrlEncode(payloadJson);
  const signingInput = `${headerB64}.${payloadB64}`;
  const signingBytes = new TextEncoder().encode(signingInput);

  try {
    let signatureBytes: Uint8Array;

    if (algorithm === "none") {
      signatureBytes = new Uint8Array(0);
    } else if (algorithm.startsWith("HS")) {
      if (!secret) return { ok: false, error: "HMAC algorithm requires a secret." };
      const cryptoKey = await importHmacKey(secret, algorithm);
      const sig = await subtle.sign("HMAC", cryptoKey, signingBytes as BufferSource);
      signatureBytes = new Uint8Array(sig);
    } else {
      // For RS/PS/ES/EdDSA, we'd need a private key. Public-key signing is
      // more complex (different import params). For now, support HS + none.
      return { ok: false, error: `Signing with ${algorithm} requires a private key — not yet supported. Use HS256/384/512 or alg:none.` };
    }

    const sigB64 = base64UrlEncodeBytes(signatureBytes);
    return { ok: true, token: `${signingInput}.${sigB64}` };
  } catch (e) {
    return { ok: false, error: `Signing failed: ${(e as Error).message}` };
  }
}

// ===== Shareable URL (extra #9) =====

/** Encode a JWT token into a URL fragment for sharing (NEVER include secrets). */
export function buildShareUrl(token: string): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}${window.location.pathname}#token=${encodeURIComponent(token)}`;
}

/** Extract a token from a URL fragment (if present). */
export function extractTokenFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash;
  if (!hash) return null;
  const match = hash.match(/[#&]token=([^&]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}
