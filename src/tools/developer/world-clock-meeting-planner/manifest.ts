/**
 * World Clock & Meeting Planner — Tool Manifest.
 * Tool #303 — Category 4 (Developer & Code).
 *
 * Show the current time in many cities at once and find the best overlapping
 * meeting slot across time zones with a color-coded 24-hour grid. Per-zone
 * work-hours and weekend definition. Best-slot finder ranks top suggestions.
 * Export to .ics / Google / Outlook. Shareable URL. 400+ cities, 100%
 * client-side using Intl + IANA tz database.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "world-clock-meeting-planner",
  name: "World Clock & Meeting Planner",
  description:
    "Show the current time across 400+ cities and find the best meeting slot across time zones with a color-coded 24-hour grid. Per-zone work hours, weekend definition, DST-aware. Best-slot finder ranks top suggestions. Export to .ics, Google Calendar, Outlook. Shareable URL. 100% client-side.",
  category: "developer",
  keywords: [
    "world clock", "meeting planner", "time zone planner",
    "meeting time finder", "best meeting time", "time zone overlap",
    "working hours overlap", "across time zones", "schedule meeting",
    "international meeting", "team meeting planner", "iana timezone",
    "dst aware", "ics export", "google calendar link",
  ],
  icon: "globe",
  requiresNetwork: false,
  seo: {
    title: "World Clock & Meeting Planner — Best time across time zones, 400+ cities | UnQTools",
    faq: [
      {
        q: "How does the meeting planner find the best slot?",
        a: "For each hour of your chosen date (interpreted in UTC), we compute the wall-clock time in every selected participant's time zone and classify it as work, off, or sleep based on their work hours and weekend definition. We then score each hour by how many participants are in work hours, with a heavy bonus when everyone overlaps. The top 5 suggestions are ranked by score so you can pick the most convenient slot for the whole team.",
      },
      {
        q: "How are time zones and DST handled?",
        a: "We use the browser's built-in Intl.DateTimeFormat with the full IANA timezone database (430+ zones, 400+ cities). When you pick a date and city, we look up the actual UTC offset at that exact instant — including DST transitions, half-hour zones like India (UTC+5:30), and 45-minute zones like Nepal (UTC+5:45). You never need to think about DST; the grid always shows correct local times.",
      },
      {
        q: "Can each participant have different work hours?",
        a: "Yes. By default everyone is assumed to work 9 AM–5 PM Monday to Friday, but you can customize the start hour, end hour, and weekend days for the whole team at once (per-participant overrides are an advanced option in the planner). Weekend days use the ISO-like 0=Sunday, 6=Saturday convention so you can accommodate Middle Eastern Sunday–Thursday weeks or any other pattern.",
      },
      {
        q: "How do I export the chosen meeting time?",
        a: "Once you lock in a candidate slot, three export options appear: a downloadable .ics file (RFC 5545 VEVENT) that imports cleanly into Google Calendar, Outlook, and Apple Calendar; a direct Google Calendar compose link with the date, time, title and description pre-filled; and an Outlook compose link with the same. You can also copy a plain-text summary listing each participant's local time for sharing in chat or email.",
      },
      {
        q: "What extra features does this tool have versus others?",
        a: "(1) Live world clock for 400+ cities with day/night indicator. (2) Color-coded 24-hour grid (green=work, yellow=off, red=sleep) per participant. (3) DST-aware conversion via Intl + IANA database. (4) Per-team work hours + weekend definition. (5) Best-slot finder ranking top 5 overlapping slots. (6) .ics / Google / Outlook export. (7) Plain-text summary copy. (8) Half-hour and 45-minute zone support (IST, NPT, CHAST). (9) Shareable URL encoding participants + date (fragment, never sent to server). (10) localStorage history (max 20, metadata only). (11) Drag-to-reorder cities. (12) Mobile horizontal scroll.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All time zone math runs locally via Intl.DateTimeFormat with the IANA database bundled in your browser. The shareable URL is fragment-encoded so it never reaches a server. History is stored in localStorage on this device only and contains metadata (zone ids + date), never your notes.",
      },
    ],
  },
  status: "done",
};
