import { describe, it, expect } from "vitest";
import { rotateChar, rotate, rot13, encode, decode, validateRot, allRotations } from "./logic";

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
