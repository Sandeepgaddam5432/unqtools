/**
 * TLS Version Checker — unit tests.
 */
import { describe, it, expect } from "vitest";
import {
  TLS_VERSIONS,
  lookup,
  allVersions,
  recommended,
  deprecatedVersions,
  isSecure,
  toMarkdown,
} from "./logic";

describe("tls TLS_VERSIONS", () => {
  it("has 4 versions", () => {
    expect(TLS_VERSIONS).toHaveLength(4);
  });
  it("includes TLS 1.0 through 1.3", () => {
    const names = TLS_VERSIONS.map((t) => t.version);
    expect(names).toContain("TLS 1.0");
    expect(names).toContain("TLS 1.1");
    expect(names).toContain("TLS 1.2");
    expect(names).toContain("TLS 1.3");
  });
});

describe("tls lookup", () => {
  it("finds TLS 1.3", () => {
    expect(lookup("TLS 1.3")?.rfc).toBe("RFC 8446");
  });
  it("is case-insensitive", () => {
    expect(lookup("tls 1.2")?.version).toBe("TLS 1.2");
  });
  it("returns undefined for unknown version", () => {
    expect(lookup("SSL 3.0")).toBeUndefined();
  });
});

describe("tls recommended / deprecated", () => {
  it("recommends TLS 1.3", () => {
    const r = recommended();
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((t) => t.status === "Recommended")).toBe(true);
  });
  it("marks 1.0 and 1.1 as deprecated", () => {
    const d = deprecatedVersions();
    expect(d.length).toBe(2);
    expect(d.map((t) => t.version).sort()).toEqual(["TLS 1.0", "TLS 1.1"]);
  });
  it("allVersions returns 4 entries", () => {
    expect(allVersions()).toHaveLength(4);
  });
});

describe("tls isSecure", () => {
  it("returns true for TLS 1.3", () => {
    expect(isSecure("TLS 1.3")).toBe(true);
  });
  it("returns false for TLS 1.0", () => {
    expect(isSecure("TLS 1.0")).toBe(false);
  });
  it("returns false for unknown version", () => {
    expect(isSecure("SSL 2.0")).toBe(false);
  });
});

describe("tls toMarkdown", () => {
  it("produces markdown with version header", () => {
    const md = toMarkdown(TLS_VERSIONS[0]);
    expect(md).toContain("## TLS 1.0");
    expect(md).toContain("RFC 2246");
  });
});
