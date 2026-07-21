/**
 * Scientific & Engineering Notation Converter — Tool Manifest.
 * Tool #374 — Category 4 (Developer & Code).
 *
 * Convert numbers between decimal, scientific (a × 10^b), engineering
 * (exponent a multiple of 3), SI-prefix (12.3k, 4.7µ), and E-notation
 * (1.5e-9) forms — with significant-figure control, exact BigInt mantissa
 * math, full SI prefix table (yocto → quetta + binary prefixes), batch
 * conversion, and rounding-mode selection. 100% client-side.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "scientific-engineering-notation-converter",
  name: "Scientific & Engineering Notation Converter (SI Prefix, E-Notation)",
  description:
    "Convert numbers between decimal, scientific (a × 10^b), engineering (exponent multiple of 3), SI-prefixed (12.3k, 4.7µ), and E-notation (1.5e-9) — with adjustable significant figures, exact BigInt mantissa math, full SI prefix table from yocto to quetta (plus binary IEC prefixes), batch list conversion, and rounding-mode selection. 100% client-side & offline.",
  category: "developer",
  keywords: [
    "scientific notation converter", "engineering notation converter",
    "SI prefix converter", "E notation converter", "standard form calculator",
    "scientific to decimal", "decimal to scientific",
    "engineering notation", "SI prefix", "quetta to yocto",
    "binary IEC prefix", "significant figures",
  ],
  icon: "binary",
  requiresNetwork: false,
  seo: {
    title: "Scientific & Engineering Notation Converter — SI Prefix + E-Notation | UnQTools",
    faq: [
      {
        q: "Which notation forms does this converter support?",
        a: "Five forms, all kept in sync: plain decimal, scientific (a × 10^b with 1 ≤ |a| < 10), engineering (exponent is always a multiple of 3, mantissa 1 ≤ |a| < 1000), SI-prefixed (12.3k, 4.7µ, 2.5Qi), and E-notation (1.5e-9). Type any of them and the others update live.",
      },
      {
        q: "How does significant-figure control work?",
        a: "Pick how many significant figures (1–50) you want and the converter rounds every form consistently. The rounding mode is selectable (half-up, half-even, down, up, half-down) so you can match IEEE 754, banking, or scientific conventions. Trailing zeros are preserved when sig-figs demand them (e.g. 1.200 × 10³ at 4 sig-figs).",
      },
      {
        q: "Does it stay exact for very large or very small numbers?",
        a: "Yes. The mantissa is parsed as a BigInt (sign + integer-digits + fractional-digits) and the exponent is handled as a separate integer, so values like 6.02214076e23 (Avogadro) or 1.616255e-35 (Planck length) convert without float round-off. SI prefix output uses the same exact core, with fallback to scientific form when the exponent falls outside the yocto (10⁻²⁴) … quetta (10³⁰) range.",
      },
      {
        q: "Which SI and binary prefixes are included?",
        a: "All 24 metric SI prefixes from quetta (10³⁰) down to yocto (10⁻²⁴), including the micro (µ) sign. As an optional toggle, all 8 binary IEC prefixes from kibi (Ki = 2¹⁰) to yobi (Yi = 2⁸⁰) are available for byte-style values. When the exponent lies outside the prefix range, the converter falls back to scientific notation so you never get a misleading result.",
      },
      {
        q: "What extra features does this tool have compared to other notation converters?",
        a: "(1) Decimal ↔ scientific ↔ engineering ↔ SI-prefix ↔ E-notation, all live. (2) Significant-figure control (1–50). (3) Rounding-mode selector (5 modes). (4) Exact BigInt mantissa — no float rounding for huge/tiny values. (5) Full SI prefix range yocto → quetta. (6) Binary IEC prefix toggle (Ki–Yi). (7) Batch list conversion (one input per line → all forms). (8) Copy each form individually. (9) History (localStorage, last 20). (10) Shareable URL. (11) Auto-detect input form. 100% client-side and offline — your numbers never leave the device.",
      },
    ],
  },
  status: "done",
};
