import { describe, it, expect } from "vitest";
import { encode, decode, standardToUrlSafe, urlSafeToStandard, isValidUrlSafeBase64 } from "./logic";

describe("URL-safe Base64", () => {
  it("encodes text", () => {
    const encoded = encode("hello");
    expect(encoded).not.toContain("+");
    expect(encoded).not.toContain("/");
  });
  it("decodes text", () => {
    const encoded = encode("hello world");
    expect(decode(encoded)).toBe("hello world");
  });
  it("round-trips", () => {
    const input = "The quick brown fox!";
    expect(decode(encode(input))).toBe(input);
  });
  it("converts standard to url-safe", () => {
    expect(standardToUrlSafe("a+b/c=")).toBe("a-b_c");
  });
  it("converts url-safe to standard", () => {
    expect(urlSafeToStandard("a-b_c")).toBe("a+b/c=");
  });
  it("validates url-safe base64", () => {
    expect(isValidUrlSafeBase64("a-b_c")).toBe(true);
    expect(isValidUrlSafeBase64("a+b/c")).toBe(false);
  });
});
