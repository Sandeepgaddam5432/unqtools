/**
 * Number Base Converter — Tool Manifest.
 * Tool #361 — Category 4 (Developer & Code).
 *
 * Convert a number between any two bases from 2 to 36 — binary, octal,
 * decimal, hexadecimal, and arbitrary radices — in real time, with a
 * live digit-by-digit breakdown of the place-value math. BigInt-backed
 * for arbitrary precision, fractional radix-point support with repeating
 * detection, signed two's-complement at selectable bit widths, plus
 * base58/base64 byte-encoding shortcuts and batch conversion.
 * 100% client-side.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "number-base-converter",
  name: "Number Base Converter (Binary / Octal / Decimal / Hex / Base 2–36)",
  description:
    "Convert a number between any two bases from 2 to 36 — binary, octal, decimal, hex, base32, base36 — with BigInt precision, place-value expansion, fractional radix-point support, signed two's-complement mode, plus base58 and base64 byte-encoding shortcuts. Auto-detects 0x/0b/0o prefixes, groups long binary/hex output, and batch-converts a list of numbers. 100% client-side.",
  category: "developer",
  keywords: [
    "number base converter", "binary to decimal", "decimal to hex",
    "hex to binary", "base 2 to 36", "any base converter with steps",
    "radix converter", "binary octal decimal hex", "base32", "base36",
    "base58", "bigint converter", "two's complement", "place value expansion",
  ],
  icon: "binary",
  requiresNetwork: false,
  seo: {
    title: "Number Base Converter — Binary / Octal / Decimal / Hex / Base 2–36 | UnQTools",
    faq: [
      {
        q: "Which bases does this converter support?",
        a: "Any integer radix from 2 to 36 using the standard 0-9 + A-Z digit alphabet (binary, octal, decimal, hex, base32, base36, and every radix in between), plus base58 (Bitcoin alphabet) and base64 (RFC 4648) as byte-encoding shortcuts for non-negative integers. BigInt is used internally so even values larger than Number.MAX_SAFE_INTEGER convert without precision loss.",
      },
      {
        q: "How does the place-value expansion work?",
        a: "Each digit is multiplied by base^position (positions run right-to-left for the integer part, left-to-right after the radix point for the fractional part). The expansion panel shows the full sum, e.g. 1011₂ = 1·8 + 0·4 + 1·2 + 1·1 = 11₁₀. The expansion is computed from the integer part of the parsed value.",
      },
      {
        q: "Does it handle fractional numbers and repeating expansions?",
        a: "Yes. Fractional radix-point conversion is supported up to a configurable precision (default 24 fractional digits). When the fractional part cannot be represented exactly in the target base within the precision budget, the tool marks the result as 'repeating' so you know it is an approximation rather than an exact value.",
      },
      {
        q: "What is the signed two's-complement mode?",
        a: "Toggle signed mode and pick a bit width (8, 16, 32, or 64). Negative inputs are reinterpreted as their two's-complement bit pattern at the chosen width before conversion, so -1 at 8-bit becomes FF₁₆ / 11111111₂. The original sign is preserved in the result label.",
      },
      {
        q: "What extra features does this tool have compared to other base converters?",
        a: "(1) Any base 2–36 ↔ any base 2–36. (2) Auto-detect input base from 0x/0b/0o prefixes. (3) Place-value expansion panel. (4) Digit grouping (4-bit nibbles for binary, configurable for others). (5) BigInt-backed arbitrary precision. (6) Fractional radix-point conversion with repeating-digit detection. (7) Signed two's-complement mode at 8/16/32/64-bit. (8) base58 + base64 byte-encoding shortcuts. (9) Batch conversion (one input → all common bases, or a list of inputs). (10) Quick-convert chips for bin/oct/dec/hex. (11) History (localStorage, last 20). (12) Shareable URL. 100% client-side and offline — your numbers never leave the device.",
      },
    ],
  },
  status: "done",
};
