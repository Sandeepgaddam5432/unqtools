/**
 * Integer Data Type Range & Overflow Reference — Tool Manifest.
 * Tool #372 — Category 4 (Developer & Code).
 *
 * An interactive reference for the min/max range, bit width, and overflow
 * behavior of integer types across C/C++, Rust, Go, Java, C#, JavaScript and
 * Python — plus a calculator that shows what happens when a value overflows
 * or wraps in a given type. Curated dataset (BigInt-accurate), format
 * specifiers, copyable language constants. 100% client-side.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "integer-data-type-range-overflow-reference",
  name: "Integer Data Type Range & Overflow Reference",
  description:
    "Reference table for integer types (int8, uint8, int16, …, int64, uint64, size_t, intptr_t, byte, char, short, long, i32, u64, isize, usize) across C/C++, Rust, Go, Java, C#, JavaScript and Python. Show min/max (BigInt-exact), bit width, overflow behavior, format specifiers and copyable language constants. Interactive overflow calculator — enter a value and a type, see whether it fits and exactly how it wraps/saturates/panics/errors per language. 100% client-side, no network.",
  category: "developer",
  keywords: [
    "integer range", "int8 range", "uint8 max", "int32 max",
    "int64 max", "uint64 max", "size_t max", "intptr_t range",
    "integer overflow", "overflow calculator", "int overflow simulator",
    "c integer types", "rust integer types", "go integer types",
    "java integer types", "c sharp integer types", "format specifier",
    "int max value", "uint max value", "twos complement range",
    "min int max int", "language comparison integer",
  ],
  icon: "binary",
  requiresNetwork: false,
  seo: {
    title: "Integer Data Type Range & Overflow Reference (int8–uint64, size_t, intptr_t) | UnQTools",
    faq: [
      {
        q: "Which integer types and languages does the reference cover?",
        a: "All common fixed-width integer types across seven languages: C/C++ (int8_t/uint8_t/int16_t/uint16_t/int32_t/uint32_t/int64_t/uint64_t, char/short/int/long/long long, size_t, intptr_t/uintptr_t, ptrdiff_t), Rust (i8/u8/i16/u16/i32/u32/i64/u64/i128/u128/isize/usize), Go (int8/uint8/int16/uint16/int32/uint32/int64/uint64, int/uint/uintptr, byte/rune), Java (byte/short/int/long/char — no unsigned), C# (sbyte/byte/short/ushort/int/uint/long/ulong, nint/nuint), JavaScript (Number safe-int range and BigInt), and Python (int — arbitrary precision). Each entry shows the exact min/max using BigInt, the bit width, signed/unsigned flag, the printf-style format specifier where applicable, and the language's named constant (e.g. INT_MAX, i32::MAX, math.MaxInt32, Integer.MAX_VALUE).",
      },
      {
        q: "How does the overflow calculator work?",
        a: "Type any integer (decimal, 0x hex, 0b binary or 0o octal) and pick a target type. The calculator tells you whether the value fits in that type and, if it doesn't, exactly how each language would treat it: C/C++ signed overflow is undefined behavior (UB) while unsigned wraps modulo 2^N; Rust panics in debug builds and wraps modulo 2^N in release; Go always wraps modulo 2^N for both signed and unsigned; Java wraps modulo 2^N (two's complement) and has no unsigned types; C# wraps in unchecked context and throws OverflowException in checked context; JavaScript Number loses precision beyond 2^53; Python ints never overflow. The wrapped/stored bit pattern is shown in decimal, hex and binary.",
      },
      {
        q: "Are the min/max values really exact for 64-bit and 128-bit types?",
        a: "Yes. All range math is done with native JavaScript BigInt, so int64's −9,223,372,036,854,775,808 to 9,223,372,036,854,775,807, uint64's 0 to 18,446,744,073,709,551,615, and even Rust's i128/u128 (−170,141,183,460,469,231,731,687,303,715,884,105,728 to 170,141,183,460,469,231,731,687,303,715,884,105,727) are computed exactly. There is no floating-point loss anywhere — BigInt is exact by definition.",
      },
      {
        q: "Does it really reflect how each language behaves on overflow?",
        a: "It reflects the documented semantics. C/C++ signed overflow is UB by the standard (so we label it as such, even if many compilers wrap in practice); C/C++ unsigned arithmetic is defined to wrap mod 2^N. Rust's debug-panic vs release-wrap distinction is encoded. Go's spec defines two's-complement wrapping for both signed and unsigned. Java's JLS defines wraparound. C# distinguishes checked vs unchecked arithmetic. JS Number follows IEEE-754 double precision (53-bit mantissa), and BigInt is unbounded. Python ints are unbounded. Real programs can still differ due to compiler flags, optimization levels, UB exploitation, or compiler-specific intrinsics — always verify on your target.",
      },
      {
        q: "What extra features does this tool have versus a static cheatsheet?",
        a: "(1) Cross-language comparison view for one type family (e.g. int32 → C int32_t, Rust i32, Go int32, Java int, C# int). (2) Interactive overflow simulator with per-language semantics labels (wrap/panic/UB/saturate/promote-to-bignum). (3) Copyable language constants (INT_MAX, i32::MAX, math.MaxInt32, Integer.MAX_VALUE, int.MaxValue, …) with one-click copy. (4) printf / fmt / format-specifier column. (5) Input accepts decimal, 0x hex, 0b binary, 0o octal with underscores. (6) Signed/unsigned toggle for the calculator. (7) Search/filter across type names, languages and bit widths. (8) Result of overflow shown in decimal, hex and binary. (9) History (localStorage, last 20, clickable to reload). (10) Shareable URL with the input + type + language encoded. (11) Bit-grid visualization of the wrapped result. (12) Overflow semantics cheatsheet card per language. 100% client-side and offline — your numbers never leave the device.",
      },
    ],
  },
  status: "done",
};
