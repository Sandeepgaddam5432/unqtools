/**
 * Two's Complement / Signed Integer Calculator — Tool Manifest.
 * Tool #364 — Category 4 (Developer & Code).
 *
 * Convert between signed decimal and its two's-complement (and one's-complement
 * / sign-magnitude) binary representation at any width from 4 to 64 bits, with
 * step-by-step negation (invert → +1), a clickable bit grid with MSB sign
 * highlighted, hex/octal views, range/overflow detection, and sign-extension /
 * truncation visualization. 100% client-side, BigInt-correct.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "twos-complement-signed-integer-calculator",
  name: "Two's Complement / Signed Integer Calculator",
  description:
    "Convert between signed decimal and two's-complement binary at any width (4/8/16/32/64-bit or custom up to 256-bit). Step-by-step negation (invert → +1), one's-complement and sign-magnitude side-by-side, clickable bit grid with MSB sign bit highlighted, hex/octal views, range & overflow detection, and sign-extension / truncation visualization. BigInt-correct, fully client-side.",
  category: "developer",
  keywords: [
    "two's complement calculator", "signed binary converter",
    "two's complement with steps", "one's complement vs sign magnitude",
    "signed integer converter", "binary to decimal signed",
    "decimal to binary two's complement", "sign extension",
    "bit width converter", "overflow detection",
  ],
  icon: "binary",
  requiresNetwork: false,
  seo: {
    title: "Two's Complement / Signed Integer Calculator | UnQTools",
    faq: [
      {
        q: "What is two's complement and how is it computed?",
        a: "Two's complement is the standard way signed integers are represented in modern CPUs. For an N-bit value, the most-significant bit (MSB) is the sign bit (0 = non-negative, 1 = negative). To negate a value you invert every bit (one's complement) and then add 1 — this is the famous 'invert and add 1' rule. The tool shows this step-by-step so you can verify e.g. that −5 in 8-bit becomes 11111011.",
      },
      {
        q: "What is the valid range for each bit width?",
        a: "For N-bit two's complement, the representable range is −2^(N−1) … 2^(N−1) − 1. So 8-bit is −128 … 127, 16-bit is −32768 … 32767, 32-bit is −2147483648 … 2147483647, and 64-bit is −9223372036854775808 … 9223372036854775807. The tool always displays the current range and flags any input that falls outside it as an overflow.",
      },
      {
        q: "What is the difference between two's complement, one's complement, and sign-magnitude?",
        a: "Two's complement negates by inverting all bits and adding 1 (no ±0 ambiguity, single zero). One's complement negates by inverting all bits only (so +0 = 0000 and −0 = 1111 both exist). Sign-magnitude uses the MSB as a pure sign flag and the remaining bits as a magnitude (so −5 = 1_0000101 in 8-bit, with the same ±0 ambiguity). The tool shows all three representations side-by-side so you can compare them.",
      },
      {
        q: "How does sign-extension work when changing bit width?",
        a: "When you widen a two's-complement value, the new high-order bits are filled with copies of the original sign bit. So 8-bit 0xFB (−5) sign-extended to 16-bit becomes 0xFFFB. When you narrow, the high bits are simply dropped — if any of those dropped bits differ from the new sign bit, the value changes (overflow). The tool visualizes both directions whenever you change the width.",
      },
      {
        q: "What extra features does this tool have versus other two's-complement calculators?",
        a: "(1) Any width from 4 to 256 bits (preset 4/8/16/32/64 or custom). (2) All three representations — two's, one's, sign-magnitude — side-by-side. (3) Step-by-step negation panel showing invert → +1. (4) Clickable bit grid: click any bit to toggle and watch the decimal value update live. (5) MSB sign bit visually highlighted. (6) Per-bit weight tooltips (2^k). (7) Hex / octal / decimal / binary views simultaneously. (8) Live range display + overflow flag. (9) Sign-extension & truncation visualizer when width changes. (10) Handles the most-negative value (−2^(N−1)) which has no positive counterpart. (11) History (localStorage, last 20). (12) Shareable URL with full state round-trip. 100% client-side and offline — your values never leave the device.",
      },
    ],
  },
  status: "done",
};
