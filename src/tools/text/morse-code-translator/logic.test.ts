/**
 * Morse Code Translator — unit tests.
 */
import { describe, it, expect } from "vitest";
import {
  textToMorse, morseToText, getCharBreakdown, getTiming, generateBeepPattern,
  validateMorse, MORSE_CODE, MORSE_PROSIGNS, PHONETIC_ALPHABET,
} from "./logic";

describe("textToMorse", () => {
  it("converts simple text", () => {
    expect(textToMorse("HELLO")).toBe(".... . .-.. .-.. ---");
  });
  it("converts SOS", () => {
    expect(textToMorse("SOS")).toBe("... --- ...");
  });
  it("handles words", () => {
    expect(textToMorse("HELLO WORLD")).toBe(".... . .-.. .-.. ---   .-- --- .-. .-.. -..");
  });
  it("handles lowercase", () => {
    expect(textToMorse("hello")).toBe(".... . .-.. .-.. ---");
  });
  it("handles digits", () => {
    expect(textToMorse("123")).toBe(".---- ..--- ...--");
  });
  it("handles punctuation", () => {
    expect(textToMorse("HI!")).toBe(".... .. -.-.--");
  });
  it("uses slash for word separator when option set", () => {
    expect(textToMorse("A B", { useSlashForWord: true })).toBe(".- / -...");
  });
  it("uses middle dot when option set", () => {
    expect(textToMorse("E", { useMiddleDot: true })).toBe("·");
  });
  it("skips unknown characters", () => {
    expect(textToMorse("A#B")).toBe(".- -...");
  });
  it("returns empty string for empty input", () => {
    expect(textToMorse("")).toBe("");
  });
});

describe("morseToText", () => {
  it("converts simple morse", () => {
    expect(morseToText(".... . .-.. .-.. ---")).toBe("HELLO");
  });
  it("converts SOS", () => {
    expect(morseToText("... --- ...")).toBe("SOS");
  });
  it("handles word separator (3 spaces)", () => {
    expect(morseToText(".... . .-.. .-.. ---   .-- --- .-. .-.. -..")).toBe("HELLO WORLD");
  });
  it("handles slash word separator", () => {
    expect(morseToText(".- / -...")).toBe("A B");
  });
  it("handles middle dots", () => {
    expect(morseToText("·-")).toBe("A");
  });
  it("returns empty string for empty input", () => {
    expect(morseToText("")).toBe("");
  });
  it("round-trips text → morse → text", () => {
    const original = "HELLO WORLD";
    const morse = textToMorse(original);
    expect(morseToText(morse)).toBe(original);
  });
});

describe("getCharBreakdown", () => {
  it("returns breakdown for each character", () => {
    const breakdown = getCharBreakdown("AB");
    expect(breakdown.length).toBe(2);
    expect(breakdown[0]).toEqual({ char: "A", morse: ".-", phonetic: "Alpha" });
    expect(breakdown[1]).toEqual({ char: "B", morse: "-...", phonetic: "Bravo" });
  });
  it("handles spaces", () => {
    const breakdown = getCharBreakdown("A B");
    expect(breakdown.length).toBe(3);
    expect(breakdown[1]).toEqual({ char: "␣", morse: "/", phonetic: "" });
  });
  it("includes phonetic for digits", () => {
    const breakdown = getCharBreakdown("1");
    expect(breakdown[0]?.phonetic).toBe("One");
  });
});

describe("getTiming", () => {
  it("computes timing for 20 WPM", () => {
    const t = getTiming(20);
    expect(t.dit).toBe(60); // 1200/20
    expect(t.dah).toBe(180);
    expect(t.intraCharGap).toBe(60);
    expect(t.letterGap).toBe(180);
    expect(t.wordGap).toBe(420);
  });
  it("faster WPM = shorter dit", () => {
    expect(getTiming(40).dit).toBeLessThan(getTiming(10).dit);
  });
});

describe("generateBeepPattern", () => {
  it("generates beep pattern for simple morse", () => {
    const pattern = generateBeepPattern("... --- ...", 20, 600);
    expect(pattern.length).toBeGreaterThan(0);
    // Should have alternating on/off
    expect(pattern.some((p) => p.on)).toBe(true);
    expect(pattern.some((p) => !p.on)).toBe(true);
  });
  it("uses provided frequency", () => {
    const pattern = generateBeepPattern(".", 20, 800);
    expect(pattern[0]?.frequency).toBe(800);
  });
  it("handles empty input", () => {
    expect(generateBeepPattern("", 20, 600).length).toBe(0);
  });
});

describe("validateMorse", () => {
  it("validates valid morse", () => {
    const r = validateMorse("... --- ...");
    expect(r.isValid).toBe(true);
    expect(r.errors.length).toBe(0);
  });
  it("flags invalid characters", () => {
    const r = validateMorse("abc");
    expect(r.isValid).toBe(false);
  });
  it("flags unknown sequences", () => {
    const r = validateMorse(".........."); // 10 dots — not a valid char
    expect(r.isValid).toBe(false);
    expect(r.errors.some((e) => e.includes("Unknown"))).toBe(true);
  });
  it("accepts slash", () => {
    const r = validateMorse(".- / -...");
    expect(r.isValid).toBe(true);
  });
});

describe("MORSE_CODE completeness", () => {
  it("has all 26 letters", () => {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    for (const l of letters) expect(MORSE_CODE[l]).toBeDefined();
  });
  it("has all 10 digits", () => {
    for (let i = 0; i <= 9; i++) expect(MORSE_CODE[String(i)]).toBeDefined();
  });
});

describe("MORSE_PROSIGNS", () => {
  it("includes SOS", () => {
    expect(MORSE_PROSIGNS.SOS).toBe("...---...");
  });
  it("includes end-of-message (AR)", () => {
    expect(MORSE_PROSIGNS.AR).toBeDefined();
  });
});

describe("PHONETIC_ALPHABET", () => {
  it("has NATO alphabet for all letters", () => {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    for (const l of letters) expect(PHONETIC_ALPHABET[l]).toBeDefined();
  });
});
