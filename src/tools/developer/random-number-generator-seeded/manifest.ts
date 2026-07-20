/**
 * Random Number Generator (Seeded) — Tool Manifest.
 * Tool #289 — Category 4 (Developer & Code).
 *
 * Seeded PRNG (mulberry32 / LCG / xorshift / Mersenne-Twister) with multiple
 * distributions (uniform / normal / exponential / Poisson), unique-set mode,
 * weighted choice, histogram preview, CSV/JSON export, and CSPRNG mode for
 * security use. 100% client-side, fully offline.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "random-number-generator-seeded",
  name: "Random Number Generator (Seeded)",
  description:
    "Generate reproducible random numbers with four PRNG algorithms (mulberry32, LCG, xorshift, Mersenne-Twister), four distributions (uniform, normal, exponential, Poisson), unique-set mode, weighted choice, histogram preview, bulk export to CSV/JSON, plus a clearly-labeled crypto-secure CSPRNG mode. Seeded for reproducibility. 100% client-side.",
  category: "developer",
  keywords: [
    "random number generator", "seeded random", "prng",
    "mulberry32", "lcg", "xorshift", "mersenne twister",
    "normal distribution", "gaussian", "box-muller",
    "poisson", "exponential", "csprng", "secure random",
    "unique random", "random integers",
  ],
  icon: "shuffle",
  requiresNetwork: false,
  seo: {
    title: "Random Number Generator (Seeded) — PRNG + CSPRNG + Distributions | UnQTools",
    faq: [
      {
        q: "Which PRNG algorithms does this tool support?",
        a: "Four popular seeded algorithms: mulberry32 (fast, great statistical quality), LCG (Linear Congruential — classic, fast, weaker distribution), xorshift32 (Xorshift — tiny state, fast), and a simplified Mersenne-Twister (MT19937-style state, long period, excellent quality). The same seed and algorithm always produce the exact same sequence, so your results are 100% reproducible.",
      },
      {
        q: "What distributions can I generate?",
        a: "Uniform (integers or decimals in any [min, max] range, with optional unique-set mode), Normal/Gaussian (Box-Muller transform with configurable mean and standard deviation), Exponential (configurable lambda rate), and Poisson (configurable lambda rate, returns non-negative integers). Switch distribution in the dropdown and tune its parameters.",
      },
      {
        q: "Is the seeded PRNG safe for cryptography?",
        a: "No — seeded PRNGs are deterministic and only suitable for reproducible sequences, simulations, and games. For cryptography (tokens, passwords, IDs) switch on the CSPRNG mode which uses the browser's crypto.getRandomValues() under the hood. The UI clearly labels which mode is active so you never confuse reproducible for secure.",
      },
      {
        q: "Can I generate unique (non-repeating) numbers?",
        a: "Yes. Toggle 'Unique' on (uniform distribution only). We use a Fisher-Yates partial shuffle of the requested range, so uniqueness is guaranteed. If your count exceeds the range size (e.g. 15 unique values from 1..10), the tool refuses and tells you the maximum possible.",
      },
      {
        q: "What extra features does this tool have versus others?",
        a: "(1) Four PRNG algorithms. (2) Four distributions (uniform/normal/exponential/Poisson). (3) Unique-set mode with safety check. (4) Decimal precision control. (5) Box-Muller Gaussian. (6) Weighted choice. (7) Fisher-Yates shuffle. (8) Live histogram preview. (9) CSPRNG (crypto.getRandomValues) mode. (10) CSV/JSON export. (11) Sort / shuffle output. (12) localStorage history (max 20). (13) Shareable config URL (encoded in fragment). (14) Bulk generation up to 10,000.",
      },
    ],
  },
  status: "done",
};
