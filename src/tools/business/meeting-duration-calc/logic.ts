/**
 * Meeting Duration Calculator — meeting cost = sum(attendee_rate × duration).
 *
 * Supports per-attendee hourly rates, break-time deduction, overtime multiplier,
 * per-person cost breakdown, batch mode, multi-currency, and CSV export.
 */

export type Currency = "USD" | "EUR" | "GBP" | "INR" | "JPY" | "AUD" | "CAD" | "CNY";

export interface Attendee {
  name: string;
  hourlyRate: number;
}

export interface MeetingInput {
  attendees: Attendee[];
  durationMinutes: number;
  /** Total break minutes to deduct from working time. */
  breakMinutes?: number;
  /** Overtime multiplier (e.g. 1.5 = time-and-a-half after threshold). */
  overtimeMultiplier?: number;
  /** Minutes after which overtime kicks in. 0 = no overtime. */
  overtimeThresholdMinutes?: number;
  /** Additional overhead (% of total cost). */
  overheadPercent?: number;
  currency?: Currency;
}

export interface MeetingResult {
  totalCost: number;
  costPerMinute: number;
  costPerAttendee: number;
  attendeeCount: number;
  durationHours: number;
  workingMinutes: number;
  breakMinutes: number;
  overtimeMinutes: number;
  overtimeCost: number;
  baseCost: number;
  overheadCost: number;
  withOverhead: number;
  currency: Currency;
  formula: string;
}

export interface AttendeeBreakdownEntry {
  name: string;
  hourlyRate: number;
  hours: number;
  cost: number;
  overtimeCost: number;
  total: number;
}

export interface MeetingStats {
  durationMs: number;
  attendeeCount: number;
  workingMinutes: number;
  overtimeMinutes: number;
}

const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function computeMeetingCost(input: MeetingInput): MeetingResult | { error: string } {
  const start = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (input.attendees.length === 0) return { error: "Need at least one attendee" };
  if (input.durationMinutes <= 0) return { error: "Duration must be positive" };
  if (input.attendees.some((a) => a.hourlyRate < 0)) return { error: "Hourly rates cannot be negative" };
  const breakMinutes = input.breakMinutes ?? 0;
  if (breakMinutes < 0) return { error: "Break minutes cannot be negative" };
  if (breakMinutes >= input.durationMinutes) return { error: "Break minutes must be less than total duration" };
  const currency = input.currency ?? "USD";
  const workingMinutes = input.durationMinutes - breakMinutes;
  const overtimeThreshold = input.overtimeThresholdMinutes ?? 0;
  const overtimeMult = input.overtimeMultiplier ?? 1;
  let overtimeMinutes = 0;
  if (overtimeThreshold > 0 && workingMinutes > overtimeThreshold) {
    overtimeMinutes = workingMinutes - overtimeThreshold;
  }
  const regularMinutes = workingMinutes - overtimeMinutes;

  const regularHours = regularMinutes / 60;
  const overtimeHours = overtimeMinutes / 60;

  let baseCost = 0;
  let overtimeCost = 0;
  for (const a of input.attendees) {
    baseCost += a.hourlyRate * regularHours;
    overtimeCost += a.hourlyRate * overtimeHours * overtimeMult;
  }
  const subtotal = baseCost + overtimeCost;
  const overhead = (input.overheadPercent ?? 0) / 100;
  const overheadCost = subtotal * overhead;
  const withOverhead = subtotal + overheadCost;

  const end = typeof performance !== "undefined" ? performance.now() : Date.now();
  // Duration tracked for consistency with other tools; not returned in result.
  const _duration = end - start;
  void _duration;

  return {
    totalCost: round(subtotal),
    costPerMinute: subtotal / input.durationMinutes,
    costPerAttendee: round(subtotal / input.attendees.length),
    attendeeCount: input.attendees.length,
    durationHours: round(input.durationMinutes / 60),
    workingMinutes,
    breakMinutes,
    overtimeMinutes,
    overtimeCost: round(overtimeCost),
    baseCost: round(baseCost),
    overheadCost: round(overheadCost),
    withOverhead: round(withOverhead),
    currency,
    formula: "cost = Σ(rate × hours) + overtime + overhead",
  };
}

/** Per-attendee cost breakdown. */
export function attendeeBreakdown(input: MeetingInput): AttendeeBreakdownEntry[] {
  const breakMinutes = input.breakMinutes ?? 0;
  const workingMinutes = Math.max(0, input.durationMinutes - breakMinutes);
  const overtimeThreshold = input.overtimeThresholdMinutes ?? 0;
  const overtimeMult = input.overtimeMultiplier ?? 1;
  let overtimeMinutes = 0;
  if (overtimeThreshold > 0 && workingMinutes > overtimeThreshold) {
    overtimeMinutes = workingMinutes - overtimeThreshold;
  }
  const regularMinutes = workingMinutes - overtimeMinutes;
  return input.attendees.map((a) => {
    const regularHours = regularMinutes / 60;
    const overtimeHours = overtimeMinutes / 60;
    const cost = a.hourlyRate * regularHours;
    const overtimeCost = a.hourlyRate * overtimeHours * overtimeMult;
    return {
      name: a.name || "Unnamed",
      hourlyRate: a.hourlyRate,
      hours: round(regularHours + overtimeHours),
      cost: round(cost),
      overtimeCost: round(overtimeCost),
      total: round(cost + overtimeCost),
    };
  });
}

/** Batch: process multiple meeting inputs. */
export function computeMeetingCostBatch(inputs: MeetingInput[]): (MeetingResult | { error: string })[] {
  return inputs.map((i) => computeMeetingCost(i));
}

/** Format currency using Intl. */
export function formatMoney(n: number, currency: Currency = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

/** Compute statistics for a meeting. */
export function computeStats(input: MeetingInput): MeetingStats {
  const start = typeof performance !== "undefined" ? performance.now() : Date.now();
  const r = computeMeetingCost(input);
  const end = typeof performance !== "undefined" ? performance.now() : Date.now();
  const workingMinutes = "error" in r ? 0 : r.workingMinutes;
  const overtimeMinutes = "error" in r ? 0 : r.overtimeMinutes;
  return {
    durationMs: Math.max(0, end - start),
    attendeeCount: input.attendees.length,
    workingMinutes,
    overtimeMinutes,
  };
}

/** Serialize attendee breakdown to CSV. */
export function breakdownToCsv(breakdown: AttendeeBreakdownEntry[]): string {
  const lines = ["Name,HourlyRate,Hours,BaseCost,OvertimeCost,Total"];
  for (const e of breakdown) {
    lines.push(`"${e.name}",${e.hourlyRate},${e.hours},${e.cost},${e.overtimeCost},${e.total}`);
  }
  return lines.join("\n");
}

/** Render a plain-text meeting cost report. */
export function renderReport(input: MeetingInput, result: MeetingResult): string {
  const L: string[] = [];
  L.push("MEETING COST REPORT", "=".repeat(40), "");
  L.push(`Attendees: ${result.attendeeCount}`);
  L.push(`Duration: ${input.durationMinutes} min (${result.durationHours}h)`);
  if (result.breakMinutes > 0) L.push(`Breaks: ${result.breakMinutes} min`);
  L.push(`Working time: ${result.workingMinutes} min`);
  if (result.overtimeMinutes > 0) L.push(`Overtime: ${result.overtimeMinutes} min`);
  L.push("");
  L.push(`Base cost: ${formatMoney(result.baseCost, result.currency)}`);
  if (result.overtimeCost > 0) L.push(`Overtime cost: ${formatMoney(result.overtimeCost, result.currency)}`);
  if (result.overheadCost > 0) L.push(`Overhead: ${formatMoney(result.overheadCost, result.currency)}`);
  L.push("-".repeat(40));
  L.push(`Total (with overhead): ${formatMoney(result.withOverhead, result.currency)}`);
  L.push(`Cost per minute: ${formatMoney(result.costPerMinute, result.currency)}`);
  L.push(`Cost per attendee: ${formatMoney(result.costPerAttendee, result.currency)}`);
  return L.join("\n");
}

export const CURRENCIES: { value: Currency; label: string }[] = [
  { value: "USD", label: "USD ($)" },
  { value: "EUR", label: "EUR (€)" },
  { value: "GBP", label: "GBP (£)" },
  { value: "INR", label: "INR (₹)" },
  { value: "JPY", label: "JPY (¥)" },
  { value: "AUD", label: "AUD (A$)" },
  { value: "CAD", label: "CAD (C$)" },
  { value: "CNY", label: "CNY (¥)" },
];
