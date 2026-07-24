import { describe, it, expect } from "vitest";
import { process, statsToCsv } from "./logic";

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
