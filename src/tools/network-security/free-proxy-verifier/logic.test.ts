/**
 * Free Proxy Verifier — unit tests.
 */
import { describe, it, expect } from "vitest";
import {
  parseProxy,
  parseBatch,
  classifyHost,
  inferProtocol,
  anonymityChecklist,
  verificationToCsv,
} from "./logic";

describe("classifyHost", () => {
  it("recognises IPv4", () => {
    expect(classifyHost("192.168.1.1")).toBe("ipv4");
    expect(classifyHost("8.8.8.8")).toBe("ipv4");
  });
  it("recognises IPv6 (bracketed)", () => {
    expect(classifyHost("[::1]")).toBe("ipv6");
    expect(classifyHost("[2001:db8::1]")).toBe("ipv6");
  });
  it("recognises hostnames", () => {
    expect(classifyHost("example.com")).toBe("hostname");
    expect(classifyHost("proxy.example.org")).toBe("hostname");
  });
  it("flags invalid", () => {
    expect(classifyHost("not a host")).toBe("invalid");
    expect(classifyHost("999.999.999.999")).toBe("invalid");
  });
});

describe("inferProtocol", () => {
  it("respects explicit protocol", () => {
    expect(inferProtocol(8080, "socks5")).toBe("socks5");
  });
  it("infers from port 3128 → http", () => {
    expect(inferProtocol(3128)).toBe("http");
  });
  it("infers from port 1080 → socks5", () => {
    expect(inferProtocol(1080)).toBe("socks5");
  });
  it("returns unknown for unrecognised port", () => {
    expect(inferProtocol(12345)).toBe("unknown");
  });
});

describe("parseProxy — basic", () => {
  it("parses host:port", () => {
    const r = parseProxy("1.2.3.4:8080");
    expect(r.valid).toBe(true);
    expect(r.host).toBe("1.2.3.4");
    expect(r.port).toBe(8080);
    expect(r.protocol).toBe("http");
  });
  it("parses scheme://host:port", () => {
    const r = parseProxy("socks5://1.2.3.4:1080");
    expect(r.valid).toBe(true);
    expect(r.protocol).toBe("socks5");
  });
  it("parses user:pass@host:port", () => {
    const r = parseProxy("http://alice:secret@1.2.3.4:8080");
    expect(r.username).toBe("alice");
    expect(r.password).toBe("secret");
    expect(r.host).toBe("1.2.3.4");
  });
  it("parses IPv6 [::1]:8080", () => {
    const r = parseProxy("[::1]:8080");
    expect(r.valid).toBe(true);
    expect(r.hostType).toBe("ipv6");
    expect(r.port).toBe(8080);
  });
});

describe("parseProxy — validation", () => {
  it("rejects empty string", () => {
    const r = parseProxy("");
    expect(r.valid).toBe(false);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it("rejects missing port", () => {
    const r = parseProxy("1.2.3.4");
    expect(r.valid).toBe(false);
  });
  it("rejects non-numeric port", () => {
    const r = parseProxy("1.2.3.4:abc");
    expect(r.valid).toBe(false);
  });
  it("rejects port out of range", () => {
    const r = parseProxy("1.2.3.4:99999");
    expect(r.valid).toBe(false);
  });
  it("rejects malformed IPv6", () => {
    const r = parseProxy("[::1:8080");
    expect(r.valid).toBe(false);
  });
  it("warns on unrecognised scheme", () => {
    const r = parseProxy("foo://1.2.3.4:8080");
    expect(r.warnings.some((w) => w.includes("foo"))).toBe(true);
  });
});

describe("parseProxy — anonymity inference", () => {
  it("http without creds → transparent", () => {
    expect(parseProxy("1.2.3.4:8080").anonymity).toBe("transparent");
  });
  it("http with creds → anonymous", () => {
    expect(parseProxy("http://u:p@1.2.3.4:8080").anonymity).toBe("anonymous");
  });
  it("socks5 with creds → elite", () => {
    expect(parseProxy("socks5://u:p@1.2.3.4:1080").anonymity).toBe("elite");
  });
  it("https without creds → anonymous", () => {
    expect(parseProxy("https://1.2.3.4:443").anonymity).toBe("anonymous");
  });
});

describe("parseBatch", () => {
  it("parses multiple lines, skipping blanks", () => {
    const results = parseBatch("1.2.3.4:8080\n\n2.2.2.2:3128\n");
    expect(results.length).toBe(2);
  });
});

describe("anonymityChecklist", () => {
  it("returns at least 5 items with labels and descriptions", () => {
    const list = anonymityChecklist();
    expect(list.length).toBeGreaterThanOrEqual(5);
    expect(list[0]).toHaveProperty("label");
    expect(list[0]).toHaveProperty("description");
  });
});

describe("verificationToCsv", () => {
  it("produces CSV with header + rows", () => {
    const csv = verificationToCsv([parseProxy("1.2.3.4:8080"), parseProxy("socks5://5.6.7.8:1080")]);
    const lines = csv.split("\n");
    expect(lines[0]).toContain("proxy");
    expect(lines.length).toBe(3);
  });
});
