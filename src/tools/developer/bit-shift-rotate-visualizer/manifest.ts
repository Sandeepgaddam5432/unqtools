/**
 * Bit Shift & Rotate Visualizer — Tool Manifest.
 * Tool #363 — Category 4 (Developer & Code).
 *
 * Visualize left/right shifts (`<<`, `>>` arithmetic, `>>>` logical) plus
 * circular rotates (ROL, ROR) and rotate-through-carry (RCL, RCR) on integers
 * of 8 / 16 / 32 / 64-bit widths. Shows the before/after binary representation
 * with per-bit movement, the shifted-out bits, the carry flag, and the
 * ×/÷ by 2^k relationship. 100% client-side, BigInt-correct.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "bit-shift-rotate-visualizer",
  name: "Bit Shift & Rotate Visualizer (<<, >>, >>>, ROL / ROR)",
  description:
    "Visualize left and right shifts (<<, >> arithmetic, >>> logical) plus circular rotates (ROL, ROR) and rotate-through-carry (RCL, RCR) on integers at 8/16/32/64-bit widths. Animated per-bit movement, before/after binary grid, shifted-out bits + carry flag, ×/÷ by 2^k annotation, BigInt-correct at every width. 100% client-side and offline.",
  category: "developer",
  keywords: [
    "bit shift calculator", "left shift right shift visualizer",
    "arithmetic vs logical shift", "rotate bits online", "rotate through carry",
    "rol ror rcl rcr", "unsigned right shift", "binary shift visualizer",
    "bit rotate", "two's complement shift", "sign fill shift",
  ],
  icon: "cpu",
  requiresNetwork: false,
  seo: {
    title: "Bit Shift & Rotate Visualizer (<<, >>, >>>, ROL / ROR) | UnQTools",
    faq: [
      {
        q: "What is the difference between >>, >>>, and arithmetic vs logical right shift?",
        a: "Arithmetic right shift (>>) fills the vacated high-order bits with the original sign bit, preserving the sign of negative numbers (e.g. -8 >> 1 = -4 in 8-bit signed). Logical / unsigned right shift (>>>) always fills with zeros, treating the operand as unsigned (so 0xF8 >>> 1 = 0x7C). This tool clearly separates all three: left shift (<<), arithmetic right shift (>>), and logical right shift (>>>), and shows the bit pattern after each.",
      },
      {
        q: "How do ROL, ROR, RCL and RCR rotate operations work?",
        a: "ROL (rotate left) and ROR (rotate right) wrap the bits that fall off one end back into the other end — no bits are lost. RCL (rotate through carry left) and RCR (rotate through carry right) treat the carry flag as a 9th (or width+1-th) bit: the bit shifted out goes into the carry, and the previous carry value rotates in at the other end. The carry flag is shown alongside every rotate result so you can verify the wraparound behavior.",
      },
      {
        q: "Which bit widths are supported and is the math BigInt-correct at 64-bit?",
        a: "8, 16, 32 and 64-bit widths are all supported, with all arithmetic performed using BigInt under the hood. This means 64-bit shifts and rotates are exact — no JavaScript Number precision loss, no implicit 32-bit truncation. The display also shows the ×2^k / ÷2^k relationship for shifts so you can confirm e.g. that 5 << 3 = 40.",
      },
      {
        q: "What happens when the shift count is greater than or equal to the bit width?",
        a: "For shifts, bits shifted by ≥ width fully empty the register — the tool mirrors the C/UB note and shows a warning. For rotates, the count is taken modulo the width (so ROL by 8 on an 8-bit value is a no-op). A shift count of 0 is a no-op for every operation. Negative shift counts are flagged as errors. The behavior is always documented inline so you can predict the result.",
      },
      {
        q: "What extra features does this tool have versus other bit-shift visualizers?",
        a: "(1) Six operations: <<, >> arithmetic, >>> logical, ROL, ROR, RCL, RCR. (2) 8/16/32/64-bit widths, BigInt-correct. (3) Signed/unsigned display toggle. (4) Before/after binary grid with per-bit movement arrows. (5) Shifted-out bits shown explicitly. (6) Carry flag tracked and shown. (7) ×2^k / ÷2^k annotation for shifts. (8) Mixed-base operand parsing (0x hex, 0b binary, 0o octal, decimal). (9) Multi-step chaining (apply the same op k times). (10) History (localStorage, last 20). (11) Shareable URL with full state round-trip. (12) Reference table for every operation. 100% client-side and offline — your values never leave the device.",
      },
    ],
  },
  status: "done",
};
