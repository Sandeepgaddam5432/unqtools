import { describe, it, expect } from "vitest";
import { tokenize, toCamelCase, toPascalCase, toSnakeCase, toKebabCase, toConstantCase, toTitleCase, toSentenceCase, convertCase, availableModes } from "./logic";

describe("tokenize", () => {
  it("splits on spaces", () => {
    expect(tokenize("hello world")).toEqual(["hello", "world"]);
  });
  it("splits snake_case", () => {
    expect(tokenize("hello_world")).toEqual(["hello", "world"]);
  });
  it("splits kebab-case", () => {
    expect(tokenize("hello-world")).toEqual(["hello", "world"]);
  });
  it("splits camelCase at boundaries", () => {
    expect(tokenize("helloWorld")).toEqual(["hello", "World"]);
  });
  it("splits PascalCase", () => {
    expect(tokenize("HelloWorld")).toEqual(["Hello", "World"]);
  });
  it("handles empty string", () => {
    expect(tokenize("")).toEqual([]);
  });
  it("handles consecutive ALLCAPS followed by lower", () => {
    expect(tokenize("HTMLEditor")).toEqual(["HTML", "Editor"]);
  });
});

describe("toCamelCase", () => {
  it("converts to camelCase", () => {
    expect(toCamelCase(["hello", "world"])).toBe("helloWorld");
  });
  it("first word is lowercase", () => {
    expect(toCamelCase(["Hello", "World"])).toBe("helloWorld");
  });
});

describe("toPascalCase", () => {
  it("converts to PascalCase", () => {
    expect(toPascalCase(["hello", "world"])).toBe("HelloWorld");
  });
});

describe("toSnakeCase", () => {
  it("converts to snake_case", () => {
    expect(toSnakeCase(["hello", "world"])).toBe("hello_world");
  });
});

describe("toKebabCase", () => {
  it("converts to kebab-case", () => {
    expect(toKebabCase(["hello", "world"])).toBe("hello-world");
  });
});

describe("toConstantCase", () => {
  it("converts to CONSTANT_CASE", () => {
    expect(toConstantCase(["hello", "world"])).toBe("HELLO_WORLD");
  });
});

describe("toTitleCase", () => {
  it("converts to Title Case", () => {
    expect(toTitleCase(["hello", "world"])).toBe("Hello World");
  });
});

describe("toSentenceCase", () => {
  it("converts to Sentence case", () => {
    expect(toSentenceCase(["hello", "world"])).toBe("Hello world");
  });
});

describe("convertCase", () => {
  it("handles empty input", () => {
    expect(convertCase("", { mode: "camelCase", preserveLines: false })).toBe("");
  });
  it("camelCase with preserveLines", () => {
    const out = convertCase("hello world\nfoo bar", { mode: "camelCase", preserveLines: true });
    expect(out).toBe("helloWorld\nfooBar");
  });
  it("UPPERCASE", () => {
    expect(convertCase("hello", { mode: "UPPERCASE", preserveLines: false })).toBe("HELLO");
  });
  it("lowercase", () => {
    expect(convertCase("HELLO", { mode: "lowercase", preserveLines: false })).toBe("hello");
  });
  it("snake_case from camelCase input", () => {
    expect(convertCase("helloWorldFoo", { mode: "snake_case", preserveLines: false })).toBe("hello_world_foo");
  });
});

describe("availableModes", () => {
  it("returns all 9 modes", () => {
    expect(availableModes().length).toBe(9);
  });
});
