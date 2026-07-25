/**
 * Employee Shift Trader — pure logic.
 * Determine feasibility of shift swaps between employees.
 */

export interface Shift {
  id: string;
  employeeId: string;
  role: string; // required role
  start: string; // ISO time or yyyy-mm-dd HH:mm
  end: string;
  day: string; // yyyy-mm-dd
}

export interface Employee {
  id: string;
  name: string;
  roles: string[]; // qualified roles
  maxHoursPerWeek: number;
}

export interface SwapRequest {
  shiftId: string;
  fromEmployeeId: string;
  toEmployeeId: string;
}

export interface ConflictCheck {
  hasConflict: boolean;
  reason?: string;
  conflictingShiftId?: string;
}

export interface SwapResult {
  feasible: boolean;
  coverageMaintained: boolean;
  conflicts: ConflictCheck[];
  warnings: string[];
  reasons: string[];
}

/** Parse "yyyy-mm-dd HH:mm" into a Date object (UTC). */
function parseShiftTime(day: string, time: string): Date {
  // time may already include day
  const s = time.includes("T") || time.includes(" ") && time.length > 5 ? time : `${day}T${time}:00`;
  return new Date(s);
}

/** Detect overlap between two shifts (same day, overlapping time range). */
export function shiftsOverlap(a: Shift, b: Shift): boolean {
  if (a.day !== b.day) return false;
  const as = parseShiftTime(a.day, a.start);
  const ae = parseShiftTime(a.day, a.end);
  const bs = parseShiftTime(b.day, b.start);
  const be = parseShiftTime(b.day, b.end);
  return as < be && bs < ae;
}

/** Check if employee is qualified for a role. */
export function isQualified(employee: Employee, role: string): boolean {
  return employee.roles.includes(role);
}

/** Sum weekly hours from a list of shifts (assuming shifts use same time format). */
export function computeWeeklyHours(shifts: Shift[]): number {
  let totalMs = 0;
  for (const s of shifts) {
    const start = parseShiftTime(s.day, s.start);
    const end = parseShiftTime(s.day, s.end);
    totalMs += Math.max(0, end.getTime() - start.getTime());
  }
  return totalMs / (1000 * 60 * 60);
}

/** Check if adding a new shift would push the employee over their max weekly hours.
 *  `currentShifts` is assumed to already be filtered to the employee in question. */
export function checkWeeklyHours(employee: Employee, currentShifts: Shift[], newShift: Shift): { ok: boolean; projected: number; max: number } {
  const baseHours = computeWeeklyHours(currentShifts);
  const shiftHours = computeWeeklyHours([newShift]);
  const projected = baseHours + shiftHours;
  return { ok: projected <= employee.maxHoursPerWeek, projected, max: employee.maxHoursPerWeek };
}

/** Evaluate a swap request. */
export function evaluateSwap(
  request: SwapRequest,
  shift: Shift,
  toEmployee: Employee,
  toEmployeeShifts: Shift[]
): SwapResult {
  const conflicts: ConflictCheck[] = [];
  const warnings: string[] = [];
  const reasons: string[] = [];

  // 1. Role qualification
  if (!isQualified(toEmployee, shift.role)) {
    conflicts.push({ hasConflict: true, reason: `${toEmployee.name} is not qualified for role "${shift.role}".` });
    reasons.push(`Not qualified for ${shift.role}.`);
  }

  // 2. Time conflict
  for (const s of toEmployeeShifts) {
    if (s.employeeId !== toEmployee.id) continue;
    if (shiftsOverlap(shift, s)) {
      conflicts.push({ hasConflict: true, reason: `Overlaps with shift ${s.id}.`, conflictingShiftId: s.id });
      reasons.push(`Overlaps shift ${s.id}.`);
    }
  }

  // 3. Weekly hours
  const hours = checkWeeklyHours(toEmployee, toEmployeeShifts, shift);
  if (!hours.ok) {
    conflicts.push({ hasConflict: true, reason: `Would exceed ${toEmployee.name}'s max weekly hours (${hours.projected.toFixed(1)} / ${hours.max}).` });
    reasons.push(`Exceeds max weekly hours.`);
  }
  if (hours.projected > hours.max * 0.8) {
    warnings.push(`${toEmployee.name} would be at ${Math.round((hours.projected / hours.max) * 100)}% of weekly max.`);
  }

  const feasible = conflicts.length === 0;
  const coverageMaintained = feasible; // coverage is maintained if swap is feasible

  return {
    feasible,
    coverageMaintained,
    conflicts,
    warnings,
    reasons: feasible ? ["No conflicts. Swap is feasible."] : reasons,
  };
}

/** Generate swap suggestions: who can cover a shift? */
export function suggestSwapCandidates(
  shift: Shift,
  employees: Employee[],
  allShifts: Shift[]
): Array<{ employee: Employee; result: SwapResult }> {
  const candidates: Array<{ employee: Employee; result: SwapResult }> = [];
  for (const emp of employees) {
    if (emp.id === shift.employeeId) continue;
    const empShifts = allShifts.filter((s) => s.employeeId === emp.id);
    const result = evaluateSwap(
      { shiftId: shift.id, fromEmployeeId: shift.employeeId, toEmployeeId: emp.id },
      shift,
      emp,
      empShifts
    );
    if (result.feasible) candidates.push({ employee: emp, result });
  }
  return candidates;
}
