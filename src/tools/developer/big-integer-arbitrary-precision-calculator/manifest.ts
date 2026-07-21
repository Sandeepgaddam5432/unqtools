/**
 * Big Integer Arbitrary-Precision Calculator — Tool Manifest.
 * Tool #367 — Category 4 (Developer & Code).
 *
 * Arbitrary-precision integer arithmetic using native BigInt: +, -, *, /,
 * %, **, GCD, LCM, factorial, Fibonacci, modular exponentiation, Miller-Rabin
 * primality test, base conversion (binary / octal / decimal / hex / base-N up
 * to 36), exact rational mode (fractions kept as numerator/denominator, not
 * floated), and a full shunting-yard expression parser with precedence and
 * parentheses. Results include digit count, thousands-grouped display, and a
 * scientific approximation. 100% client-side, no network, no libraries.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "big-integer-arbitrary-precision-calculator",
  name: "Big Integer Arbitrary-Precision Calculator",
  description:
    "Evaluate arbitrary-precision integer arithmetic with native BigInt: +, -, *, /, %, **, GCD, LCM, factorial, Fibonacci, modular exponentiation (a^b mod m), Miller-Rabin primality test, base conversion (binary/octal/decimal/hex/base-N up to 36), exact rational mode (fractions kept exact, not floated), and a full shunting-yard expression parser with precedence and parentheses. Result digit count + grouped display + scientific approximation. 100% client-side, no network, no libraries.",
  category: "developer",
  keywords: [
    "big integer calculator", "arbitrary precision", "big number calculator",
    "large integer", "modular exponentiation", "modpow",
    "factorial of large number", "fibonacci big", "gcd lcm calculator",
    "miller rabin primality", "fraction exact arithmetic", "big int parser",
    "base conversion bigint", "shunting yard expression",
  ],
  icon: "binary",
  requiresNetwork: false,
  seo: {
    title: "Big Integer Arbitrary-Precision Calculator (BigInt, ModPow, Factorial) | UnQTools",
    faq: [
      {
        q: "What can the big integer calculator do?",
        a: "It evaluates arithmetic on integers of unlimited size using JavaScript's native BigInt. Supported operations: addition (+), subtraction (-), multiplication (*), integer division (/) with remainder (%), power (**), GCD, LCM, factorial (n!), Fibonacci, and modular exponentiation (a^b mod m). You can type a single full expression with parentheses (e.g. `(2^1000) + (3 * 5!) - 7`) and the shunting-yard parser evaluates it with correct precedence. Each result shows the exact value, digit count, thousands-grouped display, a scientific approximation, and the value converted to binary / octal / hex.",
      },
      {
        q: "How does the exact rational (fraction) mode work?",
        a: "When a division does not divide evenly, the result is kept as an exact fraction (numerator/denominator) reduced to lowest terms via BigInt GCD — never as a floating-point approximation. So `1 / 3` is exactly `1/3`, not `0.3333...`. You can chain further operations on the fraction (`(1/3) + (1/6) = 1/2`) and the result stays exact. The fraction is also rendered as a decimal expansion with a configurable digit limit.",
      },
      {
        q: "How is primality tested for very large numbers?",
        a: "The tool uses a deterministic Miller-Rabin test. For n < 3,317,044,064,679,887,385,961,981 the test is provably correct using the first 13 prime witnesses. For larger n it falls back to a high-confidence probabilistic Miller-Rabin with 40 rounds, which gives a false-positive probability below 2^-80 — far stronger than cryptographic requirements. Small composites are caught first by trial division by the first 200 primes.",
      },
      {
        q: "Are extremely large computations like 100000! going to crash my browser?",
        a: "BigInt operations are native and fast, but truly enormous results (e.g. factorial of 100000 produces a ~456574-digit number) take time and memory. The tool runs in the main thread but yields to the event loop between independent operations so the UI stays responsive. Very long computations can be canceled via the cancel button. There is a configurable safety bound on factorial input to prevent accidental hangs.",
      },
      {
        q: "What extra features does this tool have compared to other big integer calculators?",
        a: "(1) Full shunting-yard expression parser with precedence and parentheses (most only do two operands and one op). (2) Exact rational mode (fractions kept exact, not floated). (3) Modular exponentiation (a^b mod m) with large inputs. (4) Miller-Rabin primality test (deterministic under ~3.3*10^24, probabilistic above). (5) Factorial and Fibonacci for any n. (6) GCD and LCM. (7) Base conversion (bin/oct/dec/hex/base-N up to 36) for both input and output. (8) Result digit count + thousands-grouped display + scientific approximation. (9) History (localStorage, last 20, clickable to reload). (10) Shareable URL with full expression round-trip. (11) Niche presets (e.g. 2^256, 10!, 100th Fibonacci, RSA-100). (12) Copy result / fraction / decimal expansion. 100% client-side and offline — your numbers never leave the device.",
      },
    ],
  },
  status: "done",
};
