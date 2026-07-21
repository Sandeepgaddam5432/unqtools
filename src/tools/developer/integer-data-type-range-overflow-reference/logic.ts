/**
 * Integer Data Type Range & Overflow Reference — pure logic.
 *
 * Curated BigInt-accurate dataset of fixed-width integer types across
 * C/C++, Rust, Go, Java, C#, JavaScript and Python. Includes an interactive
 * overflow simulator that reflects each language's documented wrap / panic /
 * UB / saturate / promote-to-bignum semantics, plus format specifiers and
 * copyable language constants.
 *
 * Pure functions only — no DOM, no network. 100% client-side.
 */

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

export type Language =
  | "c"
  | "rust"
  | "go"
  | "java"
  | "csharp"
  | "javascript"
  | "python";

export const LANGUAGES: Language[] = [
  "c", "rust", "go", "java", "csharp", "javascript", "python",
];

export const LANGUAGE_LABELS: Record<Language, string> = {
  c: "C / C++",
  rust: "Rust",
  go: "Go",
  java: "Java",
  csharp: "C#",
  javascript: "JavaScript",
  python: "Python",
};

/** Cross-language type-family buckets for comparison view. */
export type TypeFamily =
  | "int8"
  | "uint8"
  | "int16"
  | "uint16"
  | "int32"
  | "uint32"
  | "int64"
  | "uint64"
  | "int128"
  | "uint128"
  | "isize"
  | "usize"
  | "char16"
  | "bignum";

export const TYPE_FAMILIES: TypeFamily[] = [
  "int8", "uint8",
  "int16", "uint16",
  "int32", "uint32",
  "int64", "uint64",
  "int128", "uint128",
  "isize", "usize",
  "char16",
  "bignum",
];

export const FAMILY_LABELS: Record<TypeFamily, string> = {
  int8: "8-bit signed",
  uint8: "8-bit unsigned",
  int16: "16-bit signed",
  uint16: "16-bit unsigned",
  int32: "32-bit signed",
  uint32: "32-bit unsigned",
  int64: "64-bit signed",
  uint64: "64-bit unsigned",
  int128: "128-bit signed",
  uint128: "128-bit unsigned",
  isize: "Pointer-sized signed",
  usize: "Pointer-sized unsigned",
  char16: "16-bit char",
  bignum: "Arbitrary precision",
};

/** Overflow behavior labels. */
export type OverflowBehavior =
  | "wrap"     // modular wraparound mod 2^N
  | "ub"       // undefined behavior (C/C++ signed)
  | "panic"    // Rust debug-build panic
  | "throw"    // C# checked context OverflowException
  | "lossy"    // JS Number precision loss
  | "none"     // Python / BigInt — no overflow possible
  | "saturate"; // (rare, e.g. some DSP intrinsics — included for completeness)

export const OVERFLOW_BEHAVIOR_LABELS: Record<OverflowBehavior, string> = {
  wrap: "Wraps (modular)",
  ub: "Undefined behavior",
  panic: "Panics (debug)",
  throw: "Throws OverflowException",
  lossy: "Precision loss",
  none: "No overflow",
  saturate: "Saturates",
};

/** Build / compilation mode that affects overflow behavior. */
export type BuildMode = "default" | "debug" | "release" | "checked" | "unchecked";

export const BUILD_MODES: BuildMode[] = [
  "default", "debug", "release", "checked", "unchecked",
];

export const BUILD_MODE_LABELS: Record<BuildMode, string> = {
  default: "Default",
  debug: "Debug",
  release: "Release",
  checked: "Checked",
  unchecked: "Unchecked",
};

export interface IntegerType {
  /** Stable unique id, kebab-case. */
  id: string;
  /** Display name (e.g. "int32_t", "i32", "rust i32"). */
  name: string;
  /** Language. */
  language: Language;
  /** Cross-language family for comparison view. */
  family: TypeFamily;
  /** Bit width (BigInt-safe — up to 128 here). 0 means unbounded. */
  bits: number;
  /** True if signed (two's complement). */
  signed: boolean;
  /** Exact minimum value (BigInt). */
  min: bigint;
  /** Exact maximum value (BigInt). */
  max: bigint;
  /** printf / fmt / String.format format specifier, if applicable. */
  formatSpec?: string;
  /** Language-specific named constant (e.g. "INT32_MAX", "i32::MAX"). */
  constantMin?: string;
  constantMax?: string;
  /** Short overflow-behavior note for this type. */
  overflowNote?: string;
}

// ---------------------------------------------------------------------------
// Curated dataset
// ---------------------------------------------------------------------------

function makeFixedWidth(bits: number, signed: boolean): { min: bigint; max: bigint } {
  const w = BigInt(bits);
  if (signed) {
    const min = -(1n << (w - 1n));
    const max = (1n << (w - 1n)) - 1n;
    return { min, max };
  }
  return { min: 0n, max: (1n << w) - 1n };
}

// C/C++ signed UB note — used by many C types.
const C_SIGNED_OVERFLOW = "Signed overflow is UB in C/C++; unsigned wraps mod 2^N.";

export const INTEGER_TYPES: IntegerType[] = [
  // ----- C / C++ fixed-width -----
  {
    id: "c-int8_t", name: "int8_t", language: "c", family: "int8",
    bits: 8, signed: true, ...makeFixedWidth(8, true),
    formatSpec: "%hhd / PRId8", constantMin: "INT8_MIN", constantMax: "INT8_MAX",
    overflowNote: C_SIGNED_OVERFLOW,
  },
  {
    id: "c-uint8_t", name: "uint8_t", language: "c", family: "uint8",
    bits: 8, signed: false, ...makeFixedWidth(8, false),
    formatSpec: "%hhu / PRIu8", constantMin: "0", constantMax: "UINT8_MAX",
    overflowNote: "Unsigned arithmetic wraps mod 2^N (well-defined).",
  },
  {
    id: "c-int16_t", name: "int16_t", language: "c", family: "int16",
    bits: 16, signed: true, ...makeFixedWidth(16, true),
    formatSpec: "%hd / PRId16", constantMin: "INT16_MIN", constantMax: "INT16_MAX",
    overflowNote: C_SIGNED_OVERFLOW,
  },
  {
    id: "c-uint16_t", name: "uint16_t", language: "c", family: "uint16",
    bits: 16, signed: false, ...makeFixedWidth(16, false),
    formatSpec: "%hu / PRIu16", constantMin: "0", constantMax: "UINT16_MAX",
    overflowNote: "Unsigned arithmetic wraps mod 2^N.",
  },
  {
    id: "c-int32_t", name: "int32_t", language: "c", family: "int32",
    bits: 32, signed: true, ...makeFixedWidth(32, true),
    formatSpec: "%d / PRId32", constantMin: "INT32_MIN", constantMax: "INT32_MAX",
    overflowNote: C_SIGNED_OVERFLOW,
  },
  {
    id: "c-uint32_t", name: "uint32_t", language: "c", family: "uint32",
    bits: 32, signed: false, ...makeFixedWidth(32, false),
    formatSpec: "%u / PRIu32", constantMin: "0", constantMax: "UINT32_MAX",
    overflowNote: "Unsigned arithmetic wraps mod 2^N.",
  },
  {
    id: "c-int64_t", name: "int64_t", language: "c", family: "int64",
    bits: 64, signed: true, ...makeFixedWidth(64, true),
    formatSpec: "%lld / PRId64", constantMin: "INT64_MIN", constantMax: "INT64_MAX",
    overflowNote: C_SIGNED_OVERFLOW,
  },
  {
    id: "c-uint64_t", name: "uint64_t", language: "c", family: "uint64",
    bits: 64, signed: false, ...makeFixedWidth(64, false),
    formatSpec: "%llu / PRIu64", constantMin: "0", constantMax: "UINT64_MAX",
    overflowNote: "Unsigned arithmetic wraps mod 2^N.",
  },
  // C/C++ conventional types (LP64 / ILP32 assumptions noted)
  {
    id: "c-char", name: "char", language: "c", family: "int8",
    bits: 8, signed: true, ...makeFixedWidth(8, true),
    formatSpec: "%c / %hhd", constantMin: "SCHAR_MIN", constantMax: "SCHAR_MAX",
    overflowNote: "Signedness of `char` is implementation-defined. Treated as signed here.",
  },
  {
    id: "c-unsigned-char", name: "unsigned char", language: "c", family: "uint8",
    bits: 8, signed: false, ...makeFixedWidth(8, false),
    formatSpec: "%hhu", constantMin: "0", constantMax: "UCHAR_MAX",
    overflowNote: "Wraps mod 2^N.",
  },
  {
    id: "c-short", name: "short", language: "c", family: "int16",
    bits: 16, signed: true, ...makeFixedWidth(16, true),
    formatSpec: "%hd", constantMin: "SHRT_MIN", constantMax: "SHRT_MAX",
    overflowNote: C_SIGNED_OVERFLOW,
  },
  {
    id: "c-unsigned-short", name: "unsigned short", language: "c", family: "uint16",
    bits: 16, signed: false, ...makeFixedWidth(16, false),
    formatSpec: "%hu", constantMin: "0", constantMax: "USHRT_MAX",
    overflowNote: "Wraps mod 2^N.",
  },
  {
    id: "c-int", name: "int", language: "c", family: "int32",
    bits: 32, signed: true, ...makeFixedWidth(32, true),
    formatSpec: "%d", constantMin: "INT_MIN", constantMax: "INT_MAX",
    overflowNote: C_SIGNED_OVERFLOW + " (Assumes 32-bit int.)",
  },
  {
    id: "c-unsigned-int", name: "unsigned int", language: "c", family: "uint32",
    bits: 32, signed: false, ...makeFixedWidth(32, false),
    formatSpec: "%u", constantMin: "0", constantMax: "UINT_MAX",
    overflowNote: "Wraps mod 2^N. (Assumes 32-bit int.)",
  },
  {
    id: "c-long", name: "long", language: "c", family: "int64",
    bits: 64, signed: true, ...makeFixedWidth(64, true),
    formatSpec: "%ld", constantMin: "LONG_MIN", constantMax: "LONG_MAX",
    overflowNote: C_SIGNED_OVERFLOW + " (LP64: 64-bit long.)",
  },
  {
    id: "c-unsigned-long", name: "unsigned long", language: "c", family: "uint64",
    bits: 64, signed: false, ...makeFixedWidth(64, false),
    formatSpec: "%lu", constantMin: "0", constantMax: "ULONG_MAX",
    overflowNote: "Wraps mod 2^N. (LP64: 64-bit long.)",
  },
  {
    id: "c-long-long", name: "long long", language: "c", family: "int64",
    bits: 64, signed: true, ...makeFixedWidth(64, true),
    formatSpec: "%lld", constantMin: "LLONG_MIN", constantMax: "LLONG_MAX",
    overflowNote: C_SIGNED_OVERFLOW,
  },
  {
    id: "c-unsigned-long-long", name: "unsigned long long", language: "c", family: "uint64",
    bits: 64, signed: false, ...makeFixedWidth(64, false),
    formatSpec: "%llu", constantMin: "0", constantMax: "ULLONG_MAX",
    overflowNote: "Wraps mod 2^N.",
  },
  {
    id: "c-size_t", name: "size_t", language: "c", family: "usize",
    bits: 64, signed: false, ...makeFixedWidth(64, false),
    formatSpec: "%zu", constantMin: "0", constantMax: "SIZE_MAX",
    overflowNote: "Unsigned; wraps mod 2^N. (LP64: 64-bit.)",
  },
  {
    id: "c-intptr_t", name: "intptr_t", language: "c", family: "isize",
    bits: 64, signed: true, ...makeFixedWidth(64, true),
    formatSpec: "%ld / PRIdPTR", constantMin: "INTPTR_MIN", constantMax: "INTPTR_MAX",
    overflowNote: C_SIGNED_OVERFLOW + " (LP64: 64-bit.)",
  },
  {
    id: "c-uintptr_t", name: "uintptr_t", language: "c", family: "usize",
    bits: 64, signed: false, ...makeFixedWidth(64, false),
    formatSpec: "%lu / PRIuPTR", constantMin: "0", constantMax: "UINTPTR_MAX",
    overflowNote: "Unsigned; wraps mod 2^N. (LP64: 64-bit.)",
  },
  {
    id: "c-ptrdiff_t", name: "ptrdiff_t", language: "c", family: "isize",
    bits: 64, signed: true, ...makeFixedWidth(64, true),
    formatSpec: "%td", constantMin: "PTRDIFF_MIN", constantMax: "PTRDIFF_MAX",
    overflowNote: C_SIGNED_OVERFLOW + " (LP64: 64-bit.)",
  },

  // ----- Rust -----
  {
    id: "rust-i8", name: "i8", language: "rust", family: "int8",
    bits: 8, signed: true, ...makeFixedWidth(8, true),
    constantMin: "i8::MIN", constantMax: "i8::MAX",
    overflowNote: "Debug: panics. Release: wraps mod 2^N. Use wrapping_* / checked_* / saturating_*.",
  },
  {
    id: "rust-u8", name: "u8", language: "rust", family: "uint8",
    bits: 8, signed: false, ...makeFixedWidth(8, false),
    constantMin: "u8::MIN", constantMax: "u8::MAX",
    overflowNote: "Debug: panics. Release: wraps mod 2^N.",
  },
  {
    id: "rust-i16", name: "i16", language: "rust", family: "int16",
    bits: 16, signed: true, ...makeFixedWidth(16, true),
    constantMin: "i16::MIN", constantMax: "i16::MAX",
    overflowNote: "Debug: panics. Release: wraps mod 2^N.",
  },
  {
    id: "rust-u16", name: "u16", language: "rust", family: "uint16",
    bits: 16, signed: false, ...makeFixedWidth(16, false),
    constantMin: "u16::MIN", constantMax: "u16::MAX",
    overflowNote: "Debug: panics. Release: wraps mod 2^N.",
  },
  {
    id: "rust-i32", name: "i32", language: "rust", family: "int32",
    bits: 32, signed: true, ...makeFixedWidth(32, true),
    constantMin: "i32::MIN", constantMax: "i32::MAX",
    overflowNote: "Debug: panics. Release: wraps mod 2^N. Default integer type.",
  },
  {
    id: "rust-u32", name: "u32", language: "rust", family: "uint32",
    bits: 32, signed: false, ...makeFixedWidth(32, false),
    constantMin: "u32::MIN", constantMax: "u32::MAX",
    overflowNote: "Debug: panics. Release: wraps mod 2^N.",
  },
  {
    id: "rust-i64", name: "i64", language: "rust", family: "int64",
    bits: 64, signed: true, ...makeFixedWidth(64, true),
    constantMin: "i64::MIN", constantMax: "i64::MAX",
    overflowNote: "Debug: panics. Release: wraps mod 2^N.",
  },
  {
    id: "rust-u64", name: "u64", language: "rust", family: "uint64",
    bits: 64, signed: false, ...makeFixedWidth(64, false),
    constantMin: "u64::MIN", constantMax: "u64::MAX",
    overflowNote: "Debug: panics. Release: wraps mod 2^N.",
  },
  {
    id: "rust-i128", name: "i128", language: "rust", family: "int128",
    bits: 128, signed: true, ...makeFixedWidth(128, true),
    constantMin: "i128::MIN", constantMax: "i128::MAX",
    overflowNote: "Debug: panics. Release: wraps mod 2^N.",
  },
  {
    id: "rust-u128", name: "u128", language: "rust", family: "uint128",
    bits: 128, signed: false, ...makeFixedWidth(128, false),
    constantMin: "u128::MIN", constantMax: "u128::MAX",
    overflowNote: "Debug: panics. Release: wraps mod 2^N.",
  },
  {
    id: "rust-isize", name: "isize", language: "rust", family: "isize",
    bits: 64, signed: true, ...makeFixedWidth(64, true),
    constantMin: "isize::MIN", constantMax: "isize::MAX",
    overflowNote: "Pointer-sized. 64-bit on 64-bit targets. Debug panics, release wraps.",
  },
  {
    id: "rust-usize", name: "usize", language: "rust", family: "usize",
    bits: 64, signed: false, ...makeFixedWidth(64, false),
    constantMin: "usize::MIN", constantMax: "usize::MAX",
    overflowNote: "Pointer-sized. 64-bit on 64-bit targets. Debug panics, release wraps.",
  },

  // ----- Go -----
  {
    id: "go-int8", name: "int8", language: "go", family: "int8",
    bits: 8, signed: true, ...makeFixedWidth(8, true),
    constantMin: "math.MinInt8", constantMax: "math.MaxInt8",
    overflowNote: "Always wraps mod 2^N (two's complement). Use math/bits Add/Sub/etc. for checked ops.",
  },
  {
    id: "go-uint8", name: "uint8 / byte", language: "go", family: "uint8",
    bits: 8, signed: false, ...makeFixedWidth(8, false),
    constantMin: "0", constantMax: "math.MaxUint8",
    overflowNote: "Always wraps mod 2^N. byte is an alias for uint8.",
  },
  {
    id: "go-int16", name: "int16", language: "go", family: "int16",
    bits: 16, signed: true, ...makeFixedWidth(16, true),
    constantMin: "math.MinInt16", constantMax: "math.MaxInt16",
    overflowNote: "Always wraps mod 2^N.",
  },
  {
    id: "go-uint16", name: "uint16", language: "go", family: "uint16",
    bits: 16, signed: false, ...makeFixedWidth(16, false),
    constantMin: "0", constantMax: "math.MaxUint16",
    overflowNote: "Always wraps mod 2^N.",
  },
  {
    id: "go-int32", name: "int32 / rune", language: "go", family: "int32",
    bits: 32, signed: true, ...makeFixedWidth(32, true),
    constantMin: "math.MinInt32", constantMax: "math.MaxInt32",
    overflowNote: "Always wraps mod 2^N. rune is an alias for int32.",
  },
  {
    id: "go-uint32", name: "uint32", language: "go", family: "uint32",
    bits: 32, signed: false, ...makeFixedWidth(32, false),
    constantMin: "0", constantMax: "math.MaxUint32",
    overflowNote: "Always wraps mod 2^N.",
  },
  {
    id: "go-int64", name: "int64", language: "go", family: "int64",
    bits: 64, signed: true, ...makeFixedWidth(64, true),
    constantMin: "math.MinInt64", constantMax: "math.MaxInt64",
    overflowNote: "Always wraps mod 2^N.",
  },
  {
    id: "go-uint64", name: "uint64", language: "go", family: "uint64",
    bits: 64, signed: false, ...makeFixedWidth(64, false),
    constantMin: "0", constantMax: "math.MaxUint64",
    overflowNote: "Always wraps mod 2^N.",
  },
  {
    id: "go-int", name: "int", language: "go", family: "int64",
    bits: 64, signed: true, ...makeFixedWidth(64, true),
    constantMin: "math.MinInt", constantMax: "math.MaxInt",
    overflowNote: "Platform-sized (64-bit on 64-bit targets). Wraps mod 2^N.",
  },
  {
    id: "go-uint", name: "uint", language: "go", family: "uint64",
    bits: 64, signed: false, ...makeFixedWidth(64, false),
    constantMin: "0", constantMax: "math.MaxUint",
    overflowNote: "Platform-sized (64-bit on 64-bit targets). Wraps mod 2^N.",
  },
  {
    id: "go-uintptr", name: "uintptr", language: "go", family: "usize",
    bits: 64, signed: false, ...makeFixedWidth(64, false),
    constantMin: "0", constantMax: "math.MaxUint64",
    overflowNote: "Unsigned pointer-sized. Wraps mod 2^N.",
  },

  // ----- Java -----
  {
    id: "java-byte", name: "byte", language: "java", family: "int8",
    bits: 8, signed: true, ...makeFixedWidth(8, true),
    formatSpec: "%d", constantMin: "Byte.MIN_VALUE", constantMax: "Byte.MAX_VALUE",
    overflowNote: "Always wraps mod 2^N. No unsigned types in Java. Use Math.addExact for checked ops.",
  },
  {
    id: "java-short", name: "short", language: "java", family: "int16",
    bits: 16, signed: true, ...makeFixedWidth(16, true),
    formatSpec: "%d", constantMin: "Short.MIN_VALUE", constantMax: "Short.MAX_VALUE",
    overflowNote: "Always wraps mod 2^N.",
  },
  {
    id: "java-int", name: "int", language: "java", family: "int32",
    bits: 32, signed: true, ...makeFixedWidth(32, true),
    formatSpec: "%d", constantMin: "Integer.MIN_VALUE", constantMax: "Integer.MAX_VALUE",
    overflowNote: "Always wraps mod 2^N. Use Math.*Exact for checked operations.",
  },
  {
    id: "java-long", name: "long", language: "java", family: "int64",
    bits: 64, signed: true, ...makeFixedWidth(64, true),
    formatSpec: "%d", constantMin: "Long.MIN_VALUE", constantMax: "Long.MAX_VALUE",
    overflowNote: "Always wraps mod 2^N.",
  },
  {
    id: "java-char", name: "char", language: "java", family: "char16",
    bits: 16, signed: false, ...makeFixedWidth(16, false),
    formatSpec: "%c", constantMin: "Character.MIN_VALUE", constantMax: "Character.MAX_VALUE",
    overflowNote: "Only unsigned 16-bit type in Java. Wraps mod 2^16.",
  },

  // ----- C# -----
  {
    id: "csharp-sbyte", name: "sbyte", language: "csharp", family: "int8",
    bits: 8, signed: true, ...makeFixedWidth(8, true),
    formatSpec: "{0:d}", constantMin: "sbyte.MinValue", constantMax: "sbyte.MaxValue",
    overflowNote: "unchecked: wraps mod 2^N. checked: throws OverflowException.",
  },
  {
    id: "csharp-byte", name: "byte", language: "csharp", family: "uint8",
    bits: 8, signed: false, ...makeFixedWidth(8, false),
    formatSpec: "{0:d}", constantMin: "byte.MinValue", constantMax: "byte.MaxValue",
    overflowNote: "unchecked: wraps mod 2^N. checked: throws OverflowException.",
  },
  {
    id: "csharp-short", name: "short", language: "csharp", family: "int16",
    bits: 16, signed: true, ...makeFixedWidth(16, true),
    formatSpec: "{0:d}", constantMin: "short.MinValue", constantMax: "short.MaxValue",
    overflowNote: "unchecked: wraps. checked: throws OverflowException.",
  },
  {
    id: "csharp-ushort", name: "ushort", language: "csharp", family: "uint16",
    bits: 16, signed: false, ...makeFixedWidth(16, false),
    formatSpec: "{0:d}", constantMin: "ushort.MinValue", constantMax: "ushort.MaxValue",
    overflowNote: "unchecked: wraps. checked: throws OverflowException.",
  },
  {
    id: "csharp-int", name: "int", language: "csharp", family: "int32",
    bits: 32, signed: true, ...makeFixedWidth(32, true),
    formatSpec: "{0:d}", constantMin: "int.MinValue", constantMax: "int.MaxValue",
    overflowNote: "unchecked: wraps. checked: throws OverflowException.",
  },
  {
    id: "csharp-uint", name: "uint", language: "csharp", family: "uint32",
    bits: 32, signed: false, ...makeFixedWidth(32, false),
    formatSpec: "{0:d}", constantMin: "uint.MinValue", constantMax: "uint.MaxValue",
    overflowNote: "unchecked: wraps. checked: throws OverflowException.",
  },
  {
    id: "csharp-long", name: "long", language: "csharp", family: "int64",
    bits: 64, signed: true, ...makeFixedWidth(64, true),
    formatSpec: "{0:d}", constantMin: "long.MinValue", constantMax: "long.MaxValue",
    overflowNote: "unchecked: wraps. checked: throws OverflowException.",
  },
  {
    id: "csharp-ulong", name: "ulong", language: "csharp", family: "uint64",
    bits: 64, signed: false, ...makeFixedWidth(64, false),
    formatSpec: "{0:d}", constantMin: "ulong.MinValue", constantMax: "ulong.MaxValue",
    overflowNote: "unchecked: wraps. checked: throws OverflowException.",
  },
  {
    id: "csharp-nint", name: "nint", language: "csharp", family: "isize",
    bits: 64, signed: true, ...makeFixedWidth(64, true),
    constantMin: "nint.MinValue", constantMax: "nint.MaxValue",
    overflowNote: "Native-sized signed (64-bit on 64-bit). unchecked: wraps. checked: throws.",
  },
  {
    id: "csharp-nuint", name: "nuint", language: "csharp", family: "usize",
    bits: 64, signed: false, ...makeFixedWidth(64, false),
    constantMin: "nuint.MinValue", constantMax: "nuint.MaxValue",
    overflowNote: "Native-sized unsigned (64-bit on 64-bit). unchecked: wraps. checked: throws.",
  },

  // ----- JavaScript -----
  {
    id: "js-number-safe", name: "Number (safe int)", language: "javascript", family: "bignum",
    bits: 53, signed: true,
    min: -(2n ** 53n - 1n),
    max: 2n ** 53n - 1n,
    constantMin: "Number.MIN_SAFE_INTEGER", constantMax: "Number.MAX_SAFE_INTEGER",
    overflowNote: "IEEE-754 double. Integers beyond ±2^53-1 lose precision (silently). Use BigInt instead.",
  },
  {
    id: "js-bigint", name: "BigInt", language: "javascript", family: "bignum",
    bits: 0, signed: true,
    min: 0n, // 0 means unbounded; use a sentinel
    max: 0n,
    constantMin: "—", constantMax: "—",
    overflowNote: "Arbitrary-precision. No overflow; memory-limited only.",
  },

  // ----- Python -----
  {
    id: "python-int", name: "int", language: "python", family: "bignum",
    bits: 0, signed: true,
    min: 0n, max: 0n,
    constantMin: "—", constantMax: "—",
    overflowNote: "Arbitrary-precision. No overflow; memory-limited only.",
  },
];

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

export function getTypeById(id: string): IntegerType | undefined {
  return INTEGER_TYPES.find((t) => t.id === id);
}

export function getTypesByLanguage(language: Language): IntegerType[] {
  return INTEGER_TYPES.filter((t) => t.language === language);
}

export function getTypesByFamily(family: TypeFamily): IntegerType[] {
  return INTEGER_TYPES.filter((t) => t.family === family);
}

/** Filter types by free-text query and/or language. */
export function filterTypes(query: string, language?: Language | ""): IntegerType[] {
  const q = query.trim().toLowerCase();
  return INTEGER_TYPES.filter((t) => {
    if (language && t.language !== language) return false;
    if (!q) return true;
    return (
      t.name.toLowerCase().includes(q) ||
      t.id.toLowerCase().includes(q) ||
      t.family.toLowerCase().includes(q) ||
      String(t.bits).includes(q) ||
      (t.constantMin ?? "").toLowerCase().includes(q) ||
      (t.constantMax ?? "").toLowerCase().includes(q) ||
      (t.formatSpec ?? "").toLowerCase().includes(q)
    );
  });
}

/** Cross-language comparison view for a single family. */
export function compareAcrossLanguages(family: TypeFamily): IntegerType[] {
  return INTEGER_TYPES.filter((t) => t.family === family);
}

// ---------------------------------------------------------------------------
// Number formatting
// ---------------------------------------------------------------------------

/** Group a bigint's decimal representation with underscores / commas. */
export function formatBigint(value: bigint): string {
  const neg = value < 0n;
  const digits = (neg ? -value : value).toString();
  // Group with underscores (matches Rust / Python literals; readable in any lang).
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, "_");
  return (neg ? "-" : "") + grouped;
}

/** Plain decimal string. */
export function toDecimal(value: bigint): string {
  return value.toString();
}

/** Hex string with 0x prefix, uppercase. */
export function toHex(value: bigint): string {
  if (value === 0n) return "0x0";
  const neg = value < 0n;
  const mag = neg ? -value : value;
  const hex = mag.toString(16).toUpperCase();
  return (neg ? "-0x" : "0x") + hex;
}

/** Binary string with 0b prefix. */
export function toBinary(value: bigint): string {
  if (value === 0n) return "0b0";
  const neg = value < 0n;
  const mag = neg ? -value : value;
  return (neg ? "-0b" : "0b") + mag.toString(2);
}

/** Octal string with 0o prefix. */
export function toOctal(value: bigint): string {
  if (value === 0n) return "0o0";
  const neg = value < 0n;
  const mag = neg ? -value : value;
  return (neg ? "-0o" : "0o") + mag.toString(8);
}

// ---------------------------------------------------------------------------
// Input parsing
// ---------------------------------------------------------------------------

export interface ParsedInput {
  ok: boolean;
  value?: bigint;
  error?: string;
  base?: number;
  raw: string;
}

/** Parse a signed decimal, 0x hex, 0b binary, 0o octal literal (with _ allowed). */
export function parseInput(s: string): ParsedInput {
  const raw = s.trim();
  if (!raw) return { ok: false, error: "Empty input.", raw };
  const neg = raw.startsWith("-");
  const body = (neg ? raw.slice(1) : raw).replace(/_/g, "");
  if (!body) return { ok: false, error: "No digits after sign/prefix.", raw };
  let base = 10;
  let digits = body;
  if (/^0x/i.test(body)) {
    base = 16;
    digits = body.slice(2);
  } else if (/^0b/i.test(body)) {
    base = 2;
    digits = body.slice(2);
  } else if (/^0o/i.test(body)) {
    base = 8;
    digits = body.slice(2);
  }
  const valid =
    base === 10 ? /^[0-9]+$/.test(digits)
    : base === 16 ? /^[0-9a-fA-F]+$/.test(digits)
    : base === 8 ? /^[0-7]+$/.test(digits)
    : /^[01]+$/.test(digits);
  if (!valid || digits.length === 0) {
    return { ok: false, error: `Invalid ${base === 10 ? "decimal" : base === 16 ? "hex" : base === 8 ? "octal" : "binary"} digits.`, raw };
  }
  try {
    let v = BigInt(base === 10 ? digits : "0" + (base === 16 ? "x" : base === 8 ? "o" : "b") + digits);
    if (neg) v = -v;
    return { ok: true, value: v, base, raw };
  } catch {
    return { ok: false, error: "Could not parse integer.", raw };
  }
}

// ---------------------------------------------------------------------------
// Overflow simulation
// ---------------------------------------------------------------------------

export interface OverflowResult {
  /** The input value (BigInt, exact). */
  input: bigint;
  /** The input rendered for display (decimal, hex, binary). */
  inputDec: string;
  inputHex: string;
  inputBin: string;
  /** The chosen type. */
  typeId: string;
  typeName: string;
  language: Language;
  bits: number;
  signed: boolean;
  /** Exact min/max of the type. */
  min: bigint;
  max: bigint;
  minDec: string;
  maxDec: string;
  /** True if `input` fits within [min, max]. */
  fits: boolean;
  /** The stored bit pattern as a non-negative bigint (masked to width). */
  stored: bigint;
  /** The interpreted value after wrap (signed interpretation). */
  wrapped: bigint;
  /** Decimal / hex / binary of `wrapped`. */
  wrappedDec: string;
  wrappedHex: string;
  wrappedBin: string;
  /** The overflow behavior label for this type under the chosen mode. */
  behavior: OverflowBehavior;
  /** Human-readable behavior summary. */
  behaviorLabel: string;
  /** Per-language note (longer). */
  note: string;
  /** Build mode applied. */
  mode: BuildMode;
  /** True if this type is unbounded (no overflow possible). */
  unbounded: boolean;
  /** True if the input was clamped/lossy (e.g. JS Number precision loss). */
  lossy: boolean;
}

/**
 * Simulate what happens when `value` is stored in `typeId` under the chosen
 * build `mode`. Reflects documented per-language semantics.
 */
export function simulateOverflow(
  value: bigint,
  typeId: string,
  mode: BuildMode = "default",
): OverflowResult {
  const t = getTypeById(typeId);
  if (!t) {
    throw new Error(`Unknown type id: ${typeId}`);
  }
  // Unbounded types: JS BigInt, Python int.
  const unbounded = t.bits === 0;
  const inputDec = toDecimal(value);
  const inputHex = toHex(value);
  const inputBin = toBinary(value);
  const minDec = unbounded ? "−∞ (unbounded)" : toDecimal(t.min);
  const maxDec = unbounded ? "+∞ (unbounded)" : toDecimal(t.max);

  // JS Number safe-int special case: precision loss for |v| > 2^53-1.
  const isJsSafe = t.id === "js-number-safe";
  const isBignum = unbounded;

  if (isBignum) {
    return {
      input: value,
      inputDec, inputHex, inputBin,
      typeId: t.id, typeName: t.name, language: t.language,
      bits: t.bits, signed: t.signed,
      min: t.min, max: t.max, minDec, maxDec,
      fits: true,
      stored: value,
      wrapped: value,
      wrappedDec: inputDec,
      wrappedHex: inputHex,
      wrappedBin: inputBin,
      behavior: "none",
      behaviorLabel: OVERFLOW_BEHAVIOR_LABELS.none,
      note: t.overflowNote ?? "Arbitrary-precision — no overflow possible.",
      mode,
      unbounded: true,
      lossy: false,
    };
  }

  const fits = value >= t.min && value <= t.max;
  const w = BigInt(t.bits);
  const mask = (1n << w) - 1n;
  // Two's-complement masking: bring value into [0, 2^N) first.
  const masked = value & mask;
  // Re-interpret as signed if the type is signed.
  const signBit = 1n << (w - 1n);
  const wrapped = t.signed && (masked & signBit) ? masked - (1n << w) : masked;

  // Determine behavior per language + mode.
  let behavior: OverflowBehavior;
  let note = t.overflowNote ?? "";
  let lossy = false;

  if (t.language === "c") {
    if (t.signed) {
      behavior = "ub";
    } else {
      behavior = "wrap";
    }
  } else if (t.language === "rust") {
    if (mode === "debug") behavior = "panic";
    else if (mode === "release") behavior = "wrap";
    else behavior = t.signed ? "wrap" : "wrap"; // default: assume release-like wrap
    // If default and not fits, we surface both possibilities in the note.
    if (mode === "default" && !fits) {
      note = "Rust: debug builds panic on overflow; release builds wrap mod 2^N. Pick a mode to see one.";
    }
  } else if (t.language === "go") {
    behavior = "wrap";
  } else if (t.language === "java") {
    behavior = "wrap";
  } else if (t.language === "csharp") {
    if (mode === "checked") behavior = "throw";
    else if (mode === "unchecked") behavior = "wrap";
    else behavior = "wrap"; // default unchecked in C#
    if (mode === "default" && !fits) {
      note = "C#: default context is unchecked (wraps). Use checked { ... } to throw OverflowException.";
    }
  } else if (t.language === "javascript") {
    // JS Number safe-int — only the "lossy" path applies beyond 2^53-1.
    if (isJsSafe && !fits) {
      behavior = "lossy";
      lossy = true;
    } else {
      behavior = "none";
    }
  } else {
    behavior = "none";
  }

  const wrappedDec = toDecimal(wrapped);
  const wrappedHex = toHex(wrapped);
  const wrappedBin = toBinary(wrapped);

  return {
    input: value,
    inputDec, inputHex, inputBin,
    typeId: t.id, typeName: t.name, language: t.language,
    bits: t.bits, signed: t.signed,
    min: t.min, max: t.max, minDec, maxDec,
    fits,
    stored: masked,
    wrapped,
    wrappedDec, wrappedHex, wrappedBin,
    behavior,
    behaviorLabel: OVERFLOW_BEHAVIOR_LABELS[behavior],
    note,
    mode,
    unbounded: false,
    lossy,
  };
}

/** Quick check whether a value fits in a type. */
export function valueFits(value: bigint, typeId: string): boolean {
  const t = getTypeById(typeId);
  if (!t) return false;
  if (t.bits === 0) return true;
  return value >= t.min && value <= t.max;
}

// ---------------------------------------------------------------------------
// Quick presets for the overflow calculator
// ---------------------------------------------------------------------------

export interface OverflowPreset {
  label: string;
  value: string;
  typeId: string;
  mode: BuildMode;
  description: string;
}

export const OVERFLOW_PRESETS: OverflowPreset[] = [
  { label: "200 in int8", value: "200", typeId: "c-int8_t", mode: "default", description: "C signed overflow — UB." },
  { label: "200 in uint8", value: "200", typeId: "c-uint8_t", mode: "default", description: "Fits — uint8 max is 255." },
  { label: "300 in uint8", value: "300", typeId: "c-uint8_t", mode: "default", description: "Wraps to 44 (300 - 256)." },
  { label: "i32::MAX + 1 (Rust debug)", value: "2147483648", typeId: "rust-i32", mode: "debug", description: "Debug panic." },
  { label: "i32::MAX + 1 (Rust release)", value: "2147483648", typeId: "rust-i32", mode: "release", description: "Wraps to INT_MIN." },
  { label: "Long.MAX_VALUE + 1 (Java)", value: "9223372036854775808", typeId: "java-long", mode: "default", description: "Wraps to Long.MIN_VALUE." },
  { label: "2^53 in JS Number", value: "9007199254740992", typeId: "js-number-safe", mode: "default", description: "Right at the safe boundary." },
  { label: "2^53 + 1 in JS Number", value: "9007199254740993", typeId: "js-number-safe", mode: "default", description: "Cannot be represented — lossy." },
  { label: "300 in Go uint8", value: "300", typeId: "go-uint8", mode: "default", description: "Wraps to 44." },
  { label: "300 in C# byte (checked)", value: "300", typeId: "csharp-byte", mode: "checked", description: "Throws OverflowException." },
];

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:integer-range-overflow:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  input: string;
  typeId: string;
  mode: BuildMode;
  fits: boolean;
  wrappedDec: string;
}

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, HISTORY_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Shareable URL
// ---------------------------------------------------------------------------

export function buildShareUrl(input: string, typeId: string, mode: BuildMode): string {
  const params = new URLSearchParams();
  if (input) params.set("v", input);
  if (typeId) params.set("t", typeId);
  if (mode && mode !== "default") params.set("m", mode);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export interface ShareParams {
  input: string;
  typeId: string;
  mode: BuildMode;
}

export function parseShareUrl(hash: string): ShareParams {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { input: "", typeId: "c-int32_t", mode: "default" };
  const params = new URLSearchParams(clean);
  const input = params.get("v") ?? "";
  const typeId = params.get("t") ?? "c-int32_t";
  const m = params.get("m") ?? "default";
  const mode = (BUILD_MODES.includes(m as BuildMode) ? m : "default") as BuildMode;
  return { input, typeId, mode };
}

// ---------------------------------------------------------------------------
// Bit grid (for visualizing the wrapped result)
// ---------------------------------------------------------------------------

export interface BitCell {
  position: number;
  weight: bigint;
  value: 0 | 1;
  isSign: boolean;
}

export function buildBitGrid(stored: bigint, bits: number): BitCell[] {
  const cells: BitCell[] = [];
  for (let i = bits - 1; i >= 0; i--) {
    const pos = i;
    const weight = 1n << BigInt(i);
    const value: 0 | 1 = (stored & weight) ? 1 : 0;
    cells.push({ position: pos, weight, value, isSign: i === bits - 1 });
  }
  return cells;
}
