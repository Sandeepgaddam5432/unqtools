import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "bcrypt-hash-generator",
  name: "Bcrypt Hash Generator",
  description:
    "Generate and verify bcrypt password hashes. Adjust cost factor (4-31), generate cryptographically-secure salts, and verify passwords against existing hashes — 100% private.",
  category: "network-security",
  keywords: [
    "bcrypt",
    "password hash",
    "hash",
    "salt",
    "cost factor",
    "verify",
    "crypt",
    "password security",
  ],
  icon: "lock",
  requiresNetwork: false,
  seo: {
    title: "Bcrypt Hash Generator — Hash & Verify Passwords | UnQTools",
    faq: [
      {
        q: "What is bcrypt?",
        a: "Bcrypt is a password hashing function designed specifically for passwords. It's slow by design (configurable cost factor), uses a per-hash random salt, and is resistant to rainbow table attacks and brute-force cracking. It's the recommended choice for storing user passwords.",
      },
      {
        q: "What cost factor should I use?",
        a: "The cost factor (also called work factor) determines how slow the hash is — each increment doubles the time. For 2026 production use, we recommend cost factor 12 (≈250ms per hash). Adjust to keep hash time around 250-500ms — fast enough for users, slow enough to deter attackers.",
      },
      {
        q: "Can I verify a password against an existing bcrypt hash?",
        a: "Yes. Paste the hash, type the password, and click Verify. The tool uses bcryptjs's compareSync function, which extracts the salt and cost factor from the hash, re-hashes the input, and compares the result in constant time to prevent timing attacks.",
      },
      {
        q: "Is my password sent anywhere?",
        a: "No. Hashing is done entirely in your browser using bcryptjs (a pure-JavaScript bcrypt implementation). Your password never leaves your device, never appears in network logs, and is never stored. You can verify this by disconnecting your internet — the tool still works.",
      },
    ],
  },
  status: "done",
};
