import { describe, it, expect } from "vitest";
import {
  isValidIpv4,
  isValidIpv6,
  isValidHostname,
  isValidEmail,
  isValidUint16,
  validateRecord,
  validateBatch,
  batchStats,
  formatZoneLine,
  referenceTable,
  batchToCsv,
  parseBatchInput,
  type DnsRecord,
} from "./logic";

describe("isValidIpv4", () => {
  it("accepts valid IPv4", () => {
    expect(isValidIpv4("192.168.1.1")).toBe(true);
    expect(isValidIpv4("0.0.0.0")).toBe(true);
    expect(isValidIpv4("255.255.255.255")).toBe(true);
  });
  it("rejects invalid IPv4", () => {
    expect(isValidIpv4("256.1.1.1")).toBe(false);
    expect(isValidIpv4("1.2.3")).toBe(false);
    expect(isValidIpv4("abc")).toBe(false);
  });
});

describe("isValidIpv6", () => {
  it("accepts full IPv6", () => {
    expect(isValidIpv6("2001:0db8:0000:0000:0000:0000:0000:0001")).toBe(true);
  });
  it("accepts loopback", () => {
    expect(isValidIpv6("::1")).toBe(true);
  });
  it("rejects invalid", () => {
    expect(isValidIpv6("not-an-ip")).toBe(false);
  });
});

describe("isValidHostname", () => {
  it("accepts valid hostname", () => {
    expect(isValidHostname("example.com")).toBe(true);
    expect(isValidHostname("sub.example.com")).toBe(true);
  });
  it("rejects invalid hostname", () => {
    expect(isValidHostname("-bad")).toBe(false);
    expect(isValidHostname("nohost")).toBe(false);
  });
});

describe("isValidEmail", () => {
  it("accepts valid email", () => {
    expect(isValidEmail("user@example.com")).toBe(true);
  });
  it("rejects invalid email", () => {
    expect(isValidEmail("no-at-sign")).toBe(false);
  });
});

describe("isValidUint16", () => {
  it("accepts 0..65535", () => {
    expect(isValidUint16(0)).toBe(true);
    expect(isValidUint16(65535)).toBe(true);
  });
  it("rejects negatives, non-integers, and out-of-range", () => {
    expect(isValidUint16(-1)).toBe(false);
    expect(isValidUint16(65536)).toBe(false);
    expect(isValidUint16(1.5)).toBe(false);
    expect(isValidUint16(undefined)).toBe(false);
  });
});

describe("validateRecord", () => {
  it("validates A record", () => {
    expect(validateRecord({ type: "A", value: "1.2.3.4" })).toEqual({ ok: true });
    expect(validateRecord({ type: "A", value: "bad" })).toHaveProperty("error");
  });
  it("validates AAAA record", () => {
    expect(validateRecord({ type: "AAAA", value: "::1" })).toEqual({ ok: true });
  });
  it("validates CNAME record", () => {
    expect(validateRecord({ type: "CNAME", value: "example.com" })).toEqual({ ok: true });
    expect(validateRecord({ type: "CNAME", value: "not-a-host" })).toHaveProperty("error");
  });
  it("validates NS record", () => {
    expect(validateRecord({ type: "NS", value: "ns1.example.com" })).toEqual({ ok: true });
    expect(validateRecord({ type: "NS", value: "nope" })).toHaveProperty("error");
  });
  it("validates MX record", () => {
    expect(validateRecord({ type: "MX", value: "mail.example.com", priority: 10 })).toEqual({ ok: true });
    expect(validateRecord({ type: "MX", value: "mail.example.com" })).toHaveProperty("error");
  });
  it("rejects MX priority > 65535", () => {
    expect(validateRecord({ type: "MX", value: "mail.example.com", priority: 70000 })).toHaveProperty("error");
  });
  it("validates TXT record", () => {
    expect(validateRecord({ type: "TXT", value: "v=spf1 -all" })).toEqual({ ok: true });
    expect(validateRecord({ type: "TXT", value: "" })).toHaveProperty("error");
  });
  it("rejects too-long TXT", () => {
    expect(validateRecord({ type: "TXT", value: "x".repeat(256) })).toHaveProperty("error");
  });
  it("validates SRV record", () => {
    expect(validateRecord({ type: "SRV", value: "", priority: 10, weight: 20, port: 443, target: "sip.example.com" })).toEqual({ ok: true });
  });
  it("rejects SRV with missing target", () => {
    expect(validateRecord({ type: "SRV", value: "", priority: 10, weight: 20, port: 443 })).toHaveProperty("error");
  });
  it("rejects SRV with bad port", () => {
    expect(validateRecord({ type: "SRV", value: "", priority: 10, weight: 20, port: 99999, target: "x.example.com" })).toHaveProperty("error");
  });
  it("validates CAA record", () => {
    expect(validateRecord({ type: "CAA", value: '0 issue "letsencrypt.org"' })).toEqual({ ok: true });
    expect(validateRecord({ type: "CAA", value: "bad" })).toHaveProperty("error");
  });
});

describe("formatZoneLine", () => {
  it("formats an A record", () => {
    const line = formatZoneLine({ type: "A", value: "1.2.3.4", name: "example.com.", ttl: 3600 });
    expect(line).toContain("example.com.");
    expect(line).toContain("3600");
    expect(line).toContain("IN A 1.2.3.4");
  });
  it("formats an MX record with priority", () => {
    const line = formatZoneLine({ type: "MX", value: "mail.example.com", priority: 10 });
    expect(line).toContain("IN MX 10 mail.example.com");
  });
  it("formats an SRV record", () => {
    const line = formatZoneLine({ type: "SRV", value: "", priority: 10, weight: 20, port: 5060, target: "sip.example.com" });
    expect(line).toContain("IN SRV 10 20 5060 sip.example.com");
  });
  it("uses @ when no name given", () => {
    const line = formatZoneLine({ type: "A", value: "1.2.3.4" });
    expect(line.startsWith("@")).toBe(true);
  });
});

describe("validateBatch", () => {
  it("returns one result per record", () => {
    const records: DnsRecord[] = [
      { type: "A", value: "1.2.3.4" },
      { type: "A", value: "bad" },
    ];
    const r = validateBatch(records);
    expect(r).toHaveLength(2);
    expect("ok" in r[0]!.result).toBe(true);
    expect("error" in r[1]!.result).toBe(true);
    expect(r[0]!.zoneLine).toBeTruthy();
    expect(r[1]!.zoneLine).toBeUndefined();
  });
});

describe("batchStats", () => {
  it("counts ok and errors", () => {
    const records: DnsRecord[] = [
      { type: "A", value: "1.2.3.4" },
      { type: "MX", value: "mail.example.com", priority: 5 },
      { type: "A", value: "bad" },
    ];
    const stats = batchStats(validateBatch(records));
    expect(stats.total).toBe(3);
    expect(stats.ok).toBe(2);
    expect(stats.errors).toBe(1);
    expect(stats.byType.A).toBe(2);
    expect(stats.byType.MX).toBe(1);
  });
  it("returns zeros for empty batch", () => {
    const stats = batchStats([]);
    expect(stats.total).toBe(0);
    expect(stats.ok).toBe(0);
  });
});

describe("referenceTable", () => {
  it("covers every supported record type", () => {
    const t = referenceTable();
    expect(t.length).toBeGreaterThanOrEqual(8);
    const types = t.map((e) => e.type);
    expect(types).toContain("A");
    expect(types).toContain("AAAA");
    expect(types).toContain("SRV");
    expect(types).toContain("CAA");
  });
});

describe("batchToCsv", () => {
  it("generates CSV with header", () => {
    const r = batchToCsv(validateBatch([{ type: "A", value: "1.2.3.4" }]));
    expect(r.split("\n")[0]).toBe("Type,Value,Valid,Error,ZoneLine");
    expect(r).toContain("A");
    expect(r).toContain("yes");
  });
  it("includes errors for invalid records", () => {
    const r = batchToCsv(validateBatch([{ type: "A", value: "bad" }]));
    expect(r).toContain("no");
  });
});

describe("parseBatchInput", () => {
  it("parses one record per line", () => {
    const records = parseBatchInput("A 1.2.3.4\nMX mail.example.com");
    expect(records).toHaveLength(2);
    expect(records[0]!.type).toBe("A");
    expect(records[0]!.value).toBe("1.2.3.4");
    expect(records[1]!.type).toBe("MX");
  });
  it("supports pipe separator", () => {
    const records = parseBatchInput("A|1.2.3.4");
    expect(records[0]!.value).toBe("1.2.3.4");
  });
  it("skips empty lines", () => {
    const records = parseBatchInput("\n  \nA 1.2.3.4");
    expect(records).toHaveLength(1);
  });
});
