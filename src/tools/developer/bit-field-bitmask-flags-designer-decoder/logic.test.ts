import { describe, it, expect, beforeEach } from "vitest";
import {
  BIT_WIDTHS,
  FIELD_COLORS,
  PRESETS,
  fieldColor,
  fieldMask,
  fieldMaskShifted,
  fieldMaxValue,
  fieldEndBit,
  layoutCapacity,
  toLsb0,
  validateLayout,
  reservedBits,
  encodeFields,
  decodeValue,
  maskWidth,
  toBinaryString,
  formatInBases,
  parseInteger,
  buildBitStrip,
  generateCode,
  generateCodeC,
  generateCodeRust,
  generateCodePython,
  generateCodeGo,
  generateCodeTypeScript,
  getPreset,
  cloneLayout,
  loadHistory,
  saveHistory,
  clearHistory,
  loadSavedLayouts,
  saveSavedLayout,
  deleteSavedLayout,
  buildShareUrl,
  parseShareUrl,
  type BitWidth,
  type Layout,
  type BitField,
  type CodeLang,
} from "./logic";

// Helper to build a clean field with a unique id (since makeId is internal).
let _testIdCounter = 0;
function tf(name: string, startBit: number, width: number, extra: Partial<BitField> = {}): BitField {
  _testIdCounter += 1;
  return { id: `test_${_testIdCounter}`, name, startBit, width, ...extra };
}

function abModeLayout(): Layout {
  // Per blueprint acceptance: A=bit0, B=bit1, MODE=bits2-3
  return {
    name: "ABMode",
    width: 8,
    numbering: "LSB0",
    fields: [
      tf("A", 0, 1),
      tf("B", 1, 1),
      tf("MODE", 2, 2, { enums: [
        { value: 0, label: "OFF" },
        { value: 1, label: "AUTO" },
        { value: 2, label: "ON" },
        { value: 3, label: "MAX" },
      ] }),
    ],
  };
}

beforeEach(() => {
  const store: Record<string, string> = {};
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  };
});

describe("bit-field-bitmask-flags-designer-decoder constants", () => {
  it("exposes 4 bit widths", () => {
    expect(BIT_WIDTHS).toEqual([8, 16, 32, 64]);
  });
  it("has at least 15 colors for the visual strip", () => {
    expect(FIELD_COLORS.length).toBeGreaterThanOrEqual(15);
  });
  it("fieldColor cycles through palette", () => {
    expect(fieldColor(0)).toBe(FIELD_COLORS[0]);
    expect(fieldColor(FIELD_COLORS.length)).toBe(FIELD_COLORS[0]);
  });
  it("has 5 presets", () => {
    expect(PRESETS).toHaveLength(5);
    const ids = PRESETS.map((p) => p.id);
    expect(ids).toContain("posix-file-mode");
    expect(ids).toContain("tcp-flags");
    expect(ids).toContain("fat-attrs");
    expect(ids).toContain("arm-cpsr");
    expect(ids).toContain("x86-eflags");
  });
  it("getPreset finds by id and returns undefined for unknown", () => {
    expect(getPreset("tcp-flags")?.name).toMatch(/TCP/);
    expect(getPreset("nope")).toBeUndefined();
  });
});

describe("bit-field-bitmask-flags-designer-decoder field helpers", () => {
  it("fieldMask covers field bits", () => {
    expect(fieldMask(tf("X", 0, 1))).toBe(1n);
    expect(fieldMask(tf("X", 0, 4))).toBe(0xFn);
    expect(fieldMask(tf("X", 0, 8))).toBe(0xFFn);
  });
  it("fieldMaskShifted is mask at position", () => {
    expect(fieldMaskShifted(tf("X", 4, 4))).toBe(0xF0n);
    expect(fieldMaskShifted(tf("X", 0, 2))).toBe(0x3n);
  });
  it("fieldMaxValue is 2^width - 1", () => {
    expect(fieldMaxValue(tf("X", 0, 1))).toBe(1);
    expect(fieldMaxValue(tf("X", 0, 4))).toBe(15);
    expect(fieldMaxValue(tf("X", 0, 8))).toBe(255);
  });
  it("fieldEndBit returns inclusive end", () => {
    expect(fieldEndBit(tf("X", 2, 3))).toBe(4);
  });
  it("layoutCapacity matches width", () => {
    expect(layoutCapacity(8)).toBe(8);
    expect(layoutCapacity(64)).toBe(64);
  });
  it("toLsb0 converts MSB0 numbering to LSB0", () => {
    expect(toLsb0(8, "LSB0", 3)).toBe(3);
    expect(toLsb0(8, "MSB0", 0)).toBe(7);
    expect(toLsb0(8, "MSB0", 7)).toBe(0);
  });
});

describe("bit-field-bitmask-flags-designer-decoder validateLayout", () => {
  it("accepts a valid layout (blueprint ABMode)", () => {
    expect(validateLayout(abModeLayout())).toEqual([]);
  });
  it("rejects overlapping fields with a clear message", () => {
    const layout: Layout = {
      name: "Bad",
      width: 8,
      numbering: "LSB0",
      fields: [
        tf("A", 0, 4),
        tf("B", 2, 4), // overlaps A (bits 2-3)
      ],
    };
    const errs = validateLayout(layout);
    expect(errs.length).toBeGreaterThan(0);
    expect(errs.some((e) => /overlap/i.test(e.message))).toBe(true);
  });
  it("rejects out-of-range fields", () => {
    const layout: Layout = {
      name: "Bad",
      width: 8,
      numbering: "LSB0",
      fields: [tf("A", 6, 4)], // bits 6-9, exceeds 8-bit word
    };
    const errs = validateLayout(layout);
    expect(errs.length).toBeGreaterThan(0);
    expect(errs.some((e) => /exceeds/i.test(e.message))).toBe(true);
  });
  it("rejects width=0 fields", () => {
    const layout: Layout = {
      name: "Bad",
      width: 8,
      numbering: "LSB0",
      fields: [tf("A", 0, 0)],
    };
    expect(validateLayout(layout).length).toBeGreaterThan(0);
  });
  it("rejects negative start bits", () => {
    const layout: Layout = {
      name: "Bad",
      width: 8,
      numbering: "LSB0",
      fields: [tf("A", -1, 1)],
    };
    expect(validateLayout(layout).length).toBeGreaterThan(0);
  });
  it("rejects duplicate field names", () => {
    const layout: Layout = {
      name: "Bad",
      width: 8,
      numbering: "LSB0",
      fields: [tf("X", 0, 1), tf("X", 1, 1)],
    };
    expect(validateLayout(layout).some((e) => /duplicate/i.test(e.message))).toBe(true);
  });
  it("all presets validate cleanly", () => {
    for (const p of PRESETS) {
      expect(validateLayout(p.layout), `preset ${p.id} should validate`).toEqual([]);
    }
  });
  it("reservedBits returns unused bit positions", () => {
    const layout: Layout = {
      name: "Sparse",
      width: 8,
      numbering: "LSB0",
      fields: [tf("A", 0, 1), tf("B", 7, 1)],
    };
    const r = reservedBits(layout);
    expect(r).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe("bit-field-bitmask-flags-designer-decoder encodeFields (blueprint acceptance)", () => {
  it("encodes A=1, B=0, MODE=2 → 0b1001 (9)", () => {
    const layout = abModeLayout();
    const r = encodeFields(layout, [
      { fieldId: layout.fields[0].id, value: 1 }, // A
      { fieldId: layout.fields[1].id, value: 0 }, // B
      { fieldId: layout.fields[2].id, value: 2 }, // MODE
    ]);
    expect(r.value).toBe(9n);
    expect(r.bases.bin).toBe("00001001");
    expect(r.bases.hex).toBe("09");
    expect(r.bases.dec).toBe("9");
    expect(r.errors).toEqual([]);
  });
  it("encodes A=1, B=1, MODE=0 → 0b0011 (3)", () => {
    const layout = abModeLayout();
    const r = encodeFields(layout, [
      { fieldId: layout.fields[0].id, value: 1 },
      { fieldId: layout.fields[1].id, value: 1 },
      { fieldId: layout.fields[2].id, value: 0 },
    ]);
    expect(r.value).toBe(3n);
  });
  it("encodes MODE=3 (max for 2-bit field) → 0b1100 (12)", () => {
    const layout = abModeLayout();
    const r = encodeFields(layout, [
      { fieldId: layout.fields[0].id, value: 0 },
      { fieldId: layout.fields[1].id, value: 0 },
      { fieldId: layout.fields[2].id, value: 3 },
    ]);
    expect(r.value).toBe(12n);
  });
  it("masks overflow values with a clear error", () => {
    const layout = abModeLayout();
    const r = encodeFields(layout, [
      { fieldId: layout.fields[2].id, value: 5 }, // exceeds max 3
    ]);
    // 5 = 0b101 → masked to 0b01 = 1 → shifted to bit 2 = 0b0100 = 4
    expect(r.value).toBe(4n);
    expect(r.fieldValues[0].overflow).toBe(true);
    expect(r.errors.length).toBeGreaterThan(0);
  });
  it("encodes partial inputs (only some fields set)", () => {
    const layout = abModeLayout();
    const r = encodeFields(layout, [
      { fieldId: layout.fields[0].id, value: 1 },
    ]);
    expect(r.value).toBe(1n); // only A set
  });
});

describe("bit-field-bitmask-flags-designer-decoder decodeValue (blueprint acceptance)", () => {
  it("decodes 0b1001 (9) → A=1, B=0, MODE=2", () => {
    const layout = abModeLayout();
    const r = decodeValue(layout, 9n);
    expect(r.fields).toHaveLength(3);
    const a = r.fields.find((f) => f.field.name === "A");
    const b = r.fields.find((f) => f.field.name === "B");
    const mode = r.fields.find((f) => f.field.name === "MODE");
    expect(a?.rawValue).toBe(1);
    expect(a?.isSet).toBe(true);
    expect(b?.rawValue).toBe(0);
    expect(b?.isSet).toBe(false);
    expect(mode?.rawValue).toBe(2);
    expect(mode?.label).toBe("ON");
  });
  it("decodes 0 → all zero", () => {
    const layout = abModeLayout();
    const r = decodeValue(layout, 0n);
    expect(r.fields.every((f) => f.rawValue === 0)).toBe(true);
  });
  it("decodes 0b1111 → A=1, B=1, MODE=3 (label MAX)", () => {
    const layout = abModeLayout();
    const r = decodeValue(layout, 0b1111n);
    const mode = r.fields.find((f) => f.field.name === "MODE");
    expect(mode?.rawValue).toBe(3);
    expect(mode?.label).toBe("MAX");
  });
  it("reports when value exceeds word width", () => {
    const layout = abModeLayout();
    const r = decodeValue(layout, 0x1FFn); // 9-bit value into 8-bit layout
    expect(r.errors.some((e) => /exceeds/i.test(e))).toBe(true);
  });
  it("detects reserved bits that are set", () => {
    const layout: Layout = {
      name: "WithReserved",
      width: 8,
      numbering: "LSB0",
      fields: [tf("A", 0, 1), tf("RESERVED", 1, 1, { reserved: true })],
    };
    const r = decodeValue(layout, 0b10n); // reserved bit set
    expect(r.reserved).toContain(1);
  });
});

describe("bit-field-bitmask-flags-designer-decoder format helpers", () => {
  it("maskWidth masks to width", () => {
    expect(maskWidth(0x1FFn, 8)).toBe(0xFFn);
    expect(maskWidth(-1n, 8)).toBe(0xFFn);
  });
  it("toBinaryString pads to width", () => {
    expect(toBinaryString(5n, 8)).toBe("00000101");
    expect(toBinaryString(0xFFn, 8)).toBe("11111111");
  });
  it("formatInBases returns bin/hex/dec", () => {
    const r = formatInBases(255n, 8);
    expect(r.bin).toBe("11111111");
    expect(r.hex).toBe("FF");
    expect(r.dec).toBe("255");
  });
});

describe("bit-field-bitmask-flags-designer-decoder parseInteger", () => {
  it("parses decimal", () => { expect(parseInteger("255")).toBe(255n); });
  it("parses hex with 0x", () => { expect(parseInteger("0xff")).toBe(255n); });
  it("parses binary with 0b", () => { expect(parseInteger("0b1010")).toBe(10n); });
  it("parses octal with 0o", () => { expect(parseInteger("0o17")).toBe(15n); });
  it("handles negatives", () => { expect(parseInteger("-1")).toBe(-1n); });
  it("throws on empty", () => { expect(() => parseInteger("")).toThrow(); });
  it("throws on invalid digit", () => { expect(() => parseInteger("0xgg")).toThrow(); });
});

describe("bit-field-bitmask-flags-designer-decoder buildBitStrip", () => {
  it("returns one cell per bit (MSB-first display)", () => {
    const layout = abModeLayout();
    const cells = buildBitStrip(layout, 9n);
    expect(cells).toHaveLength(8);
    expect(cells[0].displayIndex).toBe(0);
    expect(cells[0].bitIndex).toBe(7); // MSB first
    expect(cells[7].bitIndex).toBe(0);
  });
  it("marks cells with field name and color", () => {
    const layout = abModeLayout();
    const cells = buildBitStrip(layout, 9n);
    const bit0 = cells.find((c) => c.bitIndex === 0);
    expect(bit0?.fieldName).toBe("A");
    expect(bit0?.value).toBe(1);
    expect(bit0?.fieldColor).toBeDefined();
  });
});

describe("bit-field-bitmask-flags-designer-decoder code generation", () => {
  it("generateCode dispatches by language", () => {
    const layout = abModeLayout();
    const c = generateCode(layout, "c");
    const rust = generateCode(layout, "rust");
    const py = generateCode(layout, "python");
    const go = generateCode(layout, "go");
    const ts = generateCode(layout, "typescript");
    expect(c).toContain("typedef struct");
    expect(rust).toContain("impl");
    expect(py).toContain("@property");
    expect(go).toContain("package");
    expect(ts).toContain("export function");
  });
  it("C code includes #define masks and shifts", () => {
    const layout = abModeLayout();
    const c = generateCodeC(layout);
    expect(c).toContain("A_SHIFT");
    expect(c).toContain("A_MASK");
    expect(c).toContain("MODE_SHIFT");
    expect(c).toContain("MODE_MASK");
    expect(c).toContain("uint8_t");
  });
  it("Rust code includes bitflags! for single-bit flags", () => {
    const layout = abModeLayout();
    const rust = generateCodeRust(layout);
    expect(rust).toContain("bitflags!");
    expect(rust).toContain("const A");
    expect(rust).toContain("const B");
    // MODE is multi-bit so should not be in bitflags! but in const helpers
    expect(rust).toContain("MODE_MASK");
  });
  it("Python code uses IntFlag + @property", () => {
    const layout = abModeLayout();
    const py = generateCodePython(layout);
    expect(py).toContain("IntFlag");
    expect(py).toContain("@property");
    expect(py).toContain("def mode(");
  });
  it("Go code emits const block and getters", () => {
    const layout = abModeLayout();
    const go = generateCodeGo(layout);
    expect(go).toContain("const (");
    expect(go).toContain("GetA");
    expect(go).toContain("SetA");
    expect(go).toContain("GetMODE");
    expect(go).toContain("SetMODE");
  });
  it("TypeScript code exports const + helper functions", () => {
    const layout = abModeLayout();
    const ts = generateCodeTypeScript(layout);
    expect(ts).toContain("export const ABModeFlags");
    expect(ts).toContain("getA");
    expect(ts).toContain("setA");
    expect(ts).toContain("getMODE");
  });
  it("64-bit layout generates uint64_t / bigint", () => {
    const layout: Layout = {
      name: "Big",
      width: 64,
      numbering: "LSB0",
      fields: [tf("HI", 32, 32), tf("LO", 0, 32)],
    };
    expect(generateCodeC(layout)).toContain("uint64_t");
    expect(generateCodeGo(layout)).toContain("uint64");
    expect(generateCodeTypeScript(layout)).toContain("bigint");
  });
});

describe("bit-field-bitmask-flags-designer-decoder cloneLayout", () => {
  it("produces a deep clone", () => {
    const layout = abModeLayout();
    const clone = cloneLayout(layout);
    expect(clone).not.toBe(layout);
    expect(clone.fields).not.toBe(layout.fields);
    expect(clone.fields[0]).not.toBe(layout.fields[0]);
    expect(clone.fields[0].name).toBe(layout.fields[0].name);
  });
});

describe("bit-field-bitmask-flags-designer-decoder history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads entries", () => {
    saveHistory({ ts: 1, layoutName: "L", width: 8, value: "9", hex: "09" });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].layoutName).toBe("L");
  });
  it("caps at 20 entries", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, layoutName: `L${i}`, width: 8, value: String(i), hex: "00" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears history", () => {
    saveHistory({ ts: 1, layoutName: "L", width: 8, value: "1", hex: "01" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("bit-field-bitmask-flags-designer-decoder saved layouts", () => {
  it("loads empty initially", () => {
    expect(loadSavedLayouts()).toEqual([]);
  });
  it("saves a named layout", () => {
    const layout = abModeLayout();
    const saved = saveSavedLayout("MyLayout", layout);
    expect(saved).toHaveLength(1);
    expect(saved[0].name).toBe("MyLayout");
    expect(loadSavedLayouts()).toHaveLength(1);
  });
  it("replaces same-name layout", () => {
    const l1 = abModeLayout();
    const l2 = cloneLayout(l1);
    l2.width = 16;
    saveSavedLayout("MyLayout", l1);
    saveSavedLayout("MyLayout", l2);
    expect(loadSavedLayouts()).toHaveLength(1);
    expect(loadSavedLayouts()[0].layout.width).toBe(16);
  });
  it("deletes a saved layout", () => {
    const layout = abModeLayout();
    saveSavedLayout("ToDelete", layout);
    expect(loadSavedLayouts()).toHaveLength(1);
    deleteSavedLayout("ToDelete");
    expect(loadSavedLayouts()).toEqual([]);
  });
});

describe("bit-field-bitmask-flags-designer-decoder shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const layout = abModeLayout();
    const url = buildShareUrl({ layout, value: "09" });
    expect(url).toContain("l=");
    expect(url).toContain("v=09");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("round-trips a layout via share URL", () => {
    const layout = abModeLayout();
    const url = buildShareUrl({ layout, value: "FF" });
    const hash = url.includes("#") ? url.slice(url.indexOf("#")) : url;
    const parsed = parseShareUrl(hash);
    expect(parsed).not.toBeNull();
    expect(parsed?.value).toBe("FF");
    expect(parsed?.layout.name).toBe("ABMode");
    expect(parsed?.layout.fields).toHaveLength(3);
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
  });
  it("returns null for malformed layout param", () => {
    expect(parseShareUrl("l=not-json")).toBeNull();
  });
});

// Suppress unused-import lint
export type _Unused = BitWidth | CodeLang;
