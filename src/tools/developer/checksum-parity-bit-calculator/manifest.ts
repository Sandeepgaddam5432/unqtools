/**
 * Checksum & Parity Bit Calculator — Tool Manifest.
 * Tool #378 — Category 4 (Developer & Code).
 *
 * Compute parity (even, odd, mark, space), LRC, sum checksums (8/16/32-bit,
 * one's/two's complement, Internet/RFC-1071), XOR, Fletcher-16/32, Adler-32,
 * CRC-8/CRC-16/CRC-32 (with parameterised polynomial), Luhn, Verhoeff and
 * ISBN-10/13 check digits — over ASCII, hex, or binary input, with bit-level
 * working, verify mode, and endianness control. 100% client-side.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "checksum-parity-bit-calculator",
  name: "Checksum & Parity Bit Calculator (LRC, Fletcher, Adler, CRC, Luhn, Verhoeff)",
  description:
    "Compute parity (even, odd, mark, space), LRC, sum checksums (8/16/32-bit, one's/two's complement, RFC-1071 Internet), XOR, Fletcher-16/32, Adler-32, CRC-8/16/32 (parameterised polynomial), Luhn, Verhoeff and ISBN-10/13 check digits over ASCII, hex, or binary input — with bit-level working, verify mode, endianness control, and history. 100% client-side & offline.",
  category: "developer",
  keywords: [
    "checksum calculator", "parity bit calculator", "parity bit",
    "LRC calculator", "longitudinal redundancy check",
    "Fletcher checksum", "Adler-32", "Internet checksum",
    "RFC 1071", "CRC calculator", "CRC-8", "CRC-16", "CRC-32",
    "Luhn algorithm", "Verhoeff algorithm", "ISBN check digit",
    "two's complement checksum", "one's complement checksum",
  ],
  icon: "shield-check",
  requiresNetwork: false,
  seo: {
    title: "Checksum & Parity Bit Calculator — LRC, Fletcher, Adler, CRC, Luhn, Verhoeff | UnQTools",
    faq: [
      {
        q: "Which checksum and parity schemes does this calculator support?",
        a: "Parity (even, odd, mark, space) per byte and aggregate; LRC (XOR across bytes); additive 8/16/32-bit sum with one's-complement, two's-complement and RFC-1071 Internet-checksum variants; XOR; Fletcher-16, Fletcher-32, Adler-32; CRC-8, CRC-16 and CRC-32 with a parameterised polynomial, init, final-XOR and reflect options; Luhn (credit-card / IMEI); Verhoeff (Aadhaar-style); ISBN-10 and ISBN-13 check digits. All outputs are computed locally in your browser.",
      },
      {
        q: "What input formats can I use?",
        a: "Three formats: ASCII text (each character's char-code becomes one byte), hex (space-, comma- or 0x-separated byte pairs), or binary (whitespace-separated groups of 8 bits). The tool auto-pads odd hex nibbles and validates binary digit groups, showing exactly which bytes were used so you can verify before trusting the checksum.",
      },
      {
        q: "How does verify mode work?",
        a: "Toggle Verify on, paste the data plus the expected check value, and the calculator flags match / mismatch for every scheme. This is handy for confirming CRC values from datasheets, validating ISBN barcodes, or sanity-checking Luhn numbers like credit cards and IMEIs without exposing the data anywhere.",
      },
      {
        q: "Why are there both one's-complement and two's-complement sum variants?",
        a: "One's-complement (with carry-folding) is what the RFC-1071 Internet checksum uses for IP/TCP/UDP headers; two's-complement is the more common unsigned additive checksum with the result negated. The tool exposes both plus raw sum, so you can match whichever convention your protocol or hardware datasheet specifies. Multi-byte sums also have an endianness toggle for little- vs big-endian byte order.",
      },
      {
        q: "What extra features does this tool have compared to other checksum calculators?",
        a: "(1) Parity even/odd/mark/space, per-byte and aggregate. (2) LRC (XOR). (3) 8/16/32-bit sum + one's/two's complement + Internet. (4) Fletcher-16/32, Adler-32. (5) CRC-8/16/32 with parameterised polynomial. (6) Luhn, Verhoeff, ISBN-10/13. (7) Three input formats (ASCII, hex, binary). (8) Endianness toggle. (9) Verify mode. (10) Bit-level working panel. (11) History (localStorage, last 20). (12) Shareable URL. 100% client-side and offline — your data never leaves the device.",
      },
    ],
  },
  status: "done",
};
