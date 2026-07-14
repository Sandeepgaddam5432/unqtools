import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "jwt-decoder",
  name: "JWT Decoder",
  description:
    "Decode JSON Web Tokens (JWT) — inspect header, payload, and signature. Supports HS256, RS256, and more. 100% client-side, no token ever leaves your browser.",
  category: "network-security",
  keywords: [
    "jwt",
    "json web token",
    "decode",
    "inspect",
    "authentication",
    "bearer",
    "token",
    "header",
    "payload",
  ],
  icon: "shield",
  requiresNetwork: false,
  seo: {
    title: "JWT Decoder — Inspect JSON Web Tokens | UnQTools",
    faq: [
      {
        q: "What is a JWT?",
        a: "A JSON Web Token (JWT) is a compact, URL-safe way to represent claims between two parties. It has three parts separated by dots: header.payload.signature. The header specifies the algorithm, the payload contains claims (like user ID, expiry), and the signature verifies integrity.",
      },
      {
        q: "Does this tool verify the signature?",
        a: "No — this tool decodes and displays the contents only. Signature verification requires the secret (HS256) or public key (RS256), which the token issuer keeps. We intentionally don't verify to keep the tool 100% client-side and private.",
      },
      {
        q: "Is my token sent anywhere?",
        a: "No. Decoding is a simple base64url operation done entirely in your browser. The token never leaves your device. We recommend pasting only tokens you own or are authorized to inspect.",
      },
      {
        q: "Why are some fields colored differently?",
        a: "We highlight common registered claims: 'exp' (expiry), 'iat' (issued at), 'nbf' (not before), 'sub' (subject), 'iss' (issuer), 'aud' (audience) are standard JWT claims with reserved meanings per RFC 7519.",
      },
    ],
  },
  status: "done",
};
