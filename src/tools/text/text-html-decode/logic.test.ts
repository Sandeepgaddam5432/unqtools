import { describe, it, expect } from "vitest";
import {
  NAMED_ENTITIES, decodeEntity, entityType, htmlDecode, htmlDecodeBatch,
  batchToCsv, htmlEncode, htmlEncodeAll, roundTrip, referenceTable,
  validateInput, namedEntityCount,
} from "./logic";

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
  it("includes 200+ entities", () => {
    expect(namedEntityCount()).toBeGreaterThanOrEqual(200);
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
  it("decodes uppercase hex prefix", () => {
    expect(decodeEntity("&#X41;")).toBe("A");
  });
  it("returns original for unknown entities", () => {
    expect(decodeEntity("&unknownentity;")).toBe("&unknownentity;");
  });
  it("returns original for non-entity strings", () => {
    expect(decodeEntity("hello")).toBe("hello");
  });
  it("rejects out-of-range code points", () => {
    expect(decodeEntity("&#999999999;")).toBe("&#999999999;");
  });
});

describe("entityType", () => {
  it("classifies named", () => { expect(entityType("&amp;")).toBe("named"); });
  it("classifies decimal", () => { expect(entityType("&#65;")).toBe("decimal"); });
  it("classifies hex", () => { expect(entityType("&#x41;")).toBe("hex"); });
  it("classifies unknown", () => { expect(entityType("&bogus;")).toBe("unknown"); });
  it("classifies non-entity", () => { expect(entityType("hello")).toBe("unknown"); });
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
  it("counts entity types", () => {
    const r = htmlDecode("&amp; &#65; &#x41;");
    expect(r.namedCount).toBe(1);
    expect(r.decimalCount).toBe(1);
    expect(r.hexCount).toBe(1);
  });
  it("reports unknown entities", () => {
    const r = htmlDecode("&bogus; and &anotherbogus;");
    expect(r.unknownCount).toBe(2);
    expect(r.unknownEntities).toContain("&bogus;");
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

describe("htmlDecodeBatch + batchToCsv", () => {
  it("decodes each line", () => {
    const results = htmlDecodeBatch(["&amp;", "&lt;test&gt;"]);
    expect(results.length).toBe(2);
    expect(results[0]!.output).toBe("&");
    expect(results[1]!.output).toBe("<test>");
  });
  it("emits CSV with header + rows", () => {
    const lines = ["&amp;", "&copy;"];
    const results = htmlDecodeBatch(lines);
    const csv = batchToCsv(results, lines);
    expect(csv.split("\n")[0]).toBe("Input,Output,Decoded,Named,Decimal,Hex,Unknown");
    expect(csv).toContain("&amp;");
  });
});

describe("htmlEncode + htmlEncodeAll", () => {
  it("encodes core entities", () => {
    expect(htmlEncode("<b>")).toBe("&lt;b&gt;");
    expect(htmlEncode("a & b")).toBe("a &amp; b");
  });
  it("encodes all non-ASCII as numeric", () => {
    expect(htmlEncodeAll("A©")).toBe("A&#169;");
  });
  it("leaves ASCII alone in htmlEncodeAll", () => {
    expect(htmlEncodeAll("ABC123")).toBe("ABC123");
  });
});

describe("roundTrip", () => {
  it("round-trips encoded text", () => {
    const r = roundTrip("&lt;b&gt;hi&lt;/b&gt;");
    expect(r.ok).toBe(true);
  });
  it("round-trips mixed text", () => {
    const r = roundTrip("Tom &amp; Jerry");
    expect(r.ok).toBe(true);
    expect(r.decoded).toBe("Tom & Jerry");
  });
});

describe("referenceTable", () => {
  it("returns sorted entries with code points", () => {
    const table = referenceTable();
    expect(table.length).toBeGreaterThanOrEqual(200);
    const amp = table.find((e) => e.name === "amp");
    expect(amp?.char).toBe("&");
    expect(amp?.codePoint).toBe(38);
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
