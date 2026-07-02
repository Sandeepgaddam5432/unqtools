import { describe, it, expect } from "vitest";
import { toBigText, getStyleA11y, type BigTextStyle } from "./logic";

describe("toBigText — fullwidth", () => {
  it("converts uppercase letters", () => {
    expect(toBigText("ABC", "fullwidth")).toBe("ＡＢＣ");
  });

  it("converts lowercase letters", () => {
    expect(toBigText("abc", "fullwidth")).toBe("ａｂｃ");
  });

  it("converts digits", () => {
    expect(toBigText("123", "fullwidth")).toBe("１２３");
  });

  it("converts space to fullwidth space", () => {
    expect(toBigText("a b", "fullwidth")).toBe("ａ\u3000ｂ");
  });

  it("converts punctuation", () => {
    expect(toBigText("!", "fullwidth")).toBe("！");
    expect(toBigText("?", "fullwidth")).toBe("？");
  });

  it("preserves unmapped characters (emoji, CJK)", () => {
    expect(toBigText("🎉", "fullwidth")).toBe("🎉");
    expect(toBigText("你好", "fullwidth")).toBe("你好");
  });
});

describe("toBigText — sans-bold", () => {
  it("converts uppercase to bold sans", () => {
    const result = toBigText("ABC", "sans-bold");
    expect(result).toBe("𝗔𝗕𝗖");
  });

  it("converts lowercase to bold sans", () => {
    const result = toBigText("abc", "sans-bold");
    expect(result).toBe("𝗮𝗯𝗰");
  });

  it("converts digits to bold sans", () => {
    const result = toBigText("123", "sans-bold");
    expect(result).toBe("𝟭𝟮𝟯");
  });

  it("preserves spaces and punctuation", () => {
    const result = toBigText("a b!", "sans-bold");
    expect(result).toContain("𝗮");
    expect(result).toContain(" ");
    expect(result).toContain("!");
  });
});

describe("toBigText — sans-bold-italic", () => {
  it("converts letters to bold italic sans", () => {
    const result = toBigText("Ab", "sans-bold-italic");
    expect(result).toBe("𝙰𝙗");
  });
});

describe("toBigText — monospace", () => {
  it("converts letters and digits to monospace", () => {
    const result = toBigText("A1b", "monospace");
    expect(result).toBe("𝙰𝟷𝚋");
  });
});

describe("toBigText — circled", () => {
  it("converts uppercase to circled", () => {
    expect(toBigText("ABC", "circled")).toBe("ⒶⒷⒸ");
  });

  it("converts lowercase to circled", () => {
    expect(toBigText("abc", "circled")).toBe("ⓐⓑⓒ");
  });

  it("converts digits to circled", () => {
    expect(toBigText("012", "circled")).toBe("⓪①②");
  });
});

describe("toBigText — squared", () => {
  it("converts uppercase to squared", () => {
    expect(toBigText("AB", "squared")).toBe("🄰🄱");
  });

  it("does not have lowercase squared (falls back to original)", () => {
    expect(toBigText("ab", "squared")).toBe("ab");
  });
});

describe("toBigText — edge cases", () => {
  it("handles empty input", () => {
    expect(toBigText("", "fullwidth")).toBe("");
  });

  it("handles Unicode emoji (preserves them)", () => {
    const result = toBigText("Hello 🎉 World", "fullwidth");
    expect(result).toContain("🎉");
    expect(result).toContain("Ｈｅｌｌｏ");
  });

  it("handles CJK characters (preserves them)", () => {
    const result = toBigText("Hello 你好", "fullwidth");
    expect(result).toContain("你好");
    expect(result).toContain("Ｈｅｌｌｏ");
  });

  it("handles newlines", () => {
    const result = toBigText("a\nb", "fullwidth");
    expect(result).toBe("ａ\nｂ");
  });

  it("handles mixed case + digits + punctuation", () => {
    const result = toBigText("Test 123!", "fullwidth");
    expect(result).toBe("Ｔｅｓｔ\u3000１２３！");
  });

  it("handles huge input (10K chars)", () => {
    const input = "a".repeat(10000);
    const result = toBigText(input, "fullwidth");
    expect(result.length).toBe(10000);
  });
});

describe("getStyleA11y", () => {
  it("returns a11y note for each style", () => {
    const styles: BigTextStyle[] = [
      "fullwidth",
      "sans-bold",
      "sans-bold-italic",
      "monospace",
      "circled",
      "squared",
    ];
    for (const s of styles) {
      const note = getStyleA11y(s);
      expect(note).toBeTruthy();
      expect(note.length).toBeGreaterThan(3);
    }
  });
});
