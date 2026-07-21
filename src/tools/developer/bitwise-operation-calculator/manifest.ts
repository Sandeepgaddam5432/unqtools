/**
 * Bitwise Operation Calculator — Tool Manifest.
 * Tool #362 — Category 4 (Developer & Code).
 *
 * Evaluate bitwise expressions — AND, OR, XOR, NOT, NAND, NOR, XNOR, plus
 * left/right shifts (arithmetic and logical) — across two or more operands
 * in mixed bases (bin/oct/dec/hex) with an aligned bit-column grid, a
 * per-gate truth table, selectable width (8/16/32/64-bit or BigInt) and a
 * signed/unsigned toggle. 100% client-side.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "bitwise-operation-calculator",
  name: "Bitwise Operation Calculator (AND / OR / XOR / NOT / Shift)",
  description:
    "Evaluate bitwise expressions — AND, OR, XOR, NOT, NAND, NOR, XNOR, left shift, right shift (arithmetic & logical) — on two or more operands in mixed bases (bin/oct/dec/hex). Aligned bit-column grid, truth-table generator, selectable width (8/16/32/64-bit or BigInt), signed/unsigned toggle, and multi-input chained operations. 100% client-side.",
  category: "developer",
  keywords: [
    "bitwise calculator", "and or xor calculator", "bitwise expression evaluator",
    "nand nor xnor calculator", "bit shift calculator", "two's complement",
    "bit grid", "binary operations", "hex bitwise", "signed unsigned",
    "truth table generator", "bitwise not", "arithmetic shift", "logical shift",
  ],
  icon: "cpu",
  requiresNetwork: false,
  seo: {
    title: "Bitwise Operation Calculator — AND / OR / XOR / NOT / Shift | UnQTools",
    faq: [
      {
        q: "Which bitwise operations are supported?",
        a: "All seven named gates — AND (&), OR (|), XOR (^), NOT (~), NAND, NOR, XNOR — plus left shift (<<), logical right shift (>>>, zero-fill), and arithmetic right shift (>>, sign-fill). NOT, NAND, NOR and XNOR are derived from AND/OR/XOR with the NOT step applied to the result, so they work on arbitrarily many operands at the chosen width.",
      },
      {
        q: "Can I mix bases in one expression?",
        a: "Yes. Each operand is auto-detected: 0x prefix is hex, 0b is binary, 0o is octal, no prefix is decimal. Negative literals (e.g. -0x10) are accepted and interpreted per the chosen signed/unsigned mode and bit width. The full expression parser supports parentheses and standard precedence: NOT > shift > AND > XOR > OR.",
      },
      {
        q: "How does the bit-column grid work?",
        a: "Each operand and the final result are rendered as a left-padded binary string at the chosen width (8/16/32/64 bits). The bits are aligned in columns so you can trace a single bit position across every operand and the result. Set bits are highlighted; hover highlights the same column across rows for visual tracing.",
      },
      {
        q: "What is the difference between arithmetic and logical right shift?",
        a: "Arithmetic right shift (>>) fills the vacated high-order bits with the original sign bit, preserving the sign of negative numbers — this matches C/Java semantics for signed integers. Logical right shift (>>>) fills with zeros regardless of sign, treating the operand as unsigned. Both are provided so you can compare results; the tool matches the chosen bit width exactly.",
      },
      {
        q: "What extra features does this tool have versus other bitwise calculators?",
        a: "(1) Seven gates: AND, OR, XOR, NOT, NAND, NOR, XNOR. (2) Left shift + arithmetic & logical right shifts. (3) Mixed-base operand parsing (0x/0b/0o/decimal). (4) Full expression evaluator with parentheses and precedence (shunting-yard). (5) Aligned bit-column grid for visual tracing. (6) Selectable width 8/16/32/64-bit and BigInt mode (no overflow). (7) Signed/unsigned reinterpretation. (8) Per-gate truth-table generator. (9) Step-by-step evaluation log. (10) Multi-input chained operations (e.g. 0xF0 & ~0b1010 ^ 12). (11) Result shown in bin/oct/dec/hex simultaneously. (12) History (localStorage, last 20). (13) Shareable URL. 100% client-side and offline — your values never leave the device.",
      },
    ],
  },
  status: "done",
};
