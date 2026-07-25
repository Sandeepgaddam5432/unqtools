import { describe, it, expect } from "vitest";
import { splitJwt, base64urlDecode, safeJsonParse, decodeJwt, extractClaims, epochToIso } from "./logic";

describe("splitJwt", () => {
  it("splits 3 dot-separated parts", () => {
    const r = splitJwt("a.b.c");
    if ("error" in r) throw new Error("should not error");
    expect(r.header).toBe("a");
    expect(r.payload).toBe("b");
    expect(r.signature).toBe("c");
  });
  it("errors on wrong count", () => {
    expect(splitJwt("ab")).toHaveProperty("error");
    expect(splitJwt("a.b.c.d")).toHaveProperty("error");
  });
});

describe("base64urlDecode", () => {
  it("decodes standard base64url", () => {
    // "hello" base64url = "aGVsbG8"
    expect(base64urlDecode("aGVsbG8")).toBe("hello");
  });
  it("handles padding absence", () => {
    expect(base64urlDecode("YWJjZA")).toBe("abcd");
  });
});

describe("safeJsonParse", () => {
  it("parses valid JSON", () => {
    expect(safeJsonParse('{"a":1}')).toEqual({ a: 1 });
  });
  it("returns null on invalid JSON", () => {
    expect(safeJsonParse("not json")).toBeNull();
  });
});

describe("decodeJwt", () => {
  // {"alg":"HS256"} . {"sub":"123"} . sig
  const header = "eyJhbGciOiJIUzI1NiJ9";
  const payload = "eyJzdWIiOiIxMjMifQ";
  const sig = "signature";
  it("decodes header and payload", () => {
    const r = decodeJwt(`${header}.${payload}.${sig}`);
    if ("error" in r) throw new Error("should not error");
    expect(r.header).toEqual({ alg: "HS256" });
    expect(r.payload).toEqual({ sub: "123" });
  });
  it("errors on malformed input", () => {
    expect(decodeJwt("bad")).toHaveProperty("error");
  });
});

describe("extractClaims", () => {
  it("extracts standard claims", () => {
    const claims = extractClaims({ sub: "u1", iss: "me", extra: "ignored" });
    expect(claims.sub).toBe("u1");
    expect(claims.iss).toBe("me");
    expect(claims.extra).toBeUndefined();
  });
  it("returns empty for non-object", () => {
    expect(extractClaims(null)).toEqual({});
  });
});

describe("epochToIso", () => {
  it("converts seconds to ISO string", () => {
    expect(epochToIso(0)).toBe("1970-01-01T00:00:00.000Z");
  });
});
