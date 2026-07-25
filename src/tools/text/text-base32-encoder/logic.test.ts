import { describe, it, expect } from "vitest";
import { encodeBase32, decodeBase32, encodeText, decodeText, validateInput } from "./logic";

describe("encodeBase32", () => {
  it("encodes empty bytes", () => {
    expect(encodeBase32([])).toBe("");
  });
  it("encodes RFC 4648 test vectors", () => {
    expect(encodeBase32([0x66])).toBe("MY======");
    expect(encodeBase32([0x66, 0x6f])).toBe("MZXQ====");
    expect(encodeBase32([0x66, 0x6f, 0x6f])).toBe("MZXW6===");
    expect(encodeBase32([0x66, 0x6f, 0x6f, 0x62])).toBe("MZXW6YQ=");
    expect(encodeBase32([0x66, 0x6f, 0x6f, 0x62, 0x61])).toBe("MZXW6YTB");
  });
});

describe("decodeBase32", () => {
  it("decodes empty string", () => {
    expect(decodeBase32("")).toEqual([]);
  });
  it("decodes RFC 4648 test vectors", () => {
    expect(decodeBase32("MY======")).toEqual([0x66]);
    expect(decodeBase32("MZXQ====")).toEqual([0x66, 0x6f]);
    expect(decodeBase32("MZXW6===")).toEqual([0x66, 0x6f, 0x6f]);
    expect(decodeBase32("MZXW6YQ=")).toEqual([0x66, 0x6f, 0x6f, 0x62]);
    expect(decodeBase32("MZXW6YTB")).toEqual([0x66, 0x6f, 0x6f, 0x62, 0x61]);
  });
  it("returns error for invalid char", () => {
    expect("error" in decodeBase32("M!XQ====")).toBe(true);
  });
  it("accepts lowercase input", () => {
    expect(decodeBase32("mzxq====")).toEqual([0x66, 0x6f]);
  });
});

describe("encodeText / decodeText round-trip", () => {
  it("round-trips ASCII", () => {
    const enc = encodeText("Hello");
    const dec = decodeText(enc.output);
    expect("error" in dec).toBe(false);
    if (!("error" in dec)) expect(dec.output).toBe("Hello");
  });
  it("round-trips unicode", () => {
    const enc = encodeText("héllo");
    const dec = decodeText(enc.output);
    if (!("error" in dec)) expect(dec.output).toBe("héllo");
  });
  it("round-trips empty string", () => {
    const enc = encodeText("");
    expect(enc.output).toBe("");
  });
});

describe("validateInput", () => {
  it("accepts valid encode input", () => {
    expect(validateInput("Hi", "encode")).toEqual({ ok: true });
  });
  it("accepts valid decode input", () => {
    expect(validateInput("MZXQ====", "decode")).toEqual({ ok: true });
  });
  it("rejects invalid decode input", () => {
    expect(validateInput("M!XQ====", "decode")).toHaveProperty("error");
  });
});
