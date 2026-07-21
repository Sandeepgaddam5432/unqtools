/**
 * IEEE 754 Floating-Point Converter — Tool Manifest.
 * Tool #365 — Category 4 (Developer & Code).
 *
 * Decompose a decimal (or hex-float) value into IEEE 754 sign / exponent /
 * mantissa fields for binary16 (half), binary32 (single), binary64 (double),
 * and binary128 (quad) precision. Show the exact stored value (full-precision
 * decimal via BigInt), absolute and relative rounding error, classification
 * (normal / subnormal / ±0 / ±inf / qNaN / sNaN), a clickable bit grid with
 * per-field color coding, ULP next/previous stepping, hex-float parsing
 * (`0x1.8p+1`), and side-by-side precision comparison. 100% client-side,
 * BigInt-correct for all four widths including the no-native-type binary128.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ieee-754-floating-point-converter",
  name: "IEEE 754 Floating-Point Converter (binary16 / 32 / 64 / 128)",
  description:
    "Convert between decimal and IEEE 754 binary representations (binary16 half, binary32 single, binary64 double, binary128 quad). Show sign / exponent / mantissa bit fields, the exact stored value via BigInt, absolute & relative rounding error, classification (normal / subnormal / ±0 / ±inf / qNaN / sNaN), a clickable bit grid, ULP next/previous stepping, hex-float parsing (0x1.8p+1), and side-by-side precision comparison. 100% client-side, BigInt-correct for all four widths.",
  category: "developer",
  keywords: [
    "ieee 754 converter", "float to binary", "double precision bit converter",
    "half precision float calculator", "binary128 converter", "ieee 754",
    "floating point bit pattern", "hex float parser", "ulp step",
    "subnormal number", "mantissa exponent sign",
  ],
  icon: "binary",
  requiresNetwork: false,
  seo: {
    title: "IEEE 754 Floating-Point Converter (binary16 / 32 / 64 / 128) | UnQTools",
    faq: [
      {
        q: "What does the IEEE 754 converter do?",
        a: "Type a decimal number (or a hex float like 0x1.8p+1) and the tool decomposes it into the IEEE 754 sign / exponent / mantissa bit fields for all four standard widths — binary16 (half), binary32 (single), binary64 (double), and binary128 (quad). You see the raw bit pattern in binary and hex, the field breakdown, the classification (normal / subnormal / ±0 / ±inf / qNaN / sNaN), the exact value actually stored (computed with BigInt so it is correct to the last digit), and the absolute / relative rounding error versus your typed input.",
      },
      {
        q: "How are special values (inf, NaN, subnormals, ±0) handled?",
        a: "All four widths follow the IEEE 754 encoding: an all-ones exponent with a zero mantissa is ±inf, an all-ones exponent with a non-zero mantissa is NaN (most-significant mantissa bit set = qNaN, cleared = sNaN), an all-zero exponent with a non-zero mantissa is a subnormal, and an all-zero exponent with a zero mantissa is ±0 (distinguished by the sign bit). The tool labels each of these explicitly and the clickable bit grid highlights the field boundaries.",
      },
      {
        q: "How does the binary128 path work when JavaScript has no native 128-bit float?",
        a: "binary16 / 32 / 64 use the browser's typed arrays (DataView + Uint16Array / Float32Array / Float64Array) for hardware-exact conversion. For binary128, which has no native JS type, the tool falls back to a BigInt-based path: the decimal input is parsed as an exact rational (numerator / denominator), the nearest representable quad-precision value is computed with round-to-nearest-even, and the exact stored decimal is reconstructed from the bits via BigInt math. It is correct but slower than the hardware paths.",
      },
      {
        q: "What is ULP stepping and hex-float parsing?",
        a: "ULP (unit in the last place) is the gap between two consecutive representable floats at the current exponent. The Next / Previous buttons step the value by exactly one ULP, so you can walk every representable number in the chosen precision. Hex-float parsing accepts the C99 / JS-style literal 0x1.91eb86p+1, where the part before 'p' is a hex fraction and the part after is a binary exponent — useful for copying exact bit patterns out of compiler diagnostics or specs.",
      },
      {
        q: "What extra features does this tool have compared to other IEEE 754 converters?",
        a: "(1) All four widths — binary16, 32, 64, and 128 — in one tool (most only do 32 or 64). (2) Exact stored value to the last digit via BigInt (not a re-printed JS number). (3) Absolute AND relative rounding error displayed side-by-side. (4) Full classification including qNaN vs sNaN and ±0 distinction. (5) Clickable bit grid — toggle any bit and watch every field update. (6) Per-field color coding (sign / exponent / mantissa). (7) Hex-float input parsing (0x1.8p+1). (8) ULP next / previous stepping. (9) Side-by-side precision comparison of the same input across all four widths. (10) Copy fields / hex / binary. (11) History (localStorage, last 20). (12) Shareable URL with full state round-trip. 100% client-side and offline — your numbers never leave the device.",
      },
    ],
  },
  status: "done",
};
