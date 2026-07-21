/**
 * Modular Arithmetic & GCD/LCM Calculator — Tool Manifest.
 * Tool #375 — Category 4 (Developer & Code).
 *
 * BigInt-exact modular arithmetic primitives: modular add/sub/mul/pow,
 * GCD/LCM (Euclidean), extended GCD with Bézout coefficients, modular
 * inverse (with existence check), and a Chinese Remainder Theorem solver
 * — with full step-by-step tables for the Euclidean algorithms. 100%
 * client-side.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "modular-arithmetic-gcd-lcm-calculator",
  name: "Modular Arithmetic & GCD/LCM Calculator (CRT, Bézout, Mod-Inverse)",
  description:
    "BigInt-exact modular arithmetic: a mod m (floor or truncated), modular add/subtract/multiply/exponentiation (binary exponentiation), GCD/LCM of two or more numbers, extended Euclidean algorithm with Bézout coefficients, modular inverse with existence check, and a Chinese Remainder Theorem solver for a system of congruences — with step-by-step Euclid tables. 100% client-side & offline.",
  category: "developer",
  keywords: [
    "modular arithmetic calculator", "GCD LCM calculator",
    "modular inverse calculator", "extended euclidean algorithm",
    "chinese remainder theorem solver", "modular exponentiation",
    "bezout coefficients", "mod calculator", "number theory",
    "binary exponentiation mod",
  ],
  icon: "binary",
  requiresNetwork: false,
  seo: {
    title: "Modular Arithmetic & GCD/LCM Calculator — CRT + Bézout | UnQTools",
    faq: [
      {
        q: "Which modular operations does this calculator support?",
        a: "All the standard primitives: a mod m (with floor or truncated sign convention), modular addition (a+b mod m), subtraction (a−b mod m), multiplication (a·b mod m), and exponentiation (a^b mod m via binary exponentiation, with negative-exponent support through the modular inverse). Everything is BigInt-exact so even very large operands work without precision loss.",
      },
      {
        q: "How does the modular inverse work, and when does it not exist?",
        a: "The modular inverse of a modulo m is the integer x such that a·x ≡ 1 (mod m). It exists if and only if gcd(a, m) = 1. The calculator uses the extended Euclidean algorithm to find x; if gcd(a, m) ≠ 1, it returns a clear 'inverse does not exist' message instead of a wrong answer. The result is always returned in the canonical range [0, m).",
      },
      {
        q: "Does it show the Bézout coefficients and Euclid steps?",
        a: "Yes. The extended Euclidean algorithm produces the Bézout identity a·x + b·y = gcd(a, b), and the calculator displays a step-by-step table showing each division step (a = q·b + r) and the evolving Bézout coefficients. You can verify the identity at any time — the product a·x + b·y always equals gcd(a, b).",
      },
      {
        q: "How does the Chinese Remainder Theorem solver handle non-coprime moduli?",
        a: "The CRT solver uses the pairwise-merge algorithm rather than requiring all moduli to be pairwise coprime. For each pair of congruences (x ≡ r₁ mod m₁, x ≡ r₂ mod m₂), it checks whether gcd(m₁, m₂) divides (r₂ − r₁). If it does, the pair is merged into a single congruence modulo lcm(m₁, m₂). If not, the system has no solution and a clear error is returned.",
      },
      {
        q: "What extra features does this tool have compared to other modular calculators?",
        a: "(1) Modular add/sub/mul/pow with BigInt precision. (2) Sign-convention toggle (floor vs truncated mod). (3) GCD of two or more numbers. (4) LCM of two or more numbers. (5) Extended Euclidean algorithm with Bézout coefficients. (6) Modular inverse with existence check. (7) Chinese Remainder Theorem solver (pairwise-merge, supports non-coprime moduli). (8) Step-by-step Euclid table. (9) Step-by-step extended-Euclid table with Bézout coefficients. (10) Bézout identity verifier. (11) History (localStorage, last 20). (12) Shareable URL. 100% client-side and offline — your inputs never leave the device.",
      },
    ],
  },
  status: "done",
};
