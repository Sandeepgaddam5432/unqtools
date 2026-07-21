/**
 * Fixed-Point Q-Format Converter (Qm.n) — Tool Manifest.
 * Tool #366 — Category 4 (Developer & Code).
 *
 * Convert between real decimal numbers and fixed-point Qm.n representations
 * used in DSP, embedded, and FPGA work. Configurable integer bits (m) and
 * fractional bits (n), signed (Qm.n) or unsigned (UQm.n), three rounding
 * modes (round-half-up, round-to-nearest-even, truncate/floor), two overflow
 * modes (saturate, wrap), live resolution (2^-n) and representable range
 * readouts, quantization error vs the typed value, raw stored integer in
 * dec / hex / bin, a clickable bit grid with integer | fraction split, and
 * preset chips (Q7, Q15, Q31, Q1.15, Q1.31, UQ8.8, UQ16.16 …). 100%
 * client-side, BigInt-correct.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "fixed-point-q-format-converter",
  name: "Fixed-Point Q-Format Converter (Qm.n)",
  description:
    "Convert between real numbers and fixed-point Qm.n representations (signed Qm.n or unsigned UQm.n) used in DSP, embedded, and FPGA work. Configurable integer bits (m) and fractional bits (n), three rounding modes (round-half-up, round-to-even, truncate), two overflow modes (saturate, wrap), live resolution (2^-n) and representable range, exact quantization error, raw stored integer in dec / hex / bin, a clickable bit grid with integer | fraction split, and presets (Q7, Q15, Q31, UQ8.8, UQ16.16). BigInt-correct, 100% client-side.",
  category: "developer",
  keywords: [
    "q format converter", "fixed point converter", "qm.n calculator",
    "q15 q31 fixed point", "fixed point quantization error",
    "dsp fixed point", "two's complement fixed point",
    "fixed point saturation", "fixed point rounding",
    "uqm.n unsigned fixed point",
  ],
  icon: "binary",
  requiresNetwork: false,
  seo: {
    title: "Fixed-Point Q-Format Converter (Qm.n) | UnQTools",
    faq: [
      {
        q: "What is Qm.n fixed-point notation?",
        a: "Qm.n is a fixed-point notation where m is the number of integer bits (including the sign bit for signed formats) and n is the number of fractional bits. The total word length is m + n bits. So Q1.15 means 1 integer bit (the sign) + 15 fractional bits = 16 bits total, often abbreviated Q15. Q1.31 = 32 bits total (a.k.a. Q31). The fractional bits give a resolution (quantum) of 2^-n — Q15 has a resolution of 1/32768 ≈ 3.05e-5.",
      },
      {
        q: "What is the difference between signed Qm.n and unsigned UQm.n?",
        a: "Signed Qm.n uses two's-complement encoding for the integer bits, so the most-significant bit is the sign bit. The representable range is [-2^(m-1), 2^(m-1) - 2^-n]. Unsigned UQm.n has no sign bit and uses all m integer bits for magnitude, giving a range of [0, 2^m - 2^-n]. The tool supports both — toggle the Signed checkbox to switch.",
      },
      {
        q: "What rounding and overflow modes are supported?",
        a: "Three rounding modes: round-half-up (the schoolbook rule, ties go away from zero), round-to-nearest-even (the IEEE 754 default, ties go to the even LSB — eliminates bias), and truncate (floor toward negative infinity for signed, toward zero for unsigned). Two overflow modes: saturate (clamp to the representable range with an overflow warning) and wrap (two's-complement wraparound, the default CPU behavior).",
      },
      {
        q: "What are the quantization error and resolution readouts?",
        a: "Resolution (quantum, LSB weight) = 2^-n and is shown as both a fraction and a decimal. The quantization error is the exact difference between your typed real value and the value reconstructed from the stored integer — it is computed with BigInt so it is exact to the last digit, never a re-printed float. For rounding modes the error is bounded by ±0.5 LSB; for truncate it is in [-1, 0] LSB (signed) or [-1, 0] LSB (unsigned).",
      },
      {
        q: "What extra features does this tool have versus other Q-format converters?",
        a: "(1) Both signed Qm.n AND unsigned UQm.n with a single toggle (most assume signed only). (2) Three rounding modes (round-half-up, round-to-even, truncate) — most only do one. (3) Two overflow modes (saturate vs wrap) with an explicit warning flag. (4) Live resolution (2^-n) as both fraction and decimal. (5) Live representable range display. (6) Exact quantization error via BigInt (not a re-printed float). (7) Raw stored integer in decimal, hex, and binary simultaneously. (8) Clickable bit grid with integer | fraction bit split color-coded. (9) Q7 / Q15 / Q31 / Q1.15 / Q1.31 / UQ8.8 / UQ16.16 preset chips. (10) Real → Q and Q → real both directions. (11) History (localStorage, last 20). (12) Shareable URL with full state round-trip. 100% client-side and offline — your values never leave the device.",
      },
    ],
  },
  status: "done",
};
