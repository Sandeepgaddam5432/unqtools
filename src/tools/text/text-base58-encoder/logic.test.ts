import { describe, it, expect } from "vitest";
import { encodeBase58, decodeBase58, encodeText, decodeText, validateInput } from "./logic";

describe("encodeBase58", () => {
  it("encodes empty bytes", () => {
    expect(encodeBase58([])).toBe("");
  });
  it("encodes leading zeros as 1s", () => {
    expect(encodeBase58([0])).toBe("1");
    expect(encodeBase58([0, 0])).toBe("11");
  });
  it("encodes 'Hello World'", () => {
    const bytes = "Hello World".split("").map((c) => c.charCodeAt(0));
    expect(encodeBase58(bytes)).toBe("JxF12TrwUP45BMd");
  });
  it("encodes Bitcoin genesis block prefix", () => {
    const bytes = [0x00, 0x00, 0x00, 0x00, 0xde, 0xad, 0xbe, 0xef];
    expect(encodeBase58(bytes)).toMatch(/^1111/);
  });
});

describe("decodeBase58", () => {
  it("decodes empty string", () => {
    expect(decodeBase58("")).toEqual([]);
  });
  it("round-trips through encode", () => {
    const bytes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const enc = encodeBase58(bytes);
    const dec = decodeBase58(enc);
    expect("error" in dec).toBe(false);
    if (!("error" in dec)) expect(dec).toEqual(bytes);
  });
  it("returns error for invalid char", () => {
    expect("error" in decodeBase58("0")).toBe(true); // 0 not in Bitcoin alphabet
  });
  it("decodes 1 to 0 byte", () => {
    expect(decodeBase58("1")).toEqual([0]);
  });
});

describe("encodeText / decodeText round-trip", () => {
  it("round-trips ASCII text", () => {
    const enc = encodeText("Hello");
    const dec = decodeText(enc.output);
    if (!("error" in dec)) expect(dec.output).toBe("Hello");
  });
  it("round-trips unicode", () => {
    const enc = encodeText("héllo");
    const dec = decodeText(enc.output);
    if (!("error" in dec)) expect(dec.output).toBe("héllo");
  });
  it("round-trips empty string", () => {
    expect(encodeText("").output).toBe("");
  });
});

describe("validateInput", () => {
  it("accepts valid encode input", () => {
    expect(validateInput("Hi", "encode")).toEqual({ ok: true });
  });
  it("accepts valid decode input", () => {
    expect(validateInput("JxF12TrwUP45BMd", "decode")).toEqual({ ok: true });
  });
  it("rejects invalid decode input", () => {
    expect(validateInput("0", "decode")).toHaveProperty("error");
  });
});
