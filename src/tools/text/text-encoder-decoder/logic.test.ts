import { describe, it, expect } from "vitest";
import { encode, decode, batchEncode, type Encoding } from "./logic";

const encodings: Encoding[] = ["base64", "url", "html", "hex", "rot13", "binary"];

describe("round-trip", () => {
  for (const enc of encodings) {
    it(`round-trips ${enc}`, () => {
      const e = encode("Hello, World!", { encoding: enc });
      if ("error" in e) throw new Error(e.error);
      const d = decode(e.output, { encoding: enc });
      if ("error" in d) throw new Error(d.error);
      expect(d.output).toBe("Hello, World!");
    });
  }
});

describe("base64", () => {
  it("encodes correctly", () => {
    const e = encode("hi", { encoding: "base64" });
    if ("error" in e) throw new Error("err");
    expect(e.output).toBe("aGk=");
  });
  it("decodes correctly", () => {
    const d = decode("aGk=", { encoding: "base64" });
    if ("error" in d) throw new Error("err");
    expect(d.output).toBe("hi");
  });
});

describe("url", () => {
  it("encodes special chars", () => {
    const e = encode("a b&c", { encoding: "url" });
    if ("error" in e) throw new Error("err");
    expect(e.output).toBe("a%20b%26c");
  });
});

describe("html", () => {
  it("escapes angle brackets", () => {
    const e = encode("<div>", { encoding: "html" });
    if ("error" in e) throw new Error("err");
    expect(e.output).toBe("&lt;div&gt;");
  });
  it("unescapes entities", () => {
    const d = decode("&lt;a&gt;&amp;&#39;", { encoding: "html" });
    if ("error" in d) throw new Error("err");
    expect(d.output).toBe("<a>&'");
  });
});

describe("hex", () => {
  it("encodes ascii", () => {
    const e = encode("AB", { encoding: "hex" });
    if ("error" in e) throw new Error("err");
    expect(e.output).toBe("4142");
  });
});

describe("rot13", () => {
  it("rotates letters", () => {
    const e = encode("hello", { encoding: "rot13" });
    if ("error" in e) throw new Error("err");
    expect(e.output).toBe("uryyb");
  });
});

describe("binary", () => {
  it("encodes to binary string", () => {
    const e = encode("A", { encoding: "binary" });
    if ("error" in e) throw new Error("err");
    expect(e.output).toBe("01000001");
  });
});

describe("errors", () => {
  it("returns error on invalid base64", () => {
    const d = decode("!!!notbase64!!!", { encoding: "base64" });
    expect("error" in d).toBe(true);
  });
});

describe("batchEncode", () => {
  it("encodes multiple inputs", () => {
    const r = batchEncode(["a", "b"], { encoding: "hex" });
    expect(r).toHaveLength(2);
    const out0 = r[0]!;
    if ("error" in out0) throw new Error("err");
    expect(out0.output).toBe("61");
  });
});
