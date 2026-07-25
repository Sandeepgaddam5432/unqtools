/**
 * Social Media Post Scheduler — pure logic.
 * Plan posts with optimal posting times per platform.
 */

export type Platform = "instagram" | "twitter" | "linkedin" | "facebook" | "tiktok";

export interface OptimalSlot {
  day: string;
  time: string; // HH:MM
  reason: string;
}

export const OPTIMAL_TIMES: Record<Platform, OptimalSlot[]> = {
  instagram: [
    { day: "Mon", time: "11:00", reason: "Lunch break browsing" },
    { day: "Tue", time: "13:00", reason: "Midday engagement peak" },
    { day: "Wed", time: "15:00", reason: "Mid-week afternoon peak" },
    { day: "Thu", time: "16:00", reason: "Late afternoon browsing" },
    { day: "Fri", time: "10:00", reason: "Friday morning engagement" },
  ],
  twitter: [
    { day: "Mon", time: "09:00", reason: "Morning news scroll" },
    { day: "Tue", time: "12:00", reason: "Lunchtime retweets" },
    { day: "Wed", time: "17:00", reason: "Evening commute" },
    { day: "Thu", time: "12:00", reason: "Midday retweet peak" },
    { day: "Fri", time: "09:00", reason: "Friday morning news" },
  ],
  linkedin: [
    { day: "Tue", time: "08:00", reason: "Pre-work professional browsing" },
    { day: "Wed", time: "12:00", reason: "Lunchtime professional content" },
    { day: "Thu", time: "17:00", reason: "End-of-day professional reading" },
    { day: "Fri", time: "10:00", reason: "Friday morning insights" },
  ],
  facebook: [
    { day: "Tue", time: "14:00", reason: "Afternoon engagement" },
    { day: "Wed", time: "15:00", reason: "Mid-week browsing" },
    { day: "Thu", time: "12:00", reason: "Lunch break activity" },
    { day: "Fri", time: "10:00", reason: "Morning shares" },
  ],
  tiktok: [
    { day: "Tue", time: "16:00", reason: "After-school engagement" },
    { day: "Wed", time: "14:00", reason: "Afternoon discovery" },
    { day: "Thu", time: "19:00", reason: "Evening peak" },
    { day: "Fri", time: "12:00", reason: "Lunch break scrolling" },
    { day: "Sat", time: "10:00", reason: "Weekend morning" },
  ],
};

export interface ScheduledPost {
  platform: Platform;
  day: string;
  time: string;
  reason: string;
}

/** Plan a week of posts: pick one optimal slot per day for the platform. */
export function planWeek(platform: Platform, maxPosts: number = 5): ScheduledPost[] {
  const slots = OPTIMAL_TIMES[platform] ?? [];
  return slots.slice(0, Math.max(1, Math.min(maxPosts, slots.length))).map((s) => ({
    platform, day: s.day, time: s.time, reason: s.reason,
  }));
}

/** Plan across multiple platforms. */
export function planMulti(platforms: Platform[]): ScheduledPost[] {
  const out: ScheduledPost[] = [];
  for (const p of platforms) out.push(...planWeek(p, 2));
  return out;
}

export function bestSlot(platform: Platform): ScheduledPost | null {
  const slot = OPTIMAL_TIMES[platform]?.[0];
  if (!slot) return null;
  return { platform, day: slot.day, time: slot.time, reason: slot.reason };
}

export function toCsv(posts: ScheduledPost[]): string {
  const lines = ["platform,day,time,reason"];
  for (const p of posts) lines.push([p.platform, p.day, p.time, `"${p.reason}"`].join(","));
  return lines.join("\n");
}

export const PLATFORM_LABELS: Record<Platform, string> = {
  instagram: "Instagram",
  twitter: "Twitter / X",
  linkedin: "LinkedIn",
  facebook: "Facebook",
  tiktok: "TikTok",
};
