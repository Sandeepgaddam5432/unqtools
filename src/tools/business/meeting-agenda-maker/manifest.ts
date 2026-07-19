import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "meeting-agenda-maker",
  name: "Meeting Agenda Maker",
  description:
    "Generate structured meeting agendas with timeboxed agenda items, presenters, action items, and time slots. Enter meeting title, date, start/end time, attendees, agenda items (CSV: topic,duration_minutes,presenter), and objectives. Compute total meeting duration, total agenda time, buffer time, detect overflow, generate time slots, and export as text, HTML (printable), Markdown, or CSV. 16 extra features: attendee parser, agenda item parser, duration calculator, total agenda time calculator, buffer time calculator, time slot generator, overflow detector, 5 meeting type presets, multi-format renderers, copy/download, history (localStorage), shareable URL, summary stats. 100% client-side.",
  category: "business",
  keywords: [
    "meeting agenda", "agenda", "agenda maker",
    "meeting planner", "timebox", "meeting minutes",
    "action items", "facilitation", "standup",
  ],
  icon: "calendar-clock",
  requiresNetwork: false,
  seo: {
    title: "Meeting Agenda Maker — Timeboxed Items + Action Items | UnQTools",
    faq: [
      {
        q: "How does the meeting agenda maker work?",
        a: "Enter the meeting title, date, start/end time, location, organizer, attendees (one per line), agenda items as `topic,duration_minutes,presenter` per line, and objectives (one per line). The tool computes the meeting duration, sums all agenda item durations, calculates the buffer time (or overflow), generates start/end time slots for each item, and exports as text, printable HTML, Markdown, or CSV.",
      },
      {
        q: "What format are agenda items in?",
        a: "One per line, comma-separated: `topic,duration_minutes,presenter`. Example: `Q3 review,15,Alice` means a 15-minute item called 'Q3 review' presented by Alice. The parser strips quotes, validates that duration is a positive number, and skips blank lines. Lines with missing fields are reported as errors.",
      },
      {
        q: "What happens if agenda time exceeds meeting duration?",
        a: "The overflow detector flags the meeting with a warning and shows how many minutes you are over. Buffer time will be negative in that case so you can see exactly how much you need to cut.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Attendee parser (one per line). (2) Agenda item parser (CSV: topic,duration,presenter). (3) Meeting duration calculator (end − start). (4) Total agenda time calculator. (5) Buffer time calculator (remaining). (6) Time slot generator (per-item start/end). (7) Overflow detector (warn if agenda > meeting). (8) 5 meeting type presets (standup 15m, weekly 60m, monthly 90m, quarterly 3h, retrospective 2h). (9) Text agenda renderer. (10) Printable HTML agenda renderer (inline CSS). (11) Markdown renderer. (12) CSV renderer (slot,topic,duration,presenter). (13) Copy + download .txt/.html/.md/.csv. (14) History (localStorage, last 20). (15) Shareable URL (encode inputs in hash). (16) Summary stats (attendee count, item count, total time, buffer, overflow warning).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All agenda generation, time slot calculation and rendering happen 100% locally in your browser. History is stored in localStorage on this device only. Nothing is uploaded.",
      },
    ],
  },
  status: "done",
};
