import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "study-notes-organizer",
  name: "Study Notes Organizer",
  description:
    "Organize study notes by subject, topic, tags, and search. Pipe-separated input, subject/topic/tag grouping, full-text search, duplicate detector, tag cloud, summary stats. Export as TXT, HTML, Markdown, CSV, JSON. 100% client-side, no upload.",
  category: "education",
  keywords: [
    "study notes", "notes organizer", "note taking",
    "subject", "topic", "tags", "tag cloud",
    "study planner", "lecture notes", "exam prep",
    "markdown notes", "obsidian", "notion import",
  ],
  icon: "notebook-pen",
  requiresNetwork: false,
  seo: {
    title: "Study Notes Organizer — Subject, Topic, Tags + Search | UnQTools",
    faq: [
      {
        q: "How does the Study Notes Organizer work?",
        a: "Paste your notes as pipe-separated lines: subject|topic|title|content|tags|date. Tags are comma-separated within the tags cell (e.g. important,review,exam). The tool groups notes by subject → topic, builds a tag index, supports full-text search across title + content, filters by subject/tag, sorts by date, and exports as TXT, HTML (printable), Markdown, CSV, or JSON.",
      },
      {
        q: "What input format does it expect?",
        a: "One note per line, six pipe-separated fields: subject|topic|title|content|tags|date. Content fields can be wrapped in double quotes if they contain pipes (e.g. \"See: chapter 3 | page 12\"). Date is YYYY-MM-DD. Example: Biology|Cells|Mitochondria|Powerhouse of the cell|bio,cells|2024-09-12",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Pipe-separated parser with quoted fields. (2) Note validator (subject + title + content required). (3) Subject grouper. (4) Topic grouper (within subject). (5) Tag indexer (tag → notes). (6) Search filter (title + content, case-insensitive). (7) Subject/tag combined filter. (8) Date sorter (newest/oldest). (9) Counts per subject/topic/tag. (10) Render as text notes (grouped). (11) Render as printable HTML with TOC. (12) Render as Markdown with headers. (13) Render as CSV. (14) Render as JSON (Notion/Obsidian import). (15) Copy + Download .txt + HTML + MD + CSV + JSON. (16) History (localStorage, last 20). (17) Shareable URL (max 50 notes encoded in hash). (18) Summary stats (total notes, by subject, by topic, by tag, total words). (19) Tag cloud (top 10 by frequency). (20) Duplicate note detector (same title + subject).",
      },
      {
        q: "Can I import these notes into Notion or Obsidian?",
        a: "Yes. Use Download JSON to get a structured JSON file you can import into Notion or Obsidian. The Markdown export produces headers per subject → topic → note, which Obsidian reads natively.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All parsing, grouping, search, and export runs 100% client-side in your browser. History is stored in localStorage on this device only. No notes ever leave your computer.",
      },
    ],
  },
  status: "done",
};
