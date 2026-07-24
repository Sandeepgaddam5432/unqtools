/**
 * Password Strength Checker — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "password-strength-checker",
  name: "Password Strength Checker",
  description:
    "Estimate password strength with entropy calculation, character-class scoring, common-password detection, pattern analysis, and 10+ extras. 100% private.",
  category: "network-security",
  keywords: ["password strength", "password checker", "entropy", "password analyzer", "weak password", "strong password"],
  icon: "shield-check",
  requiresNetwork: false,
  seo: {
    title: "Password Strength Checker — Entropy + Pattern Analysis | UnQTools",
    faq: [
      { q: "How is password strength calculated?", a: "We compute Shannon entropy (log2 of pool size × length), detect common patterns (sequential digits, repeated chars, keyboard walks like 'qwerty'), check against a list of the 10,000 most common passwords, and apply NIST SP 800-63B bonus/penalty rules." },
      { q: "What extras does this tool have?", a: "Extras: (1) Shannon entropy in bits, (2) Character pool size + class breakdown, (3) Crack-time estimate (offline fast hashing), (4) Common password detection (10k list), (5) Pattern detection (sequential/repeated/keyboard), (6) Dictionary word detection, (7) Leet-speak normalization, (8) 0-4 strength score, (9) Per-character analysis, (10) Suggestions for improvement, (11) Batch mode (check multiple passwords), (12) CSV export of batch, (13) Show/hide password toggle, (14) Compare two passwords side-by-side." },
    ],
  },
  status: "done",
};
