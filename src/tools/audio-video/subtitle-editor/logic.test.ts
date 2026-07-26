import { describe, it, expect } from "vitest";
import {
  parseTimestamp, formatTimestamp, detectFormat, parseSubtitles,
  serializeSubtitles, convertFormat, shiftTime, scaleTime, renumber,
  searchCues, replaceText, filterByTimeRange, validateCues, formatDuration,
  totalDuration,
} from "./logic";

describe("parseTimestamp", () => {
  it("parses SRT format", () => {
    expect(parseTimestamp("00:01:30,500")).toBe(90500);
  });
  it("parses VTT format", () => {
    expect(parseTimestamp("00:01:30.500")).toBe(90500);
  });
  it("parses without hours", () => {
    expect(parseTimestamp("01:30.500")).toBe(90500);
  });
  it("returns 0 for invalid", () => {
    expect(parseTimestamp("garbage")).toBe(0);
  });
});

describe("formatTimestamp", () => {
  it("formats SRT", () => {
    expect(formatTimestamp(90500, "srt")).toBe("00:01:30,500");
  });
  it("formats VTT", () => {
    expect(formatTimestamp(90500, "vtt")).toBe("00:01:30.500");
  });
  it("clamps negatives", () => {
    expect(formatTimestamp(-100, "srt")).toBe("00:00:00,000");
  });
});

describe("detectFormat", () => {
  it("detects VTT from WEBVTT header", () => {
    expect(detectFormat("WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHello")).toBe("vtt");
  });
  it("defaults to SRT", () => {
    expect(detectFormat("1\n00:00:01,000 --> 00:00:02,000\nHello")).toBe("srt");
  });
});

describe("parseSubtitles", () => {
  it("parses SRT", () => {
    const srt = "1\n00:00:01,000 --> 00:00:02,000\nHello\n\n2\n00:00:03,000 --> 00:00:04,000\nWorld\n";
    const r = parseSubtitles(srt);
    expect(r.cues.length).toBe(2);
    expect(r.cues[0].text).toBe("Hello");
    expect(r.cues[1].startTimeMs).toBe(3000);
  });
  it("parses VTT", () => {
    const vtt = "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHello\n";
    const r = parseSubtitles(vtt);
    expect(r.format).toBe("vtt");
    expect(r.cues.length).toBe(1);
  });
  it("handles multi-line text", () => {
    const srt = "1\n00:00:01,000 --> 00:00:02,000\nLine 1\nLine 2\n";
    const r = parseSubtitles(srt);
    expect(r.cues[0].text).toBe("Line 1\nLine 2");
  });
  it("collects warnings for malformed cues", () => {
    const srt = "1\nbad timestamp\nHello\n";
    const r = parseSubtitles(srt);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

describe("serializeSubtitles", () => {
  it("round-trips SRT", () => {
    const cues = [{ index: 1, startTimeMs: 1000, endTimeMs: 2000, text: "Hi" }];
    const out = serializeSubtitles(cues, "srt");
    expect(out).toContain("1");
    expect(out).toContain("00:00:01,000 --> 00:00:02,000");
    expect(out).toContain("Hi");
  });
  it("round-trips VTT", () => {
    const cues = [{ index: 1, startTimeMs: 1000, endTimeMs: 2000, text: "Hi" }];
    const out = serializeSubtitles(cues, "vtt");
    expect(out).toContain("WEBVTT");
    expect(out).toContain("00:00:01.000 --> 00:00:02.000");
  });
});

describe("convertFormat", () => {
  it("converts SRT to VTT", () => {
    const srt = "1\n00:00:01,000 --> 00:00:02,000\nHello\n";
    const vtt = convertFormat(srt, "vtt");
    expect(vtt.startsWith("WEBVTT")).toBe(true);
    expect(vtt).toContain("00:00:01.000");
  });
});

describe("shiftTime", () => {
  it("shifts later", () => {
    const cues = [{ index: 1, startTimeMs: 1000, endTimeMs: 2000, text: "x" }];
    const shifted = shiftTime(cues, 500);
    expect(shifted[0].startTimeMs).toBe(1500);
    expect(shifted[0].endTimeMs).toBe(2500);
  });
  it("clamps to 0", () => {
    const cues = [{ index: 1, startTimeMs: 100, endTimeMs: 200, text: "x" }];
    const shifted = shiftTime(cues, -500);
    expect(shifted[0].startTimeMs).toBe(0);
  });
});

describe("scaleTime", () => {
  it("scales by factor", () => {
    const cues = [{ index: 1, startTimeMs: 1000, endTimeMs: 2000, text: "x" }];
    const scaled = scaleTime(cues, 2);
    expect(scaled[0].startTimeMs).toBe(2000);
    expect(scaled[0].endTimeMs).toBe(4000);
  });
});

describe("renumber", () => {
  it("renumbers from 1", () => {
    const cues = [
      { index: 5, startTimeMs: 0, endTimeMs: 100, text: "a" },
      { index: 9, startTimeMs: 100, endTimeMs: 200, text: "b" },
    ];
    const r = renumber(cues);
    expect(r[0].index).toBe(1);
    expect(r[1].index).toBe(2);
  });
});

describe("searchCues", () => {
  it("finds matches", () => {
    const cues = [
      { index: 1, startTimeMs: 0, endTimeMs: 100, text: "Hello world" },
      { index: 2, startTimeMs: 100, endTimeMs: 200, text: "Goodbye" },
    ];
    expect(searchCues(cues, "hello")).toEqual([1]);
  });
  it("returns empty for no match", () => {
    const cues = [{ index: 1, startTimeMs: 0, endTimeMs: 100, text: "Hello" }];
    expect(searchCues(cues, "missing")).toEqual([]);
  });
});

describe("replaceText", () => {
  it("replaces text", () => {
    const cues = [{ index: 1, startTimeMs: 0, endTimeMs: 100, text: "Hello world" }];
    const r = replaceText(cues, "world", "earth");
    expect(r[0].text).toBe("Hello earth");
  });
  it("is case-insensitive by default", () => {
    const cues = [{ index: 1, startTimeMs: 0, endTimeMs: 100, text: "Hello HELLO" }];
    const r = replaceText(cues, "hello", "hi");
    expect(r[0].text).toBe("hi hi");
  });
});

describe("filterByTimeRange", () => {
  it("filters cues", () => {
    const cues = [
      { index: 1, startTimeMs: 0, endTimeMs: 100, text: "a" },
      { index: 2, startTimeMs: 200, endTimeMs: 300, text: "b" },
      { index: 3, startTimeMs: 400, endTimeMs: 500, text: "c" },
    ];
    expect(filterByTimeRange(cues, 100, 350).length).toBe(1);
  });
});

describe("validateCues", () => {
  it("flags zero duration", () => {
    const cues = [{ index: 1, startTimeMs: 100, endTimeMs: 100, text: "x" }];
    const r = validateCues(cues);
    expect(r.ok).toBe(false);
    expect(r.issues.length).toBe(1);
  });
  it("flags overlaps", () => {
    const cues = [
      { index: 1, startTimeMs: 0, endTimeMs: 200, text: "a" },
      { index: 2, startTimeMs: 100, endTimeMs: 300, text: "b" },
    ];
    const r = validateCues(cues);
    expect(r.issues.length).toBeGreaterThan(0);
  });
  it("passes valid cues", () => {
    const cues = [
      { index: 1, startTimeMs: 0, endTimeMs: 100, text: "a" },
      { index: 2, startTimeMs: 200, endTimeMs: 300, text: "b" },
    ];
    expect(validateCues(cues).ok).toBe(true);
  });
});

describe("formatDuration & totalDuration", () => {
  it("formats", () => {
    expect(formatDuration(90500)).toBe("01:30.500");
  });
  it("total duration", () => {
    const cues = [
      { index: 1, startTimeMs: 1000, endTimeMs: 2000, text: "a" },
      { index: 2, startTimeMs: 3000, endTimeMs: 4000, text: "b" },
    ];
    expect(totalDuration(cues)).toBe(3000);
  });
  it("0 for empty", () => {
    expect(totalDuration([])).toBe(0);
  });
});
