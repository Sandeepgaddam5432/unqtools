/**
 * Meeting Duration Calculator — meeting cost = sum(attendee_rate × duration).
 */
export interface Attendee {
  name: string;
  hourlyRate: number;
}

export interface MeetingInput {
  attendees: Attendee[];
  durationMinutes: number;
  overheadPercent?: number; // additional overhead (% of total cost)
}

export interface MeetingResult {
  totalCost: number;
  costPerMinute: number;
  attendeeCount: number;
  durationHours: number;
  withOverhead: number;
}

export function computeMeetingCost(input: MeetingInput): MeetingResult | { error: string } {
  if (input.attendees.length === 0) return { error: "Need at least one attendee" };
  if (input.durationMinutes <= 0) return { error: "Duration must be positive" };
  if (input.attendees.some((a) => a.hourlyRate < 0)) return { error: "Hourly rates cannot be negative" };
  const hours = input.durationMinutes / 60;
  const totalCost = input.attendees.reduce((sum, a) => sum + a.hourlyRate * hours, 0);
  const overhead = (input.overheadPercent ?? 0) / 100;
  return {
    totalCost,
    costPerMinute: totalCost / input.durationMinutes,
    attendeeCount: input.attendees.length,
    durationHours: hours,
    withOverhead: totalCost * (1 + overhead),
  };
}

/** Format currency. */
export function formatMoney(n: number): string {
  return `$${n.toFixed(2)}`;
}

/** Per-attendee cost breakdown. */
export function attendeeBreakdown(input: MeetingInput): { name: string; cost: number }[] {
  const hours = input.durationMinutes / 60;
  return input.attendees.map((a) => ({ name: a.name || "Unnamed", cost: a.hourlyRate * hours }));
}
