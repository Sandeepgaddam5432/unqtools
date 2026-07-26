/**
 * Blacklist IP Checker — unit tests.
 */
import { describe, it, expect } from "vitest";
import {
  classifyIp,
  reverseIpv4,
  reverseIpv6,
  buildLookupTarget,
  checkIpBlacklist,
  resultToText,
  lookupsToCsv,
  BLACKLIST_DBS,
} from "./logic";

describe("classifyIp", () => {
  it("recognises IPv4", () => {
    expect(classifyIp("192.168.1.1")).toBe("ipv4");
    expect(classifyIp("8.8.8.8")).toBe("ipv4");
  });
  it("recognises IPv6", () => {
    expect(classifyIp("::1")).toBe("ipv6");
    expect(classifyIp("2001:db8::1")).toBe("ipv6");
  });
  it("flags invalid", () => {
    expect(classifyIp("not an ip")).toBe("invalid");
    expect(classifyIp("999.1.1.1")).toBe("invalid");
    expect(classifyIp("")).toBe("invalid");
  });
});

describe("reverseIpv4", () => {
  it("reverses octets", () => {
    expect(reverseIpv4("1.2.3.4")).toBe("4.3.2.1");
    expect(reverseIpv4("8.8.8.8")).toBe("8.8.8.8");
  });
});

describe("reverseIpv6", () => {
  it("expands :: and reverses nibbles", () => {
    const r = reverseIpv6("2001:db8::1");
    // Should end with the reversed nibble of "1"
    expect(r.endsWith("1.0.0.0")).toBe(true);
    expect(r).toContain("2.0.0.1");
  });
  it("handles ::1", () => {
    const r = reverseIpv6("::1");
    expect(r.startsWith("1.0.0.0")).toBe(true);
  });
});

describe("buildLookupTarget", () => {
  it("concatenates reverse name and zone", () => {
    expect(buildLookupTarget("4.3.2.1", "zen.spamhaus.org")).toBe("4.3.2.1.zen.spamhaus.org");
  });
});

describe("BLACKLIST_DBS", () => {
  it("contains at least 4 DBs", () => {
    expect(BLACKLIST_DBS.length).toBeGreaterThanOrEqual(4);
  });
  it("includes Spamhaus ZEN", () => {
    expect(BLACKLIST_DBS.find((d) => d.zone === "zen.spamhaus.org")).toBeDefined();
  });
});

describe("checkIpBlacklist — validation", () => {
  it("errors on empty input", () => {
    expect("error" in checkIpBlacklist("")).toBe(true);
  });
  it("errors on invalid IP", () => {
    expect("error" in checkIpBlacklist("not an ip")).toBe(true);
  });
});

describe("checkIpBlacklist — IPv4", () => {
  it("returns lookups for every DB", () => {
    const r = checkIpBlacklist("1.2.3.4");
    if ("error" in r) throw new Error("should not error");
    expect(r.ipType).toBe("ipv4");
    expect(r.reverseName).toBe("4.3.2.1");
    expect(r.blacklistChecks.length).toBe(BLACKLIST_DBS.length);
    expect(r.blacklistChecks[0]!.lookupTarget).toBe("4.3.2.1.zen.spamhaus.org");
  });
  it("warns on private 10.x range", () => {
    const r = checkIpBlacklist("10.0.0.1");
    if ("error" in r) throw new Error("should not error");
    expect(r.warnings.some((w) => w.includes("private"))).toBe(true);
  });
  it("warns on 192.168.x range", () => {
    const r = checkIpBlacklist("192.168.1.1");
    if ("error" in r) throw new Error("should not error");
    expect(r.warnings.some((w) => w.includes("private"))).toBe(true);
  });
  it("warns on 127.x loopback", () => {
    const r = checkIpBlacklist("127.0.0.1");
    if ("error" in r) throw new Error("should not error");
    expect(r.warnings.some((w) => w.includes("loopback"))).toBe(true);
  });
});

describe("checkIpBlacklist — IPv6", () => {
  it("returns lookups with nibble-reversed name", () => {
    const r = checkIpBlacklist("2001:db8::1");
    if ("error" in r) throw new Error("should not error");
    expect(r.ipType).toBe("ipv6");
    expect(r.reverseName).toContain(".");
    expect(r.blacklistChecks.length).toBe(BLACKLIST_DBS.length);
  });
  it("warns on ::1 loopback", () => {
    const r = checkIpBlacklist("::1");
    if ("error" in r) throw new Error("should not error");
    expect(r.warnings.some((w) => w.includes("loopback"))).toBe(true);
  });
});

describe("exports", () => {
  it("resultToText contains IP and lookups", () => {
    const r = checkIpBlacklist("1.2.3.4");
    if ("error" in r) throw new Error("should not error");
    const text = resultToText(r);
    expect(text).toContain("IP: 1.2.3.4");
    expect(text).toContain("Lookups to perform");
  });
  it("lookupsToCsv produces CSV with header", () => {
    const r = checkIpBlacklist("1.2.3.4");
    if ("error" in r) throw new Error("should not error");
    const csv = lookupsToCsv(r);
    const lines = csv.split("\n");
    expect(lines[0]).toContain("Blacklist");
    expect(lines.length).toBe(r.blacklistChecks.length + 1);
  });
});
