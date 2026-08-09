/**
 * Timezone Converter — pure logic.
 * Uses only the browser's native Intl API (no network, no deps).
 */

export interface ZoneInfo {
  /** IANA timezone id, e.g. "Asia/Kolkata" */
  id: string;
  /** Short city label shown in the picker, e.g. "Kolkata (India)" */
  label: string;
  /** Major city name used for search. */
  city: string;
}

// A curated list of the most-used IANA timezones with friendly labels.
// The browser's Intl API resolves the real offset/DST for each one.
export const COMMON_ZONES: ZoneInfo[] = [
  { id: "UTC", label: "UTC", city: "UTC" },
  { id: "America/Los_Angeles", label: "Los Angeles", city: "Los Angeles, US" },
  { id: "America/Denver", label: "Denver", city: "Denver, US" },
  { id: "America/Chicago", label: "Chicago", city: "Chicago, US" },
  { id: "America/New_York", label: "New York", city: "New York, US" },
  { id: "America/Toronto", label: "Toronto", city: "Toronto, CA" },
  { id: "America/Sao_Paulo", label: "São Paulo", city: "São Paulo, BR" },
  { id: "America/Mexico_City", label: "Mexico City", city: "Mexico City, MX" },
  { id: "America/Bogota", label: "Bogotá", city: "Bogotá, CO" },
  { id: "America/Lima", label: "Lima", city: "Lima, PE" },
  { id: "America/Caracas", label: "Caracas", city: "Caracas, VE" },
  { id: "Europe/London", label: "London", city: "London, UK" },
  { id: "Europe/Dublin", label: "Dublin", city: "Dublin, IE" },
  { id: "Europe/Lisbon", label: "Lisbon", city: "Lisbon, PT" },
  { id: "Europe/Paris", label: "Paris", city: "Paris, FR" },
  { id: "Europe/Madrid", label: "Madrid", city: "Madrid, ES" },
  { id: "Europe/Berlin", label: "Berlin", city: "Berlin, DE" },
  { id: "Europe/Amsterdam", label: "Amsterdam", city: "Amsterdam, NL" },
  { id: "Europe/Brussels", label: "Brussels", city: "Brussels, BE" },
  { id: "Europe/Rome", label: "Rome", city: "Rome, IT" },
  { id: "Europe/Zurich", label: "Zurich", city: "Zurich, CH" },
  { id: "Europe/Stockholm", label: "Stockholm", city: "Stockholm, SE" },
  { id: "Europe/Oslo", label: "Oslo", city: "Oslo, NO" },
  { id: "Europe/Copenhagen", label: "Copenhagen", city: "Copenhagen, DK" },
  { id: "Europe/Vienna", label: "Vienna", city: "Vienna, AT" },
  { id: "Europe/Warsaw", label: "Warsaw", city: "Warsaw, PL" },
  { id: "Europe/Prague", label: "Prague", city: "Prague, CZ" },
  { id: "Europe/Athens", label: "Athens", city: "Athens, GR" },
  { id: "Europe/Helsinki", label: "Helsinki", city: "Helsinki, FI" },
  { id: "Europe/Bucharest", label: "Bucharest", city: "Bucharest, RO" },
  { id: "Europe/Istanbul", label: "Istanbul", city: "Istanbul, TR" },
  { id: "Europe/Kyiv", label: "Kyiv", city: "Kyiv, UA" },
  { id: "Europe/Moscow", label: "Moscow", city: "Moscow, RU" },
  { id: "Asia/Dubai", label: "Dubai", city: "Dubai, AE" },
  { id: "Asia/Riyadh", label: "Riyadh", city: "Riyadh, SA" },
  { id: "Asia/Tehran", label: "Tehran", city: "Tehran, IR" },
  { id: "Asia/Karachi", label: "Karachi", city: "Karachi, PK" },
  { id: "Asia/Kolkata", label: "Kolkata", city: "Kolkata (India), IN" },
  { id: "Asia/Shanghai", label: "Shanghai", city: "Shanghai, CN" },
  { id: "Asia/Hong_Kong", label: "Hong Kong", city: "Hong Kong, HK" },
  { id: "Asia/Taipei", label: "Taipei", city: "Taipei, TW" },
  { id: "Asia/Tokyo", label: "Tokyo", city: "Tokyo, JP" },
  { id: "Asia/Seoul", label: "Seoul", city: "Seoul, KR" },
  { id: "Asia/Singapore", label: "Singapore", city: "Singapore, SG" },
  { id: "Asia/Bangkok", label: "Bangkok", city: "Bangkok, TH" },
  { id: "Asia/Jakarta", label: "Jakarta", city: "Jakarta, ID" },
  { id: "Asia/Manila", label: "Manila", city: "Manila, PH" },
  { id: "Asia/Kuala_Lumpur", label: "Kuala Lumpur", city: "Kuala Lumpur, MY" },
  { id: "Asia/Jerusalem", label: "Jerusalem", city: "Jerusalem, IL" },
  { id: "Asia/Kathmandu", label: "Kathmandu", city: "Kathmandu, NP" },
  { id: "Asia/Dhaka", label: "Dhaka", city: "Dhaka, BD" },
  { id: "Asia/Colombo", label: "Colombo", city: "Colombo, LK" },
  { id: "Asia/Kabul", label: "Kabul", city: "Kabul, AF" },
  { id: "Australia/Sydney", label: "Sydney", city: "Sydney, AU" },
  { id: "Australia/Melbourne", label: "Melbourne", city: "Melbourne, AU" },
  { id: "Australia/Brisbane", label: "Brisbane", city: "Brisbane, AU" },
  { id: "Australia/Perth", label: "Perth", city: "Perth, AU" },
  { id: "Pacific/Auckland", label: "Auckland", city: "Auckland, NZ" },
  { id: "Africa/Cairo", label: "Cairo", city: "Cairo, EG" },
  { id: "Africa/Lagos", label: "Lagos", city: "Lagos, NG" },
  { id: "Africa/Nairobi", label: "Nairobi", city: "Nairobi, KE" },
  { id: "Africa/Johannesburg", label: "Johannesburg", city: "Johannesburg, ZA" },
  { id: "America/Argentina/Buenos_Aires", label: "Buenos Aires", city: "Buenos Aires, AR" },
];

/** Full list of all IANA zones available in the browser. */
export function getAllZoneIds(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    // Fallback if supportedValuesOf is unavailable.
    return COMMON_ZONES.map((z) => z.id);
  }
}

/** Format a Date in a given timezone using the browser's Intl API. */
export function formatInZone(
  date: Date,
  zone: string,
  opts: { hour12?: boolean; withDate?: boolean } = {},
): string {
  const { hour12 = true, withDate = true } = opts;
  try {
    const timeFmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: zone,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12,
    });
    if (!withDate) return timeFmt.format(date);
    const dateFmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: zone,
      year: "numeric",
      month: "short",
      day: "2-digit",
      weekday: "short",
    });
    return `${dateFmt.format(date)} · ${timeFmt.format(date)}`;
  } catch {
    return "Invalid timezone";
  }
}

/** Get the UTC offset (e.g. "+05:30" or "Z") for a zone at a given date. */
export function utcOffsetFor(zone: string, date: Date): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      timeZoneName: "shortOffset",
    }).formatToParts(date);
    const tz = parts.find((p) => p.type === "timeZoneName");
    const raw = tz ? tz.value : "";
    // "GMT+5:30" -> "+05:30", "GMT" -> "Z"
    if (!raw || raw === "GMT" || raw === "UTC") return "Z";
    const m = raw.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
    if (!m) return raw;
    const sign = m[1];
    const hh = m[2].padStart(2, "0");
    const mm = m[3] ?? "00";
    return `${sign}${hh}:${mm}`;
  } catch {
    return "";
  }
}

/** Convert a date/time from one zone to all zones. */
export function convertToAll(
  date: Date,
  fromZone: string,
  zones: string[],
): { zone: string; local: string; offset: string; relativeHours: string }[] {
  const fromOffset = offsetMinutes(fromZone, date);
  return zones.map((zone) => {
    const zOffset = offsetMinutes(zone, date);
    const diffMin = zOffset - fromOffset;
    const rel = diffMinutesToLabel(diffMin);
    return {
      zone,
      local: formatInZone(date, zone),
      offset: utcOffsetFor(zone, date),
      relativeHours: rel,
    };
  });
}

/** Offset in minutes for a zone at a given date (includes DST). */
export function offsetMinutes(zone: string, date: Date): number {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      timeZoneName: "shortOffset",
    });
    const parts = dtf.formatToParts(date);
    const tz = parts.find((p) => p.type === "timeZoneName");
    const raw = tz ? tz.value : "";
    if (!raw || raw === "GMT" || raw === "UTC") return 0;
    const m = raw.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
    if (!m) return 0;
    const sign = m[1] === "+" ? 1 : -1;
    const hh = parseInt(m[2], 10);
    const mm = m[3] ? parseInt(m[3], 10) : 0;
    return sign * (hh * 60 + mm);
  } catch {
    return 0;
  }
}

/** Convert a difference in minutes to a human label like "+5.5 hours". */
function diffMinutesToLabel(diff: number): string {
  if (diff === 0) return "same time";
  const sign = diff > 0 ? "+" : "-";
  const abs = Math.abs(diff);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (m === 0) return `${sign}${h} hour${h === 1 ? "" : "s"}`;
  return `${sign}${h}${(m / 60).toString().slice(1)} hours`;
}

/** Build a Date from a local date/time in a given zone (from the source zone). */
export function dateFromZoneParts(
  year: number,
  month: number, // 1-12
  day: number,
  hour: number,
  minute: number,
  zone: string,
): Date | null {
  // Naive local representation.
  const naive = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (isNaN(naive.getTime())) return null;
  // Convert naive local (browser zone) to the target zone's wall clock.
  // Strategy: find the instant whose wall time in `zone` equals the naive time.
  const targetOffset = offsetMinutes(zone, naive);
  const browserOffset = -naive.getTimezoneOffset();
  const diff = targetOffset - browserOffset;
  return new Date(naive.getTime() - diff * 60000);
}

/** Validate date/time input; returns error message or null. */
export function validateInput(date: Date): string | null {
  if (isNaN(date.getTime())) return "Please enter a valid date and time.";
  return null;
}
