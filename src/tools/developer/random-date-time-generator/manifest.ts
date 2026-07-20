/**
 * Random Date / Time Generator — Tool Manifest.
 * Tool #294 — Category 4 (Developer & Code).
 *
 * Generate random dates/times within a range, in any format (ISO 8601,
 * Unix epoch s/ms, locale, custom strftime-like pattern, relative "time ago"),
 * across time zones, with business-day filter, weighting, granularity, sorted
 * / unique output, seeded reproducibility, and bulk export up to 10k. Fully
 * client-side, no network.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "random-date-time-generator",
  name: "Random Date / Time Generator",
  description:
    "Generate random dates and times within any range, in any format (ISO 8601, Unix epoch seconds/millis, locale, custom strftime-like pattern, relative 'time ago'), across time zones, with business-day filter, granularity (date/datetime/time), sorted/unique output, seeded reproducibility (mulberry32), and bulk export to CSV/JSON. 100% client-side.",
  category: "developer",
  keywords: [
    "random date generator", "random datetime", "random timestamp",
    "random date between", "epoch generator", "unix timestamp generator",
    "iso 8601 generator", "strftime", "date fixture",
    "business day random", "seeded date", "bulk date generator",
    "timezone date generator", "date picker test data",
  ],
  icon: "calendar",
  requiresNetwork: false,
  seo: {
    title: "Random Date / Time Generator — Range + Timezone + Format + Seed | UnQTools",
    faq: [
      {
        q: "How does the random date/time generator work?",
        a: "Pick a start and end date (any range, past or future), set the count, choose a format (ISO 8601, Unix seconds, Unix milliseconds, locale string, custom strftime-like pattern, or relative 'time ago'), optionally pick a timezone, then click Generate. We draw random timestamps uniformly across the range using a seeded mulberry32 PRNG so the same seed always reproduces the same sequence.",
      },
      {
        q: "Which output formats are supported?",
        a: "ISO 8601 (full UTC), Unix epoch seconds, Unix epoch milliseconds, a locale-formatted string in the chosen timezone, a custom strftime-like pattern (tokens: %Y %m %d %H %M %S %y %j %p %I %A %a %B %b %z), a relative 'time ago' string (e.g. '3 hours ago'), date-only, and time-only.",
      },
      {
        q: "Can I restrict output to business days (Mon-Fri)?",
        a: "Yes. Toggle 'Business days only' on and we filter out Saturdays and Sundays in the chosen timezone. You can also toggle 'Unique' to guarantee no two timestamps collide, and 'Sort ascending/descending' to order the output.",
      },
      {
        q: "How does the seed work and is it reproducible?",
        a: "We use mulberry32 as a fast, high-quality PRNG with a 32-bit seed. The same seed and options always produce the exact same sequence — ideal for test fixtures. If you want fresh numbers every time, click the dice button to randomize the seed.",
      },
      {
        q: "What extra features does this tool have versus others?",
        a: "(1) Range start/end with swap-on-inverted. (2) Eight output formats. (3) Timezone-aware formatting (Intl.DateTimeFormat). (4) Granularity: datetime / date-only / time-only. (5) Business-day filter (excludes weekends). (6) Unique-output mode with safety check. (7) Sort asc/desc. (8) Seeded mulberry32 PRNG for reproducibility. (9) Custom strftime-like pattern tokenizer. (10) Relative 'time ago' formatter. (11) Bulk generation up to 10,000. (12) CSV / JSON / plain-text export. (13) localStorage history (max 20). (14) Shareable config URL (fragment-encoded, never sent to server). (15) Stats: min / max / count / span.",
      },
    ],
  },
  status: "done",
};
