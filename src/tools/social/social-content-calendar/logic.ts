/**
 * Social Content Calendar — pure logic.
 * Generate a monthly content calendar with day-of-week layout.
 */

export interface CalendarDay {
  date: string; // ISO yyyy-mm-dd
  day: number;
  dayOfWeek: number; // 0 = Sunday
  isCurrentMonth: boolean;
  isWeekend: boolean;
  contentSlot?: string;
  platform?: string;
}

export interface CalendarMonth {
  year: number;
  month: number; // 0-11
  label: string;
  days: CalendarDay[]; // length 35 or 42
  weeks: CalendarDay[][];
}

export const PLATFORMS = ["Instagram", "Twitter/X", "LinkedIn", "TikTok", "Facebook", "YouTube", "Blog"] as const;
export type Platform = typeof PLATFORMS[number];

export const CONTENT_TYPES = [
  "Educational", "Behind-the-scenes", "User-generated", "Product showcase",
  "Storytelling", "Promotional", "Poll / Question", "Tip", "Quote", "Meme / Humor",
] as const;
export type ContentType = typeof CONTENT_TYPES[number];

/** Generate a calendar grid for a given year/month. */
export function generateMonth(year: number, month: number, options: { leadingBlanks?: boolean } = {}): CalendarMonth {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 0 || month > 11) {
    return { year: 1970, month: 0, label: "Invalid", days: [], weeks: [] };
  }
  const firstDay = new Date(Date.UTC(year, month, 1));
  const firstDayOfWeek = firstDay.getUTCDay();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const days: CalendarDay[] = [];
  // Leading blanks from previous month (optional - we'll skip and just emit current-month days starting at firstDayOfWeek)
  for (let i = 0; i < firstDayOfWeek; i++) {
    const prevLastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const prevDay = prevLastDay - firstDayOfWeek + i + 1;
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    days.push({
      date: `${prevYear}-${String(prevMonth + 1).padStart(2, "0")}-${String(prevDay).padStart(2, "0")}`,
      day: prevDay,
      dayOfWeek: i,
      isCurrentMonth: false,
      isWeekend: i === 0 || i === 6,
    });
  }
  for (let d = 1; d <= lastDay; d++) {
    const date = new Date(Date.UTC(year, month, d));
    const dow = date.getUTCDay();
    days.push({
      date: `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      day: d,
      dayOfWeek: dow,
      isCurrentMonth: true,
      isWeekend: dow === 0 || dow === 6,
    });
  }
  // Trailing blanks to fill 6 weeks (42 cells) — optional
  const trailingNeeded = 42 - days.length;
  for (let i = 0; i < trailingNeeded; i++) {
    const nextDay = i + 1;
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    const dow = (firstDayOfWeek + lastDay + i) % 7;
    days.push({
      date: `${nextYear}-${String(nextMonth + 1).padStart(2, "0")}-${String(nextDay).padStart(2, "0")}`,
      day: nextDay,
      dayOfWeek: dow,
      isCurrentMonth: false,
      isWeekend: dow === 0 || dow === 6,
    });
  }

  const weeks: CalendarDay[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  return { year, month, label: `${monthNames[month]} ${year}`, days, weeks };
}

/** Auto-fill content slots based on a deterministic rotation. */
export function autoFillCalendar(
  month: CalendarMonth,
  contentTypes: ContentType[] = [...CONTENT_TYPES],
  platforms: Platform[] = ["Instagram", "Twitter/X", "LinkedIn"]
): CalendarMonth {
  const filled: CalendarDay[] = month.days.map((d) => {
    if (!d.isCurrentMonth) return d;
    const idx = (d.day - 1) % contentTypes.length;
    const pIdx = (d.day - 1) % platforms.length;
    return { ...d, contentSlot: contentTypes[idx], platform: platforms[pIdx] };
  });
  const weeks: CalendarDay[][] = [];
  for (let i = 0; i < filled.length; i += 7) weeks.push(filled.slice(i, i + 7));
  return { ...month, days: filled, weeks };
}

/** Convert month to CSV. */
export function monthToCsv(month: CalendarMonth): string {
  const rows = ["date,day,day_of_week,content_type,platform"];
  const dowNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  for (const d of month.days) {
    if (!d.isCurrentMonth) continue;
    rows.push(`${d.date},${d.day},${dowNames[d.dayOfWeek]},${d.contentSlot ?? ""},${d.platform ?? ""}`);
  }
  return rows.join("\n");
}

/** Count content slots per type. */
export function countByContentType(month: CalendarMonth): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const d of month.days) {
    if (!d.isCurrentMonth || !d.contentSlot) continue;
    counts[d.contentSlot] = (counts[d.contentSlot] ?? 0) + 1;
  }
  return counts;
}

/** Count content slots per platform. */
export function countByPlatform(month: CalendarMonth): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const d of month.days) {
    if (!d.isCurrentMonth || !d.platform) continue;
    counts[d.platform] = (counts[d.platform] ?? 0) + 1;
  }
  return counts;
}
