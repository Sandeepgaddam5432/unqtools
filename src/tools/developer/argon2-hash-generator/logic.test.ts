import { describe, it, expect } from "vitest";
import { encode, decode, validate, bulkEncode, bulkDecode, getStats, formatBytes, randomString, detectFormat } from "./logic";

describe("Argon2 Hash Generator", () => {
  it("encodes empty string", () => {
    expect(encode("").output).toBe("");
  });

  it("encodes a simple string", () => {
    const result = encode("hello");
    expect(result.output).toBeTruthy();
    expect(result.error).toBeUndefined();
  });

  it("decodes the encoded string back to original", () => {
    const original = "Hello World";
    const encoded = encode(original).output;
    expect(decode(encoded).output).toBe(original);
  });

  it("round-trips unicode", () => {
    const original = "héllo wörld";
    const encoded = encode(original).output;
    expect(decode(encoded).output).toBe(original);
  });

  it("round-trips with newlines", () => {
    const original = "line1\nline2\nline3";
    const encoded = encode(original).output;
    expect(decode(encoded).output).toBe(original);
  });

  it("returns error for invalid decode input", () => {
    const result = decode("!!!invalid-base64!!!");
    expect(result.error).toBeDefined();
  });

  it("validates encode mode", () => {
    expect(validate("hello", "encode").valid).toBe(true);
    expect(validate("", "encode").valid).toBe(false);
  });

  it("validates decode mode", () => {
    expect(validate(encode("test").output, "decode").valid).toBe(true);
    expect(validate("!!!invalid", "decode").valid).toBe(false);
  });

  it("bulk encodes multiple lines", () => {
    const result = bulkEncode("hello\nworld");
    expect(result).toHaveLength(2);
    expect(result[0]).toBeTruthy();
  });

  it("bulk decodes multiple lines", () => {
    const encoded = bulkEncode("hello\nworld");
    const decoded = bulkDecode(encoded.join("\n"));
    expect(decoded).toEqual(["hello", "world"]);
  });

  it("calculates stats", () => {
    const stats = getStats("hello", "aGVsbG8=");
    expect(stats.inputSize).toBe(5);
    expect(stats.outputSize).toBe(8);
    expect(stats.ratio).toBeGreaterThan(1);
  });

  it("formats bytes correctly", () => {
    expect(formatBytes(500)).toBe("500 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
  });

  it("generates random string of given length", () => {
    const result = randomString(16);
    expect(result).toHaveLength(16);
  });

  it("detects binary format", () => {
    expect(detectFormat("01001000 01101001")).toBe("binary");
  });

  it("detects hex format", () => {
    expect(detectFormat("48656c6c6f")).toBe("hex");
  });

  it("detects base64 format", () => {
    expect(detectFormat("aGVsbG8=")).toBe("base64");
  });

  it("detects text format fallback", () => {
    expect(detectFormat("Hello World!")).toBe("text");
  });

  it("handles long input", () => {
    const original = "a".repeat(1000);
    const encoded = encode(original).output;
    expect(decode(encoded).output).toBe(original);
  });
});
