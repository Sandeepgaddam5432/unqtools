import { describe, it, expect } from "vitest";
import { decode, encode, detectSeparator, detectSpeed, MORSE_TO_TEXT } from "./logic";

describe("encode", () => {
  it("encodes a simple word", () => {
    expect(encode("SOS")).toBe("... --- ...");
  });

  it("encodes a sentence with word separators", () => {
    expect(encode("HI THERE")).toBe(".... .. / - .... . .-. .");
  });

  it("encodes numbers", () => {
    expect(encode("42")).toBe("....- ..---");
  });

  it("returns empty for empty input", () => {
    expect(encode("")).toBe("");
  });
});

describe("decode", () => {
  it("decodes SOS", () => {
    expect(decode("... --- ...")).toBe("SOS");
  });

  it("decodes with slash word separator", () => {
    expect(decode(".... .. / - .... . .-. .")).toBe("HI THERE");
  });

  it("decodes with double-space word separator", () => {
    expect(decode(".... ..  - .... . .-. .")).toBe("HI THERE");
  });

  it("decodes numbers", () => {
    expect(decode("....- ..---")).toBe("42");
  });

  it("returns empty for empty input", () => {
    expect(decode("")).toBe("");
  });
});

describe("encode/decode round-trip", () => {
  it("round-trips a sentence", () => {
    const s = "HELLO WORLD 123";
    expect(decode(encode(s))).toBe(s);
  });
});

describe("detectSeparator", () => {
  it("detects slash separator", () => {
    expect(detectSeparator("... --- ... / ... --- ...")).toContain("/");
  });

  it("detects double-space separator", () => {
    expect(detectSeparator("... --- ...  ... --- ...")).toBe("  ");
  });

  it("defaults to single space", () => {
    expect(detectSeparator("... --- ...")).toBe(" ");
  });
});

describe("detectSpeed", () => {
  it("returns a positive WPM", () => {
    const wpm = detectSpeed("... --- ... / ... --- ...");
    expect(wpm).toBeGreaterThan(0);
  });

  it("returns default for empty input", () => {
    expect(detectSpeed("")).toBe(100);
  });
});

describe("MORSE_TO_TEXT", () => {
  it("has all 26 letters", () => {
    const letters = Object.values(MORSE_TO_TEXT).filter(
      (v) => v.length === 1 && /[A-Z]/.test(v),
    );
    expect(letters.length).toBe(26);
  });

  it("has all 10 digits", () => {
    const digits = Object.values(MORSE_TO_TEXT).filter(
      (v) => v.length === 1 && /[0-9]/.test(v),
    );
    expect(digits.length).toBe(10);
  });
});
