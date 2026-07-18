import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "content-calendar-planner",
  name: "Content Calendar Planner",
  description:
    "Generate monthly content calendars with topic, channel, content type, and keyword assigned per posting day. Supports daily/weekdays/3×-week/weekly frequencies, 7 channel presets, weighted content-type mix, 7-day topic dedup, conflict detection, ICS calendar export, CSV export, summary stats, history (localStorage), shareable URL. 100% client-side.",
  category: "seo",
  keywords: [
    "content calendar", "editorial calendar", "content planner",
    "posting schedule", "content schedule", "ics calendar",
    "social media calendar", "blog calendar",
  ],
  icon: "calendar-days",
  requiresNetwork: false,
  seo: {
    title: "Content Calendar Planner — Monthly Editorial Schedule + ICS Export | UnQTools",
    faq: [
      {
        q: "How does the content calendar planner work?",
        a: "Enter a year, month, your topic pool, channels, content-type weights (e.g. blog:3, video:2, social:5, email:1), and posting frequency. The tool generates the date list for the month, then assigns one topic, channel, content type, and keyword per posting day using rotation + a 7-day topic dedup rule. You can download as .ics, .csv, or .txt, and copy to clipboard.",
      },
      {
        q: "What posting frequencies are supported?",
        a: "Four presets: Daily (every day), Weekdays (Mon–Fri), 3× a week (Mon/Wed/Fri), and Weekly (every Monday). Each preset generates the appropriate date list for the selected month and year.",
      },
      {
        q: "What is the 7-day topic dedup rule?",
        a: "When assigning a topic to a post, the planner looks at all previously assigned posts within the past 7 days. If a topic was already used in that window, it's skipped in favor of the next topic in your pool. This prevents back-to-back repetition. If your pool is too small to avoid all recent topics, it falls back to round-robin rotation and the conflict detector flags the overlap.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Date list generator (4 frequency presets). (2) Topic rotator with 7-day dedup. (3) Channel rotator. (4) Content-type weighted randomizer (deterministic). (5) Keyword assigner (optional pool, rotating). (6) ICS iCalendar file generator. (7) Text table renderer. (8) CSV exporter (date, topic, channel, type, keyword). (9) Copy + Download .txt + Download CSV + Download .ics. (10) History (localStorage, last 20). (11) Shareable URL. (12) Filter by channel. (13) Summary stats (total posts, by channel, by content type, unique topics/keywords). (14) 7 channel presets (Blog, YouTube, LinkedIn, Twitter, Instagram, Email, Podcast). (15) Conflict detector (same topic within 7 days).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All calendar generation, ICS rendering, and stats run locally in your browser. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
