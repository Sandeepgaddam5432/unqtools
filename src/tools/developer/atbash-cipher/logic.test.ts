import { describe, it, expect } from "vitest";
import { atbashEncode, atbashDecode, atbashEncodeGrouped, getStats } from "./logic";

describe("Atbash Cipher", () => {
  it("encodes a→z", () => expect(atbashEncode("a")).toBe("z"));
  it("encodes z→a", () => expect(atbashEncode("z")).toBe("a"));
  it("encodes hello→svool", () => expect(atbashEncode("hello")).toBe("svool"));
  it("preserves case", () => expect(atbashEncode("Hello")).toBe("Svool"));
  it("preserves non-alpha", () => expect(atbashEncode("Hello, World!")).toBe("Svool, Dliow!"));
  it("is self-inverse", () => {
    const original = "Test Message 123!";
    expect(atbashDecode(atbashEncode(original))).toBe(original);
  });
  it("groups output", () => {
    const r = atbashEncodeGrouped("hello world");
    expect(r).toBe("svool dliow");
  });
  it("gets stats", () => {
    const s = getStats("Hello!", "Svool!");
    expect(s.alphaChars).toBe(5);
    expect(s.nonAlpha).toBe(1);
  });
  it("handles empty string", () => expect(atbashEncode("")).toBe(""));
  it("handles numbers", () => expect(atbashEncode("123")).toBe("123"));
});
