import { describe, it, expect } from "vitest";
import { parseCidr, rangeToCidrs, mergeCidrs } from "./logic";

describe("subnet-cidr-merger parseCidr", () => {
  it("parses a valid CIDR", () => {
    const r = parseCidr("192.168.1.0/24");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.start).toBe(0xc0a80100);
      expect(r.end).toBe(0xc0a801ff);
      expect(r.cidr).toBe("192.168.1.0/24");
    }
  });

  it("rejects missing prefix", () => {
    const r = parseCidr("192.168.1.0");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/prefix/i);
  });

  it("rejects invalid IP", () => {
    const r = parseCidr("999.168.1.0/24");
    expect(r.ok).toBe(false);
  });

  it("rejects out-of-range prefix", () => {
    const r = parseCidr("192.168.1.0/40");
    expect(r.ok).toBe(false);
  });

  it("normalizes a non-aligned CIDR to its network address", () => {
    const r = parseCidr("192.168.1.10/24");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.cidr).toBe("192.168.1.0/24");
  });
});

describe("subnet-cidr-merger rangeToCidrs", () => {
  it("returns a single CIDR for an aligned block", () => {
    expect(rangeToCidrs(0xc0a80100, 0xc0a801ff)).toEqual(["192.168.1.0/24"]);
  });

  it("splits an unaligned range", () => {
    const cidrs = rangeToCidrs(0xc0a80180, 0xc0a801ff);
    expect(cidrs).toEqual(["192.168.1.128/25"]);
  });

  it("handles a single IP", () => {
    expect(rangeToCidrs(0x08080808, 0x08080808)).toEqual(["8.8.8.8/32"]);
  });
});

describe("subnet-cidr-merger mergeCidrs", () => {
  it("merges adjacent CIDRs", () => {
    const res = mergeCidrs(["192.168.0.0/24", "192.168.1.0/24"]);
    expect(res.ranges.length).toBe(1);
    expect(res.ranges[0].cidr).toBe("192.168.0.0/23");
  });

  it("merges overlapping CIDRs", () => {
    const res = mergeCidrs(["10.0.0.0/24", "10.0.0.128/25"]);
    expect(res.ranges.length).toBe(1);
    expect(res.ranges[0].start).toBe("10.0.0.0");
    expect(res.ranges[0].end).toBe("10.0.0.255");
  });

  it("keeps non-adjacent CIDRs separate", () => {
    const res = mergeCidrs(["192.168.0.0/24", "10.0.0.0/8"]);
    expect(res.ranges.length).toBe(2);
  });

  it("collects parse errors", () => {
    const res = mergeCidrs(["192.168.1.0/24", "bad-input"]);
    expect(res.errors.length).toBe(1);
    expect(res.ranges.length).toBe(1);
  });

  it("skips empty lines", () => {
    const res = mergeCidrs(["", "  ", "192.168.1.0/24"]);
    expect(res.ranges.length).toBe(1);
    expect(res.inputCount).toBe(3);
  });
});
