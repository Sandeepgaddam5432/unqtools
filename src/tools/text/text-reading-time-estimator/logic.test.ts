/**
 * Reading Time Estimator — unit tests.
 */
import { describe, it, expect } from "vitest";
import {
  estimateReadingTime,
  estimateReadingTimeBatch,
  tokenizeWords,
  countSentences,
  countParagraphs,
  countSyllables,
  formatDuration,
  fleschReadingEase,
  fleschKincaidGrade,
  readingEaseLabel,
  toCsv,
  toJson,
  sampleText,
} from "./logic";

const SAMPLE = sampleText();

describe("tokenizeWords", () => {
  it("splits Latin text", () => {
    expect(tokenizeWords("Hello world!")).toEqual(["Hello", "world"]);
  });
  it("handles CJK characters", () => {
    const t = tokenizeWords("你好世界 hello");
    // Each CJK character counts as one word (no spaces in CJK)
    expect(t).toContain("你");
    expect(t).toContain("好");
    expect(t).toContain("世");
    expect(t).toContain("界");
    expect(t).toContain("hello");
    expect(t.length).toBe(5);
  });
  it("returns [] for empty input", () => {
    expect(tokenizeWords("")).toEqual([]);
  });
});

describe("countSentences", () => {
  it("counts . ! ? terminators", () => {
    expect(countSentences("Hi. How are you? I am fine!")).toBe(3);
  });
  it("returns 0 for empty", () => {
    expect(countSentences("")).toBe(0);
  });
  it("returns 1 for unterminated text", () => {
    expect(countSentences("just some words")).toBe(1);
  });
});

describe("countParagraphs", () => {
  it("splits on double newlines", () => {
    expect(countParagraphs("Para one.\n\nPara two.\n\nPara three.")).toBe(3);
  });
  it("returns 0 for empty", () => {
    expect(countParagraphs("")).toBe(0);
  });
  it("returns 1 for single paragraph", () => {
    expect(countParagraphs("Just one paragraph here.")).toBe(1);
  });
});

describe("countSyllables", () => {
  it("counts simple words", () => {
    expect(countSyllables("hello")).toBe(2);
    expect(countSyllables("world")).toBe(1);
    expect(countSyllables("apple")).toBe(2);
  });
  it("returns 0 for empty", () => {
    expect(countSyllables("")).toBe(0);
  });
  it("handles short words", () => {
    expect(countSyllables("a")).toBe(1);
    expect(countSyllables("the")).toBe(1);
  });
});

describe("formatDuration", () => {
  it("formats seconds only when < 60", () => {
    expect(formatDuration(45)).toBe("45s");
  });
  it("formats minutes and seconds", () => {
    expect(formatDuration(125)).toBe("2m 5s");
  });
  it("formats whole minutes", () => {
    expect(formatDuration(120)).toBe("2m");
  });
  it("formats hours and minutes", () => {
    expect(formatDuration(3725)).toBe("1h 2m");
  });
  it("returns 0s for invalid", () => {
    expect(formatDuration(-1)).toBe("0s");
    expect(formatDuration(NaN)).toBe("0s");
  });
});

describe("fleschReadingEase & grade", () => {
  it("returns 0 for empty input", () => {
    expect(fleschReadingEase([], 0)).toBe(0);
    expect(fleschKincaidGrade([], 0)).toBe(0);
  });
  it("computes a positive score for simple text", () => {
    const words = tokenizeWords("The cat sat on the mat. The dog ran fast.");
    const s = countSentences("The cat sat on the mat. The dog ran fast.");
    const ease = fleschReadingEase(words, s);
    expect(ease).toBeGreaterThan(0);
    const grade = fleschKincaidGrade(words, s);
    expect(grade).toBeGreaterThan(-20);
    expect(grade).toBeLessThan(20);
  });
});

describe("readingEaseLabel", () => {
  it("returns very easy for 90+", () => {
    expect(readingEaseLabel(95)).toContain("Very easy");
  });
  it("returns very difficult for < 30", () => {
    expect(readingEaseLabel(10)).toContain("Very difficult");
  });
  it("returns standard for 60-70", () => {
    expect(readingEaseLabel(65)).toContain("Standard");
  });
});

describe("estimateReadingTime — validation", () => {
  it("errors on empty text", () => {
    expect("error" in estimateReadingTime("")).toBe(true);
  });
  it("errors on whitespace-only text", () => {
    expect("error" in estimateReadingTime("   \n\t  ")).toBe(true);
  });
});

describe("estimateReadingTime — basic metrics", () => {
  it("counts words", () => {
    const r = estimateReadingTime(SAMPLE);
    if ("error" in r) throw new Error("err");
    expect(r.words).toBeGreaterThan(0);
  });
  it("counts characters and charactersNoSpaces", () => {
    const r = estimateReadingTime("Hello world");
    if ("error" in r) throw new Error("err");
    expect(r.characters).toBe(11);
    expect(r.charactersNoSpaces).toBe(10);
  });
  it("counts sentences and paragraphs", () => {
    const r = estimateReadingTime(SAMPLE);
    if ("error" in r) throw new Error("err");
    expect(r.sentences).toBeGreaterThan(0);
    expect(r.paragraphs).toBeGreaterThanOrEqual(3);
  });
});

describe("estimateReadingTime — times", () => {
  it("default reading WPM = 200", () => {
    const text = "word ".repeat(400).trim();
    const r = estimateReadingTime(text);
    if ("error" in r) throw new Error("err");
    // 400 words / 200 WPM = 2 minutes = 120 seconds
    expect(r.readingTimeSeconds).toBeCloseTo(120, 1);
    expect(r.readingTimeFormatted).toBe("2m");
  });
  it("default speaking WPM = 130", () => {
    const text = "word ".repeat(260).trim();
    const r = estimateReadingTime(text);
    if ("error" in r) throw new Error("err");
    // 260 words / 130 WPM = 2 minutes = 120 seconds
    expect(r.speakingTimeSeconds).toBeCloseTo(120, 1);
  });
  it("default scanning WPM = 700", () => {
    const text = "word ".repeat(700).trim();
    const r = estimateReadingTime(text);
    if ("error" in r) throw new Error("err");
    expect(r.scanningTimeSeconds).toBeCloseTo(60, 1);
  });
  it("respects custom readingWpm", () => {
    const text = "word ".repeat(400).trim();
    const r = estimateReadingTime(text, { readingWpm: 400 });
    if ("error" in r) throw new Error("err");
    // 400 words / 400 WPM = 1 minute = 60 seconds
    expect(r.readingTimeSeconds).toBeCloseTo(60, 1);
  });
});

describe("estimateReadingTime — slides & pages", () => {
  it("computes slides with default 60 words/slide", () => {
    const text = "word ".repeat(180).trim();
    const r = estimateReadingTime(text);
    if ("error" in r) throw new Error("err");
    expect(r.slides).toBe(3);
  });
  it("respects custom wordsPerSlide", () => {
    const text = "word ".repeat(200).trim();
    const r = estimateReadingTime(text, { wordsPerSlide: 100 });
    if ("error" in r) throw new Error("err");
    expect(r.slides).toBe(2);
  });
  it("computes pages with default 300 words/page", () => {
    const text = "word ".repeat(900).trim();
    const r = estimateReadingTime(text);
    if ("error" in r) throw new Error("err");
    expect(r.pages).toBe(3);
  });
});

describe("estimateReadingTime — reading level", () => {
  it("computes reading ease and grade", () => {
    const r = estimateReadingTime(SAMPLE);
    if ("error" in r) throw new Error("err");
    expect(r.readingEase).toBeGreaterThan(-50);
    expect(r.readingEase).toBeLessThan(150);
    expect(r.gradeLevel).toBeGreaterThan(-5);
    expect(r.readingEaseLabel.length).toBeGreaterThan(0);
  });
});

describe("estimateReadingTime — warnings", () => {
  it("warns on very short text", () => {
    const r = estimateReadingTime("Hi there.");
    if ("error" in r) throw new Error("err");
    expect(r.warnings.some((w) => w.includes("Only"))).toBe(true);
  });
  it("warns on low reading WPM", () => {
    const r = estimateReadingTime(SAMPLE, { readingWpm: 75 });
    if ("error" in r) throw new Error("err");
    expect(r.warnings.some((w) => w.includes("below average"))).toBe(true);
  });
  it("warns on very high reading WPM", () => {
    const r = estimateReadingTime(SAMPLE, { readingWpm: 500 });
    if ("error" in r) throw new Error("err");
    expect(r.warnings.some((w) => w.includes("unusually high"))).toBe(true);
  });
});

describe("estimateReadingTime — cost to read", () => {
  it("computes cost when hourlyRate is provided", () => {
    const text = "word ".repeat(200).trim(); // 1 minute at 200 wpm
    const r = estimateReadingTime(text, { hourlyRate: 60 });
    if ("error" in r) throw new Error("err");
    expect(r.costToRead).toBeDefined();
    // 60 seconds / 3600 * 60 = 1
    expect(r.costToRead).toBeCloseTo(1, 1);
  });
  it("omits cost when hourlyRate is not provided", () => {
    const r = estimateReadingTime(SAMPLE);
    if ("error" in r) throw new Error("err");
    expect(r.costToRead).toBeUndefined();
  });
});

describe("estimateReadingTimeBatch", () => {
  it("sums metrics across documents", () => {
    const docs = ["word ".repeat(100).trim(), "word ".repeat(200).trim(), "word ".repeat(300).trim()];
    const batch = estimateReadingTimeBatch(docs);
    expect(batch.results.length).toBe(3);
    expect(batch.totals.words).toBe(600);
  });
  it("records warnings for empty docs", () => {
    const batch = estimateReadingTimeBatch(["", SAMPLE]);
    expect(batch.warnings.some((w) => w.includes("Doc 1"))).toBe(true);
    expect(batch.results.length).toBe(1);
  });
  it("formats totals", () => {
    const batch = estimateReadingTimeBatch([SAMPLE, SAMPLE]);
    expect(batch.totals.readingTimeFormatted.length).toBeGreaterThan(0);
    expect(batch.totals.speakingTimeFormatted.length).toBeGreaterThan(0);
  });
});

describe("exporters", () => {
  it("toCsv has metric/value rows", () => {
    const r = estimateReadingTime(SAMPLE);
    if ("error" in r) throw new Error("err");
    const csv = toCsv(r);
    expect(csv.split("\n")[0]).toBe("Metric,Value");
    expect(csv).toContain("Words");
    expect(csv).toContain("ReadingTimeFormatted");
  });
  it("toJson parses with expected fields", () => {
    const r = estimateReadingTime(SAMPLE);
    if ("error" in r) throw new Error("err");
    const json = JSON.parse(toJson(r));
    expect(json.words).toBeGreaterThan(0);
    expect(json.readingTimeFormatted).toBeDefined();
    expect(json.readingEaseLabel).toBeDefined();
  });
});

describe("sampleText", () => {
  it("returns a multi-paragraph text", () => {
    const s = sampleText();
    expect(s.length).toBeGreaterThan(100);
    expect(countParagraphs(s)).toBeGreaterThanOrEqual(3);
  });
});
