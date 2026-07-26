import { describe, it, expect } from "vitest";
import {
  parseCertDate, daysBetween, computeStatus, validateRecord, buildReport,
  buildBatch, sortReports, groupByStatus, computeBatchStats, renderBatchCsv,
  renderReport, renderBatchSummary, getSampleRecords, DEFAULT_THRESHOLDS,
  type CertRecord,
} from "./logic";

const NOW = new Date("2024-07-01T00:00:00Z");

describe("ssl-expiry-tracker parseCertDate", () => {
  it("parses valid ISO date", () => {
    const d = parseCertDate("2024-06-01");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2024);
  });
  it("returns null for invalid input", () => {
    expect(parseCertDate("not-a-date")).toBeNull();
    expect(parseCertDate("")).toBeNull();
  });
});

describe("ssl-expiry-tracker daysBetween", () => {
  it("computes whole days", () => {
    expect(daysBetween(new Date("2024-01-01"), new Date("2024-01-11"))).toBe(10);
  });
  it("returns negative for past dates", () => {
    expect(daysBetween(new Date("2024-02-01"), new Date("2024-01-01"))).toBe(-31);
  });
});

describe("ssl-expiry-tracker computeStatus", () => {
  it("returns valid when far from expiry", () => {
    expect(computeStatus(120, DEFAULT_THRESHOLDS)).toBe("valid");
  });
  it("returns expiring within warn window", () => {
    expect(computeStatus(20, DEFAULT_THRESHOLDS)).toBe("expiring");
  });
  it("returns expiring within critical window", () => {
    expect(computeStatus(3, DEFAULT_THRESHOLDS)).toBe("expiring");
  });
  it("returns expired for negative days", () => {
    expect(computeStatus(-1, DEFAULT_THRESHOLDS)).toBe("expired");
  });
});

describe("ssl-expiry-tracker validateRecord", () => {
  it("returns no errors for a valid record", () => {
    const r: CertRecord = { domain: "x.com", issuedOn: "2024-01-01", expiresOn: "2025-01-01" };
    expect(validateRecord(r)).toEqual([]);
  });
  it("flags missing domain", () => {
    const r: CertRecord = { domain: "", issuedOn: "2024-01-01", expiresOn: "2025-01-01" };
    expect(validateRecord(r).some((e) => e.includes("domain"))).toBe(true);
  });
  it("flags expiry before issue", () => {
    const r: CertRecord = { domain: "x.com", issuedOn: "2024-12-01", expiresOn: "2024-01-01" };
    expect(validateRecord(r).some((e) => e.includes("Expiry"))).toBe(true);
  });
});

describe("ssl-expiry-tracker buildReport", () => {
  it("builds a valid report", () => {
    const r: CertRecord = { domain: "x.com", issuedOn: "2024-01-01", expiresOn: "2024-12-31" };
    const rep = buildReport(r, DEFAULT_THRESHOLDS, NOW);
    // 183 days remaining from July 1 → beyond warn window → valid
    expect(rep.status).toBe("valid");
    expect(rep.daysRemaining).toBeGreaterThan(30);
  });
  it("flags an expiring cert within warn window", () => {
    const r: CertRecord = { domain: "x.com", issuedOn: "2024-06-01", expiresOn: "2024-07-15" };
    const rep = buildReport(r, DEFAULT_THRESHOLDS, NOW);
    expect(rep.status).toBe("expiring");
    expect(rep.warnings.length).toBeGreaterThan(0);
  });
  it("flags expired cert", () => {
    const r: CertRecord = { domain: "x.com", issuedOn: "2022-01-01", expiresOn: "2023-01-01" };
    const rep = buildReport(r, DEFAULT_THRESHOLDS, NOW);
    expect(rep.status).toBe("expired");
    expect(rep.warnings.length).toBeGreaterThan(0);
  });
  it("returns unknown for invalid record", () => {
    const r: CertRecord = { domain: "", issuedOn: "bad", expiresOn: "bad" };
    const rep = buildReport(r, DEFAULT_THRESHOLDS, NOW);
    expect(rep.status).toBe("unknown");
  });
});

describe("ssl-expiry-tracker buildBatch", () => {
  it("builds reports for all records", () => {
    const rs = buildBatch(getSampleRecords(), DEFAULT_THRESHOLDS, NOW);
    expect(rs.length).toBe(3);
  });
});

describe("ssl-expiry-tracker sortReports", () => {
  it("sorts by domain ascending", () => {
    const rs = buildBatch([
      { domain: "z.com", issuedOn: "2024-01-01", expiresOn: "2025-01-01" },
      { domain: "a.com", issuedOn: "2024-01-01", expiresOn: "2025-01-01" },
    ], DEFAULT_THRESHOLDS, NOW);
    const sorted = sortReports(rs, "domain", true);
    expect(sorted[0].record.domain).toBe("a.com");
  });
  it("sorts by daysRemaining descending", () => {
    const rs = buildBatch(getSampleRecords(), DEFAULT_THRESHOLDS, NOW);
    const sorted = sortReports(rs, "daysRemaining", false);
    expect(sorted[0].daysRemaining).toBeGreaterThanOrEqual(sorted[sorted.length - 1].daysRemaining);
  });
});

describe("ssl-expiry-tracker groupByStatus", () => {
  it("groups reports by status", () => {
    const rs = buildBatch(getSampleRecords(), DEFAULT_THRESHOLDS, NOW);
    const groups = groupByStatus(rs);
    expect(Object.keys(groups).length).toBe(4);
    const total = groups.valid.length + groups.expiring.length + groups.expired.length + groups.unknown.length;
    expect(total).toBe(3);
  });
});

describe("ssl-expiry-tracker computeBatchStats", () => {
  it("aggregates stats", () => {
    const rs = buildBatch(getSampleRecords(), DEFAULT_THRESHOLDS, NOW);
    const s = computeBatchStats(rs);
    expect(s.total).toBe(3);
    expect(s.valid + s.expiring + s.expired + s.unknown).toBe(3);
  });
  it("handles empty input", () => {
    const s = computeBatchStats([]);
    expect(s.total).toBe(0);
  });
});

describe("ssl-expiry-tracker renderBatchCsv", () => {
  it("renders CSV with header", () => {
    const csv = renderBatchCsv([]);
    expect(csv.split("\n")[0]).toContain("domain,issued_on");
  });
  it("includes each record", () => {
    const rs = buildBatch(getSampleRecords(), DEFAULT_THRESHOLDS, NOW);
    const csv = renderBatchCsv(rs);
    expect(csv.split("\n").length).toBe(4); // header + 3 records
  });
});

describe("ssl-expiry-tracker renderReport", () => {
  it("renders a report", () => {
    const r: CertRecord = { domain: "x.com", issuedOn: "2024-01-01", expiresOn: "2024-12-31" };
    const rep = buildReport(r, DEFAULT_THRESHOLDS, NOW);
    const text = renderReport(rep);
    expect(text).toContain("SSL Certificate Expiry Report");
    expect(text).toContain("Domain:");
  });
});

describe("ssl-expiry-tracker renderBatchSummary", () => {
  it("renders summary", () => {
    const rs = buildBatch(getSampleRecords(), DEFAULT_THRESHOLDS, NOW);
    const s = computeBatchStats(rs);
    const text = renderBatchSummary(s);
    expect(text).toContain("SSL Expiry Batch Summary");
    expect(text).toContain("Total certificates: 3");
  });
});

describe("ssl-expiry-tracker getSampleRecords", () => {
  it("returns 3 samples", () => {
    expect(getSampleRecords().length).toBe(3);
  });
});
