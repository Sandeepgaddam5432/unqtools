import { describe, it, expect } from "vitest";
import {
  toUpperCase,
  toLowerCase,
  toTitleCase,
  toSentenceCase,
  toCamelCase,
  toPascalCase,
  toSnakeCase,
  toKebabCase,
  toConstantCase,
  toDotCase,
  toAlternatingCase,
  convertCase,
  CASE_OPTIONS,
} from "./logic";

describe("toUpperCase / toLowerCase", () => {
  it("uppercases text", () => {
    expect(toUpperCase("hello world")).toBe("HELLO WORLD");
    expect(toUpperCase("MixedCase")).toBe("MIXEDCASE");
  });

  it("lowercases text", () => {
    expect(toLowerCase("HELLO WORLD")).toBe("hello world");
    expect(toLowerCase("MixedCase")).toBe("mixedcase");
  });

  it("handles empty string", () => {
    expect(toUpperCase("")).toBe("");
    expect(toLowerCase("")).toBe("");
  });
});

describe("toTitleCase", () => {
  it("title-cases a simple sentence", () => {
    expect(toTitleCase("hello world")).toBe("Hello World");
  });

  it("keeps small words lowercase (except first/last)", () => {
    expect(toTitleCase("the quick brown fox and the lazy dog")).toBe(
      "The Quick Brown Fox and the Lazy Dog",
    );
  });

  it("capitalizes the first word even if it's a small word", () => {
    expect(toTitleCase("a tale of two cities")).toBe("A Tale of Two Cities");
  });

  it("capitalizes the last word even if it's a small word", () => {
    expect(toTitleCase("looking for")).toBe("Looking For");
  });

  it("handles empty string", () => {
    expect(toTitleCase("")).toBe("");
  });
});

describe("toSentenceCase", () => {
  it("sentence-cases text", () => {
    expect(toSentenceCase("HELLO WORLD")).toBe("Hello world");
  });

  it("capitalizes after sentence-ending punctuation", () => {
    expect(toSentenceCase("hello. world. foo! bar? baz")).toBe("Hello. World. Foo! Bar? Baz");
  });

  it("handles empty string", () => {
    expect(toSentenceCase("")).toBe("");
  });
});

describe("toCamelCase", () => {
  it("camelCases kebab input", () => {
    expect(toCamelCase("hello-world")).toBe("helloWorld");
  });

  it("camelCases snake input", () => {
    expect(toCamelCase("hello_world")).toBe("helloWorld");
  });

  it("camelCases spaced input", () => {
    expect(toCamelCase("hello world foo")).toBe("helloWorldFoo");
  });

  it("camelCases PascalCase input", () => {
    expect(toCamelCase("HelloWorld")).toBe("helloWorld");
  });

  it("handles mixed separators", () => {
    expect(toCamelCase("hello-world_foo bar")).toBe("helloWorldFooBar");
  });

  it("handles consecutive capitals (acronyms)", () => {
    expect(toCamelCase("XMLHttpRequest")).toBe("xmlHttpRequest");
  });
});

describe("toPascalCase", () => {
  it("pascalCases kebab input", () => {
    expect(toPascalCase("hello-world")).toBe("HelloWorld");
  });

  it("pascalCases spaced input", () => {
    expect(toPascalCase("hello world")).toBe("HelloWorld");
  });

  it("pascalCases camelCase input", () => {
    expect(toPascalCase("helloWorld")).toBe("HelloWorld");
  });
});

describe("toSnakeCase", () => {
  it("snake_cases kebab input", () => {
    expect(toSnakeCase("hello-world")).toBe("hello_world");
  });

  it("snake_cases spaced input", () => {
    expect(toSnakeCase("hello world foo")).toBe("hello_world_foo");
  });

  it("snake_cases camelCase input", () => {
    expect(toSnakeCase("helloWorld")).toBe("hello_world");
  });

  it("lowercases everything", () => {
    expect(toSnakeCase("HELLO WORLD")).toBe("hello_world");
  });
});

describe("toKebabCase", () => {
  it("kebab-cases snake input", () => {
    expect(toKebabCase("hello_world")).toBe("hello-world");
  });

  it("kebab-cases spaced input", () => {
    expect(toKebabCase("hello world foo")).toBe("hello-world-foo");
  });

  it("kebab-cases camelCase input", () => {
    expect(toKebabCase("helloWorld")).toBe("hello-world");
  });
});

describe("toConstantCase", () => {
  it("CONSTANT_CASES input", () => {
    expect(toConstantCase("hello world")).toBe("HELLO_WORLD");
    expect(toConstantCase("helloWorld")).toBe("HELLO_WORLD");
    expect(toConstantCase("hello-world")).toBe("HELLO_WORLD");
  });
});

describe("toDotCase", () => {
  it("dot.cases input", () => {
    expect(toDotCase("hello world")).toBe("hello.world");
    expect(toDotCase("helloWorld")).toBe("hello.world");
    expect(toDotCase("hello-world")).toBe("hello.world");
  });
});

describe("toAlternatingCase", () => {
  it("alternates case", () => {
    expect(toAlternatingCase("hello")).toBe("hElLo");
    expect(toAlternatingCase("HELLO")).toBe("hElLo");
  });

  it("preserves non-letters without counting them", () => {
    expect(toAlternatingCase("a b c")).toBe("a B c");
  });
});

describe("convertCase dispatch", () => {
  const input = "hello world foo";
  const expectations: Record<string, string> = {
    upper: "HELLO WORLD FOO",
    lower: "hello world foo",
    title: "Hello World Foo",
    sentence: "Hello world foo",
    camel: "helloWorldFoo",
    pascal: "HelloWorldFoo",
    snake: "hello_world_foo",
    kebab: "hello-world-foo",
    constant: "HELLO_WORLD_FOO",
    dot: "hello.world.foo",
  };

  for (const [type, expected] of Object.entries(expectations)) {
    it(`converts to ${type}`, () => {
      expect(convertCase(input, type as never)).toBe(expected);
    });
  }
});

describe("CASE_OPTIONS", () => {
  it("has 11 case types", () => {
    expect(CASE_OPTIONS.length).toBe(11);
  });

  it("every case type is unique", () => {
    const values = CASE_OPTIONS.map((c) => c.value);
    expect(new Set(values).size).toBe(values.length);
  });
});
