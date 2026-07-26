/**
 * Strong Password Generator — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "strong-password-generator",
  name: "Strong Password Generator",
  description:
    "Generate cryptographically-secure random passwords and EFF passphrases using crypto.getRandomValues with bias-free rejection sampling. Per-class minimums, exclude-ambiguous, pronounceable mode, batch + CSV export, and 10+ extras. No caps, no ads, no upload.",
  category: "network-security",
  keywords: [
    "strong password generator",
    "random password generator",
    "passphrase generator",
    "secure password",
    "eff wordlist",
    "csprng",
    "diceware",
    "password creator",
    "memorable password",
    "random string",
  ],
  icon: "KeyRound",
  requiresNetwork: false,
  seo: {
    title: "Strong Password Generator — CSPRNG Passwords & EFF Passphrases, Unlimited & Private | UnQTools",
    faq: [
      {
        q: "Is this password generator cryptographically secure?",
        a: "Yes. We use window.crypto.getRandomValues — the browser's CSPRNG (cryptographically-secure pseudo-random number generator) backed by the OS entropy pool. We never use Math.random(). Selection from each character class uses rejection sampling (not modulo bias), so every character is uniformly distributed. We document this clearly in the UI because several popular generators quietly use Math.random() which is predictable.",
      },
      {
        q: "What is 'bias-free selection' and why does it matter?",
        a: "If you pick a random number from 0–255 (one byte) and then take modulo 94 to map to printable ASCII, the first 14 characters get picked slightly more often than the rest — a small but real bias. We use rejection sampling: draw bytes until we get one in [0, alphabetSize * floor(256 / alphabetSize)), then modulo. This eliminates modulo bias entirely. Over millions of generated passwords, biased generators leak information about the RNG state.",
      },
      {
        q: "What is the EFF passphrase mode?",
        a: "Passphrases pick N words uniformly at random from the EFF short wordlist (1,296 words, ~10.34 bits/word). A 6-word passphrase has ~62 bits of entropy — stronger than a 10-char random password and far easier to type and remember. We support custom separators (- _ . space), capitalization toggle, and an optional appended digit/symbol. The EFF wordlists are CC-licensed and bundled offline.",
      },
      {
        q: "Can I generate passwords in bulk?",
        a: "Yes — the batch mode generates up to 1000 passwords at once and exports them as CSV (with entropy + character-class breakdown). Useful for provisioning service accounts, demo data, or testing. Bulk generation is rate-limited via setTimeout to keep the UI responsive. No caps, no ads, no upload — passwords never leave your browser.",
      },
      {
        q: "What extras does this tool include?",
        a: "(1) CSPRNG with bias-free rejection sampling (documented). (2) Character-class toggles (upper, lower, digits, symbols). (3) Per-class minimums (e.g., 'at least 2 digits'). (4) Exclude-ambiguous (0/O/1/l/I). (5) Custom symbol set. (6) Pronounceable mode (consonant-vowel pattern). (7) EFF passphrase mode with word count, separator, capitalize, and appended digit/symbol. (8) Live entropy + character-class display. (9) Batch generation (up to 1000) with CSV export. (10) Auto-generate on load + one-tap regenerate. (11) Auto-clear-clipboard toggle (30s). (12) Length 1–128 (no caps). (13) Shareable rule preset via URL fragment — NEVER the password. (14) Reduced-motion respect.",
      },
      {
        q: "Does the shareable URL include the password?",
        a: "No — never. The URL encodes only the generation *settings* (length, character classes, per-class minimums, exclude-ambiguous, passphrase options) in the URL fragment. The fragment is never transmitted in HTTP requests. You can share a settings URL with a teammate so they use the same policy, but each browser generates its own independent password from those settings.",
      },
      {
        q: "Are generated passwords sent to a server or stored anywhere?",
        a: "No. Generation runs entirely in your browser via window.crypto.getRandomValues. Passwords are not logged, not stored in localStorage, not sent anywhere. The auto-clear-clipboard option (when enabled) wipes the clipboard 30 seconds after you copy — useful if you generate a password, paste it into a signup form, then walk away. There is no backend for this tool.",
      },
      {
        q: "What length should I use?",
        a: "For random ASCII passwords: 16 chars (95^16 ≈ 2^105) is comfortably overkill for any online service; 20+ for password-manager vaults. For passphrases: 5 EFF short words (~52 bits) for medium-stakes, 6+ words (~62+ bits) for high-stakes. Always prefer length over character-class complexity — a 16-char lowercase password (2^75) beats an 8-char 'complex' one (2^52).",
      },
    ],
  },
  status: "done",
};
