import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "content-calendar-scheduler",
  name: "Content Calendar Scheduler",
  description:
    "Plan monthly content calendars across 6 platforms (Twitter, Instagram, LinkedIn, Facebook, TikTok, YouTube). Pick posting frequency per platform (daily / 3x-week / weekly / bi-weekly), rotate content themes (7-day dedup), assign per-platform time slots, exclude weekends, detect same-time conflicts and content-gap days. Export to ICS calendar, CSV, HTML, Markdown and text. Plus per-platform summary stats, theme balance checker, best-time-to-post hints, and shareable URL. 100% client-side.",
  category: "social",
  keywords: [
    "content calendar", "social media calendar", "posting schedule",
    "content scheduler", "monthly calendar", "ics calendar",
    "ics export", "content planner", "social media planner",
    "post scheduler", "content plan",
  ],
  icon: "calendar-clock",
  requiresNetwork: false,
  seo: {
    title: "Content Calendar Scheduler — Multi-Platform Monthly Plan + ICS Export | UnQTools",
    faq: [
      {
        q: "How does the content calendar scheduler work?",
        a: "Pick a year + month, select platforms (Twitter, Instagram, LinkedIn, Facebook, TikTok, YouTube), choose a posting frequency per platform (daily, 3x-week, weekly, bi-weekly), enter your rotating content themes (one per line), and optionally set per-platform start times (e.g. 'twitter,09:00'). The tool generates the schedule, rotates themes with a 7-day no-repeat rule, flags conflicts (multiple platforms posting at the same time) and content-gap days, and exports an .ics calendar file you can import into Google Calendar, Apple Calendar, or Outlook.",
      },
      {
        q: "Can I export the calendar to Google Calendar or Outlook?",
        a: "Yes. The .ics export contains one VEVENT per scheduled post with date, time, platform, and theme. Import the file into Google Calendar (Settings → Import & export), Apple Calendar (File → Import), or Outlook (File → Open & Export → Import/Export). CSV, HTML (printable), Markdown and plain-text exports are also included.",
      },
      {
        q: "How is the theme rotation decided?",
        a: "Themes are assigned in order, rotating through the list. The 7-day no-repeat rule means a theme won't be reused within 7 days of its last assignment, so a calendar with 4 themes will cycle through all of them before repeating. A theme-balance checker warns if one theme is over- or under-represented in the final schedule.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Date list generator per platform with 4 frequency presets (daily, 3x-week, weekly, bi-weekly). (2) Theme rotator with 7-day dedup rule. (3) Per-platform time slot assigner. (4) Weekend excluder (toggle). (5) ICS calendar file generator (VEVENT per post). (6) Per-platform summary (total posts, by theme). (7) Conflict detector (same time across platforms). (8) 6 platform presets with built-in best-time-to-post hints. (9) Render as text calendar (per-day table view). (10) Render as CSV. (11) Render as printable HTML. (12) Render as Markdown. (13) Copy + Download .txt + Download CSV + Download HTML + Download ICS + Download MD. (14) History (localStorage, last 20). (15) Shareable URL (inputs encoded in hash). (16) Summary stats (total posts, by platform, by theme, avg posts/day). (17) Best time to post per platform (built-in engagement data). (18) Content gap detector (days with no scheduled posts). (19) Theme balance checker.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All scheduling runs locally in your browser. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
