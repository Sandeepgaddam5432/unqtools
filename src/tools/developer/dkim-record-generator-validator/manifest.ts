/**
 * DKIM Record Generator & Validator — Tool Manifest.
 * Tool #392 — Category 4 (Developer & Code).
 *
 * Per blueprint: DKIM record generator & validator. Pure-JS builds DKIM DNS
 * TXT records (selector._domainkey) from the v / k / p / h / s / t / n tags,
 * validates DKIM record syntax against RFC 6376, generates dig / nslookup /
 * kdig (DoH) commands for selector-based DKIM lookup, generates OpenDKIM
 * keygen + openssl key-generation commands, decodes every tag with plain-
 * English explanations, and estimates the public-key bit length. 100%
 * client-side — actual key generation (via WebCrypto) is interactive in the
 * browser; the private key never leaves the device.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "dkim-record-generator-validator",
  name: "DKIM Record Generator & Validator",
  description:
    "Build a valid DKIM DNS TXT record (selector._domainkey) from the v / k / p / h / s / t / n tags (RSA 1024/2048/4096 or Ed25519), validate any existing record against RFC 6376, decode every tag with plain-English explanations, estimate the public-key bit length, generate dig / nslookup / kdig (DoH) lookup commands for the selector, generate OpenDKIM keygen + openssl key-generation commands, and split long 2048/4096-bit TXT records into publishable chunks. 100% client-side generation and validation; live lookup requires the network via the generated dig commands.",
  category: "developer",
  keywords: [
    "dkim record", "dkim generator", "dkim validator", "dkim checker",
    "dkim selector", "dkim lookup", "opendkim", "opendkim-genkey",
    "rfc 6376", "selector._domainkey", "dkim1", "email authentication",
    "dkim txt record", "rsa public key", "ed25519 dkim",
  ],
  icon: "mail-check",
  requiresNetwork: false,
  seo: {
    title: "DKIM Record Generator & Validator — RFC 6376 + OpenDKIM Keygen | UnQTools",
    faq: [
      {
        q: "How does the DKIM generator work?",
        a: "Enter your selector (e.g. default, s1, google) and domain, choose a key type (RSA 1024/2048/4096 or Ed25519), paste your base64 public key (the p= tag — generated locally by opendkim-genkey or openssl, never uploaded), optionally set hash algorithms (h=), service type (s=), flags (t=y for test mode, t=s for strict selector), and notes (n=). The generator assembles a valid `v=DKIM1; k=rsa; p=<base64>; ...` TXT record for the `<selector>._domainkey.<domain>` DNS name with tags in the recommended order, and shows a live preview you can copy. Validation against RFC 6376 runs as you type.",
      },
      {
        q: "What does the validator check?",
        a: "(1) Valid `v=DKIM1` version tag (must be first). (2) Required `p=` public-key tag present. (3) `k=` key type is rsa or ed25519. (4) `h=` hash algorithms are from {sha1, sha256, sha512}. (5) `s=` service type is email or *. (6) `t=` flags are from {y, s, i, ...}. (7) Public key is valid base64. (8) Empty `p=` is flagged as a revoked key. (9) Weak 1024-bit RSA key warning. (10) Tag-order check (v= must be first). (11) Multiple DKIM records on the same selector name flagged. (12) Estimated key bit length (1024/2048/4096 for RSA, 256 for Ed25519). Every issue comes with a plain-English explanation and a suggested fix.",
      },
      {
        q: "How do I generate a DKIM key pair with OpenDKIM or openssl?",
        a: "The tool generates the exact commands for you. For OpenDKIM: `opendkim-genkey -s <selector> -d <domain> -b 2048 -r` produces `<selector>.private` (private key — keep on your mail server) and `<selector>.txt` (the DNS TXT record). For openssl RSA: `openssl genrsa -out private.key 2048` then `openssl rsa -in private.key -pubout -outform der 2>/dev/null | openssl base64 -A` produces the p= value. For Ed25519: `openssl genpkey -algorithm Ed25519 -out private.key` then `openssl pkey -in private.key -pubout -outform der 2>/dev/null | openssl base64 -A`. The private key NEVER leaves your server — only the public key goes in DNS.",
      },
      {
        q: "What do the t= flags mean (y, s, i)?",
        a: "The `t=` tag is a colon-separated list of flags. `t=y` means the domain is testing DKIM — receivers should treat the signature as valid but not enforce (do not quarantine/reject on failure). `t=s` means the key is in strict mode — the signature must match the exact i= identity (no subdomain matching). `t=i` (RFC 8301) is deprecated/obsolete. Remove `t=y` before you go to enforcement. The recommended production setting is `t=s` (or omit `t=` entirely for relaxed mode).",
      },
      {
        q: "What extra features does this tool have compared to other DKIM tools?",
        a: "(1) Visual generator for v / k / p / h / s / t / n tags. (2) RSA 1024/2048/4096 + Ed25519 key-type selector with bit-length badges. (3) RFC 6376 syntax validator with 12+ checks. (4) Per-tag plain-English explanations (`explainTag` / `explainFlag`). (5) Public-key bit-length estimator (1024/2048/4096 for RSA, 256 for Ed25519). (6) Weak-key warning for 1024-bit RSA. (7) Revoked-key detector (empty p=). (8) TXT record splitter for >255-char 2048/4096-bit keys (Bind-format). (9) dig / nslookup / kdig (DoH) / curl DoH lookup commands per selector+domain. (10) OpenDKIM keygen + openssl RSA + openssl Ed25519 command generator. (11) Multiple-DKIM-record detector. (12) Common-selector auto-detection list (google, selector1, selector2, k1, mandrill, default, s1, mail). (13) Tag reference table. (14) Copy/download record. (15) localStorage history (max 20, stores only metadata). (16) Shareable URL. 100% client-side — your private key never touches this tool.",
      },
    ],
  },
  status: "done",
};
