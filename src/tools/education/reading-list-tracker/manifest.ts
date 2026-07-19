import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "reading-list-tracker",
  name: "Reading List Tracker",
  description:
    "Track your reading list with status, progress, ratings, and notes. Parse pipe-separated books, filter by status, sort by title/author/progress/rating/date-added, calculate reading stats (total books, by status, average rating, pages read), set reading goals, estimate reading time, get basic recommendations, and export as text or CSV. 100% client-side.",
  category: "education",
  keywords: [
    "reading list", "books", "reading tracker",
    "book tracker", "goodreads", "library",
    "reading goal", "pages", "rating",
  ],
  icon: "library",
  requiresNetwork: false,
  seo: {
    title: "Reading List Tracker — Books, Status, Progress, Ratings | UnQTools",
    faq: [
      {
        q: "How does the reading list tracker work?",
        a: "Enter your books in pipe-separated format: title | author | total_pages | current_page | status | rating | notes (with optional genre). One book per line. The tool parses them, validates ratings (1-5 stars), calculates progress (current_page / total_pages × 100), and lets you filter by status (to-read, reading, finished, abandoned) and sort by title, author, progress, rating, or date-added.",
      },
      {
        q: "What stats does it compute?",
        a: "Total books, books per status (to-read, reading, finished, abandoned), average rating, total pages read, and progress toward a yearly reading goal you set. It also estimates reading time (pages / 250 wpm) per book and across all in-progress books.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Pipe-separated book parser with quoted fields. (2) 5 status presets (to-read, reading, finished, abandoned, plus 'all' filter). (3) Progress calculator (% complete). (4) Rating validator (1-5 stars). (5) Status filter. (6) Multi-sort (title, author, progress, rating, date-added). (7) Reading stats calculator. (8) Reading goal tracker (target books/year, progress %). (9) Render as text reading list. (10) Render as CSV. (11) Copy + Download .txt/.csv. (12) History (localStorage, max 20). (13) Shareable URL. (14) Summary stats. (15) Book search/filter by title or author. (16) Genre tagger (optional, per book). (17) Reading time estimator (250 wpm default). (18) Recommendation engine (basic — by genre + rating patterns).",
      },
      {
        q: "Can I set a yearly reading goal?",
        a: "Yes. Set a target number of books for the year. The tool tracks how many 'finished' books you have logged and shows the percentage progress toward your goal, plus how many more books you need to reach it.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All parsing, stats, and recommendations run locally. History is stored in localStorage on this device only. No book data, ratings, or notes are ever sent to a server.",
      },
    ],
  },
  status: "done",
};
