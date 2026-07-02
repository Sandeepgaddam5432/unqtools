/**
 * Word & Character Counter — unit tests.
 */
import { describe, it, expect } from "vitest";
import {
  countText,
  segmentWords,
  segmentSentences,
  countSmsSegments,
  computeReadingTime,
  computeSpeakingTime,
  getPlatformLimits,
  keywordDensity,
  WORKER_THRESHOLD_BYTES,
} from "./logic";

describe("countText — basics", () => {
  it("returns all-zero stats for empty input", () => {
    const s = countText("");
    expect(s.words).toBe(0);
    expect(s.charactersNoSpaces).toBe(0);
    expect(s.lines).toBe(0);
    expect(s.paragraphs).toBe(0);
  });

  it("counts simple ASCII words", () => {
    const s = countText("hello world foo");
    expect(s.words).toBe(3);
    expect(s.graphemes).toBe(15);
    expect(s.charactersNoSpaces).toBe(13);
  });

  it("counts lines correctly", () => {
    expect(countText("line1\nline2\nline3").lines).toBe(3);
    expect(countText("single line").lines).toBe(1);
  });

  it("counts paragraphs by blank-line separation", () => {
    expect(countText("para one\n\npara two\n\n\npara three").paragraphs).toBe(3);
  });
});

describe("countText — Unicode correctness", () => {
  it("counts emoji ZWJ family as 1 grapheme", () => {
    // 👨‍👩‍👧‍👦 = man + ZWJ + woman + ZWJ + girl + ZWJ + boy = 7 code points, 11 UTF-16 code units
    const s = countText("👨‍👩‍👧‍👦");
    expect(s.graphemes).toBe(1);
    // Should NOT equal codeUnits (that's the whole point)
    expect(s.codeUnits).toBeGreaterThan(s.graphemes);
  });

  it("counts flag emoji as 1 grapheme", () => {
    // 🇮🇳 = regional indicator IN + regional indicator IN = 2 code points / 2 code units
    const s = countText("🇮🇳");
    expect(s.graphemes).toBe(1);
  });

  it("counts skin-tone modifier emoji as 1 grapheme", () => {
    // 👍🏽 = thumbs up + skin tone modifier = 2 code points / 2 code units
    const s = countText("👍🏽");
    expect(s.graphemes).toBe(1);
  });

  it("handles CJK characters correctly", () => {
    const s = countText("你好世界");
    expect(s.graphemes).toBe(4);
  });

  it("counts UTF-8 bytes correctly for multibyte chars", () => {
    const s = countText("你"); // 3 bytes in UTF-8
    expect(s.utf8Bytes).toBe(3);
  });

  it("counts code points correctly for emoji", () => {
    const s = countText("👍"); // single code point
    expect(s.codePoints).toBe(1);
  });
});

describe("segmentWords", () => {
  it("returns empty array for empty input", () => {
    expect(segmentWords("")).toEqual([]);
  });

  it("returns empty array for whitespace-only input", () => {
    expect(segmentWords("   \n\t  ")).toEqual([]);
  });

  it("splits simple English text", () => {
    expect(segmentWords("Hello, world!")).toEqual(["Hello", "world"]);
  });

  it("handles contractions as single words", () => {
    const words = segmentWords("don't can't won't");
    expect(words).toContain("don't");
    expect(words).toContain("can't");
    expect(words).toContain("won't");
  });
});

describe("segmentSentences", () => {
  it("returns empty array for empty input", () => {
    expect(segmentSentences("")).toEqual([]);
  });

  it("splits on . ! ?", () => {
    const s = segmentSentences("Hello world. How are you? I am fine!");
    expect(s.length).toBe(3);
  });

  it("handles single sentence without terminal punctuation", () => {
    const s = segmentSentences("just one sentence");
    expect(s.length).toBe(1);
  });
});

describe("countSmsSegments", () => {
  it("returns 0 segments for empty input", () => {
    expect(countSmsSegments("").segments).toBe(0);
  });

  it("single GSM-7 segment under 160 chars", () => {
    const r = countSmsSegments("Hello world");
    expect(r.encoding).toBe("GSM-7");
    expect(r.segments).toBe(1);
    expect(r.charsPerSegment).toBe(160);
  });

  it("multi-segment GSM-7 (over 160 chars)", () => {
    const r = countSmsSegments("a".repeat(200));
    expect(r.encoding).toBe("GSM-7");
    expect(r.segments).toBe(2);
    expect(r.charsPerSegment).toBe(153);
  });

  it("UCS-2 encoding when emoji present", () => {
    const r = countSmsSegments("Hello 🌍");
    expect(r.encoding).toBe("UCS-2");
    expect(r.segments).toBe(1);
  });

  it("multi-segment UCS-2 (over 70 chars)", () => {
    // Use a BMP char (1 UTF-16 code unit each). 80 such chars = 80 UCS-2 code units.
    const r = countSmsSegments("á".repeat(80));
    expect(r.encoding).toBe("UCS-2");
    expect(r.segments).toBe(2);
    expect(r.charsPerSegment).toBe(67);
  });

  it("non-BMP emoji counts as 2 UCS-2 code units (surrogate pair)", () => {
    // 🌍 is U+1F30D, encoded as 2 UTF-16 code units (surrogate pair)
    // In UCS-2 SMS encoding, each surrogate half = 2 bytes, so 1 emoji = 4 bytes = 2 "chars"
    const r = countSmsSegments("🌍".repeat(40)); // 40 emoji × 2 = 80 code units → 2 segments
    expect(r.encoding).toBe("UCS-2");
    expect(r.segments).toBe(2);
  });

  it("extended GSM-7 chars (€, {, }) count as 2 septets each", () => {
    // € is in the extended table — 1 char, 2 septets cost
    const r = countSmsSegments("€");
    expect(r.encoding).toBe("GSM-7");
    expect(r.remainingInSegment).toBe(158); // 160 - 2
  });
});

describe("computeReadingTime / computeSpeakingTime", () => {
  it("returns 0:00 for 0 words", () => {
    expect(computeReadingTime(0)).toEqual({ minutes: 0, seconds: 0 });
    expect(computeSpeakingTime(0)).toEqual({ minutes: 0, seconds: 0 });
  });

  it("reading time at 225 wpm", () => {
    // 225 words = 1 minute exactly
    expect(computeReadingTime(225)).toEqual({ minutes: 1, seconds: 0 });
  });

  it("speaking time at 130 wpm", () => {
    expect(computeSpeakingTime(130)).toEqual({ minutes: 1, seconds: 0 });
  });
});

describe("getPlatformLimits", () => {
  it("returns all platforms with correct remaining counts", () => {
    const limits = getPlatformLimits(50, 10);
    expect(limits.length).toBeGreaterThan(4);
    const twitter = limits.find((l) => l.id === "twitter");
    expect(twitter?.remaining).toBe(230);
    expect(twitter?.over).toBe(false);
  });

  it("marks over-limit platforms correctly", () => {
    const limits = getPlatformLimits(300, 50);
    const twitter = limits.find((l) => l.id === "twitter");
    expect(twitter?.over).toBe(true);
    expect(twitter?.remaining).toBe(-20);
  });
});

describe("keywordDensity", () => {
  it("returns empty array for empty input", () => {
    expect(keywordDensity("")).toEqual([]);
  });

  it("counts word frequency correctly", () => {
    const r = keywordDensity("the cat sat on the mat the cat");
    const cat = r.find((k) => k.word === "cat");
    expect(cat?.count).toBe(2);
  });

  it("excludes stopwords by default", () => {
    const r = keywordDensity("the the the hello world");
    const the = r.find((k) => k.word === "the");
    expect(the).toBeUndefined();
  });

  it("includes stopwords when excludeStopwords=false", () => {
    const r = keywordDensity("the the the hello world", { excludeStopwords: false });
    const the = r.find((k) => k.word === "the");
    expect(the?.count).toBe(3);
  });

  it("respects topN limit", () => {
    const r = keywordDensity("a b c d e f g h i j k l m n o p", { topN: 5 });
    expect(r.length).toBe(5);
  });
});

describe("WORKER_THRESHOLD_BYTES", () => {
  it("is exactly 100KB", () => {
    expect(WORKER_THRESHOLD_BYTES).toBe(100 * 1024);
  });
});
