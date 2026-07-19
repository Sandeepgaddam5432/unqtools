import { describe, it, expect, beforeEach } from "vitest";
import {
  STATUS_LABELS,
  STATUS_FILTERS,
  STATUS_FILTER_LABELS,
  SORT_OPTIONS,
  SORT_LABELS,
  GENRE_PRESETS,
  DEFAULT_WPM,
  MIN_RATING,
  MAX_RATING,
  normalizeText,
  isValidStatus,
  normalizeStatus,
  validateRating,
  validatePages,
  splitPipeRow,
  parseBookLine,
  parseBooks,
  generateId,
  calcProgress,
  progressBar,
  filterByStatus,
  searchBooks,
  sortBooks,
  computeStats,
  calcGoalProgress,
  estimateReadingTime,
  estimateTotalReadingTime,
  recommendBooks,
  renderBookText,
  renderText,
  renderCsv,
  renderBookPipe,
  renderPipe,
  loadHistory,
  saveHistory,
  clearHistory,
  loadGoal,
  saveGoal,
  buildShareUrl,
  parseShareUrl,
  SAMPLE_BOOKS,
  type BookStatus,
  type StatusFilter,
  type SortBy,
  type Book,
} from "./logic";

beforeEach(() => {
  const store: Record<string, string> = {};
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  };
});

describe("reading-list-tracker constants", () => {
  it("has 4 status labels", () => {
    expect(Object.keys(STATUS_LABELS)).toHaveLength(4);
    expect(STATUS_LABELS.finished).toBe("Finished");
  });
  it("has 5 status filters (incl. all)", () => {
    expect(STATUS_FILTERS).toHaveLength(5);
    expect(STATUS_FILTERS).toContain("all");
  });
  it("has 5 status filter labels", () => {
    expect(Object.keys(STATUS_FILTER_LABELS)).toHaveLength(5);
    expect(STATUS_FILTER_LABELS.all).toBe("All Books");
  });
  it("has 5 sort options", () => {
    expect(SORT_OPTIONS).toHaveLength(5);
    expect(SORT_LABELS.title).toBeDefined();
  });
  it("has genre presets", () => {
    expect(GENRE_PRESETS.length).toBeGreaterThanOrEqual(10);
    expect(GENRE_PRESETS).toContain("fiction");
  });
  it("has default wpm 250 and rating range 1-5", () => {
    expect(DEFAULT_WPM).toBe(250);
    expect(MIN_RATING).toBe(1);
    expect(MAX_RATING).toBe(5);
  });
});

describe("reading-list-tracker normalizeText", () => {
  it("trims", () => {
    expect(normalizeText("  hello  ")).toBe("hello");
  });
  it("handles undefined", () => {
    expect(normalizeText(undefined)).toBe("");
  });
});

describe("reading-list-tracker isValidStatus / normalizeStatus", () => {
  it("validates proper statuses", () => {
    expect(isValidStatus("to-read")).toBe(true);
    expect(isValidStatus("reading")).toBe(true);
    expect(isValidStatus("finished")).toBe(true);
    expect(isValidStatus("abandoned")).toBe(true);
  });
  it("rejects invalid statuses", () => {
    expect(isValidStatus("")).toBe(false);
    expect(isValidStatus("completed")).toBe(false);
  });
  it("normalizes aliases", () => {
    expect(normalizeStatus("TBR")).toBe("to-read");
    expect(normalizeStatus("in-progress")).toBe("reading");
    expect(normalizeStatus("done")).toBe("finished");
    expect(normalizeStatus("DNF")).toBe("abandoned");
  });
  it("defaults to to-read for unknown", () => {
    expect(normalizeStatus("")).toBe("to-read");
    expect(normalizeStatus("xyz")).toBe("to-read");
  });
});

describe("reading-list-tracker validateRating", () => {
  it("accepts 1-5", () => {
    expect(validateRating(1)).toBe(1);
    expect(validateRating(3)).toBe(3);
    expect(validateRating(5)).toBe(5);
  });
  it("accepts strings", () => {
    expect(validateRating("4")).toBe(4);
  });
  it("rejects < 1 (returns 0)", () => {
    expect(validateRating(0)).toBe(0);
    expect(validateRating(-1)).toBe(0);
  });
  it("caps at 5", () => {
    expect(validateRating(6)).toBe(5);
    expect(validateRating(100)).toBe(5);
  });
  it("rejects non-numbers", () => {
    expect(validateRating("abc")).toBe(0);
    expect(validateRating(NaN)).toBe(0);
  });
});

describe("reading-list-tracker validatePages", () => {
  it("accepts positive integers", () => {
    expect(validatePages(100)).toBe(100);
    expect(validatePages("250")).toBe(250);
  });
  it("rejects negatives and NaN", () => {
    expect(validatePages(-5)).toBe(0);
    expect(validatePages("abc")).toBe(0);
    expect(validatePages(NaN)).toBe(0);
  });
  it("accepts zero", () => {
    expect(validatePages(0)).toBe(0);
  });
  it("floors decimals", () => {
    expect(validatePages(100.9)).toBe(100);
  });
});

describe("reading-list-tracker splitPipeRow", () => {
  it("splits simple", () => {
    expect(splitPipeRow("a|b|c")).toEqual(["a", "b", "c"]);
  });
  it("handles quoted pipes", () => {
    expect(splitPipeRow('"a|b"|c')).toEqual(["a|b", "c"]);
  });
  it("handles doubled quotes", () => {
    expect(splitPipeRow('"a""b"|c')).toEqual(['a"b', "c"]);
  });
});

describe("reading-list-tracker parseBookLine", () => {
  it("parses a full book line", () => {
    const book = parseBookLine("Dune|Frank Herbert|688|100|reading|4|Heard great things|sci-fi");
    expect(book).not.toBeNull();
    expect(book!.title).toBe("Dune");
    expect(book!.author).toBe("Frank Herbert");
    expect(book!.totalPages).toBe(688);
    expect(book!.currentPage).toBe(100);
    expect(book!.status).toBe("reading");
    expect(book!.rating).toBe(4);
    expect(book!.notes).toBe("Heard great things");
    expect(book!.genre).toBe("sci-fi");
  });
  it("parses minimal line (title only)", () => {
    const book = parseBookLine("Just A Title");
    expect(book).not.toBeNull();
    expect(book!.title).toBe("Just A Title");
    expect(book!.author).toBe("");
    expect(book!.status).toBe("to-read");
    expect(book!.rating).toBe(0);
  });
  it("returns null for empty line", () => {
    expect(parseBookLine("")).toBeNull();
    expect(parseBookLine("   ")).toBeNull();
  });
  it("handles quoted pipe in notes", () => {
    const book = parseBookLine('Title|Author|100|50|reading|3|"Has | pipe"|fiction');
    expect(book!.notes).toBe("Has | pipe");
  });
  it("caps currentPage at totalPages", () => {
    const book = parseBookLine("Title|Author|100|150|reading|3");
    expect(book!.currentPage).toBe(100);
  });
});

describe("reading-list-tracker parseBooks", () => {
  it("parses multiple books", () => {
    const books = parseBooks(SAMPLE_BOOKS);
    expect(books).toHaveLength(5);
    expect(books[0].title).toBe("The Hobbit");
  });
  it("skips blank lines", () => {
    const books = parseBooks("A|B|100|0|to-read\n\nC|D|200|0|to-read");
    expect(books).toHaveLength(2);
  });
  it("returns empty for empty input", () => {
    expect(parseBooks("")).toEqual([]);
  });
});

describe("reading-list-tracker generateId", () => {
  it("generates unique ids", () => {
    const a = generateId();
    const b = generateId();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^book_/);
  });
});

describe("reading-list-tracker calcProgress", () => {
  it("calculates percentage", () => {
    expect(calcProgress({ currentPage: 50, totalPages: 200 })).toBe(25);
    expect(calcProgress({ currentPage: 100, totalPages: 100 })).toBe(100);
  });
  it("returns 0 for zero total pages", () => {
    expect(calcProgress({ currentPage: 50, totalPages: 0 })).toBe(0);
  });
  it("caps at 100", () => {
    expect(calcProgress({ currentPage: 200, totalPages: 100 })).toBe(100);
  });
  it("returns 0 for negatives", () => {
    expect(calcProgress({ currentPage: -10, totalPages: 100 })).toBe(0);
  });
});

describe("reading-list-tracker progressBar", () => {
  it("renders filled chars", () => {
    const bar = progressBar(50, 10);
    expect(bar).toHaveLength(10);
    expect(bar).toContain("█");
    expect(bar).toContain("░");
  });
  it("renders empty bar at 0%", () => {
    expect(progressBar(0, 10)).toBe("░".repeat(10));
  });
  it("renders full bar at 100%", () => {
    expect(progressBar(100, 10)).toBe("█".repeat(10));
  });
});

describe("reading-list-tracker filterByStatus", () => {
  const books: Book[] = [
    { id: "1", title: "A", author: "X", totalPages: 100, currentPage: 100, status: "finished", rating: 5, notes: "", genre: "", dateAdded: 1 },
    { id: "2", title: "B", author: "Y", totalPages: 100, currentPage: 50, status: "reading", rating: 0, notes: "", genre: "", dateAdded: 2 },
    { id: "3", title: "C", author: "Z", totalPages: 100, currentPage: 0, status: "to-read", rating: 0, notes: "", genre: "", dateAdded: 3 },
  ];
  it("filters by status", () => {
    expect(filterByStatus(books, "finished")).toHaveLength(1);
    expect(filterByStatus(books, "reading")).toHaveLength(1);
    expect(filterByStatus(books, "to-read")).toHaveLength(1);
  });
  it("returns all for 'all'", () => {
    expect(filterByStatus(books, "all")).toHaveLength(3);
  });
});

describe("reading-list-tracker searchBooks", () => {
  const books: Book[] = [
    { id: "1", title: "Dune", author: "Frank Herbert", totalPages: 100, currentPage: 0, status: "to-read", rating: 0, notes: "classic", genre: "sci-fi", dateAdded: 1 },
    { id: "2", title: "Sapiens", author: "Harari", totalPages: 100, currentPage: 0, status: "to-read", rating: 0, notes: "", genre: "history", dateAdded: 2 },
  ];
  it("finds by title", () => {
    expect(searchBooks(books, "dune")).toHaveLength(1);
  });
  it("finds by author", () => {
    expect(searchBooks(books, "herbert")).toHaveLength(1);
  });
  it("finds by genre", () => {
    expect(searchBooks(books, "sci")).toHaveLength(1);
  });
  it("finds by notes", () => {
    expect(searchBooks(books, "classic")).toHaveLength(1);
  });
  it("returns all for empty query", () => {
    expect(searchBooks(books, "")).toHaveLength(2);
  });
  it("is case-insensitive", () => {
    expect(searchBooks(books, "DUNE")).toHaveLength(1);
  });
});

describe("reading-list-tracker sortBooks", () => {
  const books: Book[] = [
    { id: "1", title: "Zebra", author: "Bob", totalPages: 100, currentPage: 0, status: "to-read", rating: 3, notes: "", genre: "", dateAdded: 100 },
    { id: "2", title: "Apple", author: "Alice", totalPages: 100, currentPage: 50, status: "reading", rating: 5, notes: "", genre: "", dateAdded: 200 },
    { id: "3", title: "Mango", author: "Carol", totalPages: 100, currentPage: 100, status: "finished", rating: 4, notes: "", genre: "", dateAdded: 50 },
  ];
  it("sorts by title A-Z", () => {
    const sorted = sortBooks(books, "title");
    expect(sorted[0].title).toBe("Apple");
    expect(sorted[2].title).toBe("Zebra");
  });
  it("sorts by author A-Z", () => {
    const sorted = sortBooks(books, "author");
    expect(sorted[0].author).toBe("Alice");
    expect(sorted[2].author).toBe("Carol");
  });
  it("sorts by progress high-low", () => {
    const sorted = sortBooks(books, "progress");
    expect(sorted[0].title).toBe("Mango");
    expect(sorted[2].title).toBe("Zebra");
  });
  it("sorts by rating high-low", () => {
    const sorted = sortBooks(books, "rating");
    expect(sorted[0].rating).toBe(5);
    expect(sorted[2].rating).toBe(3);
  });
  it("sorts by date-added newest first", () => {
    const sorted = sortBooks(books, "date-added");
    expect(sorted[0].dateAdded).toBe(200);
    expect(sorted[2].dateAdded).toBe(50);
  });
});

describe("reading-list-tracker computeStats", () => {
  const books: Book[] = [
    { id: "1", title: "A", author: "", totalPages: 100, currentPage: 100, status: "finished", rating: 4, notes: "", genre: "", dateAdded: 1 },
    { id: "2", title: "B", author: "", totalPages: 200, currentPage: 50, status: "reading", rating: 5, notes: "", genre: "", dateAdded: 2 },
    { id: "3", title: "C", author: "", totalPages: 300, currentPage: 0, status: "to-read", rating: 0, notes: "", genre: "", dateAdded: 3 },
  ];
  it("computes totals", () => {
    const s = computeStats(books);
    expect(s.total).toBe(3);
    expect(s.byStatus.finished).toBe(1);
    expect(s.byStatus.reading).toBe(1);
    expect(s.byStatus["to-read"]).toBe(1);
  });
  it("computes pages read (finished counts full)", () => {
    const s = computeStats(books);
    // 100 (finished full) + 50 (current reading) + 0 (to-read)
    expect(s.totalPagesRead).toBe(150);
    expect(s.totalPages).toBe(600);
  });
  it("computes avg rating (ignores 0 ratings)", () => {
    const s = computeStats(books);
    expect(s.avgRating).toBe(4.5); // (4 + 5) / 2
  });
  it("returns zeros for empty", () => {
    const s = computeStats([]);
    expect(s.total).toBe(0);
    expect(s.avgRating).toBe(0);
  });
});

describe("reading-list-tracker calcGoalProgress", () => {
  const books: Book[] = [
    { id: "1", title: "A", author: "", totalPages: 0, currentPage: 0, status: "finished", rating: 0, notes: "", genre: "", dateAdded: 1 },
    { id: "2", title: "B", author: "", totalPages: 0, currentPage: 0, status: "finished", rating: 0, notes: "", genre: "", dateAdded: 2 },
    { id: "3", title: "C", author: "", totalPages: 0, currentPage: 0, status: "reading", rating: 0, notes: "", genre: "", dateAdded: 3 },
  ];
  it("computes progress toward goal", () => {
    const g = calcGoalProgress(books, 10);
    expect(g.target).toBe(10);
    expect(g.finished).toBe(2);
    expect(g.remaining).toBe(8);
    expect(g.percent).toBe(20);
  });
  it("caps at 100%", () => {
    const g = calcGoalProgress(books, 1);
    expect(g.percent).toBe(100);
    expect(g.onTrack).toBe(true);
  });
  it("handles zero target", () => {
    const g = calcGoalProgress(books, 0);
    expect(g.percent).toBe(0);
  });
});

describe("reading-list-tracker estimateReadingTime", () => {
  it("estimates minutes for remaining pages", () => {
    const e = estimateReadingTime({ totalPages: 250, currentPage: 0 });
    expect(e.minutes).toBe(250); // 250 pages * 250 wpp / 250 wpm = 250 min
  });
  it("handles finished books (0 remaining)", () => {
    const e = estimateReadingTime({ totalPages: 250, currentPage: 250 });
    expect(e.minutes).toBe(0);
  });
  it("displays minutes for short books", () => {
    const e = estimateReadingTime({ totalPages: 10, currentPage: 0 });
    expect(e.displayString).toContain("min");
  });
  it("displays hours for longer books", () => {
    const e = estimateReadingTime({ totalPages: 1000, currentPage: 0 });
    expect(e.hours).toBeGreaterThan(10);
  });
});

describe("reading-list-tracker estimateTotalReadingTime", () => {
  const books: Book[] = [
    { id: "1", title: "A", author: "", totalPages: 250, currentPage: 0, status: "to-read", rating: 0, notes: "", genre: "", dateAdded: 1 },
    { id: "2", title: "B", author: "", totalPages: 250, currentPage: 250, status: "finished", rating: 0, notes: "", genre: "", dateAdded: 2 },
  ];
  it("sums only to-read and reading books", () => {
    const e = estimateTotalReadingTime(books);
    expect(e.minutes).toBe(250); // only first book
  });
});

describe("reading-list-tracker recommendBooks", () => {
  const books: Book[] = [
    { id: "1", title: "Finished Fantasy 1", author: "Author A", totalPages: 100, currentPage: 100, status: "finished", rating: 5, notes: "", genre: "fantasy", dateAdded: 1 },
    { id: "2", title: "Finished Fantasy 2", author: "Author A", totalPages: 100, currentPage: 100, status: "finished", rating: 5, notes: "", genre: "fantasy", dateAdded: 2 },
    { id: "3", title: "To-Read Fantasy", author: "Other", totalPages: 100, currentPage: 0, status: "to-read", rating: 0, notes: "", genre: "fantasy", dateAdded: 3 },
    { id: "4", title: "To-Read Other Genre", author: "Other", totalPages: 100, currentPage: 0, status: "to-read", rating: 0, notes: "", genre: "history", dateAdded: 4 },
  ];
  it("recommends to-read books in top genres", () => {
    const recs = recommendBooks(books);
    expect(recs.length).toBeGreaterThan(0);
    // Fantasy should rank first because of high finished rating
    expect(recs[0].book.title).toBe("To-Read Fantasy");
  });
  it("boosts by author rating patterns", () => {
    const recs = recommendBooks(books);
    const fantasyRec = recs.find((r) => r.book.title === "To-Read Fantasy");
    expect(fantasyRec).toBeDefined();
    expect(fantasyRec!.score).toBeGreaterThan(50);
  });
  it("limits results", () => {
    const recs = recommendBooks(books, 1);
    expect(recs).toHaveLength(1);
  });
  it("returns empty if no to-read books", () => {
    const onlyRead: Book[] = [
      { id: "1", title: "A", author: "", totalPages: 100, currentPage: 100, status: "finished", rating: 5, notes: "", genre: "fantasy", dateAdded: 1 },
    ];
    expect(recommendBooks(onlyRead)).toEqual([]);
  });
});

describe("reading-list-tracker renderers", () => {
  const book: Book = {
    id: "1", title: "Dune", author: "Frank Herbert",
    totalPages: 688, currentPage: 100, status: "reading",
    rating: 4, notes: "Great so far", genre: "sci-fi", dateAdded: 1,
  };
  it("renderBookText includes status and title", () => {
    const t = renderBookText(book);
    expect(t).toContain("[Reading]");
    expect(t).toContain("Dune");
    expect(t).toContain("Frank Herbert");
    expect(t).toContain("100/688p");
    expect(t).toContain("15%"); // 100/688 ~= 14.5%, rounds to 15
    expect(t).toContain("★★★★☆");
    expect(t).toContain("[sci-fi]");
    expect(t).toContain("Great so far");
  });
  it("renderBookText handles no rating", () => {
    const t = renderBookText({ ...book, rating: 0 });
    expect(t).toContain("☆☆☆☆☆");
  });
  it("renderText joins with newlines", () => {
    const t = renderText([book, book]);
    expect(t.split("\n").length).toBe(2);
  });
  it("renderCsv includes header", () => {
    const c = renderCsv([book]);
    expect(c).toContain("title,author,total_pages,current_page,status,rating,genre,notes,progress_pct");
    expect(c).toContain("Dune,Frank Herbert,688,100,reading,4");
  });
  it("renderCsv escapes commas", () => {
    const c = renderCsv([{ ...book, title: "Title, With Comma" }]);
    expect(c).toContain('"Title, With Comma"');
  });
  it("renderBookPipe produces pipe-separated line", () => {
    const p = renderBookPipe(book);
    expect(p).toContain("Dune|Frank Herbert|688|100|reading|4");
  });
  it("renderBookPipe escapes pipes in values", () => {
    const p = renderBookPipe({ ...book, title: "A | B" });
    expect(p).toContain('"A | B"');
  });
  it("renderPipe joins multiple books", () => {
    const p = renderPipe([book, book]);
    expect(p.split("\n").length).toBe(2);
  });
  it("renderers handle empty", () => {
    expect(renderText([])).toBe("");
    expect(renderCsv([])).toContain("title,author");
    expect(renderPipe([])).toBe("");
  });
});

describe("reading-list-tracker history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1, bookCount: 5, finishedCount: 2, avgRating: 4.5, sampleTitle: "Dune",
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, bookCount: 1, finishedCount: 0, avgRating: 0, sampleTitle: `T${i}` });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, bookCount: 1, finishedCount: 0, avgRating: 0, sampleTitle: "T" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("reading-list-tracker goal storage", () => {
  it("loads 0 by default", () => {
    expect(loadGoal()).toBe(0);
  });
  it("saves and loads", () => {
    saveGoal(50);
    expect(loadGoal()).toBe(50);
  });
});

describe("reading-list-tracker shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("Dune|Frank", "reading", "rating", 25);
    expect(url).toContain("books=Dune");
    expect(url).toContain("status=reading");
    expect(url).toContain("sort=rating");
    expect(url).toContain("goal=25");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("omits default values from share URL", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("Dune", "all", "title", 0);
    expect(url).toContain("books=Dune");
    expect(url).not.toContain("status=");
    expect(url).not.toContain("sort=");
    expect(url).not.toContain("goal=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("books=Dune&status=reading&sort=rating&goal=50");
    expect(p.books).toBe("Dune");
    expect(p.statusFilter).toBe("reading");
    expect(p.sortBy).toBe("rating");
    expect(p.goal).toBe(50);
  });
  it("handles empty hash with defaults", () => {
    const p = parseShareUrl("");
    expect(p.books).toBe("");
    expect(p.statusFilter).toBe("all");
    expect(p.sortBy).toBe("title");
    expect(p.goal).toBe(0);
  });
  it("filters unknown status", () => {
    const p = parseShareUrl("status=unknown");
    expect(p.statusFilter).toBe("all");
  });
  it("filters unknown sort", () => {
    const p = parseShareUrl("sort=unknown");
    expect(p.sortBy).toBe("title");
  });
});

describe("reading-list-tracker SAMPLE_BOOKS", () => {
  it("contains valid sample data", () => {
    const books = parseBooks(SAMPLE_BOOKS);
    expect(books.length).toBeGreaterThanOrEqual(4);
    expect(books.some((b) => b.title === "The Hobbit")).toBe(true);
  });
});

// Suppress unused-import lint
export type _Unused = BookStatus | StatusFilter | SortBy | Book;
