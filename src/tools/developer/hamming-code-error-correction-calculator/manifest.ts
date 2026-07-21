/**
 * Hamming Code Error-Correction Calculator — Tool Manifest.
 * Tool #380 — Category 4 (Developer & Code).
 *
 * Encode data bits into Hamming codes (Hamming(7,4), Hamming(15,11),
 * Hamming(31,26)) with parity bits at powers of two, decode received
 * codewords by computing the syndrome, correct any single-bit error,
 * and detect (not correct) double-bit errors via SECDED extended
 * Hamming. 100% client-side.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "hamming-code-error-correction-calculator",
  name: "Hamming Code Error-Correction Calculator",
  description:
    "Encode data bits into Hamming(7,4), Hamming(15,11), or Hamming(31,26) codes with parity at powers of two, decode received codewords via the syndrome, correct any single-bit error, and detect double-bit errors with SECDED extended Hamming. Interactive bit-flip error injection, per-parity-bit coverage display, even/odd parity mode, copy codeword, history (localStorage), and shareable URL. 100% client-side.",
  category: "developer",
  keywords: [
    "hamming code", "hamming(7,4)", "hamming(15,11)", "hamming(31,26)",
    "error correction code", "ecc calculator", "secded",
    "syndrome decoder", "single error correction", "double error detection",
    "parity bit", "hamming encode decode",
  ],
  icon: "binary",
  requiresNetwork: false,
  seo: {
    title: "Hamming Code Error-Correction Calculator — Encode / Decode / SECDED | UnQTools",
    faq: [
      {
        q: "What is a Hamming code and how does it correct errors?",
        a: "A Hamming code is a linear error-correcting code that places parity bits at positions 1, 2, 4, 8, 16, … (powers of two) of a codeword. Each parity bit covers all positions whose binary address has the corresponding bit set. When a codeword is received, the decoder XORs those covered bits to compute a syndrome: syndrome = 0 means no error, syndrome = p means position p was flipped and can be corrected by flipping it back. Standard Hamming corrects any single-bit error per codeword.",
      },
      {
        q: "What is SECDED and how does it differ from plain Hamming?",
        a: "SECDED (Single-Error Correction, Double-Error Detection) adds one extra overall parity bit covering the entire codeword. With it, the decoder can still correct any single-bit error AND detect (but not correct) any two-bit error. The rule: syndrome = 0 with overall parity OK = no error; syndrome ≠ 0 with overall parity mismatch = correctable single error at the syndrome position; syndrome ≠ 0 with overall parity OK = uncorrectable double-bit error; syndrome = 0 with overall parity mismatch = error in the overall parity bit itself.",
      },
      {
        q: "Which Hamming code variants are supported?",
        a: "Three standard variants: Hamming(7,4) with 4 data bits and 3 parity bits, Hamming(15,11) with 11 data bits and 4 parity bits, and Hamming(31,26) with 26 data bits and 5 parity bits. You can also let the tool auto-pick the smallest variant that fits your data length, or use the arbitrary-length encoder that computes p = ⌈log2(k + p + 1)⌉ for any k.",
      },
      {
        q: "Can I inject an error and watch the decoder correct it?",
        a: "Yes. After encoding, click any bit (parity or data) to flip it and inject a single-bit error — the decoder recomputes the syndrome live, highlights the flipped position, corrects it, and shows the recovered data. For double-bit-error testing with SECDED enabled, flip two positions and the tool flags the uncorrectable double error instead of miscorrecting.",
      },
      {
        q: "What extra features does this tool have versus other Hamming calculators?",
        a: "(1) Three standard variants plus arbitrary-length encoding. (2) Even/odd parity mode toggle. (3) Per-parity-bit coverage display (which positions each parity bit covers and the values it sees). (4) Live syndrome computation with binary display. (5) Interactive single- and multi-bit error injection. (6) SECDED extended Hamming with double-error detection. (7) Step-by-step corrected codeword and recovered data. (8) Copy codeword / recovered data. (9) History (localStorage, last 20). (10) Shareable URL with full state encoded. (11) Color-coded parity vs data bits. (12) Auto-variant picker. 100% client-side — no uploads, no ads.",
      },
    ],
  },
  status: "done",
};
