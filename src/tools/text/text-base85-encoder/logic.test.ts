import { describe, it, expect } from "vitest";
import { encodeAscii85, decodeAscii85, encodeText, decodeText, validateInput } from "./logic";

describe("encodeAscii85", () => {
  it("encodes empty bytes", () => {
    expect(encodeAscii85([], { delimiter: false })).toBe("");
  });
  it("encodes 'Man' (3 bytes) as 4 chars", () => {
    const bytes = [0x4d, 0x61, 0x6e];
    expect(encodeAscii85(bytes, { delimiter: false })).toBe("9jqo");
  });
  it("encodes 'Man ' (4 bytes) as 5 chars", () => {
    const bytes = [0x4d, 0x61, 0x6e, 0x20];
    expect(encodeAscii85(bytes, { delimiter: false })).toBe("9jqo^");
  });
  it("encodes zero chunk as 'z' shortcut", () => {
    const bytes = [0, 0, 0, 0];
    expect(encodeAscii85(bytes, { delimiter: false })).toBe("z");
  });
  it("adds delimiters when requested", () => {
    const bytes = [0x4d, 0x61, 0x6e];
    expect(encodeAscii85(bytes, { delimiter: true })).toBe("<~9jqo~>");
  });
});

describe("decodeAscii85", () => {
  it("decodes empty string", () => {
    expect(decodeAscii85("")).toEqual([]);
  });
  it("decodes '9jqo' to 'Man'", () => {
    expect(decodeAscii85("9jqo")).toEqual([0x4d, 0x61, 0x6e]);
  });
  it("decodes 'z' shortcut to four zero bytes", () => {
    expect(decodeAscii85("z")).toEqual([0, 0, 0, 0]);
  });
  it("returns error for invalid char", () => {
    expect("error" in decodeAscii85("9jqo~>")).toBe(false);
  });
  it("strips delimiters", () => {
    expect(decodeAscii85("<~9jqo~>")).toEqual([0x4d, 0x61, 0x6e]);
  });
});

describe("encodeText / decodeText round-trip", () => {
  it("round-trips ASCII", () => {
    const enc = encodeText("Hello", { delimiter: false });
    const dec = decodeText(enc.output);
    if (!("error" in dec)) expect(dec.output).toBe("Hello");
  });
  it("round-trips empty string", () => {
    expect(encodeText("", { delimiter: false }).output).toBe("");
  });
});

describe("validateInput", () => {
  it("accepts valid encode input", () => {
    expect(validateInput("Hi", "encode")).toEqual({ ok: true });
  });
  it("accepts valid decode input", () => {
    expect(validateInput("9jqo", "decode")).toEqual({ ok: true });
  });
  it("rejects invalid decode input", () => {
    expect(validateInput("9jqo~", "decode")).toHaveProperty("error");
  });
});
