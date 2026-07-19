import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "history-timeline-maker",
  name: "History Timeline Maker",
  description:
    "Build visual history timelines from pipe-separated events. Parse year, year-month, full date and BC/AD dates, sort chronologically or reverse, group by category, color-code events (rainbow / mono / category schemes), render as ASCII vertical timeline, HTML (printable), Markdown, or CSV. Compute spans between events, search/filter, summary stats (date range, by-category counts), era calculator (1945 → 20th century), event importance markers (1–5 stars), 4 timeline presets (WWII, American Revolution, Ancient Egypt, Renaissance), history (localStorage), and shareable URL. 100% client-side — no network.",
  category: "education",
  keywords: [
    "timeline", "history timeline", "history",
    "chronology", "events", "dates",
    "BC", "AD", "era", "century",
    "education", "social studies",
  ],
  icon: "git-commit-horizontal",
  requiresNetwork: false,
  seo: {
    title: "History Timeline Maker — Visual Chronology + ASCII / HTML / MD / CSV | UnQTools",
    faq: [
      {
        q: "How does the History Timeline Maker work?",
        a: "Enter one event per line in the format 'date|title|description|category|importance(1-5)'. Dates may be a year (1945), year-month (1945-08), full date (1945-08-06), or BC/AD (44 BC, 44 AD). The tool parses each line, sorts events chronologically (or reverse), optionally groups by category, assigns colors per category (rainbow / mono / category-based), and renders a vertical ASCII timeline, printable HTML, Markdown, and CSV.",
      },
      {
        q: "What date formats are supported?",
        a: "Four formats: bare year ('1945'), year-month ('1945-08'), ISO date ('1945-08-06'), and BC/AD notation ('44 BC', '44 BCE', '1500 AD', '1500 CE'). BC dates are sorted correctly relative to AD dates — 100 BC sorts before 44 BC, which sorts before 1 AD, which sorts before 1945.",
      },
      {
        q: "Can descriptions contain pipe characters?",
        a: "Yes. Wrap any field that contains a '|' in double quotes — e.g. '1945|VE Day|\"Germany | surrenders\"|Military|5'. Doubled quotes inside a quoted field are escaped as in CSV ('\"\"' → '\"').",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Event parser (pipe-separated, with quoted descriptions). (2) Date parser (year, year-month, full date, BC/AD). (3) Date sorter (chronological + reverse). (4) Category grouper. (5) Color palette per category (3 schemes). (6) ASCII vertical timeline renderer. (7) ASCII horizontal timeline renderer. (8) HTML timeline renderer (printable). (9) Markdown renderer. (10) CSV renderer. (11) Event span calculator (days between events). (12) Summary stats (total, date range, by-category counts). (13) Event search/filter. (14) 4 timeline presets (WWII, American Revolution, Ancient Egypt, Renaissance). (15) Event importance marker (1-5 stars). (16) Era calculator (1945 → 20th century). (17) Copy + Download .txt / .html / .md / .csv. (18) History (localStorage, last 20). (19) Shareable URL with events encoded in hash.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All parsing, sorting, and rendering runs locally in your browser. History is stored in localStorage on this device only. Nothing is uploaded.",
      },
    ],
  },
  status: "done",
};
