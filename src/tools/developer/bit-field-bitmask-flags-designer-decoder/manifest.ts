/**
 * Bit Field / Bitmask / Flags Designer & Decoder — Tool Manifest.
 * Tool #370 — Category 4 (Developer & Code).
 *
 * Visually define named single-bit flags and multi-bit fields within a word
 * (8/16/32/64-bit), validate non-overlap, encode named values into a packed
 * integer (bin/hex/dec), decode a packed integer back into named fields, and
 * generate ready-to-use code for C/C++, Rust bitflags!, Python IntFlag, Go
 * consts and TypeScript. Includes POSIX file-mode, TCP flags, FAT attrs, ARM
 * CPSR and x86 EFLAGS presets. 100% client-side, BigInt-correct at 64-bit.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "bit-field-bitmask-flags-designer-decoder",
  name: "Bit Field / Bitmask / Flags Designer & Decoder",
  description:
    "Design and decode bit fields / bitmasks visually. Define named single-bit flags and multi-bit fields within a word (8/16/32/64-bit), validate non-overlap, encode field values into a packed integer (bin/hex/dec), decode a packed integer back into named fields, and generate ready-to-compile code for C/C++, Rust bitflags!, Python IntFlag, Go consts and TypeScript. Includes POSIX file-mode, TCP flags, FAT attributes, ARM CPSR and x86 EFLAGS presets. 100% client-side and offline, BigInt-correct at 64-bit.",
  category: "developer",
  keywords: [
    "bitmask generator", "bit field decoder", "flags to integer",
    "decode register bits", "bitfield code generator", "bit flag designer",
    "register layout designer", "posix file mode bitmask", "tcp flags decoder",
    "bitmask code generator", "rust bitflags generator", "python intflag generator",
  ],
  icon: "cpu",
  requiresNetwork: false,
  seo: {
    title: "Bit Field / Bitmask / Flags Designer & Decoder | UnQTools",
    faq: [
      {
        q: "What is the difference between a bit flag and a multi-bit field?",
        a: "A single-bit flag occupies exactly one bit position and represents a boolean (set or clear) — e.g. TCP SYN at bit 1. A multi-bit field spans a contiguous range of bits (e.g. bits 2-3 = MODE) and can hold an integer value 0..(2^width - 1). This tool handles both in a single layout: you give each field a name, a start bit (LSB0 or MSB0 numbering) and a width, and the tool validates that fields do not overlap and stay within the chosen word width (8/16/32/64-bit).",
      },
      {
        q: "How does encoding and decoding work?",
        a: "Encoding: for each field you enter a value, the tool shifts it into the field's bit range and ORs the result into a packed integer (e.g. A=1, MODE=2 in a 4-bit layout → 0b1001). Decoding: you paste a packed integer in hex/binary/decimal, the tool extracts each field by masking and shifting, and shows the raw value, the enum label if any, and the boolean state for single-bit flags. All arithmetic uses BigInt so 64-bit layouts round-trip exactly with no Number precision loss.",
      },
      {
        q: "Which languages are supported for code generation?",
        a: "Five languages: C/C++ (anonymous struct with bitfields plus #define masks and shifts), Rust (bitflags! macro for the single-bit flags and const helpers for multi-bit fields), Python (IntFlag class with @property accessors), Go (const block with masks/shifts and getter/setter funcs), and TypeScript (const enum + helper functions). The generated code round-trips the layout you designed, so decoding in code matches the in-browser decode exactly.",
      },
      {
        q: "What presets are included?",
        a: "Five well-known real-world layouts: (1) POSIX file mode (12 bits — setuid/setgid/sticky + rwx × user/group/other), (2) TCP header flags (9 bits — CWR, ECE, URG, ACK, PSH, RST, SYN, FIN, NS), (3) FAT file attributes (8 bits — read-only, hidden, system, volume-label, directory, archive), (4) ARM CPSR (32-bit — mode bits, Thumb, FIQ/IRQ disable, etc.), and (5) x86 EFLAGS (selected status/control flags). Each preset is a complete layout you can edit and re-export as code.",
      },
      {
        q: "What extra features does this tool have versus other bitmask designers?",
        a: "(1) Mixed single-bit flags and multi-bit fields in one layout. (2) 8/16/32/64-bit word widths via BigInt (no JS Number precision loss). (3) LSB0 / MSB0 bit-numbering toggle. (4) Overlap & out-of-range validation with field-level error messages. (5) Enum value labels per field (e.g. MODE 0=off, 1=auto, 2=on). (6) Reserved-bit marking for unused regions. (7) Live encode + decode round-trip. (8) Code generation for C/C++, Rust, Python, Go and TypeScript. (9) Five real-world presets (POSIX mode, TCP, FAT, ARM CPSR, x86 EFLAGS). (10) Set/clear/toggle/test helper generation. (11) Save/load layouts in localStorage. (12) History (last 20). (13) Shareable URL with full layout round-trip. (14) Color-coded visual bit strip. 100% client-side and offline — your register definitions never leave the device.",
      },
    ],
  },
  status: "done",
};
