/**
 * Endianness (Byte Order) Converter — Tool Manifest.
 * Tool #371 — Category 4 (Developer & Code).
 *
 * Convert byte order between big-endian, little-endian and middle-endian
 * (PDP-11) across 16/32/64-bit words. Decodes each ordering as signed /
 * unsigned integer and IEEE 754 float32 / float64 simultaneously, with
 * batch byte-array conversion, per-byte visualization, and shareable URLs.
 * 100% client-side, BigInt-correct at 64-bit.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "endianness-byte-order-converter",
  name: "Endianness (Byte Order) Converter",
  description:
    "Convert byte order between big-endian, little-endian and middle-endian (PDP-11) across 16/32/64-bit words. Each ordering is decoded simultaneously as signed / unsigned integer and IEEE 754 float32 / float64, with batch byte-array splitting, per-byte visualization with endianness role labels, and shareable URLs. 100% client-side and offline, BigInt-correct at 64-bit.",
  category: "developer",
  keywords: [
    "endianness converter", "byte order swap", "big endian little endian converter",
    "byte swap tool", "pdp-11 middle endian", "mixed endian", "16 bit 32 bit 64 bit swap",
    "hex byte converter", "ieee 754 float decoder", "data view decoder",
  ],
  icon: "arrow-left-right",
  requiresNetwork: false,
  seo: {
    title: "Endianness (Byte Order) Converter — BE / LE / PDP | UnQTools",
    faq: [
      {
        q: "What is endianness and why does byte order matter?",
        a: "Endianness is the order in which multi-byte values are stored in memory. Big-endian (BE) stores the most significant byte first (lowest address); little-endian (LE) stores the least significant byte first. Network protocols (TCP/IP) use BE, while x86/ARM CPUs mostly use LE. When binary data crosses an endianness boundary you must swap the bytes or you will read a completely different value — e.g. bytes 0A 0B 0C 0D represent 168,496,141 as BE but 218,893,066 as LE.",
      },
      {
        q: "What is middle-endian (PDP-11) byte order?",
        a: "PDP-11 middle-endian is a historical 32-bit format used by the PDP-11 minicomputer: the value is split into two 16-bit words stored high-word-first, but each 16-bit word is internally little-endian. So 0x0A0B0C0D is stored as bytes 0B 0A 0D 0C (rather than 0A 0B 0C 0D for BE or 0D 0C 0B 0A for LE). This tool is one of the few that handles PDP-11 alongside BE and LE for 16/32/64-bit words.",
      },
      {
        q: "How are integers and floats decoded for each byte order?",
        a: "For each of the three orderings (BE, LE, PDP) the tool decodes the same bytes four ways: unsigned integer, signed integer (two's-complement at the chosen width), IEEE 754 float32 (4-byte words), and IEEE 754 float64 (8-byte words). All integer arithmetic uses BigInt so 64-bit values are exact — no JavaScript Number precision loss. Float decoding uses DataView so NaN, Infinity and denormals all round-trip correctly.",
      },
      {
        q: "What happens if my input length doesn't match the word size?",
        a: "If your input has fewer bytes than the word size, the tool left-pads with zero bytes (the high-order side) and warns you. If your input has more bytes than the word size, the tool truncates to the low-order bytes and warns. For batch conversion (splitting a long byte array into words), the final partial word is zero-padded so every word decodes cleanly. Empty input returns an explicit error rather than a silent zero.",
      },
      {
        q: "What extra features does this tool have versus other endianness converters?",
        a: "(1) Three byte orders in one view: BE, LE and PDP-11 middle-endian. (2) 16/32/64-bit word sizes, BigInt-correct. (3) Simultaneous signed/unsigned integer + float32 + float64 decoding per ordering. (4) Mixed hex input formats — accepts 0x prefix, space/colon/dash/underscore/comma separators, lowercase/uppercase. (5) Batch conversion splits a byte array into multiple words. (6) Per-byte visualization showing each byte's role in BE/LE/PDP (B0=LSB … B3=MSB). (7) C array export for use in code. (8) NaN/Infinity/denormal float support. (9) Non-aligned input handling with clear warnings. (10) History (localStorage, last 20). (11) Shareable URL with input + word size. (12) Copy buttons for every output. 100% client-side and offline — your bytes never leave the device.",
      },
    ],
  },
  status: "done",
};
