/**
 * Bulk File Timestamp Changer — unit tests.
 */
import { describe, it, expect } from "vitest";
import { applyTimestampMode, generatePowerShellScript, generateBashScript, entriesToCsv, formatTimestamp, type FileTimestampEntry } from "./logic";

const baseEntries: FileTimestampEntry[] = [
  { fileName: "file1.txt", originalMtime: new Date("2024-01-01T12:00:00Z").getTime(), originalSize: 100, warnings: [] },
  { fileName: "file2.txt", originalMtime: new Date("2024-01-02T12:00:00Z").getTime(), originalSize: 200, warnings: [] },
  { fileName: "file3.txt", originalMtime: new Date("2024-01-03T12:00:00Z").getTime(), originalSize: 300, warnings: [] },
];

describe("applyTimestampMode — absolute", () => {
  it("sets all files to the same absolute date", () => {
    const r = applyTimestampMode(baseEntries, { kind: "absolute", date: "2025-06-15T10:30" });
    expect(r.summary.changed).toBe(3);
    expect(r.summary.failed).toBe(0);
    for (const e of r.entries) {
      expect(e.newMtime).toBe(new Date("2025-06-15T10:30").getTime());
    }
  });
  it("fails on invalid date", () => {
    const r = applyTimestampMode(baseEntries, { kind: "absolute", date: "" });
    expect(r.summary.failed).toBe(3);
  });
});

describe("applyTimestampMode — relative", () => {
  it("offsets by days/hours/minutes", () => {
    const r = applyTimestampMode([baseEntries[0]!], { kind: "relative", days: 1, hours: 2, minutes: 30 });
    const expected = baseEntries[0]!.originalMtime + (1 * 24 * 60 + 2 * 60 + 30) * 60 * 1000;
    expect(r.entries[0]!.newMtime).toBe(expected);
  });
});

describe("applyTimestampMode — touch", () => {
  it("sets to current time", () => {
    const before = Date.now();
    const r = applyTimestampMode([baseEntries[0]!], { kind: "touch" });
    const after = Date.now();
    expect(r.entries[0]!.newMtime).toBeGreaterThanOrEqual(before);
    expect(r.entries[0]!.newMtime).toBeLessThanOrEqual(after);
  });
});

describe("applyTimestampMode — sequence", () => {
  it("increments each file by N minutes from start", () => {
    const r = applyTimestampMode(baseEntries, { kind: "sequence", startISO: "2025-01-01T00:00", incrementMinutes: 10 });
    const start = new Date("2025-01-01T00:00").getTime();
    expect(r.entries[0]!.newMtime).toBe(start);
    expect(r.entries[1]!.newMtime).toBe(start + 10 * 60 * 1000);
    expect(r.entries[2]!.newMtime).toBe(start + 20 * 60 * 1000);
  });
});

describe("applyTimestampMode — random", () => {
  it("generates random time within range", () => {
    const r = applyTimestampMode([baseEntries[0]!], { kind: "random", fromISO: "2024-01-01", toISO: "2024-12-31" });
    const from = new Date("2024-01-01").getTime();
    const to = new Date("2024-12-31").getTime();
    expect(r.entries[0]!.newMtime).toBeGreaterThanOrEqual(from);
    expect(r.entries[0]!.newMtime).toBeLessThanOrEqual(to);
  });
});

describe("applyTimestampMode — filenameRegex", () => {
  it("parses YYYY-MM-DD from filename", () => {
    const entries = [
      { fileName: "photo-2024-06-15.jpg", originalMtime: 0, originalSize: 0, warnings: [] },
    ];
    const r = applyTimestampMode(entries, { kind: "filenameRegex", pattern: "(\\d{4}-\\d{2}-\\d{2})", dateFormat: "YYYY-MM-DD" });
    expect(r.entries[0]!.newMtime).toBe(new Date(2024, 5, 15).getTime());
  });
  it("parses YYYYMMDD from filename", () => {
    const entries = [
      { fileName: "IMG_20240615_1230.jpg", originalMtime: 0, originalSize: 0, warnings: [] },
    ];
    const r = applyTimestampMode(entries, { kind: "filenameRegex", pattern: "(\\d{8})", dateFormat: "YYYYMMDD" });
    expect(r.entries[0]!.newMtime).toBe(new Date(2024, 5, 15).getTime());
  });
  it("fails when pattern doesn't match", () => {
    const entries = [
      { fileName: "no-date-here.jpg", originalMtime: 0, originalSize: 0, warnings: [] },
    ];
    const r = applyTimestampMode(entries, { kind: "filenameRegex", pattern: "(\\d{4}-\\d{2}-\\d{2})", dateFormat: "YYYY-MM-DD" });
    expect(r.summary.failed).toBe(1);
  });
});

describe("applyTimestampMode — summary", () => {
  it("counts changed vs unchanged vs failed", () => {
    const entries = [
      { fileName: "a.txt", originalMtime: 1000, originalSize: 0, warnings: [] },
      { fileName: "b.txt", originalMtime: 1000, originalSize: 0, warnings: [] },
      { fileName: "c.txt", originalMtime: 1000, originalSize: 0, warnings: [] },
    ];
    const r = applyTimestampMode(entries, { kind: "absolute", date: "2025-01-01" });
    expect(r.summary.total).toBe(3);
    expect(r.summary.changed).toBe(3);
    expect(r.summary.unchanged).toBe(0);
  });
});

describe("generatePowerShellScript", () => {
  it("generates PowerShell commands", () => {
    const r = applyTimestampMode(baseEntries.slice(0, 1), { kind: "absolute", date: "2025-01-01T00:00" });
    const script = generatePowerShellScript(r.entries);
    expect(script).toContain("Get-Item");
    expect(script).toContain("LastWriteTime");
    expect(script).toContain("file1.txt");
  });
});

describe("generateBashScript", () => {
  it("generates bash touch commands", () => {
    const r = applyTimestampMode(baseEntries.slice(0, 1), { kind: "absolute", date: "2025-01-01T00:00" });
    const script = generateBashScript(r.entries);
    expect(script).toContain("touch -t");
    expect(script).toContain("file1.txt");
    expect(script.startsWith("#!/usr/bin/env bash")).toBe(true);
  });
});

describe("entriesToCsv", () => {
  it("generates CSV with header", () => {
    const csv = entriesToCsv(baseEntries);
    expect(csv.split("\n")[0]).toBe("FileName,OriginalMtimeISO,NewMtimeISO,Changed,Size");
    expect(csv).toContain("file1.txt");
  });
});

describe("formatTimestamp", () => {
  it("formats epoch ms to locale string", () => {
    const s = formatTimestamp(new Date("2024-01-01").getTime());
    expect(s).toContain("2024");
  });
});
