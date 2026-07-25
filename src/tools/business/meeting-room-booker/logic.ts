/**
 * Meeting Room Booker — pure logic.
 * Calculate room utilization and available time slots.
 */

export interface Booking {
  start: string; // "HH:MM"
  end: string;   // "HH:MM"
}

export interface RoomConfig {
  openTime: string;  // "HH:MM"
  closeTime: string; // "HH:MM"
  bookings: Booking[];
}

export interface UtilizationResult {
  totalMinutes: number;
  bookedMinutes: number;
  availableMinutes: number;
  utilizationPct: number;
  freeSlots: Booking[];
  overlaps: [Booking, Booking][];
  errors: string[];
}

function toMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

function fromMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function mergeAndSort(bookings: Booking[]): Booking[] {
  const withMinutes = bookings
    .map((b) => ({ start: toMinutes(b.start), end: toMinutes(b.end) }))
    .filter((b): b is { start: number; end: number } => b.start !== null && b.end !== null && b.end > b.start);
  withMinutes.sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [];
  for (const b of withMinutes) {
    const last = merged[merged.length - 1];
    if (last && b.start <= last.end) last.end = Math.max(last.end, b.end);
    else merged.push({ ...b });
  }
  return merged.map((b) => ({ start: fromMinutes(b.start), end: fromMinutes(b.end) }));
}

export function calculateUtilization(config: RoomConfig): UtilizationResult {
  const errors: string[] = [];
  const openMin = toMinutes(config.openTime);
  const closeMin = toMinutes(config.closeTime);

  if (openMin === null) errors.push(`Invalid open time: ${config.openTime}`);
  if (closeMin === null) errors.push(`Invalid close time: ${config.closeTime}`);
  if (openMin !== null && closeMin !== null && closeMin <= openMin) {
    errors.push("Close time must be after open time");
  }

  if (errors.length > 0) {
    return {
      totalMinutes: 0, bookedMinutes: 0, availableMinutes: 0,
      utilizationPct: 0, freeSlots: [], overlaps: [], errors,
    };
  }

  const totalMinutes = closeMin! - openMin!;

  // Detect overlaps
  const overlaps: [Booking, Booking][] = [];
  const sortedBookings = [...config.bookings]
    .map((b) => ({ b, start: toMinutes(b.start), end: toMinutes(b.end) }))
    .filter((x) => x.start !== null && x.end !== null) as { b: Booking; start: number; end: number }[];
  sortedBookings.sort((a, b) => a.start - b.start);
  for (let i = 0; i < sortedBookings.length; i++) {
    for (let j = i + 1; j < sortedBookings.length; j++) {
      const a = sortedBookings[i];
      const b = sortedBookings[j];
      if (a.start < b.end && b.start < a.end) {
        overlaps.push([a.b, b.b]);
      }
    }
  }

  // Merge bookings
  const merged = mergeAndSort(config.bookings);
  let bookedMinutes = 0;
  for (const b of merged) {
    const s = toMinutes(b.start)!;
    const e = toMinutes(b.end)!;
    const clampedS = Math.max(s, openMin!);
    const clampedE = Math.min(e, closeMin!);
    if (clampedE > clampedS) bookedMinutes += clampedE - clampedS;
  }

  // Free slots: gaps between bookings within [open, close]
  const freeSlots: Booking[] = [];
  let cursor = openMin!;
  for (const b of merged) {
    const s = Math.max(toMinutes(b.start)!, openMin!);
    const e = Math.min(toMinutes(b.end)!, closeMin!);
    if (s > cursor) freeSlots.push({ start: fromMinutes(cursor), end: fromMinutes(s) });
    cursor = Math.max(cursor, e);
  }
  if (cursor < closeMin!) freeSlots.push({ start: fromMinutes(cursor), end: fromMinutes(closeMin!) });

  const availableMinutes = totalMinutes - bookedMinutes;
  const utilizationPct = totalMinutes > 0 ? Math.round((bookedMinutes / totalMinutes) * 100) : 0;

  return {
    totalMinutes, bookedMinutes, availableMinutes, utilizationPct,
    freeSlots, overlaps, errors,
  };
}

export function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
