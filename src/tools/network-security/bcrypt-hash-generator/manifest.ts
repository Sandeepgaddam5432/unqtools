import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "bcrypt-hash-generator",
  name: "Bcrypt & PBKDF2 Hash Generator",
  description:
    "Generate and verify bcrypt + PBKDF2-SHA256 password hashes. Adjustable cost factor, batch verify, hash format detection, crack-time estimate, password strength check, hash comparison, and CSV export. 100% private.",
  category: "network-security",
  keywords: [
    "bcrypt", "pbkdf2", "password hash", "hash", "salt", "cost factor",
    "verify", "crypt", "password security", "argon2", "scrypt", "webcrypto",
  ],
  icon: "lock",
  requiresNetwork: false,
  seo: {
    title: "Bcrypt & PBKDF2 Hash Generator — Hash, Verify, Lint | UnQTools",
    faq: [
      {
        q: "What is bcrypt?",
        a: "Bcrypt is a password hashing function designed specifically for passwords. It's slow by design (configurable cost factor), uses a per-hash random salt, and is resistant to rainbow table attacks and brute-force cracking. It's the recommended choice for storing user passwords in web applications.",
      },
      {
        q: "What hash algorithms does this tool support?",
        a: "Currently: bcrypt (HS256/384/512 via bcryptjs, pure-JS) and PBKDF2-SHA256 (via WebCrypto, FIPS-compliant). Argon2id and scrypt are documented in the algorithm reference but not yet implemented — they require WASM dependencies that would bloat the bundle. PBKDF2 is native to browsers via WebCrypto, so it's a good FIPS-compliant alternative to bcrypt.",
      },
      {
        q: "What cost factor should I use?",
        a: "The tool can benchmark your device and recommend a cost factor that takes ~250ms per hash (the recommended target for 2026). For bcrypt, cost 12 is the common default (~250ms on modern hardware). Each increment doubles the time. For PBKDF2, use at least 100,000 iterations (the tool's default).",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "Beyond standard hash/verify, we ship: (1) Hash history (localStorage, last 20). (2) Batch verify — paste multiple hashes, see which match a single password. (3) Crack-time estimate — see how long it would take to brute-force at GPU hashrates. (4) Password strength check — entropy estimate + crack time for the input password. (5) Hash comparison — diff two hashes field-by-field (version/cost/salt/hash). (6) CSV export of batch hashes. (7) Hash format detector — auto-detect bcrypt/PBKDF2/Argon2/scrypt/MD5/SHA1/SHA256/SHA512. (8) Cost factor recommendation — benchmark your device, suggest optimal cost. (9) Shareable URL — encode hash in fragment. (10) Algorithm reference table — compare bcrypt/PBKDF2/Argon2/scrypt pros/cons.",
      },
      {
        q: "Is my password sent anywhere?",
        a: "No. All hashing (bcrypt + PBKDF2) is done entirely in your browser using bcryptjs (pure JavaScript, no native bindings) and WebCrypto. Your password never leaves your device, never appears in network logs, and is never stored. Hash history stores only the hash output, never the input password. You can verify by disconnecting your internet — the tool still works.",
      },
      {
        q: "Why is constant-time comparison important?",
        a: "When verifying a password against a hash, a naive string comparison (===) can leak information via timing — an attacker can measure how long the comparison takes to guess characters one by one. We use a constant-time comparison (XOR all bytes, check if result is zero) so the verification takes the same time regardless of where the first difference is. This prevents timing attacks.",
      },
    ],
  },
  status: "done",
};
