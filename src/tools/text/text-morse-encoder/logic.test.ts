import { describe, it, expect } from "vitest";
import {
  encodeChar,
  encodeMorse,
  encodeSlashStyle,
  computeTiming,
  transmissionTime,
  generateToneEvents,
  validateInput,
  morseStats,
  decodeMorse,
  formatHtml,
  encodeVerbose,
  MORSE_MAP,
  PROSIGNS,
} from "./logic";

describe("encodeChar", () => {
  it("encodes A", () => {
    expect(encodeChar("A")).toBe(".-");
  });
  it("encodes 0", () => {
    expect(encodeChar("0")).toBe("-----");
  });
  it("encodes @", () => {
    expect(encodeChar("@")).toBe(".--.-.");
  });
  it("returns null for unsupported char", () => {
    expect(encodeChar("#")).toBeNull();
  });
  it("is case-insensitive", () => {
    expect(encodeChar("a")).toBe(".-");
  });
});

describe("encodeMorse", () => {
  it("encodes HELLO WORLD", () => {
    const out = encodeMorse("HELLO WORLD");
    expect(out).toContain("....");
    expect(out).toContain("/");
  });
  it("uses custom separators", () => {
    const out = encodeMorse("AB", { letterSeparator: "|", wordSeparator: "||" });
    expect(out).toBe(".-|-...");
  });
  it("supports prosigns", () => {
    const out = encodeMorse("SOS", { useProsigns: true });
    expect(out).toBe("...---...");
  });
  it("ignores unsupported chars", () => {
    const out = encodeMorse("A#B");
    expect(out).toBe(".- -...");
  });
});

describe("encodeSlashStyle", () => {
  it("uses slashes as separators", () => {
    expect(encodeSlashStyle("AB")).toBe(".-/-...");
  });
  it("uses double slash between words", () => {
    expect(encodeSlashStyle("A B")).toBe(".-//-...");
  });
});

describe("computeTiming", () => {
  it("computes dot at 1.2/WPM seconds", () => {
    expect(computeTiming(20).dotSec).toBeCloseTo(1.2 / 20, 5);
  });
  it("dash is 3x dot", () => {
    const t = computeTiming(15);
    expect(t.dashSec).toBeCloseTo(t.dotSec * 3, 5);
  });
  it("word gap is 7x dot", () => {
    const t = computeTiming(12);
    expect(t.interWordGapSec).toBeCloseTo(t.dotSec * 7, 5);
  });
  it("PARIS word is 50x dot", () => {
    const t = computeTiming(20);
    expect(t.parisWordSec).toBeCloseTo(t.dotSec * 50, 5);
  });
});

describe("transmissionTime", () => {
  it("computes non-zero time for text", () => {
    expect(transmissionTime("HELLO", 20)).toBeGreaterThan(0);
  });
  it("faster WPM = shorter time", () => {
    const slow = transmissionTime("HELLO", 10);
    const fast = transmissionTime("HELLO", 40);
    expect(fast).toBeLessThan(slow);
  });
  it("empty text = 0 time", () => {
    expect(transmissionTime("", 20)).toBe(0);
  });
});

describe("generateToneEvents", () => {
  it("generates tone and silence events", () => {
    const evts = generateToneEvents("AB", 20);
    const tones = evts.filter((e) => e.type === "tone");
    const silences = evts.filter((e) => e.type === "silence");
    expect(tones.length).toBeGreaterThan(0);
    expect(silences.length).toBeGreaterThan(0);
  });
  it("event times are sequential", () => {
    const evts = generateToneEvents("HELLO", 20);
    for (let i = 1; i < evts.length; i++) {
      expect(evts[i].time).toBeGreaterThanOrEqual(evts[i - 1].time);
    }
  });
});

describe("validateInput", () => {
  it("returns valid for supported text", () => {
    expect(validateInput("HELLO WORLD").valid).toBe(true);
  });
  it("returns unsupported chars for emoji etc.", () => {
    const r = validateInput("HELLO 😀");
    expect(r.valid).toBe(false);
    expect(r.unsupported).toContain("😀");
  });
});

describe("morseStats", () => {
  it("counts dots and dashes", () => {
    const s = morseStats("E T", 20);
    // E = . (1 dot), T = - (1 dash)
    expect(s.dots).toBe(1);
    expect(s.dashes).toBe(1);
  });
  it("counts words", () => {
    expect(morseStats("HELLO WORLD", 20).words).toBe(2);
  });
  it("computes transmission time", () => {
    expect(morseStats("HELLO", 20).transmissionSec).toBeGreaterThan(0);
  });
});

describe("decodeMorse", () => {
  it("decodes back to text", () => {
    const encoded = encodeMorse("HELLO WORLD");
    expect(decodeMorse(encoded)).toBe("HELLO WORLD");
  });
  it("decodes custom separators", () => {
    const encoded = encodeMorse("AB", { letterSeparator: "|", wordSeparator: "||" });
    expect(decodeMorse(encoded, { letterSeparator: "|", wordSeparator: "||" })).toBe("AB");
  });
});

describe("formatHtml", () => {
  it("wraps dots and dashes in colored spans", () => {
    const html = formatHtml(".-");
    expect(html).toContain("color:#ef4444");
    expect(html).toContain("color:#3b82f6");
  });
});

describe("encodeVerbose", () => {
  it("includes letter labels", () => {
    const v = encodeVerbose("AB");
    expect(v).toContain("A→.-");
    expect(v).toContain("B→-...");
  });
  it("separates words by newlines", () => {
    const v = encodeVerbose("A B");
    expect(v.split("\n")).toHaveLength(2);
  });
});

describe("MORSE_MAP", () => {
  it("has all 26 letters", () => {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    for (const l of letters) expect(MORSE_MAP[l]).toBeDefined();
  });
  it("has all 10 digits", () => {
    for (let i = 0; i <= 9; i++) expect(MORSE_MAP[String(i)]).toBeDefined();
  });
});

describe("PROSIGNS", () => {
  it("includes SOS", () => {
    expect(PROSIGNS.SOS).toBe("...---...");
  });
  it("includes AR and SK", () => {
    expect(PROSIGNS.AR).toBeDefined();
    expect(PROSIGNS.SK).toBeDefined();
  });
});
