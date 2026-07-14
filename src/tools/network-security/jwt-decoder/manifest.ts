import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "jwt-decoder",
  name: "JWT Debugger",
  description:
    "Decode, verify (HS256/384/512, RS256/384/512, PS, ES256/384/512, EdDSA), lint, encode, and compare JSON Web Tokens — all 100% in-browser via WebCrypto. Security lint flags alg:none, missing exp, weak secrets.",
  category: "network-security",
  keywords: [
    "jwt",
    "json web token",
    "decode",
    "verify",
    "signature",
    "authentication",
    "bearer",
    "token",
    "header",
    "payload",
    "jwks",
    "webcrypto",
  ],
  icon: "shield",
  requiresNetwork: false,
  seo: {
    title: "JWT Debugger — Decode, Verify, Lint, Encode | UnQTools",
    faq: [
      {
        q: "What is a JWT?",
        a: "A JSON Web Token (JWT) is a compact, URL-safe way to represent claims between two parties. It has three parts separated by dots: header.payload.signature. The header specifies the algorithm, the payload contains claims (like user ID, expiry), and the signature verifies integrity. JWTs are defined in RFC 7519.",
      },
      {
        q: "Which algorithms can this tool verify?",
        a: "All common algorithms via WebCrypto: HS256/384/512 (HMAC with shared secret), RS256/384/512 (RSA PKCS#1 v1.5), PS256/384/512 (RSA-PSS), ES256/384/512 (ECDSA with P-256/P-384/P-521 curves), and EdDSA (Ed25519). For HMAC, paste your shared secret. For RSA/ECDSA/EdDSA, paste a JWK (JSON Web Key) or JWKS (key set) — the tool auto-selects by the 'kid' header claim.",
      },
      {
        q: "Does this tool preserve the exact token bytes when verifying?",
        a: "Yes. Unlike jwt.io which historically had a bug where it stripped whitespace before verifying (breaking valid signatures), we verify the exact bytes you paste. The signing input is `header.payload` — no trimming, no normalization. This matches the JWT spec (RFC 7519) exactly.",
      },
      {
        q: "What security issues does the linter detect?",
        a: "The linter flags: (1) alg:none — unsigned tokens that anyone can forge (high severity). (2) Missing exp — tokens that never expire (medium). (3) Long-lived tokens >24h (medium). (4) Missing iat/iss/aud claims (low). (5) RS/PS/ES tokens without a kid header — hard to rotate keys (low). Each finding has a recommendation for fixing it.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "Beyond standard decode/verify, we ship: (1) JWKS key set input with auto-select by kid. (2) Token comparison mode — diff two JWTs claim-by-claim. (3) Copy individual claims with one click. (4) Timeline visualization showing iat → nbf → exp with 'now' marker and relative times. (5) PEM certificate parser (extract public key from X.509). (6) Token freshness warning — amber badge when <5 min to expiry. (7) JWT encoder/generator — build and sign a new JWT from header + payload + secret. (8) Export decoded header+payload as JSON file. (9) Shareable URL — token in URL fragment (never sent to servers, never includes secrets). (10) Keyboard shortcuts (V=verify, C=copy token).",
      },
      {
        q: "Is my token sent anywhere?",
        a: "No. Decoding, verification, and signing are all done entirely in your browser using WebCrypto. The token never leaves your device, is never logged, and is never transmitted. Shareable URLs encode the token in the URL fragment (#) which browsers do NOT send to servers in HTTP requests. However, JWTs are credentials — only paste tokens you own or are authorized to inspect, and never include secrets or private keys in shared URLs.",
      },
    ],
  },
  status: "done",
};
