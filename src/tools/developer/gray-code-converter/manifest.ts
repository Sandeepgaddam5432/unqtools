/**
 * Gray Code Converter — Tool Manifest.
 * Tool #379 — Category 4 (Developer & Code).
 *
 * Convert between binary/decimal and reflected Gray code in both directions
 * with XOR-step working, generate n-bit Gray-code sequences with the
 * single-bit-change property highlighted, support n-ary and balanced Gray
 * codes, BigInt for wide values, and a truth-table view. 100% client-side.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "gray-code-converter",
  name: "Gray Code Converter (Binary ↔ Gray, Sequence, N-ary, Balanced)",
  description:
    "Convert between binary/decimal and reflected Gray code in both directions with XOR-step working, generate n-bit Gray-code sequences (0…2ⁿ−1) with the single-bit-change property highlighted, build n-ary and balanced Gray codes, and view the full truth table. BigInt support for wide values. 100% client-side & offline.",
  category: "developer",
  keywords: [
    "gray code converter", "binary to gray code", "gray code to binary",
    "reflected gray code", "gray code calculator",
    "gray code sequence generator", "n-ary gray code", "balanced gray code",
    "single bit change", "XOR gray code", "binary reflected gray code",
    "BRGC", "gray code truth table",
  ],
  icon: "binary",
  requiresNetwork: false,
  seo: {
    title: "Gray Code Converter — Binary ↔ Gray, Sequence Generator, N-ary, Balanced | UnQTools",
    faq: [
      {
        q: "How does binary-to-Gray conversion work?",
        a: "Gray code (also called reflected binary) is generated from a normal binary number by XORing each bit with the bit to its left: gᵢ = bᵢ ⊕ bᵢ₊₁. The most-significant bit is copied unchanged. The result is a code where successive values differ by exactly one bit, which is why Gray code is used in rotary encoders, Karnaugh maps, and error-reduction schemes.",
      },
      {
        q: "How does Gray-to-binary conversion reverse it?",
        a: "To recover the binary value, you do a prefix-XOR: starting from the MSB (which is copied), each binary bit bᵢ = gᵢ ⊕ bᵢ₊₁ — that is, XOR the Gray bit with the previously-computed binary bit. The tool shows this as a step table so you can follow each XOR. Both directions also support decimal input/output and any bit width with zero-padding.",
      },
      {
        q: "What is the Gray code sequence generator?",
        a: "Given n bits, the generator produces all 2ⁿ values from 0 to 2ⁿ−1 in Gray-code order, highlighting the single bit that flips between successive entries. You can verify the single-bit-change property (including the wrap from the last value back to the first), and view a complete truth table mapping index → binary → Gray → changed-bit.",
      },
      {
        q: "What are n-ary and balanced Gray codes?",
        a: "N-ary Gray code generalises the binary version to base-r digits — each successive value differs in exactly one digit by ±1, useful for non-binary sensors. Balanced Gray code is a special reflected Gray code where each bit position toggles roughly the same number of times across a full cycle (within ±1 of the average), which is important when each bit flip has a wear or signal cost. The tool generates both.",
      },
      {
        q: "What extra features does this tool have compared to other Gray code converters?",
        a: "(1) Binary → Gray with XOR step table. (2) Gray → binary with prefix-XOR step table. (3) Decimal input/output alongside binary. (4) Selectable bit width with zero-padding. (5) n-bit sequence generator (0…2ⁿ−1) with single-bit-change highlight. (6) Wrap-around single-bit-change verification. (7) N-ary Gray code (any base r ≥ 2). (8) Balanced Gray code generator. (9) Truth-table view. (10) BigInt support for wide values (up to 2ⁿ−1 where n ≤ 53 safely, larger via BigInt). (11) History (localStorage, last 20). (12) Shareable URL. 100% client-side and offline — your data never leaves the device.",
      },
    ],
  },
  status: "done",
};
