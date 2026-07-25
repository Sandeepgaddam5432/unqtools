import { describe, it, expect } from "vitest";
import {
  splitJwt,
  base64urlDecode,
  safeJsonParse,
  decodeJwt,
  extractClaims,
  extractCustomClaims,
  epochToIso,
  detectAlg,
  checkExpiry,
  securityWarnings,
  batchDecode,
  batchToCsv,
  prettyJson,
  parseBatchInput,
  REGISTERED_CLAIMS,
} from "./logic";

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
  it("errors on empty input", () => {
    expect(splitJwt("")).toHaveProperty("error");
    expect(splitJwt("   ")).toHaveProperty("error");
  });
  it("errors when header or payload is empty", () => {
    expect(splitJwt("..sig")).toHaveProperty("error");
  });
});

describe("base64urlDecode", () => {
  it("decodes standard base64url", () => {
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
  it("errors when header/payload is not JSON", () => {
    // "!!!" base64url-decodes to invalid bytes; not valid JSON
    expect(decodeJwt("!!!.!!!.sig")).toHaveProperty("error");
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

describe("extractCustomClaims", () => {
  it("extracts only non-registered claims", () => {
    const custom = extractCustomClaims({ sub: "u1", role: "admin", scope: "read" });
    expect(custom.role).toBe("admin");
    expect(custom.scope).toBe("read");
    expect(custom.sub).toBeUndefined();
  });
  it("returns empty for non-object", () => {
    expect(extractCustomClaims("string")).toEqual({});
  });
});

describe("epochToIso", () => {
  it("converts seconds to ISO string", () => {
    expect(epochToIso(0)).toBe("1970-01-01T00:00:00.000Z");
  });
  it("converts a known timestamp", () => {
    expect(epochToIso(1_700_000_000)).toBe("2023-11-14T22:13:20.000Z");
  });
});

describe("detectAlg", () => {
  it("detects HS256", () => {
    expect(detectAlg({ alg: "HS256" })).toBe("HS256");
  });
  it("detects RS256", () => {
    expect(detectAlg({ alg: "RS256" })).toBe("RS256");
  });
  it("detects none", () => {
    expect(detectAlg({ alg: "none" })).toBe("none");
  });
  it("returns unknown for unrecognized", () => {
    expect(detectAlg({ alg: "weird" })).toBe("unknown");
  });
  it("returns unknown for missing alg", () => {
    expect(detectAlg({})).toBe("unknown");
    expect(detectAlg(null)).toBe("unknown");
  });
});

describe("checkExpiry", () => {
  it("flags expired tokens", () => {
    const past = 1_000_000; // well before now
    const info = checkExpiry({ exp: past }, Date.now());
    expect(info.expired).toBe(true);
    expect(info.expiresAt).toBeTruthy();
  });
  it("flags not-yet-valid tokens", () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    const info = checkExpiry({ nbf: future });
    expect(info.notYetValid).toBe(true);
  });
  it("reports secondsUntilExpiry for future exp", () => {
    const future = Math.floor(Date.now() / 1000) + 60;
    const info = checkExpiry({ exp: future });
    expect(info.expired).toBe(false);
    expect(info.secondsUntilExpiry).toBeGreaterThan(0);
  });
  it("returns empty info for non-object payload", () => {
    const info = checkExpiry(null);
    expect(info.expired).toBe(false);
    expect(info.notYetValid).toBe(false);
  });
});

describe("securityWarnings", () => {
  it("warns on alg=none", () => {
    const w = securityWarnings({ header: { alg: "none" }, payload: { exp: Math.floor(Date.now() / 1000) + 60 }, signature: "sig", raw: { header: "", payload: "", signature: "" } });
    expect(w.some((x) => x.level === "danger" && x.message.includes("none"))).toBe(true);
  });
  it("warns when no exp claim", () => {
    const w = securityWarnings({ header: { alg: "HS256" }, payload: { sub: "x" }, signature: "sig", raw: { header: "", payload: "", signature: "" } });
    expect(w.some((x) => x.message.includes("exp"))).toBe(true);
  });
  it("warns when expired", () => {
    const w = securityWarnings({ header: { alg: "HS256" }, payload: { exp: 1 }, signature: "sig", raw: { header: "", payload: "", signature: "" } });
    expect(w.some((x) => x.level === "danger" && x.message.includes("expired"))).toBe(true);
  });
  it("info for HMAC algorithms", () => {
    const w = securityWarnings({ header: { alg: "HS256" }, payload: { exp: Math.floor(Date.now() / 1000) + 60 }, signature: "sig", raw: { header: "", payload: "", signature: "" } });
    expect(w.some((x) => x.level === "info")).toBe(true);
  });
});

describe("batchDecode", () => {
  const header = "eyJhbGciOiJIUzI1NiJ9";
  const payload = "eyJzdWIiOiJ1MSIsImV4cCI6OTAwMDAwMDAwMH0"; // {sub:"u1", exp:9000000000}
  const sig = "sig";
  it("decodes multiple JWTs", () => {
    const { rows, decoded } = batchDecode([`${header}.${payload}.${sig}`, "bad"]);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.ok).toBe(true);
    expect(rows[1]!.ok).toBe(false);
    expect(decoded).toHaveLength(2);
  });
  it("extracts sub and alg in summary", () => {
    const { rows } = batchDecode([`${header}.${payload}.${sig}`]);
    expect(rows[0]!.alg).toBe("HS256");
    expect(rows[0]!.sub).toBe("u1");
  });
});

describe("batchToCsv", () => {
  it("generates CSV with header", () => {
    const { rows } = batchDecode(["bad"]);
    const csv = batchToCsv(rows);
    expect(csv.split("\n")[0]).toBe("Index,OK,Algorithm,Subject,Expired,Error");
    expect(csv).toContain("no");
  });
});

describe("prettyJson", () => {
  it("pretty-prints objects", () => {
    expect(prettyJson({ a: 1 })).toBe("{\n  \"a\": 1\n}");
  });
  it("handles circular references gracefully", () => {
    const obj: Record<string, unknown> = {};
    obj.self = obj;
    expect(prettyJson(obj)).toBeTruthy();
  });
});

describe("parseBatchInput", () => {
  it("splits on newlines and trims", () => {
    expect(parseBatchInput("a.b.c\n  d.e.f  \n")).toEqual(["a.b.c", "d.e.f"]);
  });
  it("skips empty lines", () => {
    expect(parseBatchInput("\n\nx.y.z\n")).toEqual(["x.y.z"]);
  });
});

describe("REGISTERED_CLAIMS", () => {
  it("covers the 7 standard claims", () => {
    const keys = Object.keys(REGISTERED_CLAIMS);
    expect(keys).toEqual(expect.arrayContaining(["iss", "sub", "aud", "exp", "nbf", "iat", "jti"]));
    expect(keys.length).toBe(7);
  });
});
