import { describe, it, expect } from "vitest";
import {
  process, statsToCsv, validatePattern, buildWordRegex, stats,
  batchProcess, batchToCsv, escapeRegex, fmt, PATTERN_NAMES,
} from "./logic";

describe("process — emails", () => {
  it("redacts emails", () => {
    const r = process("Contact me at alice@example.com", { redactEmails: true });
    if ("error" in r) throw new Error("err");
    expect(r.output).not.toContain("alice@example.com");
    expect(r.redactionCounts.email).toBe(1);
  });
  it("supports custom replacement", () => {
    const r = process("a@b.com", { redactEmails: true, replacement: "[REDACTED]" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe("[REDACTED]");
  });
});

describe("process — phones", () => {
  it("redacts phone numbers", () => {
    const r = process("Call (555) 123-4567", { redactPhones: true });
    if ("error" in r) throw new Error("err");
    expect(r.output).not.toContain("555");
  });
});

describe("process — SSN", () => {
  it("redacts SSNs", () => {
    const r = process("SSN: 123-45-6789", { redactSsns: true });
    if ("error" in r) throw new Error("err");
    expect(r.output).not.toContain("123-45-6789");
  });
});

describe("process — credit cards", () => {
  it("redacts credit card numbers", () => {
    const r = process("Card: 4111 1111 1111 1111", { redactCreditCards: true });
    if ("error" in r) throw new Error("err");
    expect(r.output).not.toContain("4111");
  });
});

describe("process — IPs", () => {
  it("redacts IP addresses", () => {
    const r = process("Server at 192.168.1.1 is down", { redactIps: true });
    if ("error" in r) throw new Error("err");
    expect(r.output).not.toContain("192.168.1.1");
  });
});

describe("process — URLs", () => {
  it("redacts URLs", () => {
    const r = process("Visit https://example.com now", { redactUrls: true });
    if ("error" in r) throw new Error("err");
    expect(r.output).not.toContain("https://example.com");
  });
});

describe("process — zip codes", () => {
  it("redacts 5-digit zip codes", () => {
    const r = process("Zip: 90210", { redactZipCodes: true });
    if ("error" in r) throw new Error("err");
    expect(r.output).not.toContain("90210");
  });
});

describe("process — custom", () => {
  it("redacts custom words", () => {
    const r = process("Top secret and confidential", { customWords: ["secret", "confidential"] });
    if ("error" in r) throw new Error("err");
    expect(r.output).not.toContain("secret");
    expect(r.output).not.toContain("confidential");
    expect(r.totalRedacted).toBe(2);
  });
  it("warns on invalid custom regex", () => {
    const r = process("hi", { customPatterns: [{ name: "bad", pattern: "(" }] });
    if ("error" in r) throw new Error("err");
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it("warns when no redactions made", () => {
    const r = process("nothing to redact", { redactEmails: true });
    if ("error" in r) throw new Error("err");
    expect(r.warnings.join()).toMatch(/No redactions/i);
  });
  it("handles multiple patterns", () => {
    const r = process("Email a@b.com and IP 1.2.3.4", { redactEmails: true, redactIps: true });
    if ("error" in r) throw new Error("err");
    expect(r.totalRedacted).toBe(2);
  });
});

describe("validatePattern", () => {
  it("accepts valid regex", () => {
    expect(validatePattern("abc", "g")).toEqual({ ok: true });
  });
  it("rejects invalid regex", () => {
    expect(validatePattern("(")).toHaveProperty("error");
  });
});

describe("buildWordRegex", () => {
  it("builds case-insensitive regex", () => {
    const re = buildWordRegex(["foo", "bar"]);
    expect("FOO bar baz".match(re)?.length).toBe(2);
  });
  it("respects word boundaries", () => {
    const re = buildWordRegex(["cat"]);
    expect("category cat".match(re)?.length).toBe(1);
  });
});

describe("stats", () => {
  it("returns most redacted pattern", () => {
    const r = process("a@b.com a@b.com a@b.com 192.168.0.1", { redactEmails: true, redactIps: true });
    if ("error" in r) throw new Error("err");
    const s = stats(r);
    expect(s.mostRedacted).toBe("email");
    expect(s.max).toBe(3);
    expect(s.patterns).toBe(2);
  });
  it("returns null mostRedacted for empty", () => {
    const s = stats({ output: "", redactionCounts: {}, totalRedacted: 0, warnings: [] });
    expect(s.mostRedacted).toBeNull();
  });
});

describe("statsToCsv", () => {
  it("generates CSV", () => {
    const r = process("a@b.com", { redactEmails: true });
    if ("error" in r) throw new Error("err");
    const csv = statsToCsv(r);
    expect(csv).toContain("Type,Count");
    expect(csv).toContain("email,1");
    expect(csv).toContain("Total,1");
  });
});

describe("batchProcess / batchToCsv", () => {
  it("returns result per input", () => {
    const r = batchProcess(["a@b.com", "nothing"], { redactEmails: true });
    expect(r).toHaveLength(2);
    if (!("error" in r[0]!.result)) expect(r[0]!.result.totalRedacted).toBe(1);
  });
  it("renders CSV with header", () => {
    const csv = batchToCsv(batchProcess(["a@b.com"], { redactEmails: true }));
    expect(csv.split("\n")[0]).toBe("index,totalRedacted,output");
  });
});

describe("escapeRegex / fmt / PATTERN_NAMES", () => {
  it("escapes regex special chars", () => {
    expect(escapeRegex("a.b*c")).toBe("a\\.b\\*c");
  });
  it("fmt trims precision", () => {
    expect(fmt(1.23456, 2)).toBe("1.23");
  });
  it("fmt em-dash for NaN", () => {
    expect(fmt(NaN)).toBe("—");
  });
  it("PATTERN_NAMES includes email and ip", () => {
    expect(PATTERN_NAMES).toContain("email");
    expect(PATTERN_NAMES).toContain("ip");
  });
});
