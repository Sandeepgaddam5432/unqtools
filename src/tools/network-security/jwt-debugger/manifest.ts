/**
 * JWT Debugger — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "jwt-debugger",
  name: "JWT Debugger",
  description:
    "Decode, verify, and generate JSON Web Tokens (HS256/384/512) entirely in-browser via WebCrypto. Flags alg:none, algorithm-confusion, expired/not-yet-valid, missing exp, weak HMAC secrets. No whitespace-stripping bug, no network calls.",
  category: "network-security",
  keywords: [
    "jwt debugger",
    "jwt decoder",
    "verify jwt signature",
    "jwt.io alternative",
    "decode json web token",
    "hs256",
    "jwt verifier",
    "jwt inspector",
    "token debugger",
    "jwt encoder",
  ],
  icon: "KeyRound",
  requiresNetwork: false,
  seo: {
    title: "JWT Debugger — Decode, Verify (HS256/384/512) & Lint, 100% In-Browser | UnQTools",
    faq: [
      {
        q: "What is a JSON Web Token (JWT)?",
        a: "A JWT (RFC 7519) is a compact, URL-safe token format used for authentication and claims exchange. It has three base64url-encoded parts — header.payload.signature — separated by dots. The header declares the algorithm, the payload carries claims (iss, sub, exp, etc.), and the signature proves integrity.",
      },
      {
        q: "Which algorithms does this debugger verify?",
        a: "HS256, HS384 and HS512 (HMAC with SHA-2) via the browser's WebCrypto API. RS256/384/512 and ES256/384 verification paths are recognized but RSA/ECDSA public-key verification is out of scope for this build — the tool flags those algorithms with guidance to use a PEM/JWK verifier. alg:none is decoded but never 'verified'.",
      },
      {
        q: "Does this tool have the jwt.io whitespace-stripping bug?",
        a: "No. Verification is performed against the exact bytes of the token as you paste it — no trimming, no normalization. The signature is computed over header.payload (the exact bytes before the final dot), so any whitespace you see is preserved and verified.",
      },
      {
        q: "What security linting does the tool do?",
        a: "It flags: (1) alg:none (never trusted), (2) algorithm-confusion attacks (RS256 token verified with an HMAC secret), (3) expired tokens (exp in the past), (4) not-yet-valid tokens (nbf in the future), (5) missing exp claim, (6) weak HMAC secrets (<16 chars / dictionary words / numeric-only), (7) clock-skew tolerance notice, (8) suspicious issuer/audience, (9) JWT issued in the future (iat > now), (10) unsigned tokens that look signed.",
      },
      {
        q: "What extras does this tool include?",
        a: "(1) Live decode as you type. (2) HS256/384/512 signature verification via WebCrypto HMAC. (3) Three-pane (encoded / decoded / verify) layout. (4) Claims reference with human-readable timestamps + countdown to exp/nbf. (5) Security lint with severity badges. (6) JWT encoder/generator with live re-sign. (7) Copy each part individually. (8) Verify-status badge (valid / invalid / unsigned / unknown alg). (9) Decode error messages with exact position. (10) Sample tokens (HS256 valid, alg:none, expired). (11) No-network assurance banner. (12) Shareable read-only URL (token only — never the secret).",
      },
      {
        q: "Is my JWT or secret sent anywhere?",
        a: "No. All decoding, HMAC computation, and verification happen locally in your browser via window.crypto.subtle. The token and secret never leave your device. Shareable URLs encode only the token (no secret) and only in the URL fragment, which browsers do not transmit in HTTP requests. Treat JWTs as credentials — paste them only into tools you trust.",
      },
      {
        q: "What are the standard JWT claims and what do they mean?",
        a: "iss = issuer (who created the token), sub = subject (who the token is about), aud = audience (intended recipient), exp = expiration time, nbf = not-before time, iat = issued-at time, jti = unique JWT ID. This tool displays each claim with a plain-English description and converts epoch timestamps to human-readable form with a countdown.",
      },
      {
        q: "Why does the tool warn about algorithm confusion?",
        a: "A classic JWT attack: a server expects RS256 (asymmetric) and verifies with a public key, but an attacker submits an alg:HS256 token signed with the public key as the HMAC secret. If the server's verify function trusts the alg header, it will accept the forged token. This tool flags any token where the alg differs from what you selected for verification.",
      },
    ],
  },
  status: "done",
};
