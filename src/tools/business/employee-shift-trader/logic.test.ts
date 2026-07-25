import { describe, it, expect } from "vitest";
import {
  shiftsOverlap,
  isQualified,
  computeWeeklyHours,
  checkWeeklyHours,
  evaluateSwap,
  suggestSwapCandidates,
  type Shift,
  type Employee,
} from "./logic";

const shiftA: Shift = { id: "s1", employeeId: "e1", role: "cashier", start: "09:00", end: "17:00", day: "2024-05-01" };
const shiftB: Shift = { id: "s2", employeeId: "e2", role: "cashier", start: "15:00", end: "23:00", day: "2024-05-01" };
const shiftC: Shift = { id: "s3", employeeId: "e2", role: "cashier", start: "10:00", end: "16:00", day: "2024-05-02" };

const emp1: Employee = { id: "e1", name: "Alice", roles: ["cashier", "cook"], maxHoursPerWeek: 40 };
const emp2: Employee = { id: "e2", name: "Bob", roles: ["cashier"], maxHoursPerWeek: 20 };

describe("employee-shift-trader shiftsOverlap", () => {
  it("detects overlap on same day", () => {
    expect(shiftsOverlap(shiftA, shiftB)).toBe(true);
  });

  it("returns false for different days", () => {
    expect(shiftsOverlap(shiftA, shiftC)).toBe(false);
  });

  it("returns false for non-overlapping times", () => {
    const early: Shift = { ...shiftA, start: "06:00", end: "08:00" };
    expect(shiftsOverlap(early, shiftA)).toBe(false);
  });
});

describe("employee-shift-trader isQualified", () => {
  it("returns true for matching role", () => {
    expect(isQualified(emp1, "cashier")).toBe(true);
  });

  it("returns false for non-matching role", () => {
    expect(isQualified(emp2, "cook")).toBe(false);
  });
});

describe("employee-shift-trader computeWeeklyHours", () => {
  it("computes hours from shifts", () => {
    const hours = computeWeeklyHours([shiftA]);
    expect(hours).toBeCloseTo(8, 1);
  });

  it("sums across multiple shifts", () => {
    const hours = computeWeeklyHours([shiftA, shiftC]);
    expect(hours).toBeCloseTo(14, 1);
  });
});

describe("employee-shift-trader checkWeeklyHours", () => {
  it("returns ok when under max", () => {
    const r = checkWeeklyHours(emp1, [], shiftA);
    expect(r.ok).toBe(true);
    expect(r.projected).toBeCloseTo(8, 1);
  });

  it("returns not ok when over max", () => {
    const manyShifts: Shift[] = Array.from({ length: 5 }, (_, i) => ({ ...shiftA, id: `s${i}`, day: `2024-05-0${i + 1}` }));
    const r = checkWeeklyHours(emp2, manyShifts, shiftA);
    expect(r.ok).toBe(false);
  });
});

describe("employee-shift-trader evaluateSwap", () => {
  it("marks feasible when no conflicts", () => {
    const r = evaluateSwap({ shiftId: "s1", fromEmployeeId: "e1", toEmployeeId: "e2" }, shiftA, emp2, []);
    expect(r.feasible).toBe(true);
    expect(r.coverageMaintained).toBe(true);
  });

  it("rejects unqualified employee", () => {
    const r = evaluateSwap({ shiftId: "s1", fromEmployeeId: "e1", toEmployeeId: "e2" }, { ...shiftA, role: "cook" }, emp2, []);
    expect(r.feasible).toBe(false);
  });

  it("rejects overlapping shift", () => {
    const r = evaluateSwap({ shiftId: "s1", fromEmployeeId: "e1", toEmployeeId: "e2" }, shiftA, emp2, [shiftB]);
    expect(r.feasible).toBe(false);
    expect(r.reasons.some((x) => x.includes("Overlaps"))).toBe(true);
  });

  it("warns near max hours", () => {
    const manyShifts: Shift[] = Array.from({ length: 3 }, (_, i) => ({ ...shiftA, id: `s${i}`, day: `2024-05-0${i + 1}` }));
    const r = evaluateSwap({ shiftId: "s1", fromEmployeeId: "e1", toEmployeeId: "e2" }, shiftA, emp2, manyShifts);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

describe("employee-shift-trader suggestSwapCandidates", () => {
  it("returns qualified, non-conflicting employees", () => {
    const candidates = suggestSwapCandidates(shiftA, [emp1, emp2], [shiftB]);
    // emp2 has shiftB overlapping shiftA, so emp2 excluded; emp1 is the shift owner, also excluded
    const names = candidates.map((c) => c.employee.name);
    expect(names).not.toContain("Alice"); // owner
    expect(names).not.toContain("Bob"); // conflict
  });

  it("includes employee with no conflicts", () => {
    const emp3: Employee = { id: "e3", name: "Carol", roles: ["cashier"], maxHoursPerWeek: 40 };
    const candidates = suggestSwapCandidates(shiftA, [emp1, emp2, emp3], []);
    expect(candidates.some((c) => c.employee.id === "e3")).toBe(true);
  });
});
