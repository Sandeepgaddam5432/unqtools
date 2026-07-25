/**
 * Contract Date Calculator — unit tests.
 */
import { describe, it, expect } from "vitest";
import { computeMilestones, toMarkdown } from "./logic";

const base = {
  startDate: "2024-01-01",
  durationDays: 365,
  noticePeriodDays: 30,
  renewalLeadDays: 60,
  paymentNetDays: 30,
  milestones: [
    { label: "Kickoff", offsetDays: 0 },
    { label: "Mid-term review", offsetDays: 180 },
    { label: "Final delivery", offsetDays: 360 },
  ],
};

describe("contract computeMilestones", () => {
  it("computes end date correctly (inclusive)", () => {
    const r = computeMilestones(base);
    expect(r.endDate).toBe("2024-12-31");
  });
  it("computes notice date = end - notice period", () => {
    const r = computeMilestones(base);
    expect(r.noticeDate).toBe("2024-12-01");
  });
  it("computes renewal notice date = end - renewal lead", () => {
    const r = computeMilestones(base);
    expect(r.renewalNoticeDate).toBe("2024-11-01");
  });
  it("computes first payment date = start + NET", () => {
    const r = computeMilestones(base);
    expect(r.firstPaymentDate).toBe("2024-01-31");
  });
  it("lists all milestones with computed dates", () => {
    const r = computeMilestones(base);
    expect(r.milestones).toHaveLength(3);
    expect(r.milestones[0].date).toBe("2024-01-01");
    expect(r.milestones[1].date).toBe("2024-06-29");
    expect(r.milestones[2].date).toBe("2024-12-26");
  });
  it("handles leap year correctly", () => {
    const r = computeMilestones({ ...base, startDate: "2024-02-28", durationDays: 1 });
    expect(r.endDate).toBe("2024-02-29");
  });
  it("reports errors for bad start date", () => {
    const r = computeMilestones({ ...base, startDate: "01/01/2024" });
    expect(r.errors.length).toBeGreaterThan(0);
  });
  it("reports error for non-positive duration", () => {
    const r = computeMilestones({ ...base, durationDays: 0 });
    expect(r.errors.length).toBeGreaterThan(0);
  });
  it("reports error for negative notice period", () => {
    const r = computeMilestones({ ...base, noticePeriodDays: -1 });
    expect(r.errors.length).toBeGreaterThan(0);
  });
});

describe("contract toMarkdown", () => {
  it("includes start and end dates", () => {
    const r = computeMilestones(base);
    const md = toMarkdown(r);
    expect(md).toContain("Start: 2024-01-01");
    expect(md).toContain("End: 2024-12-31");
  });
  it("includes milestone table", () => {
    const r = computeMilestones(base);
    const md = toMarkdown(r);
    expect(md).toContain("Kickoff");
    expect(md).toContain("Mid-term review");
  });
});
