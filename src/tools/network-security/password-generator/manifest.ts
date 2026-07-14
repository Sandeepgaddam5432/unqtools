import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "password-generator",
  name: "Password Generator",
  description:
    "Generate cryptographically-secure passwords, EFF passphrases, pronounceable passwords, PINs, WiFi passwords, and Diceware — with per-class minimums, zxcvbn cross-check, pattern detection, history, and CSV/JSON export. 100% private.",
  category: "network-security",
  keywords: [
    "password",
    "generator",
    "passphrase",
    "eff wordlist",
    "diceware",
    "wifi password",
    "pin",
    "pronounceable",
    "zxcvbn",
    "strength",
    "crypto",
    "web crypto",
  ],
  icon: "key",
  requiresNetwork: false,
  seo: {
    title: "Password Generator — Random, Passphrase, PIN, WiFi, Diceware | UnQTools",
    faq: [
      {
        q: "Are these passwords truly random?",
        a: "Yes. We use the browser's native crypto.getRandomValues API, which is a cryptographically secure pseudo-random number generator (CSPRNG). All character selection uses rejection sampling to eliminate modulo bias — we never use Math.random() for passwords.",
      },
      {
        q: "What generation modes are available?",
        a: "Six modes: (1) Random — custom charset with per-class minimums. (2) Passphrase — EFF short wordlist with separators, capitalization, and number injection. (3) Pronounceable — consonant-vowel patterns for memorability. (4) PIN — 4-8 digits for phone unlock screens. (5) WiFi — full printable ASCII for WPA2/WPA3 (up to 63 chars). (6) Diceware — virtual 4-dice rolls mapped to EFF wordlist, with rolls shown for verification.",
      },
      {
        q: "How is password strength calculated?",
        a: "We compute entropy in bits (log2(poolSize^length) for random, log2(wordCount^wordCount) for passphrase) and convert to crack-time at 10 billion hashes/sec (offline GPU attack, 2026 standard). Strength labels: Weak (<40 bits), Fair (40-59), Good (60-79), Strong (80-119), Very Strong (120+). Optional zxcvbn-ts cross-check (lazy-loaded, ~150KB) provides a second opinion based on dictionary attacks and common patterns.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "Beyond the standard features, we ship: (1) Password history (last 10, localStorage, with clear button). (2) Common pattern detection — warns about sequential chars (1234), repeated chars (aaaa), and keyboard patterns (qwerty). (3) Mobile PIN mode for phone unlock screens. (4) WPA2/WPA3 WiFi password mode (63-char ASCII for max entropy). (5) Diceware mode with virtual dice and visible rolls. (6) Crack-time estimate at offline GPU hashrate. (7) Side-by-side batch generation (up to 100 at once). (8) Pronounceable-but-strong mode. (9) Keyboard shortcuts (Space=regenerate, C=copy, 1-5=modes). (10) CSV/JSON export of batch with metadata. (11) Shareable preset URL (encodes settings, NEVER the password). (12) Auto-clear clipboard after 30s.",
      },
      {
        q: "Is my generated password sent anywhere?",
        a: "No. The password is generated entirely in your browser using local cryptographic primitives. It never leaves your device, is never logged, and is never sent to any server. History is stored in localStorage on your device only. You can verify this by disconnecting your internet — the tool still works. Note: HIBP breach check is intentionally omitted to preserve the offline-first guarantee (it would require a network call).",
      },
      {
        q: "Why is there no 'Have I Been Pwned' breach check?",
        a: "HIBP k-anonymity breach check requires a network request to the HIBP API. We intentionally omit it to preserve our 100% offline-first guarantee — the tool must work without any network. If you want to check if a password has been breached, visit haveibeenpwned.com separately. We document this exception in AGENTS.md § 1b as an 'allowed exception' to the 100% blueprint compliance rule.",
      },
    ],
  },
  status: "done",
};
