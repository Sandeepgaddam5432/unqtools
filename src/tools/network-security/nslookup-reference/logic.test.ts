import { describe, it, expect } from "vitest";
import {
  lookupQueryType, commonQueryTypes, buildDigCommand, buildNslookupCommand,
  classifyTtl, TTL_REFERENCE, DNSSEC_REFERENCE, EDNS_REFERENCE, planBatch,
  renderQueryTypeReport, renderQueryTypesCsv, renderCheatSheet,
  getQueryTypes, getTtlReference, QUERY_TYPES,
  type QueryType, type BatchLookup,
} from "./logic";

describe("nslookup-reference lookupQueryType", () => {
  it("finds A record info", () => {
    const info = lookupQueryType("A");
    expect(info).toBeDefined();
    expect(info!.name).toMatch(/IPv4/);
  });
  it("returns undefined for unknown type (via cast)", () => {
    expect(lookupQueryType("XYZ" as QueryType)).toBeUndefined();
  });
});

describe("nslookup-reference commonQueryTypes", () => {
  it("returns only common types", () => {
    const c = commonQueryTypes();
    expect(c.length).toBeLessThan(QUERY_TYPES.length);
    expect(c.every((q) => q.common)).toBe(true);
  });
});

describe("nslookup-reference buildDigCommand", () => {
  it("builds a basic dig command", () => {
    const cmd = buildDigCommand({ domain: "example.com", type: "A" });
    expect(cmd).toBe("dig example.com A");
  });
  it("adds server, port, and flags", () => {
    const cmd = buildDigCommand({ domain: "example.com", type: "AAAA", server: "8.8.8.8", port: 5353, tcp: true, verbose: true });
    expect(cmd).toContain("@8.8.8.8");
    expect(cmd).toContain("-p 5353");
    expect(cmd).toContain("+tcp");
    expect(cmd).toContain("+trace");
  });
});

describe("nslookup-reference buildNslookupCommand", () => {
  it("builds a basic nslookup command", () => {
    const cmd = buildNslookupCommand({ domain: "example.com", type: "MX" });
    expect(cmd).toBe("nslookup -type=MX example.com");
  });
  it("adds server and port", () => {
    const cmd = buildNslookupCommand({ domain: "example.com", type: "TXT", server: "1.1.1.1", port: 5353 });
    expect(cmd).toContain("1.1.1.1");
    expect(cmd).toContain("-port=5353");
  });
});

describe("nslookup-reference classifyTtl", () => {
  it("classifies 300s as 1-5m bucket", () => {
    const b = classifyTtl(300);
    expect(b).toBeDefined();
    expect(b!.range).toBe("1–5m");
  });
  it("classifies 0 as near real-time", () => {
    expect(classifyTtl(0)!.range).toBe("0–60s");
  });
  it("classifies large TTLs as 1d+", () => {
    expect(classifyTtl(100000)!.range).toBe("1d+");
  });
  it("classifies 3600s as 30m-1h", () => {
    expect(classifyTtl(3600)!.range).toBe("30m–1h");
  });
});

describe("nslookup-reference TTL_REFERENCE", () => {
  it("has 7 buckets", () => {
    expect(TTL_REFERENCE.length).toBe(7);
  });
});

describe("nslookup-reference DNSSEC_REFERENCE", () => {
  it("lists 5 record types", () => {
    expect(DNSSEC_REFERENCE.recordTypes.length).toBe(5);
    expect(DNSSEC_REFERENCE.recordTypes).toContain("DNSKEY");
  });
  it("lists benefits and drawbacks", () => {
    expect(DNSSEC_REFERENCE.benefits.length).toBeGreaterThan(0);
    expect(DNSSEC_REFERENCE.drawbacks.length).toBeGreaterThan(0);
  });
});

describe("nslookup-reference EDNS_REFERENCE", () => {
  it("has default UDP size 4096", () => {
    expect(EDNS_REFERENCE.defaultUdpSize).toBe(4096);
  });
  it("lists DO and Z flags", () => {
    expect(EDNS_REFERENCE.flags).toContain("DO (DNSSEC OK)");
  });
});

describe("nslookup-reference planBatch", () => {
  it("builds commands for a batch", () => {
    const lookups: BatchLookup[] = [
      { domain: "a.com", type: "A" },
      { domain: "b.com", type: "MX" },
      { domain: "a.com", type: "AAAA" },
    ];
    const b = planBatch(lookups);
    expect(b.digCommands.length).toBe(3);
    expect(b.nslookupCommands.length).toBe(3);
    expect(b.stats.count).toBe(3);
    expect(b.stats.byType.A).toBe(1);
    expect(b.stats.byType.MX).toBe(1);
    expect(b.stats.byType.AAAA).toBe(1);
    expect(b.stats.uniqueDomains).toBe(2);
  });
  it("handles empty batch", () => {
    const b = planBatch([]);
    expect(b.stats.count).toBe(0);
    expect(b.stats.uniqueDomains).toBe(0);
  });
});

describe("nslookup-reference renderQueryTypeReport", () => {
  it("renders a report for one type", () => {
    const info = lookupQueryType("MX")!;
    const r = renderQueryTypeReport(info);
    expect(r).toContain("DNS Query Type: MX");
    expect(r).toContain("Description:");
  });
});

describe("nslookup-reference renderQueryTypesCsv", () => {
  it("renders CSV with header", () => {
    const csv = renderQueryTypesCsv();
    const lines = csv.split("\n");
    expect(lines[0]).toBe("type,name,description,common");
    expect(lines.length).toBe(QUERY_TYPES.length + 1);
  });
});

describe("nslookup-reference renderCheatSheet", () => {
  it("renders a markdown cheat-sheet", () => {
    const md = renderCheatSheet();
    expect(md).toContain("# DNS / NSLookup Cheat Sheet");
    expect(md).toContain("## Query types");
    expect(md).toContain("## TTL reference");
    expect(md).toContain("## DNSSEC");
    expect(md).toContain("## EDNS");
  });
});

describe("nslookup-reference getQueryTypes / getTtlReference", () => {
  it("returns copies", () => {
    expect(getQueryTypes().length).toBe(QUERY_TYPES.length);
    expect(getTtlReference().length).toBe(TTL_REFERENCE.length);
  });
});
