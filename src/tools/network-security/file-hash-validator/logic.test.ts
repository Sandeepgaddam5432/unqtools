import { describe, it, expect } from "vitest";
import {
  md5, verifyHash, detectAlgorithmFromHash, parseHashList, formatHashList,
} from "./logic";

describe("File Hash Validator", () => {
  it("computes MD5 of empty string", () => {
    const bytes = new TextEncoder().encode("");
    const hash = md5(bytes);
    expect(hash).toBe("d41d8cd98f00b204e9800998ecf8427e");
  });

  it("computes MD5 of 'abc'", () => {
    const bytes = new TextEncoder().encode("abc");
    const hash = md5(bytes);
    expect(hash).toBe("900150983cd24fb0d6963f7d28e17f72");
  });

  it("computes MD5 of 'message digest'", () => {
    const bytes = new TextEncoder().encode("message digest");
    const hash = md5(bytes);
    expect(hash).toBe("f96b697d7cb7938d525a2f31aaf161d0");
  });

  it("computes MD5 of longer text", () => {
    const bytes = new TextEncoder().encode("The quick brown fox jumps over the lazy dog");
    const hash = md5(bytes);
    expect(hash).toBe("9e107d9d372bb6826bd81d3542a419d6");
  });

  it("verifies matching hash", () => {
    const result = verifyHash("d41d8cd98f00b204e9800998ecf8427e", "D41D8CD98F00B204E9800998ECF8427E");
    expect(result.match).toBe(true);
  });

  it("verifies non-matching hash", () => {
    const result = verifyHash("d41d8cd98f00b204e9800998ecf8427e", "abc123");
    expect(result.match).toBe(false);
  });

  it("verifies with whitespace differences", () => {
    const result = verifyHash("  d41d8cd98f00b204e9800998ecf8427e  ", "d41d8cd98f00b204e9800998ecf8427e");
    expect(result.match).toBe(true);
  });

  it("detects MD5 from length 32", () => {
    expect(detectAlgorithmFromHash("d41d8cd98f00b204e9800998ecf8427e")).toBe("MD5");
  });

  it("detects SHA-1 from length 40", () => {
    expect(detectAlgorithmFromHash("aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d")).toBe("SHA-1");
  });

  it("detects SHA-256 from length 64", () => {
    expect(detectAlgorithmFromHash("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")).toBe("SHA-256");
  });

  it("detects SHA-512 from length 128", () => {
    const hash = "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e";
    expect(detectAlgorithmFromHash(hash)).toBe("SHA-512");
  });

  it("detects unknown algorithm from wrong length", () => {
    expect(detectAlgorithmFromHash("abc123")).toBe("Unknown");
  });

  it("parses GNU sha256sum-style hash list", () => {
    const text = "d41d8cd98f00b204e9800998ecf8427e  file1.txt\n900150983cd24fb0d6963f7d28e17f72  file2.txt";
    const parsed = parseHashList(text);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].hash).toBe("d41d8cd98f00b204e9800998ecf8427e");
    expect(parsed[0].filename).toBe("file1.txt");
  });

  it("parses hash list with asterisk separator", () => {
    const text = "d41d8cd98f00b204e9800998ecf8427e *file1.txt";
    const parsed = parseHashList(text);
    expect(parsed[0].filename).toBe("file1.txt");
  });

  it("formats hash list (GNU style)", () => {
    const results = [
      { algorithm: "MD5", hex: "d41d8cd98f00b204e9800998ecf8427e", base64: "", size: 0 },
      { algorithm: "SHA-256", hex: "e3b0c442", base64: "", size: 0 },
    ];
    const formatted = formatHashList(results);
    expect(formatted).toContain("d41d8cd98f00b204e9800998ecf8427e  file-0");
    expect(formatted).toContain("e3b0c442  file-0");
  });

  it("handles single byte input", () => {
    const bytes = new Uint8Array([0x61]); // 'a'
    expect(md5(bytes)).toBe("0cc175b9c0f1b6a831c399e269772661");
  });

  it("handles input longer than 64 bytes", () => {
    const text = "a".repeat(100);
    const bytes = new TextEncoder().encode(text);
    const hash = md5(bytes);
    expect(hash).toHaveLength(32);
    expect(hash).toMatch(/^[0-9a-f]{32}$/);
  });
});
