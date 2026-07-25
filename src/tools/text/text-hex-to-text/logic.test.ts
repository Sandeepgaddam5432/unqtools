import { describe, it, expect } from "vitest";
import { normalizeHex, isValidHex, splitPairs, hexPairToByte, decodeBytes, hexToText, validateOptions } from "./logic";

describe("normalizeHex", () => {
  it("strips non-hex chars", () => {
    expect(normalizeHex("48 65")).toBe("4865");
  });
  it("lowercases uppercase hex", () => {
    expect(normalizeHex("AaBb")).toBe("aabb");
  });
  it("returns empty for non-hex input", () => {
    expect(normalizeHex("xyz")).toBe("");
  });
});

describe("isValidHex", () => {
  it("accepts even-length hex", () => {
    expect(isValidHex("4865")).toBe(true);
  });
  it("rejects odd-length hex", () => {
    expect(isValidHex("486")).toBe(false);
  });
  it("rejects non-hex chars", () => {
    expect(isValidHex("48zz")).toBe(false);
  });
});

describe("splitPairs", () => {
  it("splits into 2-char pairs", () => {
    expect(splitPairs("48656c")).toEqual(["48", "65", "6c"]);
  });
  it("leaves a trailing single char as a pair", () => {
    expect(splitPairs("486")).toEqual(["48", "6"]);
  });
});

describe("hexPairToByte", () => {
  it("converts hex pair to byte", () => {
    expect(hexPairToByte("48")).toBe(0x48);
    expect(hexPairToByte("ff")).toBe(255);
  });
  it("returns -1 for invalid pair", () => {
    expect(hexPairToByte("zz")).toBe(-1);
  });
});

describe("decodeBytes", () => {
  it("decodes ASCII bytes", () => {
    expect(decodeBytes([0x48, 0x69], "ascii")).toBe("Hi");
  });
  it("decodes UTF-8 multibyte", () => {
    // © = U+00A9 → 0xc2 0xa9
    expect(decodeBytes([0xc2, 0xa9], "utf-8")).toBe("©");
  });
  it("decodes UTF-16 LE", () => {
    expect(decodeBytes([0x48, 0x00, 0x69, 0x00], "utf-16le")).toBe("Hi");
  });
  it("decodes UTF-16 BE", () => {
    expect(decodeBytes([0x00, 0x48, 0x00, 0x69], "utf-16be")).toBe("Hi");
  });
});

describe("hexToText", () => {
  it("converts hex to text", () => {
    const r = hexToText("4865", { encoding: "ascii", separator: "" });
    expect(r.output).toBe("He");
  });
  it("handles empty input", () => {
    const r = hexToText("", { encoding: "utf-8", separator: "" });
    expect(r.output).toBe("");
    expect(r.byteCount).toBe(0);
  });
  it("counts bytes", () => {
    const r = hexToText("48656c6c6f", { encoding: "ascii", separator: "" });
    expect(r.byteCount).toBe(5);
    expect(r.output).toBe("Hello");
  });
});

describe("validateOptions", () => {
  it("accepts valid encoding", () => {
    expect(validateOptions({ encoding: "utf-8", separator: "" })).toEqual({ ok: true });
  });
  it("rejects invalid encoding", () => {
    expect(validateOptions({ encoding: "latin1" as never, separator: "" })).toHaveProperty("error");
  });
});
