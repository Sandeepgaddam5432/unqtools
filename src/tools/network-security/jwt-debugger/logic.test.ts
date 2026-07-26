import { describe, it, expect } from "vitest";
import {
  base64UrlDecode,
  base64UrlEncode,
  bytesToUtf8,
  utf8ToBytes,
  formatEpoch,
  countdownTo,
  decodeJwt,
  lintJwt,
  lintSecret,
  verifyJwt,
  signJwt,
  describeClaims,
  encodeShareUrl,
  decodeShareUrl,
  prettyJson,
  SAMPLE_TOKENS,
  type JwtHeader,
} from "./logic";

describe("jwt-debugger base64url codec", () => {
  it("decodes base64url without padding", () => {
    // "hello" → base64url "aGVsbG8"
    const bytes = base64UrlDecode("aGVsbG8");
    expect(bytesToUtf8(bytes)).toBe("hello");
  });

  it("decodes standard base64 with +/", () => {
    const bytes = base64UrlDecode("aGVsbG8");
    expect(bytes.length).toBe(5);
  });

  it("encodes bytes to base64url without padding", () => {
    const enc = base64UrlEncode(utf8ToBytes("hello"));
    expect(enc).toBe("aGVsbG8");
  });

  it("round-trips arbitrary UTF-8", () => {
    const s = "héllo 世界 🎉";
    const round = bytesToUtf8(base64UrlDecode(base64UrlEncode(utf8ToBytes(s))));
    expect(round).toBe(s);
  });

  it("utf8ToBytes / bytesToUtf8 round-trips", () => {
    expect(bytesToUtf8(utf8ToBytes("abc"))).toBe("abc");
  });
});

describe("jwt-debugger formatEpoch + countdownTo", () => {
  it("formatEpoch returns ISO string", () => {
    const s = formatEpoch(1609459200); // 2021-01-01T00:00:00Z
    expect(s).toContain("2021-01-01T00:00:00.000Z");
  });

  it("countdownTo returns 'ago' for past", () => {
    const past = Math.floor(Date.now() / 1000) - 3600;
    expect(countdownTo(past)).toContain("ago");
  });

  it("countdownTo returns 'in' for future", () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    expect(countdownTo(future)).toContain("in");
  });
});

describe("jwt-debugger decodeJwt", () => {
  it("decodes a valid HS256 token", () => {
    const d = decodeJwt(SAMPLE_TOKENS.valid);
    expect(d.isValidFormat).toBe(true);
    expect(d.header.alg).toBe("HS256");
    expect(d.payload.sub).toBe("1234567890");
    expect(d.payload.name).toBe("Jane Doe");
  });

  it("returns error for empty input", () => {
    expect(decodeJwt("").isValidFormat).toBe(false);
  });

  it("returns error for wrong number of parts", () => {
    const d = decodeJwt("only.two");
    expect(d.isValidFormat).toBe(false);
    expect(d.error).toMatch(/3 dot-separated/);
  });

  it("returns error for malformed header", () => {
    const d = decodeJwt("!!!.eyJzdWIiOiIxIn0.sig");
    expect(d.isValidFormat).toBe(false);
    expect(d.error).toMatch(/header/);
  });

  it("returns error for malformed payload", () => {
    const d = decodeJwt("eyJhbGciOiJIUzI1NiJ9.!!!.sig");
    expect(d.isValidFormat).toBe(false);
    expect(d.error).toMatch(/payload/);
  });

  it("decodes alg:none token", () => {
    const d = decodeJwt(SAMPLE_TOKENS.algNone);
    expect(d.isValidFormat).toBe(true);
    expect(d.header.alg).toBe("none");
    expect(d.payload.role).toBe("admin");
  });
});

describe("jwt-debugger lintJwt", () => {
  it("flags alg:none as high", () => {
    const lint = lintJwt({ alg: "none" }, { sub: "1" }, "");
    expect(lint.some((l) => l.code === "alg-none" && l.severity === "high")).toBe(true);
  });

  it("flags missing exp", () => {
    const lint = lintJwt({ alg: "HS256" }, { sub: "1" }, "sig");
    expect(lint.some((l) => l.code === "missing-exp")).toBe(true);
  });

  it("flags expired token", () => {
    const past = Math.floor(Date.now() / 1000) - 3600;
    const lint = lintJwt({ alg: "HS256" }, { sub: "1", exp: past }, "sig");
    expect(lint.some((l) => l.code === "expired" && l.severity === "high")).toBe(true);
  });

  it("flags nbf in the future", () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    const lint = lintJwt({ alg: "HS256" }, { sub: "1", nbf: future, exp: future + 1000 }, "sig");
    expect(lint.some((l) => l.code === "not-yet-valid")).toBe(true);
  });

  it("flags iat in the future", () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    const lint = lintJwt({ alg: "HS256" }, { sub: "1", iat: future, exp: future + 1000 }, "sig");
    expect(lint.some((l) => l.code === "iat-future")).toBe(true);
  });

  it("flags RS256 as info (asymmetric)", () => {
    const lint = lintJwt({ alg: "RS256" }, { sub: "1", exp: 9999999999 }, "sig");
    expect(lint.some((l) => l.code === "asymmetric-alg")).toBe(true);
  });

  it("does not flag a healthy token", () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    const lint = lintJwt({ alg: "HS256" }, { sub: "1", iat: Math.floor(Date.now() / 1000), exp: future }, "sig");
    expect(lint.filter((l) => l.severity === "high" || l.severity === "medium")).toHaveLength(0);
  });
});

describe("jwt-debugger lintSecret", () => {
  it("flags empty secret", () => {
    expect(lintSecret("")[0]?.code).toBe("empty-secret");
  });

  it("flags short secret", () => {
    expect(lintSecret("short")[0]?.code).toBe("short-secret");
  });

  it("flags numeric secret", () => {
    expect(lintSecret("123456789012345678901234567890")[0]?.code).toBe("numeric-secret");
  });

  it("flags dictionary secret", () => {
    const lint = lintSecret("password1234567890123456789");
    expect(lint.some((l) => l.code === "dictionary-secret")).toBe(true);
  });

  it("accepts strong secret", () => {
    const lint = lintSecret("x9K2mP7qR3sT8vW1yZ4aB6cD5eF0gH2j");
    expect(lint).toHaveLength(0);
  });
});

describe("jwt-debugger verifyJwt + signJwt", () => {
  it("signs and verifies a token with the correct secret", async () => {
    const header: JwtHeader = { typ: "JWT" };
    const payload = { sub: "abc", iat: 1700000000, exp: 9999999999 };
    const secret = "super-secret-key-1234567890";
    const token = await signJwt(header, payload, secret, "HS256");
    const r = await verifyJwt(token, secret, "HS256");
    expect(r.verified).toBe(true);
  });

  it("rejects wrong secret", async () => {
    const token = await signJwt({ typ: "JWT" }, { sub: "abc" }, "right-secret-aaaaaaaaaaaa", "HS256");
    const r = await verifyJwt(token, "wrong-secret-aaaaaaaaaaaa", "HS256");
    expect(r.verified).toBe(false);
  });

  it("rejects algorithm confusion (RS256 token, HS256 verifier)", async () => {
    const token = await signJwt({ typ: "JWT" }, { sub: "abc" }, "right-secret-aaaaaaaaaaaa", "HS256");
    // Tamper header to claim RS256
    const parts = token.split(".");
    const tampered = `${btoa(JSON.stringify({ alg: "RS256", typ: "JWT" })).replace(/=/g, "")}.${parts[1]}.${parts[2]}`;
    const r = await verifyJwt(tampered, "right-secret-aaaaaaaaaaaa", "HS256");
    expect(r.verified).toBe(false);
    expect(r.reason).toMatch(/Algorithm mismatch/);
  });

  it("rejects malformed token", async () => {
    const r = await verifyJwt("not.a.jwt", "any", "HS256");
    expect(r.verified).toBe(false);
  });

  it("rejects unsupported alg", async () => {
    const token = "eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiIxIn0.sig";
    const r = await verifyJwt(token, "any", "ES256" as never);
    expect(r.verified).toBe(false);
    expect(r.reason).toMatch(/not supported/);
  });

  it("verifies HS384 and HS512", async () => {
    for (const alg of ["HS384", "HS512"] as const) {
      const token = await signJwt({ typ: "JWT" }, { sub: "x", exp: 9999999999 }, "k".repeat(32), alg);
      const r = await verifyJwt(token, "k".repeat(32), alg);
      expect(r.verified).toBe(true);
    }
  });
});

describe("jwt-debugger describeClaims", () => {
  it("describes standard claims with human time", () => {
    const claims = describeClaims({ sub: "1", exp: 1609459200, custom: "value" });
    const exp = claims.find((c) => c.claim === "exp");
    expect(exp?.humanTime).toContain("2021");
    expect(exp?.countdown).toBeDefined();
    const sub = claims.find((c) => c.claim === "sub");
    expect(sub?.description).toMatch(/Subject/);
  });

  it("stringifies object claim values", () => {
    const claims = describeClaims({ addr: { city: "NYC" } });
    expect(claims[0]?.value).toBe(JSON.stringify({ city: "NYC" }));
  });
});

describe("jwt-debugger share URL", () => {
  it("encodes and decodes round-trip", () => {
    const frag = encodeShareUrl(SAMPLE_TOKENS.valid);
    expect(decodeShareUrl(frag)).toBe(SAMPLE_TOKENS.valid);
  });

  it("returns null for invalid fragment", () => {
    expect(decodeShareUrl("#other=foo")).toBeNull();
  });
});

describe("jwt-debugger prettyJson", () => {
  it("pretty-prints objects with 2-space indent", () => {
    expect(prettyJson({ a: 1 })).toBe('{\n  "a": 1\n}');
  });

  it("handles circular references by stringifying", () => {
    const s = prettyJson("just a string");
    expect(s).toBe('"just a string"');
  });
});
