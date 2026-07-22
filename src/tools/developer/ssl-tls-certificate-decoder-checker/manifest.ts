/**
 * SSL/TLS Certificate Decoder & Checker — Tool Manifest.
 * Tool #394 — Category 4 (Developer & Code).
 *
 * Per blueprint: SSL/TLS certificate decoder & checker. Pure-JS X.509
 * certificate parsing in the browser: decode a pasted PEM cert (or CSR) into
 * subject, issuer, validity, SANs, key type/size, signature algorithm, serial,
 * and SHA-1 / SHA-256 fingerprints; check expiry with a live countdown; verify
 * chain order across multiple pasted PEMs; match SANs against a hostname
 * (wildcard-aware); flag weak signature algorithms / short keys; and generate
 * the exact openssl commands (s_client, x509 -text, fingerprint, verify chain,
 * SAN extraction, etc.) for live-host checks. 100% client-side parsing — your
 * PEM never leaves the browser. The optional live-host check (openssl s_client
 * / SSL Labs) requires the network and is clearly labeled.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ssl-tls-certificate-decoder-checker",
  name: "SSL/TLS Certificate Decoder & Checker",
  description:
    "Decode a pasted PEM X.509 certificate or CSR entirely in your browser — extract subject, issuer, validity, SAN list, key type/size, signature algorithm, serial, and SHA-1/SHA-256 fingerprints; check expiry with a live countdown; verify chain order across multiple pasted PEMs; match SANs against a hostname (wildcard-aware); flag weak signature algorithms (MD5/SHA-1) and short RSA keys (<2048); and generate the exact openssl commands (s_client, x509 -text, fingerprint, verify chain, SAN extraction) for live-host checks. 100% client-side parsing — your PEM never leaves the browser.",
  category: "developer",
  keywords: [
    "ssl certificate decoder", "tls certificate decoder", "x509 decoder",
    "pem decoder", "csr decoder", "ssl checker", "certificate checker",
    "certificate expiry", "certificate fingerprint", "sha-256 fingerprint",
    "openssl x509", "openssl s_client", "subject alternative name", "san",
    "certificate chain", "self-signed certificate", "wildcard certificate",
    "rsa", "ecdsa", "ed25519",
  ],
  icon: "shield-check",
  requiresNetwork: false,
  seo: {
    title: "SSL/TLS Certificate Decoder & Checker — X.509 PEM Parser + openssl Commands | UnQTools",
    faq: [
      {
        q: "How does the certificate decoder work?",
        a: "Paste a PEM-encoded X.509 certificate (or a PKCS#10 CSR) into the decoder. The tool runs a pure-JavaScript ASN.1/DER parser in your browser to extract the subject (CN/O/OU/C/ST/L), issuer, serial number, validity period (notBefore/notAfter), public-key algorithm and bit length, signature algorithm, Subject Alternative Names (SANs), key usage, and basic constraints — then computes the SHA-1 and SHA-256 fingerprints. Nothing is uploaded: the PEM is decoded locally and discarded when you leave the page.",
      },
      {
        q: "What does the checker validate?",
        a: "(1) Expiry status — expired, not-yet-valid, or valid, with a live countdown of days remaining. (2) Self-signed detection (subject == issuer). (3) Weak signature algorithms (MD5, SHA-1) flagged as warnings. (4) Short RSA keys (<2048 bits) flagged as weak. (5) Chain-order validation when multiple PEMs are pasted (each cert's issuer must match the next cert's subject). (6) SAN-vs-hostname matching (wildcard-aware: *.example.com matches www.example.com). Every check runs locally on the decoded bytes — no network needed.",
      },
      {
        q: "What openssl commands does the tool generate?",
        a: "For a live host (e.g. example.com:443): `openssl s_client -connect example.com:443 -servername example.com -showcerts` (retrieve the chain), `echo | openssl s_client -connect example.com:443 2>/dev/null | openssl x509 -noout -dates` (one-liner expiry check), `openssl x509 -in cert.pem -noout -text` (full decode), `-subject -issuer`, `-serial`, `-ext subjectAltName`, `-fingerprint -sha256`, and `openssl verify -CAfile chain.pem cert.pem` (chain verification). For CSRs: `openssl req -in csr.pem -noout -text`, `-subject`, `-pubkey`. All commands are copy-ready; you run them in your own terminal — the tool never connects anywhere.",
      },
      {
        q: "Can I decode a CSR or a private key?",
        a: "Yes. The decoder recognizes PEM labels for X.509 certificates (`CERTIFICATE`), PKCS#10 CSRs (`CERTIFICATE REQUEST`), and the common private-key labels (`PRIVATE KEY`, `RSA PRIVATE KEY`, `EC PRIVATE KEY`, `ENCRYPTED PRIVATE KEY`) plus CRLs and public keys. For private keys, the tool only reports the PEM label and key type — it never extracts or displays key material, since private keys must never be pasted into a web tool. If you paste a CSR, it extracts the subject, public-key algorithm and bit length, and requested extensions.",
      },
      {
        q: "Is my certificate uploaded anywhere? What's stored in history?",
        a: "No. The PEM is parsed entirely in your browser — there is no upload step. History (localStorage, max 20 entries) stores only operation metadata: action type (decode/check), the certificate's subject CN, issuer CN, expiry date, and SHA-256 fingerprint — never the full PEM or private key. The shareable URL encodes only the active tab and a hostname for the openssl-command generator; the PEM itself is never placed in the URL.",
      },
    ],
  },
  status: "done",
};
