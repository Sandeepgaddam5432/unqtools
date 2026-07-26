/**
 * Audiobook Player Reference — unit tests.
 */
import { describe, it, expect } from "vitest";
import {
  analyzeAudiobook,
  formatDuration,
  bookmarksToCsv,
  sampleAudiobook,
  type Audiobook,
} from "./logic";

const book: Audiobook = {
  title: "Test Book",
  author: "Author",
  chapters: [
    { index: 1, title: "Intro", durationSec: 600 },
    { index: 2, title: "Ch 1", durationSec: 1200 },
    { index: 3, title: "Ch 2", durationSec: 1800 },
  ],
};

describe("formatDuration", () => {
  it("formats seconds-only", () => {
    expect(formatDuration(45)).toBe("45s");
  });
  it("formats minutes and seconds", () => {
    expect(formatDuration(125)).toBe("2m 5s");
  });
  it("formats hours, minutes, seconds", () => {
    expect(formatDuration(3725)).toBe("1h 2m 5s");
  });
  it("handles zero", () => {
    expect(formatDuration(0)).toBe("0s");
  });
});

describe("analyzeAudiobook — validation", () => {
  it("errors on empty chapter list", () => {
    expect("error" in analyzeAudiobook({ title: "x", author: "y", chapters: [] })).toBe(true);
  });
  it("errors on zero total duration", () => {
    expect("error" in analyzeAudiobook({ title: "x", author: "y", chapters: [{ index: 1, title: "c", durationSec: 0 }] })).toBe(true);
  });
});

describe("analyzeAudiobook — speed rows", () => {
  it("returns 6 speed rows", () => {
    const r = analyzeAudiobook(book);
    if ("error" in r) throw new Error("should not error");
    expect(r.speeds.length).toBe(6);
  });
  it("2× speed halves listening time", () => {
    const r = analyzeAudiobook(book);
    if ("error" in r) throw new Error("should not error");
    const two = r.speeds.find((s) => s.speed === 2)!;
    const one = r.speeds.find((s) => s.speed === 1)!;
    expect(two.totalListeningMin).toBeCloseTo(one.totalListeningMin / 2, 0);
  });
  it("0.75× speed increases listening time", () => {
    const r = analyzeAudiobook(book);
    if ("error" in r) throw new Error("should not error");
    const slow = r.speeds.find((s) => s.speed === 0.75)!;
    const one = r.speeds.find((s) => s.speed === 1)!;
    expect(slow.totalListeningMin).toBeGreaterThan(one.totalListeningMin);
  });
});

describe("analyzeAudiobook — recommended speed", () => {
  it("picks 1× for short books", () => {
    const short: Audiobook = { title: "x", author: "y", chapters: [{ index: 1, title: "a", durationSec: 3600 }] };
    const r = analyzeAudiobook(short);
    if ("error" in r) throw new Error("should not error");
    expect(r.recommendedSpeed).toBe(1);
  });
  it("picks 1.75× for very long books", () => {
    const long: Audiobook = {
      title: "x", author: "y",
      chapters: Array.from({ length: 20 }, (_, i) => ({ index: i + 1, title: `c${i}`, durationSec: 3600 })),
    };
    const r = analyzeAudiobook(long);
    if ("error" in r) throw new Error("should not error");
    expect(r.recommendedSpeed).toBe(1.75);
    expect(r.warnings.some((w) => w.includes("comprehension"))).toBe(true);
  });
});

describe("analyzeAudiobook — bookmarks & resume", () => {
  it("generates one bookmark per chapter", () => {
    const r = analyzeAudiobook(book);
    if ("error" in r) throw new Error("should not error");
    expect(r.bookmarks.length).toBe(book.chapters.length);
    expect(r.bookmarks[0]!.id).toBe("bm-001");
  });
  it("resume point serialises to URL-like format", () => {
    const r = analyzeAudiobook(book, { resumeAtSec: 700 });
    if ("error" in r) throw new Error("should not error");
    // 700s falls in chapter 2 (which starts at 600s)
    expect(r.resumePoint.chapter).toBe(2);
    expect(r.resumePoint.offsetSec).toBe(100);
    expect(r.resumePoint.serialised).toContain("resume://");
    expect(r.resumePoint.serialised).toContain("chapter=2");
  });
  it("warns when resume point is past end", () => {
    const r = analyzeAudiobook(book, { resumeAtSec: 99999 });
    if ("error" in r) throw new Error("should not error");
    expect(r.warnings.some((w) => w.includes("past the end"))).toBe(true);
  });
});

describe("analyzeAudiobook — session plan", () => {
  it("plans which chapter a 10-min session reaches", () => {
    const r = analyzeAudiobook(book, { sessionMinutes: 10, recommendedSpeed: 1 });
    if ("error" in r) throw new Error("should not error");
    expect(r.sessionPlan.reachableChapter).toBeGreaterThanOrEqual(1);
  });
});

describe("exports", () => {
  it("bookmarksToCsv produces header + rows", () => {
    const csv = bookmarksToCsv(book);
    const lines = csv.split("\n");
    expect(lines[0]).toContain("Chapter");
    expect(lines.length).toBe(book.chapters.length + 1);
  });
  it("sampleAudiobook returns a usable book", () => {
    const s = sampleAudiobook();
    expect(s.chapters.length).toBeGreaterThan(0);
    expect(s.title.length).toBeGreaterThan(0);
  });
});
