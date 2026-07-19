/**
 * Reading List Tracker — pure logic.
 *
 * Track books with status, progress, ratings, notes, genres. Pipe-separated
 * parser, status filter, multi-sort, reading stats, reading goal tracker,
 * reading time estimator, recommendation engine, multi-format renderers,
 * history (localStorage), shareable URL. Pure functions only — no DOM, no
 * network.
 */

// ---- Types ----

export type BookStatus = "to-read" | "reading" | "finished" | "abandoned";

export interface Book {
  id: string;
  title: string;
  author: string;
  totalPages: number;
  currentPage: number;
  status: BookStatus;
  rating: number; // 0 = unrated, 1-5 stars
  notes: string;
  genre: string;
  dateAdded: number; // epoch ms
}

export type StatusFilter = "all" | BookStatus;
export type SortBy = "title" | "author" | "progress" | "rating" | "date-added";

export interface ReadingStats {
  total: number;
  byStatus: Record<BookStatus, number>;
  avgRating: number;
  totalPagesRead: number;
  totalPages: number;
  finishedCount: number;
  readingCount: number;
}

export interface GoalProgress {
  target: number;
  finished: number;
  remaining: number;
  percent: number;
  onTrack: boolean;
}

export interface ReadingTimeEstimate {
  minutes: number;
  hours: number;
  displayString: string;
}

export interface Recommendation {
  book: Book;
  reason: string;
  score: number;
}

// ---- Constants ----

export const STATUS_LABELS: Record<BookStatus, string> = {
  "to-read": "To Read",
  reading: "Reading",
  finished: "Finished",
  abandoned: "Abandoned",
};

export const STATUS_FILTERS: StatusFilter[] = ["all", "to-read", "reading", "finished", "abandoned"];

export const STATUS_FILTER_LABELS: Record<StatusFilter, string> = {
  all: "All Books",
  "to-read": "To Read",
  reading: "Reading",
  finished: "Finished",
  abandoned: "Abandoned",
};

export const SORT_OPTIONS: SortBy[] = ["title", "author", "progress", "rating", "date-added"];

export const SORT_LABELS: Record<SortBy, string> = {
  title: "Title (A-Z)",
  author: "Author (A-Z)",
  progress: "Progress (high-low)",
  rating: "Rating (high-low)",
  "date-added": "Date Added (newest first)",
};

export const GENRE_PRESETS: string[] = [
  "fiction", "non-fiction", "fantasy", "sci-fi", "mystery",
  "thriller", "romance", "biography", "history", "self-help",
  "business", "science", "philosophy", "poetry", "children",
];

export const DEFAULT_WPM = 250;
export const MIN_RATING = 1;
export const MAX_RATING = 5;

// ---- Normalize / parse ----

/** Normalize text input. */
export function normalizeText(s: string | undefined | null): string {
  return (s ?? "").trim();
}

/** Validate a book status string. */
export function isValidStatus(s: string): s is BookStatus {
  return s === "to-read" || s === "reading" || s === "finished" || s === "abandoned";
}

/** Normalize a status string to a valid BookStatus, defaulting to "to-read". */
export function normalizeStatus(s: string): BookStatus {
  const lower = normalizeText(s).toLowerCase().replace(/\s+/g, "-");
  if (isValidStatus(lower)) return lower;
  // Common aliases
  if (lower === "toread" || lower === "want-to-read" || lower === "want-to-read" || lower === "tbr") return "to-read";
  if (lower === "in-progress" || lower === "current") return "reading";
  if (lower === "done" || lower === "complete" || lower === "completed") return "finished";
  if (lower === "dnf" || lower === "dropped" || lower === "quit") return "abandoned";
  return "to-read";
}

/** Validate rating (1-5). Returns 0 if invalid. */
export function validateRating(r: number | string): number {
  const n = typeof r === "string" ? parseInt(r, 10) : r;
  if (!Number.isFinite(n)) return 0;
  const int = Math.floor(n);
  if (int < MIN_RATING) return 0;
  if (int > MAX_RATING) return MAX_RATING;
  return int;
}

/** Validate a non-negative integer page count. Returns 0 if invalid. */
export function validatePages(p: number | string): number {
  const n = typeof p === "string" ? parseInt(p, 10) : p;
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

/** Split a pipe-separated row, handling quoted pipes. */
export function splitPipeRow(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "|" && !inQuotes) {
      out.push(current); current = "";
    } else { current += ch; }
  }
  out.push(current);
  return out;
}

/** Parse a single book from a pipe-separated line. */
export function parseBookLine(line: string, dateAdded?: number): Book | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const parts = splitPipeRow(trimmed);
  // Allow 1-8 fields
  const [
    titleRaw,
    authorRaw,
    totalPagesRaw,
    currentPageRaw,
    statusRaw,
    ratingRaw,
    notesRaw,
    genreRaw,
  ] = parts;
  const title = normalizeText(titleRaw);
  if (!title) return null;
  const author = normalizeText(authorRaw);
  const totalPages = validatePages(totalPagesRaw ?? "0");
  const currentPage = validatePages(currentPageRaw ?? "0");
  const status = normalizeStatus(statusRaw ?? "to-read");
  const rating = validateRating(ratingRaw ?? "0");
  const notes = normalizeText(notesRaw);
  const genre = normalizeText(genreRaw);
  return {
    id: generateId(),
    title,
    author,
    totalPages,
    currentPage: Math.min(currentPage, totalPages || currentPage),
    status,
    rating,
    notes,
    genre,
    dateAdded: dateAdded ?? Date.now(),
  };
}

/** Parse multiple books from a textarea input. */
export function parseBooks(input: string): Book[] {
  if (!input) return [];
  const lines = input.split(/\n/);
  const books: Book[] = [];
  let counter = 0;
  for (const line of lines) {
    const book = parseBookLine(line, Date.now() - (lines.length - counter) * 1000);
    if (book) books.push(book);
    counter += 1;
  }
  return books;
}

/** Generate a unique book id. */
let idCounter = 0;
export function generateId(): string {
  idCounter += 1;
  return `book_${Date.now().toString(36)}_${idCounter}`;
}

// ---- Compute progress ----

/** Calculate progress percentage (0-100). */
export function calcProgress(book: Pick<Book, "currentPage" | "totalPages">): number {
  if (!book.totalPages || book.totalPages <= 0) return 0;
  const p = (book.currentPage / book.totalPages) * 100;
  if (p < 0) return 0;
  if (p > 100) return 100;
  return Math.round(p);
}

/** Format a progress bar string of given length. */
export function progressBar(percent: number, length = 10): string {
  const filled = Math.round((percent / 100) * length);
  return "█".repeat(filled) + "░".repeat(length - filled);
}

// ---- Filter ----

/** Filter books by status. */
export function filterByStatus(books: Book[], status: StatusFilter): Book[] {
  if (status === "all") return books;
  return books.filter((b) => b.status === status);
}

/** Search books by title or author (case-insensitive). */
export function searchBooks(books: Book[], query: string): Book[] {
  const q = normalizeText(query).toLowerCase();
  if (!q) return books;
  return books.filter(
    (b) =>
      b.title.toLowerCase().includes(q) ||
      b.author.toLowerCase().includes(q) ||
      b.genre.toLowerCase().includes(q) ||
      b.notes.toLowerCase().includes(q),
  );
}

// ---- Sort ----

/** Sort books by the given key. */
export function sortBooks(books: Book[], sortBy: SortBy): Book[] {
  const copy = [...books];
  switch (sortBy) {
    case "title":
      copy.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case "author":
      copy.sort((a, b) => {
        const c = a.author.localeCompare(b.author);
        return c !== 0 ? c : a.title.localeCompare(b.title);
      });
      break;
    case "progress":
      copy.sort((a, b) => calcProgress(b) - calcProgress(a));
      break;
    case "rating":
      copy.sort((a, b) => b.rating - a.rating);
      break;
    case "date-added":
      copy.sort((a, b) => b.dateAdded - a.dateAdded);
      break;
  }
  return copy;
}

// ---- Stats ----

/** Compute reading stats. */
export function computeStats(books: Book[]): ReadingStats {
  const byStatus: Record<BookStatus, number> = {
    "to-read": 0, reading: 0, finished: 0, abandoned: 0,
  };
  let totalPagesRead = 0;
  let totalPages = 0;
  let ratedCount = 0;
  let ratingSum = 0;
  for (const b of books) {
    byStatus[b.status] += 1;
    totalPages += b.totalPages;
    if (b.status === "finished") {
      totalPagesRead += b.totalPages;
    } else {
      totalPagesRead += b.currentPage;
    }
    if (b.rating > 0) {
      ratingSum += b.rating;
      ratedCount += 1;
    }
  }
  return {
    total: books.length,
    byStatus,
    avgRating: ratedCount > 0 ? Math.round((ratingSum / ratedCount) * 10) / 10 : 0,
    totalPagesRead,
    totalPages,
    finishedCount: byStatus.finished,
    readingCount: byStatus.reading,
  };
}

// ---- Goal tracking ----

/** Calculate progress toward a yearly reading goal. */
export function calcGoalProgress(books: Book[], target: number): GoalProgress {
  const finished = books.filter((b) => b.status === "finished").length;
  const remaining = Math.max(0, target - finished);
  const percent = target > 0 ? Math.min(100, Math.round((finished / target) * 100)) : 0;
  return {
    target,
    finished,
    remaining,
    percent,
    onTrack: percent >= 100,
  };
}

// ---- Reading time estimator ----

/** Estimate reading time in minutes for a book at given wpm. */
export function estimateReadingTime(
  book: Pick<Book, "totalPages" | "currentPage">,
  wpm = DEFAULT_WPM,
): ReadingTimeEstimate {
  const wordsPerPage = 250; // standard estimate
  const remainingPages = Math.max(0, book.totalPages - book.currentPage);
  const minutes = Math.round((remainingPages * wordsPerPage) / wpm);
  const hours = Math.round((minutes / 60) * 10) / 10;
  let displayString: string;
  if (minutes < 60) {
    displayString = `${minutes} min`;
  } else if (hours < 10) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    displayString = m > 0 ? `${h}h ${m}min` : `${h}h`;
  } else {
    displayString = `${hours}h`;
  }
  return { minutes, hours, displayString };
}

/** Estimate total remaining reading time across all books. */
export function estimateTotalReadingTime(books: Book[], wpm = DEFAULT_WPM): ReadingTimeEstimate {
  let total = 0;
  for (const b of books) {
    if (b.status === "to-read" || b.status === "reading") {
      total += estimateReadingTime(b, wpm).minutes;
    }
  }
  const hours = Math.round((total / 60) * 10) / 10;
  let displayString: string;
  if (total < 60) displayString = `${total} min`;
  else if (hours < 10) {
    const h = Math.floor(total / 60);
    const m = total % 60;
    displayString = m > 0 ? `${h}h ${m}min` : `${h}h`;
  } else displayString = `${hours}h`;
  return { minutes: total, hours, displayString };
}

// ---- Recommendation engine ----

/** Generate simple recommendations based on genre + rating patterns. */
export function recommendBooks(books: Book[], limit = 5): Recommendation[] {
  // Find genres with highest average rating among finished books
  const genreRatings = new Map<string, { sum: number; count: number }>();
  for (const b of books) {
    if (b.status === "finished" && b.rating > 0 && b.genre) {
      const cur = genreRatings.get(b.genre) ?? { sum: 0, count: 0 };
      cur.sum += b.rating;
      cur.count += 1;
      genreRatings.set(b.genre, cur);
    }
  }
  const topGenres = Array.from(genreRatings.entries())
    .map(([genre, { sum, count }]) => ({ genre, avg: sum / count }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 3)
    .map((g) => g.genre);

  // Recommend to-read books in top genres
  const candidates = books.filter((b) => b.status === "to-read");
  const scored: Recommendation[] = candidates.map((b) => {
    let score = 50;
    let reason = "On your to-read list";
    if (b.genre) {
      const idx = topGenres.indexOf(b.genre);
      if (idx >= 0) {
        score += (3 - idx) * 15;
        reason = `Top-rated genre: ${b.genre}`;
      }
    }
    // Boost if author has high rating
    const authorBooks = books.filter((x) => x.author.toLowerCase() === b.author.toLowerCase() && x.rating > 0);
    if (authorBooks.length > 0) {
      const avg = authorBooks.reduce((s, x) => s + x.rating, 0) / authorBooks.length;
      if (avg >= 4) {
        score += 20;
        reason = `You rated ${b.author} highly (${avg.toFixed(1)}★ avg)`;
      }
    }
    return { book: b, reason, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

// ---- Renderers ----

/** Render a single book as a text line. */
export function renderBookText(book: Book): string {
  const progress = calcProgress(book);
  const stars = book.rating > 0 ? "★".repeat(book.rating) + "☆".repeat(MAX_RATING - book.rating) : "☆".repeat(MAX_RATING);
  const parts = [
    `[${STATUS_LABELS[book.status]}] ${book.title}`,
    book.author ? ` by ${book.author}` : "",
    book.totalPages > 0 ? ` (${book.currentPage}/${book.totalPages}p, ${progress}%)` : "",
    ` ${stars}`,
    book.genre ? ` [${book.genre}]` : "",
    book.notes ? ` — ${book.notes}` : "",
  ];
  return parts.join("");
}

/** Render books as a text reading list. */
export function renderText(books: Book[]): string {
  return books.map(renderBookText).join("\n");
}

/** Render books as CSV. */
export function renderCsv(books: Book[]): string {
  const lines = ["title,author,total_pages,current_page,status,rating,genre,notes,progress_pct"];
  for (const b of books) {
    const progress = calcProgress(b);
    lines.push([
      escapeCsv(b.title),
      escapeCsv(b.author),
      b.totalPages,
      b.currentPage,
      b.status,
      b.rating,
      escapeCsv(b.genre),
      escapeCsv(b.notes),
      progress,
    ].join(","));
  }
  return lines.join("\n");
}

/** Render a book as a single pipe-separated line (for re-import). */
export function renderBookPipe(book: Book): string {
  return [
    escapePipe(book.title),
    escapePipe(book.author),
    book.totalPages,
    book.currentPage,
    book.status,
    book.rating,
    escapePipe(book.notes),
    escapePipe(book.genre),
  ].join("|");
}

/** Render books as a pipe-separated list (for re-import). */
export function renderPipe(books: Book[]): string {
  return books.map(renderBookPipe).join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function escapePipe(s: string): string {
  if (/[|\n"]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:reading-list-tracker:history";
const HISTORY_MAX = 20;
const GOAL_KEY = "unqtools:reading-list-tracker:goal";

export interface HistoryEntry {
  ts: number;
  bookCount: number;
  finishedCount: number;
  avgRating: number;
  sampleTitle: string;
}

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, HISTORY_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

export function loadGoal(): number {
  if (typeof localStorage === "undefined") return 0;
  try {
    const raw = localStorage.getItem(GOAL_KEY);
    return raw ? parseInt(raw, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

export function saveGoal(target: number): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(GOAL_KEY, String(target));
  } catch {
    // ignore
  }
}

// ---- Shareable URL ----

export function buildShareUrl(booksText: string, statusFilter: StatusFilter, sortBy: SortBy, goal: number): string {
  const params = new URLSearchParams();
  if (booksText) params.set("books", booksText);
  if (statusFilter !== "all") params.set("status", statusFilter);
  if (sortBy !== "title") params.set("sort", sortBy);
  if (goal > 0) params.set("goal", String(goal));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): {
  books: string;
  statusFilter: StatusFilter;
  sortBy: SortBy;
  goal: number;
} {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) {
    return { books: "", statusFilter: "all", sortBy: "title", goal: 0 };
  }
  const params = new URLSearchParams(clean);
  const books = params.get("books") ?? "";
  const status = params.get("status") ?? "all";
  const sort = params.get("sort") ?? "title";
  const goalStr = params.get("goal") ?? "0";
  const validStatuses: StatusFilter[] = STATUS_FILTERS;
  const validSorts: SortBy[] = SORT_OPTIONS;
  const statusFilter = validStatuses.includes(status as StatusFilter) ? (status as StatusFilter) : "all";
  const sortBy = validSorts.includes(sort as SortBy) ? (sort as SortBy) : "title";
  const goal = parseInt(goalStr, 10) || 0;
  return { books, statusFilter, sortBy, goal };
}

// ---- Sample / preset data ----

export const SAMPLE_BOOKS = `The Hobbit|J.R.R. Tolkien|310|310|finished|5|Classic fantasy adventure|fantasy
Sapiens|Yuval Noah Harari|443|120|reading|4|Fascinating history of humankind|non-fiction
Dune|Frank Herbert|688|0|to-read|0|Heard great things|sci-fi
Atomic Habits|James Clear|320|320|finished|5|Practical habit-building|self-help
The Silent Patient|Alex Michaelides|336|50|abandoned|2|Too slow for me|mystery`;
