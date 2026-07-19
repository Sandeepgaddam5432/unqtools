import { describe, it, expect, beforeEach } from "vitest";
import {
  FIELD_NAMES,
  MAX_SHARE_NOTES,
  TAG_CLOUD_LIMIT,
  splitPipeLine,
  parseTags,
  isValidDate,
  parseNotes,
  validateNotes,
  groupBySubject,
  groupByTopic,
  buildTagIndex,
  searchNotes,
  filterNotes,
  sortByDate,
  computeCounts,
  generateTagCloud,
  findDuplicates,
  renderText,
  renderHtml,
  renderMarkdown,
  renderCsv,
  renderJson,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type StudyNote,
  type SortOrder,
} from "./logic";

const SAMPLE_INPUT = `Biology|Cells|Mitochondria|Powerhouse of the cell|bio,cells|2024-09-12
Biology|Cells|Nucleus|Contains DNA|bio,cells,important|2024-09-13
Biology|Genetics|DNA|Stores genetic info|bio,genetics|2024-09-14
Math|Algebra|Quadratic|Solve ax^2+bx+c=0|math,algebra|2024-09-10
Math|Calculus|Derivatives|Rate of change|math,calc,important|2024-09-15`;

const SAMPLE_INPUT_DUPS = `Biology|Cells|Mitochondria|Powerhouse of the cell|bio|2024-09-12
Biology|Cells|mitochondria|Different content but same title|bio|2024-09-13`;

function makeNote(partial: Partial<StudyNote> = {}): StudyNote {
  return {
    subject: "Biology",
    topic: "Cells",
    title: "Test Note",
    content: "Some content",
    tags: ["bio"],
    date: "2024-09-12",
    line: 1,
    ...partial,
  };
}

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

describe("study-notes-organizer constants", () => {
  it("has 6 field names", () => {
    expect(FIELD_NAMES).toHaveLength(6);
    expect(FIELD_NAMES).toContain("subject");
  });
  it("has MAX_SHARE_NOTES = 50", () => {
    expect(MAX_SHARE_NOTES).toBe(50);
  });
  it("has TAG_CLOUD_LIMIT = 10", () => {
    expect(TAG_CLOUD_LIMIT).toBe(10);
  });
});

describe("study-notes-organizer splitPipeLine", () => {
  it("splits simple pipe-separated", () => {
    expect(splitPipeLine("a|b|c")).toEqual(["a", "b", "c"]);
  });
  it("handles quoted fields containing pipes", () => {
    expect(splitPipeLine('a|"b|c"|d')).toEqual(["a", "b|c", "d"]);
  });
  it("handles escaped double quotes inside quoted field", () => {
    expect(splitPipeLine('"say ""hi"""|b')).toEqual(['say "hi"', "b"]);
  });
  it("handles empty fields", () => {
    expect(splitPipeLine("a||c")).toEqual(["a", "", "c"]);
  });
});

describe("study-notes-organizer parseTags", () => {
  it("parses comma-separated", () => {
    expect(parseTags("bio,cells,important")).toEqual(["bio", "cells", "important"]);
  });
  it("lowercases and trims", () => {
    expect(parseTags(" BIO ,  Cells ")).toEqual(["bio", "cells"]);
  });
  it("dedupes", () => {
    expect(parseTags("bio,bio,bio")).toEqual(["bio"]);
  });
  it("splits on whitespace too", () => {
    expect(parseTags("bio cells")).toEqual(["bio", "cells"]);
  });
  it("returns empty for empty input", () => {
    expect(parseTags("")).toEqual([]);
  });
});

describe("study-notes-organizer isValidDate", () => {
  it("accepts valid YYYY-MM-DD", () => {
    expect(isValidDate("2024-09-12")).toBe(true);
  });
  it("accepts empty (optional)", () => {
    expect(isValidDate("")).toBe(true);
  });
  it("rejects wrong format", () => {
    expect(isValidDate("09/12/2024")).toBe(false);
  });
  it("rejects impossible date", () => {
    expect(isValidDate("2024-13-45")).toBe(false);
  });
});

describe("study-notes-organizer parseNotes", () => {
  it("parses the sample input", () => {
    const { notes, issues } = parseNotes(SAMPLE_INPUT);
    expect(notes).toHaveLength(5);
    expect(issues).toHaveLength(0);
    expect(notes[0].subject).toBe("Biology");
    expect(notes[0].title).toBe("Mitochondria");
    expect(notes[0].tags).toEqual(["bio", "cells"]);
    expect(notes[0].date).toBe("2024-09-12");
  });
  it("skips blank lines", () => {
    const { notes } = parseNotes("a|b|c|d|e|f\n\n\ng|h|i|j|k|l");
    expect(notes).toHaveLength(2);
  });
  it("handles quoted content with pipes", () => {
    const { notes } = parseNotes('Biology|Cells|Title|"content with | pipe"|bio|2024-09-12');
    expect(notes[0].content).toBe("content with | pipe");
  });
  it("records validation issues for missing fields", () => {
    const { issues } = parseNotes("|topic|title|content|tags|2024-09-12");
    expect(issues.some((i) => i.reason === "missing-subject")).toBe(true);
  });
  it("records issue for bad date", () => {
    const { issues } = parseNotes("s|t|ti|c|tags|not-a-date");
    expect(issues.some((i) => i.reason === "bad-date")).toBe(true);
  });
  it("returns empty for empty input", () => {
    expect(parseNotes("")).toEqual({ notes: [], issues: [] });
  });
  it("pads missing fields", () => {
    const { notes } = parseNotes("Bio|Cells|Mitochondria");
    expect(notes).toHaveLength(1);
    expect(notes[0].content).toBe("");
    expect(notes[0].tags).toEqual([]);
    expect(notes[0].date).toBe("");
  });
});

describe("study-notes-organizer validateNotes", () => {
  it("splits valid and invalid", () => {
    const { notes } = parseNotes(SAMPLE_INPUT + "\n|topic|title|content|tags|2024-09-12");
    const { valid, invalid } = validateNotes(notes);
    expect(valid).toHaveLength(5);
    expect(invalid).toHaveLength(1);
  });
});

describe("study-notes-organizer groupBySubject", () => {
  it("groups notes by subject", () => {
    const { notes } = parseNotes(SAMPLE_INPUT);
    const groups = groupBySubject(notes);
    expect(groups).toHaveLength(2);
    const bio = groups.find((g) => g.subject === "Biology");
    expect(bio?.notes).toHaveLength(3);
    const math = groups.find((g) => g.subject === "Math");
    expect(math?.notes).toHaveLength(2);
  });
  it("sorts subjects alphabetically", () => {
    const { notes } = parseNotes(SAMPLE_INPUT);
    const groups = groupBySubject(notes);
    expect(groups[0].subject).toBe("Biology");
    expect(groups[1].subject).toBe("Math");
  });
  it("returns empty for empty input", () => {
    expect(groupBySubject([])).toEqual([]);
  });
});

describe("study-notes-organizer groupByTopic", () => {
  it("groups notes by topic within a subject", () => {
    const { notes } = parseNotes(SAMPLE_INPUT);
    const bio = notes.filter((n) => n.subject === "Biology");
    const topics = groupByTopic(bio);
    expect(topics).toHaveLength(2);
    const cells = topics.find((t) => t.topic === "Cells");
    expect(cells?.notes).toHaveLength(2);
  });
});

describe("study-notes-organizer buildTagIndex", () => {
  it("builds tag → notes map", () => {
    const { notes } = parseNotes(SAMPLE_INPUT);
    const idx = buildTagIndex(notes);
    const bio = idx.find((e) => e.tag === "bio");
    expect(bio?.count).toBe(3);
  });
  it("sorts by count desc then alphabetically", () => {
    const { notes } = parseNotes(SAMPLE_INPUT);
    const idx = buildTagIndex(notes);
    expect(idx[0].count).toBeGreaterThanOrEqual(idx[idx.length - 1].count);
  });
});

describe("study-notes-organizer searchNotes", () => {
  it("searches title case-insensitive", () => {
    const { notes } = parseNotes(SAMPLE_INPUT);
    const r = searchNotes(notes, "mitochondria");
    expect(r).toHaveLength(1);
    expect(r[0].title).toBe("Mitochondria");
  });
  it("searches content", () => {
    const { notes } = parseNotes(SAMPLE_INPUT);
    const r = searchNotes(notes, "DNA");
    expect(r.length).toBeGreaterThanOrEqual(2); // Nucleus + DNA notes
  });
  it("returns all for empty query", () => {
    const { notes } = parseNotes(SAMPLE_INPUT);
    expect(searchNotes(notes, "")).toHaveLength(notes.length);
  });
});

describe("study-notes-organizer filterNotes", () => {
  it("filters by subject", () => {
    const { notes } = parseNotes(SAMPLE_INPUT);
    expect(filterNotes(notes, "biology", "").length).toBe(3);
  });
  it("filters by tag", () => {
    const { notes } = parseNotes(SAMPLE_INPUT);
    expect(filterNotes(notes, "", "important").length).toBe(2);
  });
  it("filters by subject + tag combined", () => {
    const { notes } = parseNotes(SAMPLE_INPUT);
    expect(filterNotes(notes, "math", "important").length).toBe(1);
  });
  it("returns all when no filters", () => {
    const { notes } = parseNotes(SAMPLE_INPUT);
    expect(filterNotes(notes, "", "")).toHaveLength(notes.length);
  });
});

describe("study-notes-organizer sortByDate", () => {
  it("sorts newest first", () => {
    const { notes } = parseNotes(SAMPLE_INPUT);
    const sorted = sortByDate(notes, "newest" as SortOrder);
    expect(sorted[0].date).toBe("2024-09-15");
    expect(sorted[sorted.length - 1].date).toBe("2024-09-10");
  });
  it("sorts oldest first", () => {
    const { notes } = parseNotes(SAMPLE_INPUT);
    const sorted = sortByDate(notes, "oldest" as SortOrder);
    expect(sorted[0].date).toBe("2024-09-10");
  });
  it("places empty dates last in newest order", () => {
    const notes = [makeNote({ date: "" }), makeNote({ date: "2024-01-01", title: "WithDate" })];
    const sorted = sortByDate(notes, "newest" as SortOrder);
    expect(sorted[0].title).toBe("WithDate");
  });
});

describe("study-notes-organizer computeCounts", () => {
  it("computes counts correctly", () => {
    const { notes } = parseNotes(SAMPLE_INPUT);
    const c = computeCounts(notes);
    expect(c.total).toBe(5);
    expect(c.bySubject["Biology"]).toBe(3);
    expect(c.bySubject["Math"]).toBe(2);
    expect(c.byTag["bio"]).toBe(3);
    expect(c.byTag["important"]).toBe(2);
    expect(c.totalWords).toBeGreaterThan(0);
  });
  it("computes byTopic with subject|topic key", () => {
    const { notes } = parseNotes(SAMPLE_INPUT);
    const c = computeCounts(notes);
    expect(c.byTopic["Biology|Cells"]).toBe(2);
    expect(c.byTopic["Biology|Genetics"]).toBe(1);
  });
  it("returns zero total for empty input", () => {
    const c = computeCounts([]);
    expect(c.total).toBe(0);
    expect(c.totalWords).toBe(0);
  });
});

describe("study-notes-organizer generateTagCloud", () => {
  it("returns top N tags by frequency", () => {
    const { notes } = parseNotes(SAMPLE_INPUT);
    const cloud = generateTagCloud(notes, 5);
    expect(cloud.length).toBeLessThanOrEqual(5);
    expect(cloud[0].count).toBeGreaterThanOrEqual(cloud[cloud.length - 1].count);
  });
  it("respects default limit of 10", () => {
    const notes: StudyNote[] = Array.from({ length: 15 }, (_, i) =>
      makeNote({ tags: [`tag${i}`] }),
    );
    const cloud = generateTagCloud(notes);
    expect(cloud).toHaveLength(10);
  });
  it("returns empty for empty input", () => {
    expect(generateTagCloud([])).toEqual([]);
  });
});

describe("study-notes-organizer findDuplicates", () => {
  it("finds duplicates by subject + title (case-insensitive)", () => {
    const { notes } = parseNotes(SAMPLE_INPUT_DUPS);
    const dups = findDuplicates(notes);
    expect(dups).toHaveLength(1);
    expect(dups[0].count).toBe(2);
  });
  it("returns empty when no duplicates", () => {
    const { notes } = parseNotes(SAMPLE_INPUT);
    expect(findDuplicates(notes)).toEqual([]);
  });
});

describe("study-notes-organizer renderText", () => {
  it("renders grouped output", () => {
    const { notes } = parseNotes(SAMPLE_INPUT);
    const text = renderText(notes);
    expect(text).toContain("=== Biology (3) ===");
    expect(text).toContain("-- Cells (2) --");
    expect(text).toContain("• Mitochondria");
  });
  it("returns empty string for empty input", () => {
    expect(renderText([])).toBe("");
  });
});

describe("study-notes-organizer renderHtml", () => {
  it("renders HTML with TOC and notes", () => {
    const { notes } = parseNotes(SAMPLE_INPUT);
    const html = renderHtml(notes);
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("<title>Study Notes</title>");
    expect(html).toContain('href="#subject-biology"');
    expect(html).toContain("Mitochondria");
    expect(html).toContain("<div class=\"note\">");
  });
  it("renders empty state", () => {
    expect(renderHtml([])).toContain("No notes.");
  });
});

describe("study-notes-organizer renderMarkdown", () => {
  it("renders markdown headers", () => {
    const { notes } = parseNotes(SAMPLE_INPUT);
    const md = renderMarkdown(notes);
    expect(md).toContain("# Study Notes");
    expect(md).toContain("## Biology (3)");
    expect(md).toContain("### Cells");
    expect(md).toContain("#### Mitochondria");
    expect(md).toContain("`bio`");
  });
  it("returns empty for empty input", () => {
    expect(renderMarkdown([])).toBe("");
  });
});

describe("study-notes-organizer renderCsv", () => {
  it("renders header + rows", () => {
    const { notes } = parseNotes(SAMPLE_INPUT);
    const csv = renderCsv(notes);
    expect(csv).toContain("subject,topic,title,content,tags,date");
    expect(csv).toContain("Biology,Cells,Mitochondria");
  });
  it("escapes fields containing commas", () => {
    const note = makeNote({ content: "has, comma" });
    const csv = renderCsv([note]);
    expect(csv).toContain('"has, comma"');
  });
});

describe("study-notes-organizer renderJson", () => {
  it("renders valid JSON", () => {
    const { notes } = parseNotes(SAMPLE_INPUT);
    const json = renderJson(notes);
    const parsed = JSON.parse(json);
    expect(parsed.totalNotes).toBe(5);
    expect(parsed.subjects).toHaveLength(2);
    expect(parsed.subjects[0].subject).toBe("Biology");
    expect(parsed.subjects[0].topics[0].notes[0].title).toBe("Mitochondria");
  });
});

describe("study-notes-organizer history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, noteCount: 5, subjectCount: 2, preview: "..." });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, noteCount: i, subjectCount: 1, preview: String(i) });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, noteCount: 5, subjectCount: 2, preview: "..." });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("study-notes-organizer shareable URL", () => {
  it("builds share URL with encoded notes", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(SAMPLE_INPUT);
    expect(url).toContain("n=");
    expect(url.length).toBeGreaterThan(20);
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("returns empty string for empty input", () => {
    expect(buildShareUrl("")).toBe("");
  });
  it("round-trips through parseShareUrl", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(SAMPLE_INPUT);
    const hash = url.substring(url.indexOf("#") + 1);
    const { notes, raw } = parseShareUrl(hash);
    expect(notes).toHaveLength(5);
    expect(notes[0].title).toBe("Mitochondria");
    expect(raw).toContain("Biology|Cells|Mitochondria");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("limits to MAX_SHARE_NOTES when encoding", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const manyNotes = Array.from(
      { length: 60 },
      (_, i) => `Sub${i % 5}|Top${i % 3}|Title ${i}|Content ${i}|tag${i % 7}|2024-09-0${(i % 9) + 1}`,
    ).join("\n");
    const url = buildShareUrl(manyNotes);
    const hash = url.substring(url.indexOf("#") + 1);
    const { notes } = parseShareUrl(hash);
    expect(notes).toHaveLength(MAX_SHARE_NOTES);
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ notes: [], raw: "" });
  });
});

describe("study-notes-organizer extra features integration", () => {
  it("end-to-end: parse → group → search → render", () => {
    const { notes } = parseNotes(SAMPLE_INPUT);
    const searched = searchNotes(notes, "DNA");
    const md = renderMarkdown(searched);
    expect(md).toContain("DNA");
  });
  it("end-to-end: parse → filter → tag cloud", () => {
    const { notes } = parseNotes(SAMPLE_INPUT);
    const filtered = filterNotes(notes, "biology", "");
    const cloud = generateTagCloud(filtered);
    expect(cloud.some((t) => t.tag === "bio")).toBe(true);
  });
});

// Suppress unused-import lint
export type _Unused = SortOrder;
