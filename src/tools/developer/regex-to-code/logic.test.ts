import { describe, it, expect } from "vitest";
import { generateJS, generatePython, generatePHP, getAllLanguages, validatePattern } from "./logic";

describe("Regex to Code", () => {
  it("generates JavaScript code", () => {
    const code = generateJS("abc", "g", "test");
    expect(code).toContain("regex");
    expect(code).toContain("/abc/g");
  });
  it("generates Python code", () => {
    const code = generatePython("abc", "g", "test");
    expect(code).toContain("import re");
    expect(code).toContain("re.compile");
  });
  it("generates PHP code", () => {
    const code = generatePHP("abc", "g", "test");
    expect(code).toContain("preg_match");
  });
  it("lists all languages", () => {
    expect(getAllLanguages().length).toBe(5);
  });
  it("validates pattern", () => {
    expect(validatePattern("abc").valid).toBe(true);
    expect(validatePattern("[").valid).toBe(false);
  });
});
