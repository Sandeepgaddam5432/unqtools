import { describe, it, expect } from "vitest";
import {
  rotateChar,
  rotate,
  rot13,
  encode,
  decode,
  validateRot,
  allRotations,
  normalizeRot,
  rotateBatch,
  computeStats,
  detectRotation,
  rotationTable,
  historyToCsv,
  formatHistoryEntry,
  ROT_PRESETS,
} from "./logic";

describe("rotateChar", () => {
  it("rotates uppercase A by 13 to N", () => {
    expect(rotateChar("A", 13)).toBe("N");
  });
  it("rotates lowercase a by 13 to n", () => {
    expect(rotateChar("a", 13)).toBe("n");
  });
  it("wraps Z past A", () => {
    expect(rotateChar("Z", 1)).toBe("A");
  });
  it("leaves non-letters untouched", () => {
    expect(rotateChar("5", 13)).toBe("5");
    expect(rotateChar("!", 7)).toBe("!");
  });
  it("rotates digits when rotateDigits is true", () => {
    expect(rotateChar("5", 5, true)).toBe("0");
    expect(rotateChar("9", 1, true)).toBe("0");
  });
});

describe("normalizeRot", () => {
  it("wraps negative rotations", () => {
    expect(normalizeRot(-1)).toBe(25);
  });
  it("wraps large rotations", () => {
    expect(normalizeRot(27)).toBe(1);
  });
  it("returns 0 for NaN", () => {
    expect(normalizeRot(NaN)).toBe(0);
  });
});

describe("rotate", () => {
  it("rotates full strings", () => {
    expect(rotate("Hello, World!", 13)).toBe("Uryyb, Jbeyq!");
  });
  it("handles ROT0 (identity)", () => {
    expect(rotate("abc", 0)).toBe("abc");
  });
  it("handles negative rotation", () => {
    expect(rotate("N", -13)).toBe("A");
  });
  it("returns empty for empty input", () => {
    expect(rotate("", 13)).toBe("");
  });
});

describe("rot13", () => {
  it("is its own inverse", () => {
    const s = "The quick brown fox";
    expect(rot13(rot13(s))).toBe(s);
  });
  it("rotates 13 places", () => {
    expect(rot13("ABC")).toBe("NOP");
  });
});

describe("encode/decode", () => {
  it("encode/decode round-trips with default ROT13", () => {
    const s = "Secret message 42";
    expect(decode(encode(s))).toBe(s);
  });
  it("works with custom ROT5", () => {
    const s = "Hello";
    expect(decode(encode(s, 5), 5)).toBe(s);
  });
  it("supports digit rotation", () => {
    expect(encode("abc123", 5, true)).toBe("fgh678");
  });
});

describe("validateRot", () => {
  it("accepts valid rotation", () => {
    expect(validateRot(13)).toBe(13);
  });
  it("rejects zero", () => {
    expect("error" in validateRot(0)).toBe(true);
  });
  it("rejects out-of-range", () => {
    expect("error" in validateRot(30)).toBe(true);
  });
});

describe("allRotations", () => {
  it("returns 25 variants", () => {
    const all = allRotations("Hi");
    expect(all.length).toBe(25);
    expect(all[0].rot).toBe(1);
    expect(all[24].rot).toBe(25);
  });
});

describe("rotateBatch", () => {
  it("rotates multiple inputs", () => {
    expect(rotateBatch(["abc", "xyz"], 1)).toEqual(["bcd", "yza"]);
  });
});

describe("computeStats", () => {
  it("counts rotated letters", () => {
    const s = computeStats("Hello, World!", 13);
    expect(s.chars).toBe(13);
    expect(s.lettersRotated).toBe(10);
    expect(s.preserved).toBe(3);
    expect(s.digitsRotated).toBe(0);
    expect(s.rot).toBe(13);
  });
  it("counts rotated digits", () => {
    const s = computeStats("a1b2", 5, true);
    expect(s.lettersRotated).toBe(2);
    expect(s.digitsRotated).toBe(2);
  });
});

describe("detectRotation", () => {
  it("detects ROT13", () => {
    expect(detectRotation("A", "N")).toBe(13);
  });
  it("detects ROT1", () => {
    expect(detectRotation("A", "B")).toBe(1);
  });
  it("returns null for non-letter input", () => {
    expect(detectRotation("!", "!")).toBeNull();
  });
});

describe("rotationTable", () => {
  it("returns 26 entries", () => {
    const t = rotationTable(13);
    expect(t.length).toBe(26);
    expect(t[0]).toEqual({ from: "A", to: "N" });
  });
});

describe("historyToCsv", () => {
  it("generates CSV with header", () => {
    const csv = historyToCsv([
      { ts: 1700000000000, rot: 13, input: "Hi", output: "Uv" },
    ]);
    expect(csv.split("\n")[0]).toBe("Timestamp,Rotation,Input,Output");
    expect(csv).toContain("Hi");
  });
});

describe("formatHistoryEntry", () => {
  it("formats with ROT prefix", () => {
    const s = formatHistoryEntry({ ts: 1700000000000, rot: 13, input: "Hi", output: "Uv" });
    expect(s).toContain("ROT13");
    expect(s).toContain("Uv");
  });
});

describe("ROT_PRESETS", () => {
  it("contains multiple presets", () => {
    expect(ROT_PRESETS.length).toBeGreaterThanOrEqual(5);
    expect(ROT_PRESETS.some((p) => p.name.startsWith("ROT13"))).toBe(true);
  });
});
