import { describe, it, expect } from "vitest";
import { toBold, decodeBold, getStyleA11y, type BoldStyle } from "./logic";

describe("toBold — serif-bold", () => {
  it("converts uppercase to bold serif", () => {
    expect(toBold("ABC", "serif-bold")).toBe("𝐀𝐁𝐂");
  });
  it("converts lowercase to bold serif", () => {
    expect(toBold("abc", "serif-bold")).toBe("𝐚𝐛𝐜");
  });
  it("preserves non-letter characters", () => {
    expect(toBold("123! ", "serif-bold")).toBe("123! ");
  });
});

describe("toBold — sans-bold", () => {
  it("converts letters and digits to sans bold", () => {
    expect(toBold("Ab1", "sans-bold")).toBe("𝗔𝗯𝟭");
  });
});

describe("toBold — bold-italic", () => {
  it("converts letters to bold italic", () => {
    expect(toBold("Ab", "bold-italic")).toBe("𝑨𝒃");
  });
});

describe("toBold — bold-script", () => {
  it("converts letters to bold script", () => {
    expect(toBold("Ab", "bold-script")).toBe("𝓐𝓫");
  });
});

describe("toBold — bold-fraktur", () => {
  it("converts letters to bold fraktur", () => {
    expect(toBold("Ab", "bold-fraktur")).toBe("𝕬𝖇");
  });
});

describe("toBold — bold-double-struck", () => {
  it("converts letters to double-struck", () => {
    expect(toBold("AB", "bold-double-struck")).toBe("𝔸𝔹");
  });
  it("uses Letterlike Symbols for gap letters (C, H, N, P, Q, R, Z)", () => {
    expect(toBold("C", "bold-double-struck")).toBe("ℂ");
    expect(toBold("H", "bold-double-struck")).toBe("ℍ");
    expect(toBold("Z", "bold-double-struck")).toBe("ℤ");
  });
});

describe("decodeBold", () => {
  it("decodes serif bold back to normal", () => {
    expect(decodeBold("𝐀𝐛𝐜")).toBe("Abc");
  });
  it("decodes sans bold back to normal", () => {
    expect(decodeBold("𝗔𝗯𝟭")).toBe("Ab1");
  });
  it("decodes mixed styles", () => {
    expect(decodeBold("𝐀𝗯𝓒")).toBe("AbC");
  });
  it("preserves non-bold characters", () => {
    expect(decodeBold("Hello 𝐖𝐨𝐫𝐥𝐝")).toBe("Hello World");
  });
});

describe("toBold — edge cases", () => {
  it("handles empty input", () => {
    expect(toBold("", "serif-bold")).toBe("");
  });
  it("preserves emoji", () => {
    expect(toBold("🎉", "serif-bold")).toBe("🎉");
  });
  it("preserves CJK", () => {
    expect(toBold("你好", "serif-bold")).toBe("你好");
  });
  it("handles newlines", () => {
    expect(toBold("a\nb", "serif-bold")).toBe("𝐚\n𝐛");
  });
});

describe("getStyleA11y", () => {
  it("returns a11y note for each style", () => {
    const styles: BoldStyle[] = [
      "serif-bold",
      "sans-bold",
      "bold-italic",
      "bold-script",
      "bold-fraktur",
      "bold-double-struck",
    ];
    for (const s of styles) {
      expect(getStyleA11y(s).length).toBeGreaterThan(3);
    }
  });
});
