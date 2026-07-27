import { describe, it, expect } from "vitest";
import { md5, detectAlgorithm, verifyHash, getAlgorithms } from "./logic";

describe("Hashing Tool", () => {
  it("computes MD5 of empty string", () => {
    expect(md5(new TextEncoder().encode(""))).toBe("d41d8cd98f00b204e9800998ecf8427e");
  });
  it("computes MD5 of 'abc'", () => {
    expect(md5(new TextEncoder().encode("abc"))).toBe("900150983cd24fb0d6963f7d28e17f72");
  });
  it("computes MD5 of 'message digest'", () => {
    expect(md5(new TextEncoder().encode("message digest"))).toBe("f96b697d7cb7938d525a2f31aaf161d0");
  });
  it("detects algorithm from hash length", () => {
    expect(detectAlgorithm("d41d8cd98f00b204e9800998ecf8427e")).toBe("MD5");
    expect(detectAlgorithm("aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d")).toBe("SHA-1");
    expect(detectAlgorithm("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")).toBe("SHA-256");
  });
  it("verifies matching hashes", () => {
    expect(verifyHash("d41d8cd98f00b204e9800998ecf8427e", "D41D8CD98F00B204E9800998ECF8427E")).toBe(true);
  });
  it("verifies non-matching hashes", () => {
    expect(verifyHash("abc", "def")).toBe(false);
  });
  it("lists all algorithms", () => {
    expect(getAlgorithms()).toContain("MD5");
    expect(getAlgorithms()).toContain("SHA-256");
  });
  it("handles single byte input", () => {
    expect(md5(new TextEncoder().encode("a"))).toBe("0cc175b9c0f1b6a831c399e269772661");
  });
  it("handles long input", () => {
    const bytes = new TextEncoder().encode("a".repeat(100));
    expect(md5(bytes)).toHaveLength(32);
  });
  it("returns Unknown for wrong length", () => {
    expect(detectAlgorithm("abc")).toBe("Unknown");
  });
});
