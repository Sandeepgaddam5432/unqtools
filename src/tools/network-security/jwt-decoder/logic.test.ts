import { describe, it, expect } from "vitest";
import {
  decodeJwt,
  decodeJwtSafe,
  validateJwtStructure,
  base64UrlToBase64,
  base64UrlDecode,
  base64UrlEncode,
  base64UrlDecodeBytes,
  base64UrlEncodeBytes,
  getAlgorithm,
  isAlgorithmSupported,
  isExpired,
  formatTimestamp,
  formatRelative,
  lintJwt,
  computeTimeline,
  compareClaims,
  parseJwks,
  encodeJwt,
  buildShareUrl,
  extractTokenFromUrl,
  REGISTERED_CLAIMS,
  prettyPrint,
  type JwtAlgorithm,
} from "./logic";

// Standard test token (HS256, from jwt.io):
// header: {"alg":"HS256","typ":"JWT"}
// payload: {"sub":"1234567890","name":"John Doe","iat":1516239022}
const VALID_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

// Token with alg:none (no signature)
const ALG_NONE_TOKEN =
  "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.";

// Token with exp claim
const TOKEN_WITH_EXP =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjk5OTk5OTk5OTl9.signature";

// ===== Base64url codec =====

describe("jwt base64UrlToBase64", () => {
  it("replaces - with + and _ with /", () => {
    expect(base64UrlToBase64("a-b_c-da")).toBe("a+b/c+da");
  });
  it("adds padding to length multiple of 4", () => {
    expect(base64UrlToBase64("YQ")).toBe("YQ==");
    expect(base64UrlToBase64("YWE")).toBe("YWE=");
    expect(base64UrlToBase64("YWFh")).toBe("YWFh");
  });
});

describe("jwt base64UrlDecode", () => {
  it("decodes the standard JWT header", () => {
    const decoded = base64UrlDecode("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
    expect(JSON.parse(decoded)).toEqual({ alg: "HS256", typ: "JWT" });
  });
  it("decodes UTF-8 characters", () => {
    const decoded = base64UrlDecode("SMOpbGxvIFfDtnJsZA");
    expect(decoded).toBe("Héllo Wörld");
  });
});

describe("jwt base64UrlEncode / decode round-trip", () => {
  it("round-trips ASCII text", () => {
    const original = "Hello, World!";
    const encoded = base64UrlEncode(original);
    expect(base64UrlDecode(encoded)).toBe(original);
  });
  it("round-trips UTF-8 text", () => {
    const original = "Hello 世界 🌍";
    const encoded = base64UrlEncode(original);
    expect(base64UrlDecode(encoded)).toBe(original);
  });
  it("round-trips JSON", () => {
    const original = JSON.stringify({ alg: "HS256", typ: "JWT" });
    const encoded = base64UrlEncode(original);
    expect(base64UrlDecode(encoded)).toBe(original);
  });
});

describe("jwt base64UrlEncodeBytes / decodeBytes round-trip", () => {
  it("round-trips raw bytes", () => {
    const original = new Uint8Array([0, 1, 2, 255, 128, 64, 32]);
    const encoded = base64UrlEncodeBytes(original);
    const decoded = base64UrlDecodeBytes(encoded);
    expect(Array.from(decoded)).toEqual(Array.from(original));
  });
});

// ===== Structure validation =====

describe("jwt validateJwtStructure", () => {
  it("accepts a valid token", () => {
    expect(validateJwtStructure(VALID_TOKEN)).toBeNull();
  });
  it("rejects empty input", () => {
    expect(validateJwtStructure("")).toMatch(/empty/i);
  });
  it("rejects tokens with wrong part count", () => {
    expect(validateJwtStructure("a.b")).toMatch(/3 parts/);
    expect(validateJwtStructure("a.b.c.d")).toMatch(/3 parts/);
  });
  it("flags trailing newline (but does not silently strip)", () => {
    expect(validateJwtStructure(`${VALID_TOKEN}\n`)).toMatch(/trailing newline/);
  });
  it("rejects invalid base64url chars", () => {
    expect(validateJwtStructure("a.b.c+d")).toMatch(/invalid base64url/);
  });
  it("rejects empty parts", () => {
    expect(validateJwtStructure("..c")).toMatch(/empty/);
  });
});

// ===== Decode =====

describe("jwt decodeJwt", () => {
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
  });
  it("decodes alg:none token", () => {
    const parts = decodeJwt(ALG_NONE_TOKEN);
    expect(parts.header.alg).toBe("none");
    expect(parts.signature).toBe("");
  });
  it("throws on invalid token", () => {
    expect(() => decodeJwt("not-a-jwt")).toThrow();
  });
});

describe("jwt decodeJwtSafe", () => {
  it("returns decoded parts for valid token", () => {
    const r = decodeJwtSafe(VALID_TOKEN);
    expect(r.isValid).toBe(true);
    expect(r.header.alg).toBe("HS256");
  });
  it("returns isValid=false with error for invalid token", () => {
    const r = decodeJwtSafe("not-a-jwt");
    expect(r.isValid).toBe(false);
    expect(r.error).toBeDefined();
  });
});

// ===== Algorithm =====

describe("jwt getAlgorithm", () => {
  it("extracts algorithm from header", () => {
    expect(getAlgorithm(decodeJwt(VALID_TOKEN))).toBe("HS256");
  });
  it("extracts alg:none", () => {
    expect(getAlgorithm(decodeJwt(ALG_NONE_TOKEN))).toBe("none");
  });
  it("returns undefined if alg missing", () => {
    const parts: any = { header: { typ: "JWT" }, payload: {}, signature: "", raw: { header: "", payload: "", signature: "" } };
    expect(getAlgorithm(parts)).toBeUndefined();
  });
});

describe("jwt isAlgorithmSupported", () => {
  it("supports all standard algorithms", () => {
    const algs: JwtAlgorithm[] = ["HS256", "HS384", "HS512", "RS256", "RS384", "RS512", "PS256", "PS384", "PS512", "ES256", "ES384", "ES512", "EdDSA"];
    for (const a of algs) expect(isAlgorithmSupported(a)).toBe(true);
  });
  it("supports none (for linting, not verification)", () => {
    expect(isAlgorithmSupported("none")).toBe(false); // 'none' is NOT in SUPPORTED_ALGS
  });
  it("rejects unknown algorithms", () => {
    expect(isAlgorithmSupported("MD5")).toBe(false);
    expect(isAlgorithmSupported(undefined)).toBe(false);
  });
});

// ===== Expiry =====

describe("jwt isExpired", () => {
  it("returns true for past exp", () => {
    const parts: any = { header: {}, payload: { exp: 1 }, signature: "", raw: { header: "", payload: "", signature: "" } };
    expect(isExpired(parts)).toBe(true);
  });
  it("returns false for future exp", () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    const parts: any = { header: {}, payload: { exp: future }, signature: "", raw: { header: "", payload: "", signature: "" } };
    expect(isExpired(parts)).toBe(false);
  });
  it("returns false when no exp claim", () => {
    const parts: any = { header: {}, payload: {}, signature: "", raw: { header: "", payload: "", signature: "" } };
    expect(isExpired(parts)).toBe(false);
  });
});

// ===== Timestamp formatting =====

describe("jwt formatTimestamp", () => {
  it("formats a valid Unix timestamp", () => {
    expect(formatTimestamp(1516239022)).toBe("2018-01-18T01:30:22.000Z");
  });
  it("returns null for invalid input", () => {
    expect(formatTimestamp("abc" as any)).toBeNull();
    expect(formatTimestamp(NaN)).toBeNull();
  });
});

describe("jwt formatRelative", () => {
  it("formats future seconds", () => {
    const now = 1000;
    expect(formatRelative(1030, now)).toBe("in 30s");
  });
  it("formats past seconds", () => {
    const now = 1000;
    expect(formatRelative(970, now)).toBe("30s ago");
  });
  it("formats hours", () => {
    const now = 1000;
    expect(formatRelative(1000 + 7200, now)).toBe("in 2.0h");
  });
});

// ===== Linting =====

describe("jwt lintJwt", () => {
  it("flags alg:none as high severity", () => {
    const parts = decodeJwt(ALG_NONE_TOKEN);
    const findings = lintJwt(parts, "none");
    expect(findings.some((f) => f.code === "alg-none" && f.severity === "high")).toBe(true);
  });
  it("flags missing exp", () => {
    const parts = decodeJwt(VALID_TOKEN); // no exp
    const findings = lintJwt(parts, "HS256");
    expect(findings.some((f) => f.code === "missing-exp")).toBe(true);
  });
  it("does not flag exp when present", () => {
    const parts = decodeJwt(TOKEN_WITH_EXP);
    const findings = lintJwt(parts, "HS256");
    expect(findings.some((f) => f.code === "missing-exp")).toBe(false);
  });
  it("flags long-lived tokens (>24h)", () => {
    const parts: any = {
      header: { alg: "HS256" },
      payload: { iat: 1000, exp: 1000 + 100000 }, // >24h
      signature: "",
      raw: { header: "", payload: "", signature: "" },
    };
    const findings = lintJwt(parts, "HS256");
    expect(findings.some((f) => f.code === "long-lived")).toBe(true);
  });
  it("flags missing kid for RS algorithms", () => {
    const parts: any = {
      header: { alg: "RS256" },
      payload: { exp: 9999999999 },
      signature: "",
      raw: { header: "", payload: "", signature: "" },
    };
    const findings = lintJwt(parts, "RS256");
    expect(findings.some((f) => f.code === "no-kid")).toBe(true);
  });
  it("returns no high findings for a well-formed token", () => {
    const parts: any = {
      header: { alg: "HS256", kid: "k1" },
      payload: { iss: "a", sub: "b", aud: "c", iat: 1000, exp: 1000 + 3600, jti: "x" },
      signature: "",
      raw: { header: "", payload: "", signature: "" },
    };
    const findings = lintJwt(parts, "HS256");
    expect(findings.filter((f) => f.severity === "high" || f.severity === "medium")).toHaveLength(0);
  });
});

// ===== Timeline =====

describe("jwt computeTimeline", () => {
  it("computes isExpired correctly", () => {
    const t = computeTimeline({ exp: 1 }, 100);
    expect(t.isExpired).toBe(true);
    expect(t.secondsToExpiry).toBe(-99);
  });
  it("computes isNotYetValid correctly", () => {
    const t = computeTimeline({ nbf: 200 }, 100);
    expect(t.isNotYetValid).toBe(true);
    expect(t.secondsToValidity).toBe(100);
  });
  it("marks fresh token (<5min to expiry)", () => {
    const t = computeTimeline({ exp: 400 }, 100); // 300s = 5min to expiry
    expect(t.isFresh).toBe(true);
  });
  it("does not mark non-fresh token", () => {
    const t = computeTimeline({ exp: 1000 }, 100); // 900s = 15min
    expect(t.isFresh).toBe(false);
  });
  it("handles missing claims", () => {
    const t = computeTimeline({}, 100);
    expect(t.iat).toBeUndefined();
    expect(t.exp).toBeUndefined();
    expect(t.isExpired).toBe(false);
  });
});

// ===== Comparison (extra #2) =====

describe("jwt compareClaims", () => {
  it("finds differences", () => {
    const left = { sub: "123", name: "Alice", role: "admin" };
    const right = { sub: "123", name: "Bob", role: "user", extra: "x" };
    const diffs = compareClaims(left, right);
    const nameDiff = diffs.find((d) => d.key === "name");
    expect(nameDiff?.same).toBe(false);
    expect(nameDiff?.leftValue).toBe("Alice");
    expect(nameDiff?.rightValue).toBe("Bob");
    const subDiff = diffs.find((d) => d.key === "sub");
    expect(subDiff?.same).toBe(true);
    const extraDiff = diffs.find((d) => d.key === "extra");
    expect(extraDiff?.onlyIn).toBe("right");
    const roleDiff = diffs.find((d) => d.key === "role");
    expect(roleDiff?.onlyIn).toBe("both");
    expect(roleDiff?.same).toBe(false);
  });
  it("returns empty for identical payloads", () => {
    const same = { a: 1 };
    const diffs = compareClaims(same, same);
    expect(diffs.every((d) => d.same)).toBe(true);
  });
});

// ===== JWKS parsing (extra #1) =====

describe("jwt parseJwks", () => {
  it("parses a JWKS object with keys array", () => {
    const input = JSON.stringify({
      keys: [
        { kty: "RSA", kid: "k1", n: "abc", e: "AQAB" },
        { kty: "RSA", kid: "k2", n: "def", e: "AQAB" },
      ],
    });
    const keys = parseJwks(input);
    expect(keys).toHaveLength(2);
    expect(keys[0].kid).toBe("k1");
  });
  it("parses a bare array of JWKs", () => {
    const input = JSON.stringify([{ kty: "RSA", n: "x", e: "AQAB" }]);
    expect(parseJwks(input)).toHaveLength(1);
  });
  it("parses a single JWK object", () => {
    const input = JSON.stringify({ kty: "RSA", n: "x", e: "AQAB" });
    expect(parseJwks(input)).toHaveLength(1);
  });
  it("returns empty array for empty input", () => {
    expect(parseJwks("")).toEqual([]);
    expect(parseJwks("   ")).toEqual([]);
  });
  it("throws on invalid JSON", () => {
    expect(() => parseJwks("not json")).toThrow(/JSON/);
  });
  it("throws on wrong shape", () => {
    expect(() => parseJwks(JSON.stringify({ foo: "bar" }))).toThrow(/Expected/);
  });
});

// ===== Encode/generate (blueprint feature) =====

describe("jwt encodeJwt", () => {
  it("encodes a valid HS256 token", async () => {
    const r = await encodeJwt({
      header: { typ: "JWT" },
      payload: { sub: "test", iat: 1516239022 },
      algorithm: "HS256",
      secret: "your-256-bit-secret",
    });
    expect(r.ok).toBe(true);
    expect(r.token).toBeDefined();
    // Decode and verify
    const parts = decodeJwt(r.token!);
    expect(parts.header.alg).toBe("HS256");
    expect(parts.payload.sub).toBe("test");
  });

  it("encodes with alg:none (empty signature)", async () => {
    const r = await encodeJwt({
      header: { typ: "JWT" },
      payload: { sub: "test" },
      algorithm: "none",
    });
    expect(r.ok).toBe(true);
    expect(r.token).toBeDefined();
    expect(r.token!.endsWith(".")).toBe(true); // empty signature
  });

  it("returns error for HMAC without secret", async () => {
    const r = await encodeJwt({
      header: {},
      payload: {},
      algorithm: "HS256",
    });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/secret/i);
  });

  it("returns error for RS algorithms (not yet supported)", async () => {
    const r = await encodeJwt({
      header: {},
      payload: {},
      algorithm: "RS256",
    });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/private key/i);
  });

  it("round-trips: encode then decode", async () => {
    const payload = { sub: "user-123", role: "admin", iat: 1700000000, exp: 1700003600 };
    const r = await encodeJwt({
      header: { typ: "JWT" },
      payload,
      algorithm: "HS256",
      secret: "test-secret",
    });
    expect(r.ok).toBe(true);
    const parts = decodeJwt(r.token!);
    expect(parts.payload).toEqual(payload);
  });
});

// ===== Shareable URL (extra #9) =====

describe("jwt buildShareUrl", () => {
  it("builds a share URL with token in fragment", () => {
    // Mock window
    const origWindow = globalThis.window;
    (globalThis as any).window = {
      location: { origin: "https://unqtools.pages.dev", pathname: "/tools/jwt-decoder" },
    };
    const url = buildShareUrl("a.b.c");
    expect(url).toBe("https://unqtools.pages.dev/tools/jwt-decoder#token=a.b.c");
    (globalThis as any).window = origWindow;
  });
});

describe("jwt extractTokenFromUrl", () => {
  it("extracts token from URL fragment", () => {
    const origWindow = globalThis.window;
    (globalThis as any).window = {
      location: { hash: "#token=abc.def.ghi" },
    };
    expect(extractTokenFromUrl()).toBe("abc.def.ghi");
    (globalThis as any).window = origWindow;
  });
  it("returns null when no fragment", () => {
    const origWindow = globalThis.window;
    (globalThis as any).window = { location: { hash: "" } };
    expect(extractTokenFromUrl()).toBeNull();
    (globalThis as any).window = origWindow;
  });
});

// ===== Registered claims =====

describe("jwt REGISTERED_CLAIMS", () => {
  it("contains the 7 standard registered claims", () => {
    ["iss", "sub", "aud", "exp", "nbf", "iat", "jti"].forEach((c) => {
      expect(REGISTERED_CLAIMS.has(c)).toBe(true);
    });
  });
});

// ===== Pretty print =====

describe("jwt prettyPrint", () => {
  it("formats JSON with 2-space indent", () => {
    const result = prettyPrint({ a: 1, b: [2, 3] });
    expect(result).toContain('  "a": 1');
    expect(result).toContain('  "b": [');
  });
});
