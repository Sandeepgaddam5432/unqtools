/**
 * Password Strength Meter — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "password-strength-meter",
  name: "Password Strength Meter",
  description:
    "Honest, zxcvbn-style password strength estimation with 0–4 scoring, entropy in bits, multi-scenario crack-time (online throttled / bcrypt / MD5 GPU), pattern breakdown, and 10+ extras. 100% client-side — your password never leaves the browser.",
  category: "network-security",
  keywords: [
    "password strength checker",
    "how strong is my password",
    "zxcvbn",
    "test password",
    "password entropy",
    "password meter",
    "password analyzer",
    "crack time",
    "password scorer",
    "password feedback",
  ],
  icon: "Gauge",
  requiresNetwork: false,
  seo: {
    title: "Password Strength Meter — Honest, zxcvbn-Powered, 100% Private | UnQTools",
    faq: [
      {
        q: "How does this password meter score passwords?",
        a: "We use a zxcvbn-style estimator (Dropbox's research-grade approach). Instead of naive 'length + character classes' rules that mis-rate 'P@ssw0rd1' as strong, we run pattern matching: dictionary words (top-10000 + names), keyboard walks (qwerty, asdf), repeats (aaaa, abcabc), sequences (1234, abcd), l33t substitutions (@→a, $→s), dates, and unicode. Each detected pattern contributes its entropy, and we report the weakest-link estimate as a 0–4 score.",
      },
      {
        q: "Why does this meter rate a random passphrase higher than 'P@ssw0rd1'?",
        a: "Because that's the reality of password cracking. 'P@ssw0rd1' is a dictionary word + l33t + digit sequence that automated crackers try in milliseconds. A 5-word random passphrase like 'correct-horse-battery-staple-piano' has ~58 bits of entropy and resists dictionary attacks. Our meter reflects this — it's the opposite of naive 'must have uppercase + symbol' rules that ship in many forms.",
      },
      {
        q: "What crack-time scenarios does the meter show?",
        a: "Three explicit attack models so you see why a '4/4' password can still die in seconds under weak hashing: (1) Online throttled attack — 100 guesses/hour (typical login rate-limit). (2) Offline slow-hash bcrypt (cost 10) — ~10,000 guesses/sec on a single GPU. (3) Offline fast-hash MD5 — ~100 billion guesses/sec on a GPU rig. We state the assumed hash and rate, not just a single number.",
      },
      {
        q: "What is the 'bcrypt(MD5) trap'?",
        a: "Some legacy systems hash a password with MD5 first, then bcrypt the result — eliminating bcrypt's slow-hash protection. A 4/4 zxcvbn passphrase can still be cracked in seconds against such a system because the cracker brute-forces the MD5 (fast) and only the bcrypt verification is slow. Our meter explains this trap in the warnings so you understand hash choice matters as much as password choice.",
      },
      {
        q: "What extras does this tool include?",
        a: "(1) zxcvbn-style 0–4 score with color-coded bar. (2) Entropy in bits (the actual security measure). (3) Three-scenario crack times with stated hash + rate assumptions. (4) Pattern/match breakdown — see exactly which dictionary words, sequences, keyboard walks etc. were detected. (5) Actionable improvement suggestions. (6) Show/hide toggle. (7) Multi-scenario comparison (bcrypt vs MD5 vs throttled). (8) Common-password detection (top-10000). (9) Custom dictionary support (paste company terms / personal info). (10) Per-pattern entropy contribution. (11) 'Worst-case' honest warning when score is high but hash is weak. (12) Copy suggestions. (13) Reduced-motion respect. (14) 100% client-side — password never transmitted.",
      },
      {
        q: "Is my password sent anywhere?",
        a: "No. All estimation runs in your browser via JavaScript. There is no server, no logging, no analytics on the password field. We do NOT integrate the HIBP k-anonymity API in this build — if you want a breach check, paste only the first 5 characters of your password's SHA-1 into a separate HIBP-aware tool. Your password itself never leaves this page.",
      },
      {
        q: "What do the 0–4 scores mean?",
        a: "0 = extremely guessable (under 10³ guesses; dictionary word, single digit) — <10 bits. 1 = very guessable (10³–10⁶; common word + digits) — 10–20 bits. 2 = somewhat guessable (10⁶–10⁸; name + l33t) — 20–35 bits. 3 = safely unguessable (10⁸–10¹⁰; moderate passphrase) — 35–60 bits. 4 = very unguessable (>10¹⁰; random 12+ char or 5+ word passphrase) — 60+ bits. Even 4/4 isn't safe against MD5 fast-hash offline attacks on weakly-hashed breaches.",
      },
      {
        q: "Can the meter handle Unicode / emoji passwords?",
        a: "Yes. We measure entropy in code points (not bytes) and treat each unique non-ASCII code point as drawn from a 1.1-million-code-point alphabet. Note: many sites silently strip or reject non-ASCII password characters at signup, so test on the target site before relying on emoji-based entropy.",
      },
    ],
  },
  status: "done",
};
