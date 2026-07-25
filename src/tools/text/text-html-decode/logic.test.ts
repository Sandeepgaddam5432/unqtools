import { describe, it, expect } from "vitest";
import { NAMED_ENTITIES, decodeEntity, htmlDecode, validateInput } from "./logic";

describe("NAMED_ENTITIES", () => {
  it("includes the basic entities", () => {
    expect(NAMED_ENTITIES.amp).toBe("&");
    expect(NAMED_ENTITIES.lt).toBe("<");
    expect(NAMED_ENTITIES.gt).toBe(">");
    expect(NAMED_ENTITIES.quot).toBe('"');
    expect(NAMED_ENTITIES.apos).toBe("'");
  });
  it("includes common symbols", () => {
    expect(NAMED_ENTITIES.copy).toBe("©");
    expect(NAMED_ENTITIES.reg).toBe("®");
    expect(NAMED_ENTITIES.euro).toBe("€");
  });
});

describe("decodeEntity", () => {
  it("decodes named entities", () => {
    expect(decodeEntity("&amp;")).toBe("&");
    expect(decodeEntity("&lt;")).toBe("<");
  });
  it("decodes decimal numeric entities", () => {
    expect(decodeEntity("&#65;")).toBe("A");
    expect(decodeEntity("&#169;")).toBe("©");
  });
  it("decodes hex numeric entities", () => {
    expect(decodeEntity("&#x41;")).toBe("A");
    expect(decodeEntity("&#xA9;")).toBe("©");
  });
  it("returns original for unknown entities", () => {
    expect(decodeEntity("&unknownentity;")).toBe("&unknownentity;");
  });
});

describe("htmlDecode", () => {
  it("decodes multiple entities in one string", () => {
    const r = htmlDecode("&lt;b&gt;Hello&lt;/b&gt;");
    expect(r.output).toBe("<b>Hello</b>");
    expect(r.entitiesDecoded).toBe(4);
  });
  it("handles empty input", () => {
    const r = htmlDecode("");
    expect(r.output).toBe("");
    expect(r.entitiesDecoded).toBe(0);
  });
  it("leaves plain text unchanged", () => {
    const r = htmlDecode("Hello, world!");
    expect(r.output).toBe("Hello, world!");
    expect(r.entitiesDecoded).toBe(0);
  });
  it("decodes Unicode entities", () => {
    const r = htmlDecode("&#x1F600;");
    expect(r.output).toBe("😀");
  });
  it("handles mixed content", () => {
    const r = htmlDecode("Tom &amp; Jerry &copy; 2024");
    expect(r.output).toBe("Tom & Jerry © 2024");
  });
});

describe("validateInput", () => {
  it("accepts string input", () => {
    expect(validateInput("hello")).toEqual({ ok: true });
  });
  it("rejects non-string input", () => {
    expect(validateInput(42 as unknown as string)).toHaveProperty("error");
  });
});
