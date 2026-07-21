/**
 * Bit Field / Bitmask / Flags Designer & Decoder — pure logic.
 *
 * Define named single-bit flags and multi-bit fields within a word
 * (8/16/32/64-bit), validate non-overlap, encode field values into a packed
 * integer, decode a packed integer back into named fields, and generate
 * ready-to-compile code for C/C++, Rust, Python, Go and TypeScript. Pure
 * functions only — no DOM, no network.
 */

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

export type BitWidth = 8 | 16 | 32 | 64;
export type BitNumbering = "LSB0" | "MSB0";

export interface EnumLabel {
  value: number;
  label: string;
}

export interface BitField {
  id: string;
  name: string;
  /** LSB0 bit index (low bit position). For MSB0 numbering the layout-level
   *  conversion handles the flip; internal storage is always LSB0. */
  startBit: number;
  /** Number of bits this field spans. 1 = single-bit flag. */
  width: number;
  description?: string;
  color?: string;
  enums?: EnumLabel[];
  reserved?: boolean;
}

export interface Layout {
  name: string;
  width: BitWidth;
  fields: BitField[];
  numbering: BitNumbering;
}

export interface ValidationError {
  fieldId?: string;
  message: string;
}

export interface BasesResult {
  bin: string;
  hex: string;
  dec: string;
}

export interface EncodeResult {
  value: bigint;
  bases: BasesResult;
  errors: ValidationError[];
  fieldValues: { fieldId: string; name: string; rawValue: number; masked: number; overflow: boolean }[];
}

export interface DecodedField {
  field: BitField;
  rawValue: number;
  label?: string;
  isSet?: boolean; // for 1-bit flags
}

export interface DecodeResult {
  fields: DecodedField[];
  reserved: number[]; // bit positions marked reserved (set in value)
  errors: string[];
}

export type CodeLang = "c" | "rust" | "python" | "go" | "typescript";

export const BIT_WIDTHS: BitWidth[] = [8, 16, 32, 64];

/** Color palette cycling for fields in the visual bit strip. */
export const FIELD_COLORS: string[] = [
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16",
  "#06b6d4", "#a855f7", "#eab308", "#22c55e", "#f43f5e",
];

/** Stable color assignment by field index. */
export function fieldColor(idx: number): string {
  return FIELD_COLORS[idx % FIELD_COLORS.length];
}

// ---------------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------------

/** Total bit capacity of the layout's word width. */
export function layoutCapacity(width: BitWidth): number {
  return width;
}

/** Mask covering the field's bits (LSB0). */
export function fieldMask(field: BitField): bigint {
  if (field.width <= 0) return 0n;
  if (field.width >= 64) return (1n << 64n) - 1n;
  return (1n << BigInt(field.width)) - 1n;
}

/** Mask shifted into the field's bit position. */
export function fieldMaskShifted(field: BitField): bigint {
  return fieldMask(field) << BigInt(field.startBit);
}

/** Maximum value the field can hold (2^width - 1). */
export function fieldMaxValue(field: BitField): number {
  if (field.width >= 31) return Number.MAX_SAFE_INTEGER;
  return (1 << field.width) - 1;
}

/** End bit (LSB0, inclusive). */
export function fieldEndBit(field: BitField): number {
  return field.startBit + field.width - 1;
}

/** Apply LSB0/MSB0 numbering to convert a user-facing bit index to internal
 *  LSB0. Internal storage is always LSB0; the numbering only affects how the
 *  user thinks of bit positions. */
export function toLsb0(width: BitWidth, numbering: BitNumbering, bitIndex: number): number {
  if (numbering === "LSB0") return bitIndex;
  return width - 1 - bitIndex;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Validate the entire layout: check field widths, ranges, names, and overlaps. */
export function validateLayout(layout: Layout): ValidationError[] {
  const errors: ValidationError[] = [];
  const cap = layoutCapacity(layout.width);
  const seenRanges: { fieldId: string; name: string; start: number; end: number }[] = [];
  const usedNames = new Set<string>();

  for (const f of layout.fields) {
    if (!f.name || !f.name.trim()) {
      errors.push({ fieldId: f.id, message: "Field name is required" });
    } else if (usedNames.has(f.name)) {
      errors.push({ fieldId: f.id, message: `Duplicate field name: "${f.name}"` });
    } else {
      usedNames.add(f.name);
    }
    if (f.width < 1) {
      errors.push({ fieldId: f.id, message: `Field "${f.name}": width must be ≥ 1` });
      continue;
    }
    if (f.startBit < 0) {
      errors.push({ fieldId: f.id, message: `Field "${f.name}": start bit must be ≥ 0` });
      continue;
    }
    const end = fieldEndBit(f);
    if (end >= cap) {
      errors.push({
        fieldId: f.id,
        message: `Field "${f.name}" (bits ${f.startBit}-${end}) exceeds ${layout.width}-bit word (max bit ${cap - 1})`,
      });
      continue;
    }
    // Check overlap with seen ranges
    for (const r of seenRanges) {
      if (f.startBit <= r.end && r.start <= end) {
        errors.push({
          fieldId: f.id,
          message: `Field "${f.name}" (bits ${f.startBit}-${end}) overlaps "${r.name}" (bits ${r.start}-${r.end})`,
        });
      }
    }
    seenRanges.push({ fieldId: f.id, name: f.name, start: f.startBit, end });
  }
  return errors;
}

/** Return the set of reserved (unused) bit positions in the layout. */
export function reservedBits(layout: Layout): number[] {
  const cap = layoutCapacity(layout.width);
  const used = new Set<number>();
  for (const f of layout.fields) {
    for (let b = f.startBit; b <= fieldEndBit(f) && b < cap; b++) used.add(b);
  }
  const reserved: number[] = [];
  for (let b = 0; b < cap; b++) if (!used.has(b)) reserved.push(b);
  return reserved;
}

// ---------------------------------------------------------------------------
// Encoding & decoding
// ---------------------------------------------------------------------------

export interface FieldInput {
  fieldId: string;
  value: number;
}

/** Encode a set of field values into a packed integer. Values exceeding the
 *  field width are masked (overflow flagged in result). */
export function encodeFields(layout: Layout, inputs: FieldInput[]): EncodeResult {
  const errors = validateLayout(layout);
  const fieldValues: EncodeResult["fieldValues"] = [];
  let packed = 0n;
  const byId = new Map(layout.fields.map((f) => [f.id, f]));

  for (const inp of inputs) {
    const field = byId.get(inp.fieldId);
    if (!field) {
      errors.push({ fieldId: inp.fieldId, message: "Unknown field id" });
      continue;
    }
    const max = fieldMaxValue(field);
    const overflow = inp.value < 0 || inp.value > max;
    const masked = field.width >= 31
      ? Number(BigInt(inp.value) & fieldMask(field))
      : inp.value & ((1 << field.width) - 1);
    packed |= BigInt(masked) << BigInt(field.startBit);
    fieldValues.push({
      fieldId: field.id,
      name: field.name,
      rawValue: inp.value,
      masked,
      overflow,
    });
    if (overflow) {
      errors.push({
        fieldId: field.id,
        message: `Value ${inp.value} exceeds field "${field.name}" max (${max}); masked to ${masked}`,
      });
    }
  }

  return {
    value: packed,
    bases: formatInBases(packed, layout.width),
    errors,
    fieldValues,
  };
}

/** Decode a packed integer back into per-field values. */
export function decodeValue(layout: Layout, value: bigint): DecodeResult {
  const errors = validateLayout(layout);
  const cap = layoutCapacity(layout.width);
  const masked = maskWidth(value, layout.width);
  const fields: DecodedField[] = [];

  for (const f of layout.fields) {
    const shifted = masked >> BigInt(f.startBit);
    const v = Number(shifted & fieldMask(f));
    const decoded: DecodedField = { field: f, rawValue: v };
    if (f.width === 1) decoded.isSet = v === 1;
    if (f.enums && f.enums.length > 0) {
      const lab = f.enums.find((e) => e.value === v);
      if (lab) decoded.label = lab.label;
    }
    fields.push(decoded);
  }

  // Identify reserved bits that are set
  const reservedSet: number[] = [];
  const reserved = reservedBits(layout);
  for (const b of reserved) {
    if (masked & (1n << BigInt(b))) reservedSet.push(b);
  }
  // Also flag bits within fields explicitly marked reserved: true
  for (const f of layout.fields) {
    if (!f.reserved) continue;
    for (let b = f.startBit; b <= fieldEndBit(f) && b < cap; b++) {
      if (masked & (1n << BigInt(b))) reservedSet.push(b);
    }
  }
  // De-duplicate
  const unique = Array.from(new Set(reservedSet)).sort((a, b) => a - b);

  // Sanity: report if value exceeds word width
  if (value < 0n) {
    errors.push({ message: "Negative value treated as two's-complement (masked to word width)" } as ValidationError);
  }
  if (value >> BigInt(cap) !== 0n && value >= 0n) {
    errors.push({ message: `Value 0x${value.toString(16).toUpperCase()} exceeds ${layout.width}-bit word (high bits truncated)` } as ValidationError);
  }

  return { fields, reserved: unique, errors: errors.map((e) => e.message) };
}

// ---------------------------------------------------------------------------
// BigInt / format helpers
// ---------------------------------------------------------------------------

export function maskWidth(value: bigint, width: BitWidth): bigint {
  const mask = (1n << BigInt(width)) - 1n;
  return value & mask;
}

export function toBinaryString(value: bigint, width: BitWidth): string {
  const masked = maskWidth(value, width);
  let s = "";
  for (let i = width - 1; i >= 0; i--) {
    s += masked & (1n << BigInt(i)) ? "1" : "0";
  }
  return s;
}

export function formatInBases(value: bigint, width: BitWidth): BasesResult {
  const masked = maskWidth(value, width);
  return {
    bin: toBinaryString(masked, width),
    hex: masked.toString(16).toUpperCase().padStart(Math.ceil(width / 4), "0"),
    dec: masked.toString(10),
  };
}

/** Parse a user-entered integer literal — supports 0x/0b/0o/decimal. */
export function parseInteger(input: string): bigint {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Empty input");
  let negative = false;
  let rest = trimmed;
  if (rest.startsWith("-")) { negative = true; rest = rest.slice(1); }
  else if (rest.startsWith("+")) rest = rest.slice(1);
  let base = 10;
  const lower = rest.toLowerCase();
  if (lower.startsWith("0x")) { base = 16; rest = rest.slice(2); }
  else if (lower.startsWith("0b")) { base = 2; rest = rest.slice(2); }
  else if (lower.startsWith("0o")) { base = 8; rest = rest.slice(2); }
  if (!rest) throw new Error("No digits");
  let result = 0n;
  const b = BigInt(base);
  for (const ch of rest) {
    if (ch === "_") continue;
    let d: number;
    if (ch >= "0" && ch <= "9") d = ch.charCodeAt(0) - "0".charCodeAt(0);
    else if (ch >= "a" && ch <= "z") d = ch.charCodeAt(0) - "a".charCodeAt(0) + 10;
    else if (ch >= "A" && ch <= "Z") d = ch.charCodeAt(0) - "A".charCodeAt(0) + 10;
    else throw new Error(`Invalid character '${ch}'`);
    if (d >= base) throw new Error(`Invalid digit '${ch}' for base ${base}`);
    result = result * b + BigInt(d);
  }
  return negative ? -result : result;
}

// ---------------------------------------------------------------------------
// Visual bit strip
// ---------------------------------------------------------------------------

export interface BitCell {
  bitIndex: number; // LSB0
  displayIndex: number; // shown to user (MSB-first by default)
  value: 0 | 1;
  fieldId?: string;
  fieldName?: string;
  fieldColor?: string;
  reserved: boolean;
}

/** Build the per-bit visual strip for a packed value. */
export function buildBitStrip(layout: Layout, value: bigint): BitCell[] {
  const cap = layoutCapacity(layout.width);
  const masked = maskWidth(value, layout.width);
  const cells: BitCell[] = [];
  // Map each bit to a field
  const bitToField = new Map<number, BitField>();
  layout.fields.forEach((f, idx) => {
    for (let b = f.startBit; b <= fieldEndBit(f) && b < cap; b++) {
      bitToField.set(b, { ...f, color: f.color ?? fieldColor(idx) });
    }
  });
  const reserved = new Set(reservedBits(layout));
  // Display MSB-first (display index 0 = highest bit)
  for (let i = 0; i < cap; i++) {
    const bitIndex = cap - 1 - i; // LSB0 bit
    const bitVal = masked & (1n << BigInt(bitIndex)) ? 1 : 0;
    const f = bitToField.get(bitIndex);
    cells.push({
      bitIndex,
      displayIndex: i,
      value: bitVal,
      fieldId: f?.id,
      fieldName: f?.name,
      fieldColor: f?.color,
      reserved: reserved.has(bitIndex),
    });
  }
  return cells;
}

// ---------------------------------------------------------------------------
// Code generation
// ---------------------------------------------------------------------------

function sanitizeIdent(name: string): string {
  const s = name.trim().replace(/[^a-zA-Z0-9_]/g, "_");
  if (!s) return "field";
  if (/^[0-9]/.test(s)) return "_" + s;
  return s;
}

function toUpperSnake(name: string): string {
  return sanitizeIdent(name).replace(/([a-z0-9])([A-Z])/g, "$1_$2").toUpperCase();
}

function toPascalCase(name: string): string {
  const parts = sanitizeIdent(name).split(/[_\s-]+/);
  return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("");
}

/** Generate C/C++ code: #defines for masks/shifts, anonymous struct with
 *  bitfields, plus getter/setter/test helpers. */
export function generateCodeC(layout: Layout): string {
  const lines: string[] = [];
  const w = layout.width;
  const cType = w <= 8 ? "uint8_t" : w <= 16 ? "uint16_t" : w <= 32 ? "uint32_t" : "uint64_t";
  lines.push(`/* Auto-generated by UnQTools — Bit Field Designer */`);
  lines.push(`/* Layout: ${layout.name} (${w}-bit, ${layout.numbering}) */`);
  lines.push(`#include <stdint.h>`);
  lines.push(``);
  for (const f of layout.fields) {
    const nm = toUpperSnake(f.name);
    lines.push(`#define ${nm}_SHIFT  ${f.startBit}u`);
    const maskHex = "0x" + ((1n << BigInt(f.width)) - 1n).toString(16).toUpperCase();
    lines.push(`#define ${nm}_MASK   ${maskHex}u  /* bits ${f.startBit}-${fieldEndBit(f)} */`);
    if (f.enums && f.enums.length > 0) {
      lines.push(`/* ${f.name} enum values: */`);
      for (const e of f.enums) {
        lines.push(`#define ${nm}_${sanitizeIdent(e.label).toUpperCase()}  ${e.value}`);
      }
    }
    lines.push(``);
  }
  lines.push(`typedef struct {`);
  // Sort fields by startBit descending (MSB-first declaration in C bitfield struct)
  const sorted = [...layout.fields].sort((a, b) => b.startBit - a.startBit);
  for (const f of sorted) {
    lines.push(`    ${cType} ${sanitizeIdent(f.name).toLowerCase()} : ${f.width}; /* bits ${f.startBit}-${fieldEndBit(f)} */`);
  }
  lines.push(`} ${toPascalCase(layout.name)}_t;`);
  lines.push(``);
  // Helpers
  for (const f of layout.fields) {
    const nm = toUpperSnake(f.name);
    const fnm = sanitizeIdent(f.name).toLowerCase();
    lines.push(`static inline ${cType} ${fnm}_get(${cType} reg) {`);
    lines.push(`    return (${cType})((reg >> ${f.startBit}) & ${nm}_MASK);`);
    lines.push(`}`);
    lines.push(`static inline ${cType} ${fnm}_set(${cType} reg, ${cType} val) {`);
    lines.push(`    return (${cType})((reg & ~(${nm}_MASK << ${nm}_SHIFT)) | ((val & ${nm}_MASK) << ${nm}_SHIFT));`);
    lines.push(`}`);
    if (f.width === 1) {
      lines.push(`static inline bool ${fnm}_is_set(${cType} reg) { return (reg & (${nm}_MASK << ${nm}_SHIFT)) != 0; }`);
      lines.push(`static inline ${cType} ${fnm}_set_bit(${cType} reg) { return (${cType})(reg | (${nm}_MASK << ${nm}_SHIFT)); }`);
      lines.push(`static inline ${cType} ${fnm}_clear_bit(${cType} reg) { return (${cType})(reg & ~(${nm}_MASK << ${nm}_SHIFT)); }`);
      lines.push(`static inline ${cType} ${fnm}_toggle(${cType} reg) { return (${cType})(reg ^ (${nm}_MASK << ${nm}_SHIFT)); }`);
    }
    lines.push(``);
  }
  return lines.join("\n");
}

/** Generate Rust code: bitflags! for single-bit flags + const helpers for
 *  multi-bit fields, with a plain wrapper struct for multi-bit access. */
export function generateCodeRust(layout: Layout): string {
  const lines: string[] = [];
  const w = layout.width;
  const intType = w <= 8 ? "u8" : w <= 16 ? "u16" : w <= 32 ? "u32" : "u64";
  lines.push(`// Auto-generated by UnQTools — Bit Field Designer`);
  lines.push(`// Layout: ${layout.name} (${w}-bit, ${layout.numbering})`);
  const singleBits = layout.fields.filter((f) => f.width === 1);
  const multiBits = layout.fields.filter((f) => f.width > 1);
  if (singleBits.length > 0) {
    lines.push(`use bitflags::bitflags;`);
    lines.push(``);
    lines.push(`bitflags! {`);
    lines.push(`    #[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Hash)]`);
    lines.push(`    pub struct ${toPascalCase(layout.name)}Flags: ${intType} {`);
    for (const f of singleBits) {
      const v = 1n << BigInt(f.startBit);
      lines.push(`        const ${toUpperSnake(f.name)} = 0x${v.toString(16).toUpperCase()};`);
    }
    lines.push(`    }`);
    lines.push(`}`);
    lines.push(``);
  }
  for (const f of multiBits) {
    const nm = toUpperSnake(f.name);
    const mask = (1n << BigInt(f.width)) - 1n;
    lines.push(`pub const ${nm}_SHIFT: u32 = ${f.startBit};`);
    lines.push(`pub const ${nm}_MASK: ${intType} = 0x${mask.toString(16).toUpperCase()};`);
    if (f.enums && f.enums.length > 0) {
      lines.push(`#[repr(${intType})]`);
      lines.push(`#[derive(Clone, Copy, Debug, PartialEq, Eq)]`);
      lines.push(`pub enum ${toPascalCase(f.name)} {`);
      for (const e of f.enums) {
        lines.push(`    ${toPascalCase(e.label)} = ${e.value},`);
      }
      lines.push(`}`);
    }
    lines.push(``);
  }
  lines.push(`#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]`);
  lines.push(`pub struct ${toPascalCase(layout.name)}(pub ${intType});`);
  lines.push(``);
  lines.push(`impl ${toPascalCase(layout.name)} {`);
  for (const f of layout.fields) {
    const nm = toUpperSnake(f.name);
    const fnm = sanitizeIdent(f.name).toLowerCase();
    lines.push(`    pub fn ${fnm}_get(self) -> ${intType} {`);
    lines.push(`        (self.0 >> ${f.startBit}) & ${nm}_MASK`);
    lines.push(`    }`);
    lines.push(`    pub fn ${fnm}_set(self, val: ${intType}) -> Self {`);
    lines.push(`        Self((self.0 & !(${nm}_MASK << ${nm}_SHIFT)) | ((val & ${nm}_MASK) << ${nm}_SHIFT))`);
    lines.push(`    }`);
  }
  lines.push(`}`);
  return lines.join("\n");
}

/** Generate Python code: IntFlag class for single-bit flags, @property
 *  accessors for multi-bit fields. */
export function generateCodePython(layout: Layout): string {
  const lines: string[] = [];
  lines.push(`# Auto-generated by UnQTools — Bit Field Designer`);
  lines.push(`# Layout: ${layout.name} (${layout.width}-bit, ${layout.numbering})`);
  lines.push(`from enum import IntFlag, IntEnum`);
  lines.push(``);
  const singleBits = layout.fields.filter((f) => f.width === 1);
  const multiBits = layout.fields.filter((f) => f.width > 1);
  if (singleBits.length > 0) {
    lines.push(`class ${toPascalCase(layout.name)}Flags(IntFlag):`);
    for (const f of singleBits) {
      const v = 1n << BigInt(f.startBit);
      lines.push(`    ${toUpperSnake(f.name)} = 0x${v.toString(16).toUpperCase()}`);
    }
    lines.push(``);
  }
  for (const f of multiBits) {
    if (f.enums && f.enums.length > 0) {
      lines.push(`class ${toPascalCase(f.name)}Enum(IntEnum):`);
      for (const e of f.enums) {
        lines.push(`    ${toUpperSnake(e.label)} = ${e.value}`);
      }
      lines.push(``);
    }
  }
  lines.push(`class ${toPascalCase(layout.name)}:`);
  lines.push(`    """${layout.width}-bit register: ${layout.name}"""`);
  lines.push(`    WIDTH = ${layout.width}`);
  for (const f of layout.fields) {
    const nm = toUpperSnake(f.name);
    const mask = (1n << BigInt(f.width)) - 1n;
    lines.push(`    ${nm}_SHIFT = ${f.startBit}`);
    lines.push(`    ${nm}_MASK = 0x${mask.toString(16).toUpperCase()}`);
  }
  lines.push(``);
  lines.push(`    def __init__(self, value: int = 0):`);
  lines.push(`        self.value = value & ((1 << ${layout.width}) - 1)`);
  for (const f of layout.fields) {
    const nm = toUpperSnake(f.name);
    const fnm = sanitizeIdent(f.name).toLowerCase();
    lines.push(``);
    lines.push(`    @property`);
    lines.push(`    def ${fnm}(self) -> int:`);
    lines.push(`        return (self.value >> ${f.startBit}) & ${nm}_MASK`);
    lines.push(``);
    lines.push(`    @${fnm}.setter`);
    lines.push(`    def ${fnm}(self, val: int) -> None:`);
    lines.push(`        self.value = (self.value & ~(${nm}_MASK << ${nm}_SHIFT)) | ((val & ${nm}_MASK) << ${nm}_SHIFT)`);
  }
  return lines.join("\n");
}

/** Generate Go code: const block + getter/setter funcs. */
export function generateCodeGo(layout: Layout): string {
  const lines: string[] = [];
  const intType = layout.width <= 8 ? "uint8" : layout.width <= 16 ? "uint16" : layout.width <= 32 ? "uint32" : "uint64";
  lines.push(`// Auto-generated by UnQTools — Bit Field Designer`);
  lines.push(`// Layout: ${layout.name} (${layout.width}-bit, ${layout.numbering})`);
  lines.push(`package ${sanitizeIdent(layout.name).toLowerCase()}`);
  lines.push(``);
  lines.push(`type ${toPascalCase(layout.name)} ${intType}`);
  lines.push(``);
  lines.push(`const (`);
  for (const f of layout.fields) {
    const nm = toUpperSnake(f.name);
    const mask = (1n << BigInt(f.width)) - 1n;
    lines.push(`    ${nm}Shift = ${f.startBit}`);
    lines.push(`    ${nm}Mask  ${intType} = 0x${mask.toString(16).toUpperCase()}`);
  }
  lines.push(`)`);
  lines.push(``);
  for (const f of layout.fields) {
    const nm = toUpperSnake(f.name);
    const fnm = toPascalCase(f.name);
    lines.push(`// Get${fnm} returns bits ${f.startBit}-${fieldEndBit(f)}.`);
    lines.push(`func (r ${toPascalCase(layout.name)}) Get${fnm}() ${intType} {`);
    lines.push(`    return ${intType}((r >> ${f.startBit}) & ${nm}Mask)`);
    lines.push(`}`);
    lines.push(``);
    lines.push(`// Set${fnm} sets bits ${f.startBit}-${fieldEndBit(f)}.`);
    lines.push(`func (r ${toPascalCase(layout.name)}) Set${fnm}(val ${intType}) ${toPascalCase(layout.name)} {`);
    lines.push(`    return (${toPascalCase(layout.name)})((r & ^(${nm}Mask << ${nm}Shift)) | ((val & ${nm}Mask) << ${nm}Shift))`);
    lines.push(`}`);
    lines.push(``);
  }
  return lines.join("\n");
}

/** Generate TypeScript code: const enum + helper functions. */
export function generateCodeTypeScript(layout: Layout): string {
  const lines: string[] = [];
  const intType = layout.width <= 32 ? "number" : "bigint";
  lines.push(`// Auto-generated by UnQTools — Bit Field Designer`);
  lines.push(`// Layout: ${layout.name} (${layout.width}-bit, ${layout.numbering})`);
  lines.push(``);
  // Enum-like const object for single-bit flags
  const singleBits = layout.fields.filter((f) => f.width === 1);
  if (singleBits.length > 0) {
    lines.push(`export const ${toPascalCase(layout.name)}Flags = {`);
    for (const f of singleBits) {
      const v = 1n << BigInt(f.startBit);
      lines.push(`  ${toUpperSnake(f.name)}: ${intType === "bigint" ? v.toString() + "n" : Number(v)} as const,`);
    }
    lines.push(`} as const;`);
    lines.push(``);
  }
  for (const f of layout.fields) {
    if (f.enums && f.enums.length > 0) {
      lines.push(`export enum ${toPascalCase(f.name)} {`);
      for (const e of f.enums) {
        lines.push(`  ${toPascalCase(e.label)} = ${e.value},`);
      }
      lines.push(`}`);
      lines.push(``);
    }
  }
  for (const f of layout.fields) {
    const nm = toUpperSnake(f.name);
    const fnm = sanitizeIdent(f.name).toLowerCase();
    const mask = (1n << BigInt(f.width)) - 1n;
    const maskLit = intType === "bigint" ? mask.toString() + "n" : Number(mask);
    const shiftLit = f.startBit;
    lines.push(`export const ${nm}_SHIFT = ${shiftLit};`);
    lines.push(`export const ${nm}_MASK = ${maskLit};`);
    lines.push(`export function get${toPascalCase(f.name)}(reg: ${intType}): ${intType} {`);
    if (intType === "bigint") {
      lines.push(`  return (reg >> ${shiftLit}n) & ${mask}_MASK;`);
    } else {
      lines.push(`  return (reg >>> ${shiftLit}) & Number(${nm}_MASK);`);
    }
    lines.push(`}`);
    lines.push(`export function set${toPascalCase(f.name)}(reg: ${intType}, val: ${intType}): ${intType} {`);
    if (intType === "bigint") {
      lines.push(`  return (reg & ~(${nm}_MASK << ${shiftLit}n)) | ((val & ${nm}_MASK) << ${shiftLit}n);`);
    } else {
      lines.push(`  return (reg & ~(${nm}_MASK << ${shiftLit})) | ((val & Number(${nm}_MASK)) << ${shiftLit});`);
    }
    lines.push(`}`);
    if (f.width === 1) {
      lines.push(`export function is${toPascalCase(f.name)}Set(reg: ${intType}): boolean {`);
      lines.push(`  return (reg & (${nm}_MASK ${intType === "bigint" ? "<< " + shiftLit + "n" : "<< " + shiftLit})) !== ${intType === "bigint" ? "0n" : "0"};`);
      lines.push(`}`);
    }
    lines.push(``);
  }
  return lines.join("\n");
}

/** Dispatch code generation by language. */
export function generateCode(layout: Layout, lang: CodeLang): string {
  switch (lang) {
    case "c": return generateCodeC(layout);
    case "rust": return generateCodeRust(layout);
    case "python": return generateCodePython(layout);
    case "go": return generateCodeGo(layout);
    case "typescript": return generateCodeTypeScript(layout);
  }
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

export interface Preset {
  id: string;
  name: string;
  description: string;
  layout: Layout;
}

let _idCounter = 0;
function makeId(prefix: string): string {
  _idCounter += 1;
  return `${prefix}_${_idCounter}_${Math.random().toString(36).slice(2, 8)}`;
}

function field(
  name: string,
  startBit: number,
  width: number,
  opts: { description?: string; enums?: EnumLabel[]; reserved?: boolean } = {},
): BitField {
  return {
    id: makeId(name.toLowerCase()),
    name,
    startBit,
    width,
    description: opts.description,
    enums: opts.enums,
    reserved: opts.reserved,
  };
}

export const PRESETS: Preset[] = [
  {
    id: "posix-file-mode",
    name: "POSIX File Mode (chmod)",
    description: "12-bit Unix file mode: setuid, setgid, sticky + rwx for user, group, other.",
    layout: {
      name: "POSIX File Mode",
      width: 16,
      numbering: "LSB0",
      fields: [
        field("OTHER_EXECUTE", 0, 1, { description: "Execute/search for others" }),
        field("OTHER_WRITE", 1, 1, { description: "Write for others" }),
        field("OTHER_READ", 2, 1, { description: "Read for others" }),
        field("GROUP_EXECUTE", 3, 1, { description: "Execute/search for group" }),
        field("GROUP_WRITE", 4, 1, { description: "Write for group" }),
        field("GROUP_READ", 5, 1, { description: "Read for group" }),
        field("OWNER_EXECUTE", 6, 1, { description: "Execute/search for owner" }),
        field("OWNER_WRITE", 7, 1, { description: "Write for owner" }),
        field("OWNER_READ", 8, 1, { description: "Read for owner" }),
        field("STICKY", 9, 1, { description: "Sticky bit" }),
        field("SETGID", 10, 1, { description: "Set group ID on exec" }),
        field("SETUID", 11, 1, { description: "Set user ID on exec" }),
      ],
    },
  },
  {
    id: "tcp-flags",
    name: "TCP Header Flags",
    description: "9-bit TCP flags from the TCP header (NS, CWR, ECE, URG, ACK, PSH, RST, SYN, FIN).",
    layout: {
      name: "TCP Flags",
      width: 16,
      numbering: "LSB0",
      fields: [
        field("FIN", 0, 1, { description: "Finish — no more data from sender" }),
        field("SYN", 1, 1, { description: "Synchronize sequence numbers" }),
        field("RST", 2, 1, { description: "Reset the connection" }),
        field("PSH", 3, 1, { description: "Push function" }),
        field("ACK", 4, 1, { description: "Acknowledgment field significant" }),
        field("URG", 5, 1, { description: "Urgent pointer field significant" }),
        field("ECE", 6, 1, { description: "ECN-Echo" }),
        field("CWR", 7, 1, { description: "Congestion Window Reduced" }),
        field("NS", 8, 1, { description: "ECN-nonce concealment protection" }),
      ],
    },
  },
  {
    id: "fat-attrs",
    name: "FAT File Attributes",
    description: "8-bit FAT attribute byte: read-only, hidden, system, volume label, directory, archive.",
    layout: {
      name: "FAT Attributes",
      width: 8,
      numbering: "LSB0",
      fields: [
        field("READ_ONLY", 0, 1, { description: "Read-only" }),
        field("HIDDEN", 1, 1, { description: "Hidden" }),
        field("SYSTEM", 2, 1, { description: "System" }),
        field("VOLUME_LABEL", 3, 1, { description: "Volume label" }),
        field("DIRECTORY", 4, 1, { description: "Directory" }),
        field("ARCHIVE", 5, 1, { description: "Archive" }),
        field("RESERVED_6", 6, 1, { reserved: true, description: "Reserved" }),
        field("RESERVED_7", 7, 1, { reserved: true, description: "Reserved" }),
      ],
    },
  },
  {
    id: "arm-cpsr",
    name: "ARM CPSR (Current Program Status Register)",
    description: "32-bit ARM CPSR: mode bits, Thumb, FIQ/IRQ disable, overflow, carry, zero, negative, etc.",
    layout: {
      name: "ARM CPSR",
      width: 32,
      numbering: "LSB0",
      fields: [
        field("MODE", 0, 5, {
          description: "Processor mode",
          enums: [
            { value: 0x10, label: "USER" },
            { value: 0x11, label: "FIQ" },
            { value: 0x12, label: "IRQ" },
            { value: 0x13, label: "SUPERVISOR" },
            { value: 0x17, label: "ABORT" },
            { value: 0x1B, label: "UNDEFINED" },
            { value: 0x1F, label: "SYSTEM" },
          ],
        }),
        field("T", 5, 1, { description: "Thumb state" }),
        field("F", 6, 1, { description: "FIQ disable" }),
        field("I", 7, 1, { description: "IRQ disable" }),
        field("A", 8, 1, { description: "Async abort disable" }),
        field("E", 9, 1, { description: "Endianness (1=BE, 0=LE)" }),
        field("IT10", 10, 6, { reserved: true, description: "IT state bits 10-15" }),
        field("GE", 16, 4, { description: "Greater-than-or-equal flags (SIMD)" }),
        field("RESERVED_20", 20, 4, { reserved: true }),
        field("J", 24, 1, { description: "Java state" }),
        field("IT02", 25, 2, { reserved: true, description: "IT state bits 0-2" }),
        field("Q", 27, 1, { description: "Sticky overflow (saturation)" }),
        field("V", 28, 1, { description: "Overflow flag" }),
        field("C", 29, 1, { description: "Carry flag" }),
        field("Z", 30, 1, { description: "Zero flag" }),
        field("N", 31, 1, { description: "Negative flag" }),
      ],
    },
  },
  {
    id: "x86-eflags",
    name: "x86 EFLAGS (selected)",
    description: "32-bit x86 EFLAGS register: CF, PF, AF, ZF, SF, TF, IF, DF, OF, IOPL, NT, RF, VM, AC, VIF, VIP, ID.",
    layout: {
      name: "x86 EFLAGS",
      width: 32,
      numbering: "LSB0",
      fields: [
        field("CF", 0, 1, { description: "Carry flag" }),
        field("RESERVED_1", 1, 1, { reserved: true, description: "Always 1" }),
        field("PF", 2, 1, { description: "Parity flag" }),
        field("RESERVED_3", 3, 1, { reserved: true }),
        field("AF", 4, 1, { description: "Auxiliary carry flag" }),
        field("RESERVED_5", 5, 1, { reserved: true }),
        field("ZF", 6, 1, { description: "Zero flag" }),
        field("SF", 7, 1, { description: "Sign flag" }),
        field("TF", 8, 1, { description: "Trap flag (single-step)" }),
        field("IF", 9, 1, { description: "Interrupt enable flag" }),
        field("DF", 10, 1, { description: "Direction flag" }),
        field("OF", 11, 1, { description: "Overflow flag" }),
        field("IOPL", 12, 2, { description: "I/O privilege level" }),
        field("NT", 14, 1, { description: "Nested task flag" }),
        field("RESERVED_15", 15, 1, { reserved: true }),
        field("RF", 16, 1, { description: "Resume flag" }),
        field("VM", 17, 1, { description: "Virtual-8086 mode" }),
        field("AC", 18, 1, { description: "Alignment check / access control" }),
        field("VIF", 19, 1, { description: "Virtual interrupt flag" }),
        field("VIP", 20, 1, { description: "Virtual interrupt pending" }),
        field("ID", 21, 1, { description: "CPUID instruction available" }),
        field("RESERVED_22", 22, 10, { reserved: true }),
      ],
    },
  },
];

/** Find a preset by id. */
export function getPreset(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id);
}

/** Deep-clone a layout (so callers can mutate freely). */
export function cloneLayout(layout: Layout): Layout {
  return JSON.parse(JSON.stringify(layout)) as Layout;
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:bit-field-bitmask-flags-designer-decoder:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  layoutName: string;
  width: BitWidth;
  value: string;
  hex: string;
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
// Saved layouts (localStorage)
// ---------------------------------------------------------------------------

const LAYOUTS_KEY = "unqtools:bit-field-bitmask-flags-designer-decoder:layouts";

export function loadSavedLayouts(): { name: string; layout: Layout }[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(LAYOUTS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as { name: string; layout: Layout }[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveSavedLayout(name: string, layout: Layout): { name: string; layout: Layout }[] {
  const existing = loadSavedLayouts().filter((l) => l.name !== name);
  const next = [{ name, layout }, ...existing].slice(0, 20);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(LAYOUTS_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function deleteSavedLayout(name: string): { name: string; layout: Layout }[] {
  const next = loadSavedLayouts().filter((l) => l.name !== name);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(LAYOUTS_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

// ---------------------------------------------------------------------------
// Shareable URL — encodes the entire layout + current value
// ---------------------------------------------------------------------------

export interface ShareState {
  layout: Layout;
  value: string; // hex form, no 0x prefix
}

function encodeLayoutToParam(layout: Layout): string {
  // Compact JSON, then base64 (URL-safe) via encodeURIComponent
  const json = JSON.stringify(layout);
  return encodeURIComponent(json);
}

function decodeLayoutFromParam(param: string): Layout | null {
  try {
    const json = decodeURIComponent(param);
    const obj = JSON.parse(json) as Layout;
    if (!obj || typeof obj !== "object" || !Array.isArray(obj.fields)) return null;
    return obj;
  } catch {
    return null;
  }
}

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  params.set("l", encodeLayoutToParam(state.layout));
  if (state.value) params.set("v", state.value);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState | null {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return null;
  const params = new URLSearchParams(clean);
  const l = params.get("l");
  if (!l) return null;
  const layout = decodeLayoutFromParam(l);
  if (!layout) return null;
  const value = params.get("v") ?? "";
  return { layout, value };
}
