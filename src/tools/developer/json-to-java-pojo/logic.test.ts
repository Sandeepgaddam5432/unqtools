import { describe, it, expect } from "vitest";
import { jsonToJava, generateWithLombok, generateImports } from "./logic";

describe("JSON to Java POJO", () => {
  it("generates Java class", () => {
    const result = jsonToJava('{"name":"test","age":30}', "Person");
    expect(result).toContain("public class Person");
    expect(result).toContain("private String name");
    expect(result).toContain("private Long age");
  });
  it("generates getters and setters", () => {
    const result = jsonToJava('{"name":"test"}', "Person");
    expect(result).toContain("getName");
    expect(result).toContain("setName");
  });
  it("generates with Lombok", () => {
    const result = generateWithLombok('{"name":"test"}', "Person");
    expect(result).toContain("@Data");
    expect(result).toContain("@Builder");
  });
  it("generates imports", () => {
    expect(generateImports(true)).toContain("lombok");
    expect(generateImports(false)).toContain("java.util.List");
  });
});
