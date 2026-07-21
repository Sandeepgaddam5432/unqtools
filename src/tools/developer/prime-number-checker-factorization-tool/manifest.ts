/**
 * Prime Number Checker & Factorization Tool — Tool Manifest.
 * Tool #376 — Category 4 (Developer & Code).
 *
 * BigInt-exact primality test (deterministic Miller–Rabin for 64-bit,
 * probabilistic above), full prime factorization (trial division +
 * Pollard's rho), Sieve of Eratosthenes prime generator, prime-gap
 * finder, twin-prime finder, plus derived stats (divisor count/sum and
 * Euler's totient). 100% client-side & offline.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "prime-number-checker-factorization-tool",
  name: "Prime Number Checker & Factorization Tool (Miller–Rabin, Pollard's Rho)",
  description:
    "Check whether a number is prime with deterministic Miller–Rabin (64-bit) and probabilistic Miller–Rabin for larger integers, factorize any composite into its prime factors using trial division + Pollard's rho, generate primes with the Sieve of Eratosthenes, find prime gaps and twin primes, and compute divisor count/sum plus Euler's totient — all BigInt-exact and 100% client-side.",
  category: "developer",
  keywords: [
    "prime number checker", "prime factorization", "miller rabin",
    "pollard rho", "sieve of eratosthenes", "prime gap",
    "twin primes", "euler totient", "factor tree", "is prime",
  ],
  icon: "binary",
  requiresNetwork: false,
  seo: {
    title: "Prime Number Checker & Factorization Tool — Miller–Rabin + Pollard's Rho | UnQTools",
    faq: [
      {
        q: "How does the primality test work?",
        a: "For numbers below 3,317,044,064,679,887,385,961,981 (about 3.3 × 10²⁴) the tool uses deterministic Miller–Rabin with the proven witness bases {2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37} — the verdict is 100% certain. For larger integers it runs probabilistic Miller–Rabin with 20 random bases, giving an error probability below 4⁻²⁰ (≈ 9 × 10⁻¹³), which is effectively certain for any practical purpose.",
      },
      {
        q: "How does the factorization work?",
        a: "The tool first strips out small prime factors by trial division up to a few thousand, then switches to Pollard's rho algorithm (with Brent's improvement and Miller–Rabin primality checks at each step) to find larger factors. Each factor found is verified prime before being reported. The final factorization is re-multiplied to confirm it equals the original number.",
      },
      {
        q: "Can it factor very large numbers like RSA semiprimes?",
        a: "Honest answer: no tool can factor general RSA-size semiprimes (e.g. 2048-bit products of two large primes) in any reasonable time — that difficulty is what makes RSA secure. Pollard's rho is excellent at finding small-to-medium factors and works well on numbers that are not the product of two similar-size large primes. For such 'hard' semiprimes the tool will time out or hit its iteration cap.",
      },
      {
        q: "What derived statistics are computed?",
        a: "From the prime factorization the tool derives: the divisor count τ(n) = ∏(eᵢ+1), the divisor sum σ(n) = ∏(pᵢ^(eᵢ+1) − 1) / (pᵢ − 1), and Euler's totient φ(n) = n · ∏(1 − 1/pᵢ). All three are BigInt-exact and re-verified by direct enumeration for small n.",
      },
      {
        q: "What extra features does this tool have compared to other prime calculators?",
        a: "(1) Deterministic Miller–Rabin primality (certain up to ~3.3 × 10²⁴). (2) Probabilistic Miller–Rabin above that. (3) Pollard's rho factorization with Brent's improvement. (4) Trial division for small factors. (5) Sieve of Eratosthenes prime generator. (6) Prime-gap finder between consecutive primes. (7) Twin-prime finder. (8) Divisor count τ(n). (9) Divisor sum σ(n). (10) Euler's totient φ(n). (11) Factor tree visualization. (12) Exponent-form factorization (e.g. 360 = 2³ × 3² × 5). (13) Re-multiplication verification. (14) History (localStorage, last 20). (15) Shareable URL. 100% client-side and offline — your inputs never leave the device.",
      },
    ],
  },
  status: "done",
};
