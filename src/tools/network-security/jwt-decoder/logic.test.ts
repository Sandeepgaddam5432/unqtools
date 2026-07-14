import { describe, it, expect } from "vitest";
import {
  decodeJwt,
  validateJwtStructure,
  base64UrlToBase64,
  base64UrlDecode,
  getAlgorithm,
  formatTimestamp,
  isExpired,
  REGISTERED_CLAIMS,
} from "./logic";

// A valid HS256 test token from jwt.io (no secret needed for decode):
// header: {"alg":"HS256","typ":"JWT"}
// payload: {"sub":"1234567890","name":"John Doe","iat":1516239022}
const VALID_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

describe("jwt-decoder validateJwtStructure", () => {
  it("accepts a valid token", () => {
    expect(validateJwtStructure(VALID_TOKEN)).toBeNull();
  });

  it("rejects empty input", () => {
    expect(validateJwtStructure("")).toMatch(/empty/i);
  });

  it("rejects tokens with too few parts", () => {
    expect(validateJwtStructure("a.b")).toMatch(/3 parts/);
  });

  it("rejects tokens with too many parts", () => {
    expect(validateJwtStructure("a.b.c.d")).toMatch(/3 parts/);
  });

  it("rejects whitespace around the token", () => {
    expect(validateJwtStructure(` ${VALID_TOKEN} `)).toMatch(/whitespace/);
  });

  it("rejects invalid base64url characters", () => {
    expect(validateJwtStructure("a.b.c+d")).toMatch(/invalid base64url/);
    expect(validateJwtStructure("a.b.c=d")).toMatch(/invalid base64url/);
  });

  it("rejects empty parts", () => {
    expect(validateJwtStructure("..c")).toMatch(/empty/);
    expect(validateJwtStructure("a..c")).toMatch(/empty/);
    expect(validateJwtStructure("a.b.")).toMatch(/empty/);
  });
});

describe("jwt-decoder base64UrlToBase64", () => {
  it("replaces - with + and _ with /", () => {
    // 8 chars (multiple of 4) — no padding needed
    expect(base64UrlToBase64("a-b_c-da")).toBe("a+b/c+da");
  });

  it("adds padding to length multiple of 4", () => {
    expect(base64UrlToBase64("YQ")).toBe("YQ==");
    expect(base64UrlToBase64("YWE")).toBe("YWE=");
    expect(base64UrlToBase64("YWFh")).toBe("YWFh");
  });
});

describe("jwt-decoder base64UrlDecode", () => {
  it("decodes the standard JWT header", () => {
    const decoded = base64UrlDecode("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
    expect(JSON.parse(decoded)).toEqual({ alg: "HS256", typ: "JWT" });
  });

  it("decodes UTF-8 characters correctly", () => {
    // "Héllo Wörld" base64url-encoded
    const decoded = base64UrlDecode("SMOpbGxvIFfDtnJsZA");
    expect(decoded).toBe("Héllo Wörld");
  });
});

describe("jwt-decoder decodeJwt", () => {
  it("decodes a valid HS256 token", () => {
    const parts = decodeJwt(VALID_TOKEN);
    expect(parts.header).toEqual({ alg: "HS256", typ: "JWT" });
    expect(parts.payload.sub).toBe("1234567890");
    expect(parts.payload.name).toBe("John Doe");
    expect(parts.payload.iat).toBe(1516239022);
    expect(parts.signature).toBe("SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c");
  });

  it("preserves raw parts", () => {
    const parts = decodeJwt(VALID_TOKEN);
    expect(parts.raw.header).toBe("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
    expect(parts.raw.payload).toBe("eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ");
    expect(parts.raw.signature).toBe("SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c");
  });

  it("throws on invalid token", () => {
    expect(() => decodeJwt("not-a-jwt")).toThrow();
  });

  it("throws on non-JSON header", () => {
    // base64url of "not json" → "bm90IGpzb24" → token: "bm90IGpzb24.c.d"
    expect(() => decodeJwt("bm90IGpzb24.c.d")).toThrow(/header/i);
  });
});

describe("jwt-decoder getAlgorithm", () => {
  it("extracts algorithm from header", () => {
    const parts = decodeJwt(VALID_TOKEN);
    expect(getAlgorithm(parts)).toBe("HS256");
  });

  it("returns undefined if alg missing", () => {
    const parts: any = {
      header: { typ: "JWT" },
      payload: {},
      signature: "",
      raw: { header: "", payload: "", signature: "" },
    };
    expect(getAlgorithm(parts)).toBeUndefined();
  });
});

describe("jwt-decoder formatTimestamp", () => {
  it("formats a valid Unix timestamp (seconds)", () => {
    // 1516239022 seconds = 2018-01-18T01:30:22.000Z
    expect(formatTimestamp(1516239022)).toBe("2018-01-18T01:30:22.000Z");
  });

  it("returns null for non-number input", () => {
    expect(formatTimestamp("abc" as any)).toBeNull();
    expect(formatTimestamp(NaN)).toBeNull();
  });

  it("returns null for extreme out-of-range values", () => {
    expect(formatTimestamp(-1)).toBeNull();
    expect(formatTimestamp(1e20)).toBeNull();
  });
});

describe("jwt-decoder isExpired", () => {
  it("returns true for tokens with past exp", () => {
    const parts: any = {
      header: {},
      payload: { exp: 1 }, // 1970-01-01
      signature: "",
      raw: { header: "", payload: "", signature: "" },
    };
    expect(isExpired(parts)).toBe(true);
  });

  it("returns false for tokens with future exp", () => {
    const future = Math.floor(Date.now() / 1000) + 3600; // +1 hour
    const parts: any = {
      header: {},
      payload: { exp: future },
      signature: "",
      raw: { header: "", payload: "", signature: "" },
    };
    expect(isExpired(parts)).toBe(false);
  });

  it("returns false when no exp claim present", () => {
    const parts: any = {
      header: {},
      payload: {},
      signature: "",
      raw: { header: "", payload: "", signature: "" },
    };
    expect(isExpired(parts)).toBe(false);
  });
});

describe("jwt-decoder REGISTERED_CLAIMS", () => {
  it("contains the 7 standard registered claims", () => {
    expect(REGISTERED_CLAIMS.has("iss")).toBe(true);
    expect(REGISTERED_CLAIMS.has("sub")).toBe(true);
    expect(REGISTERED_CLAIMS.has("aud")).toBe(true);
    expect(REGISTERED_CLAIMS.has("exp")).toBe(true);
    expect(REGISTERED_CLAIMS.has("nbf")).toBe(true);
    expect(REGISTERED_CLAIMS.has("iat")).toBe(true);
    expect(REGISTERED_CLAIMS.has("jti")).toBe(true);
  });
});
