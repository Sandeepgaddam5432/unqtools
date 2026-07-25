import { describe, it, expect } from "vitest";
import { utf8Encode, encodeToBytes, byteToHex, textToHex, validateOptions } from "./logic";

describe("utf8Encode", () => {
  it("encodes ASCII as 1 byte", () => {
    expect(utf8Encode(0x41)).toEqual([0x41]);
  });
  it("encodes © (U+00A9) as 2 bytes", () => {
    expect(utf8Encode(0xa9)).toEqual([0xc2, 0xa9]);
  });
  it("encodes € (U+20AC) as 3 bytes", () => {
    expect(utf8Encode(0x20ac)).toEqual([0xe2, 0x82, 0xac]);
  });
  it("encodes 𝄞 (U+1D11E) as 4 bytes", () => {
    expect(utf8Encode(0x1d11e)).toEqual([0xf0, 0x9d, 0x84, 0x9e]);
  });
});

describe("encodeToBytes", () => {
  it("encodes UTF-8 bytes for ASCII text", () => {
    expect(encodeToBytes("Hi", "utf-8")).toEqual([0x48, 0x69]);
  });
  it("encodes ASCII with high bit stripped", () => {
    expect(encodeToBytes("A", "ascii")).toEqual([0x41]);
  });
  it("encodes UTF-16 LE with little-endian byte order", () => {
    expect(encodeToBytes("Hi", "utf-16le")).toEqual([0x48, 0x00, 0x69, 0x00]);
  });
  it("encodes UTF-16 BE with big-endian byte order", () => {
    expect(encodeToBytes("Hi", "utf-16be")).toEqual([0x00, 0x48, 0x00, 0x69]);
  });
});

describe("byteToHex", () => {
  it("pads to 2 chars", () => {
    expect(byteToHex(5, false)).toBe("05");
  });
  it("supports uppercase", () => {
    expect(byteToHex(0xff, true)).toBe("FF");
  });
  it("supports lowercase", () => {
    expect(byteToHex(0xff, false)).toBe("ff");
  });
});

describe("textToHex", () => {
  it("converts text to hex with separator", () => {
    const r = textToHex("Hi", { encoding: "utf-8", separator: " ", uppercase: false });
    expect(r.output).toBe("48 69");
  });
  it("handles empty input", () => {
    const r = textToHex("", { encoding: "utf-8", separator: "", uppercase: false });
    expect(r.output).toBe("");
    expect(r.byteCount).toBe(0);
  });
  it("encodes multibyte UTF-8 correctly", () => {
    const r = textToHex("©", { encoding: "utf-8", separator: "", uppercase: true });
    expect(r.output).toBe("C2A9");
  });
  it("counts bytes correctly", () => {
    const r = textToHex("Hello", { encoding: "utf-8", separator: "", uppercase: false });
    expect(r.byteCount).toBe(5);
  });
});

describe("validateOptions", () => {
  it("accepts valid encoding", () => {
    expect(validateOptions({ encoding: "utf-8", separator: "", uppercase: false })).toEqual({ ok: true });
  });
  it("rejects invalid encoding", () => {
    expect(validateOptions({ encoding: "latin1" as never, separator: "", uppercase: false })).toHaveProperty("error");
  });
});
