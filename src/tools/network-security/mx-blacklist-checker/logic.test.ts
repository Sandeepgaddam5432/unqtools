/**
 * MX Blacklist Checker — unit tests.
 */
import { describe, it, expect } from "vitest";
import {
  validateDomain,
  parseMxRecord,
  buildLookupTarget,
  checkMxBlacklist,
  resultToText,
  lookupsToCsv,
  BLACKLIST_DBS,
} from "./logic";

describe("validateDomain", () => {
  it("accepts valid domains", () => {
    expect(validateDomain("example.com")).toBe(true);
    expect(validateDomain("mail.example.co.uk")).toBe(true);
  });
  it("rejects invalid domains", () => {
    expect(validateDomain("not a domain")).toBe(false);
    expect(validateDomain("example")).toBe(false);
    expect(validateDomain("")).toBe(false);
  });
});

describe("parseMxRecord", () => {
  it("parses priority + host", () => {
    const r = parseMxRecord("10 mail.example.com");
    expect(r).toEqual({ priority: 10, host: "mail.example.com" });
  });
  it("parses host only (defaults to priority 10)", () => {
    const r = parseMxRecord("mail.example.com");
    expect(r).toEqual({ priority: 10, host: "mail.example.com" });
  });
  it("lowercases the host", () => {
    const r = parseMxRecord("MAIL.Example.COM");
    expect(r!.host).toBe("mail.example.com");
  });
  it("returns null for invalid input", () => {
    expect(parseMxRecord("not a host")).toBeNull();
    expect(parseMxRecord("abc 123 not a host")).toBeNull();
  });
});

describe("buildLookupTarget", () => {
  it("concatenates mx host and zone", () => {
    expect(buildLookupTarget("mail.example.com", "zen.spamhaus.org")).toBe("mail.example.com.zen.spamhaus.org");
  });
});

describe("BLACKLIST_DBS", () => {
  it("contains at least 4 well-known DBs", () => {
    expect(BLACKLIST_DBS.length).toBeGreaterThanOrEqual(4);
  });
  it("includes Spamhaus ZEN with return codes", () => {
    const zen = BLACKLIST_DBS.find((d) => d.zone === "zen.spamhaus.org");
    expect(zen).toBeDefined();
    expect(Object.keys(zen!.returnCodes).length).toBeGreaterThan(5);
  });
});

describe("checkMxBlacklist — validation", () => {
  it("errors on invalid domain", () => {
    expect("error" in checkMxBlacklist("not a domain", "mail.example.com")).toBe(true);
  });
  it("errors on empty MX input", () => {
    expect("error" in checkMxBlacklist("example.com", "")).toBe(true);
  });
  it("errors when no MX lines are parseable", () => {
    expect("error" in checkMxBlacklist("example.com", "not a host\nalso not")).toBe(true);
  });
});

describe("checkMxBlacklist — happy path", () => {
  it("produces a check list with mx × dbs entries", () => {
    const r = checkMxBlacklist("example.com", "10 mail.example.com");
    if ("error" in r) throw new Error("should not error");
    expect(r.mxRecords.length).toBe(1);
    expect(r.blacklistChecks.length).toBe(1 * BLACKLIST_DBS.length);
  });
  it("warns on .local hostnames", () => {
    const r = checkMxBlacklist("example.com", "mail.local");
    if ("error" in r) throw new Error("should not error");
    expect(r.warnings.some((w) => w.includes(".local"))).toBe(true);
  });
  it("warns when many MX records", () => {
    const r = checkMxBlacklist("example.com", "a.example.com\nb.example.com\nc.example.com\nd.example.com\ne.example.com\nf.example.com");
    if ("error" in r) throw new Error("should not error");
    expect(r.warnings.some((w) => w.includes("Many MX"))).toBe(true);
  });
  it("includes lookup targets", () => {
    const r = checkMxBlacklist("example.com", "mail.example.com");
    if ("error" in r) throw new Error("should not error");
    const first = r.blacklistChecks[0]!;
    expect(first.lookupTarget).toContain("mail.example.com.");
    expect(first.lookupTarget).toContain(first.db.zone);
  });
});

describe("exports", () => {
  it("resultToText contains domain and lookup targets", () => {
    const r = checkMxBlacklist("example.com", "mail.example.com");
    if ("error" in r) throw new Error("should not error");
    const text = resultToText(r);
    expect(text).toContain("Domain: example.com");
    expect(text).toContain("Blacklist lookups");
  });
  it("lookupsToCsv produces CSV with header", () => {
    const r = checkMxBlacklist("example.com", "mail.example.com");
    if ("error" in r) throw new Error("should not error");
    const csv = lookupsToCsv(r);
    const lines = csv.split("\n");
    expect(lines[0]).toContain("MX host");
    expect(lines.length).toBe(r.blacklistChecks.length + 1);
  });
});
