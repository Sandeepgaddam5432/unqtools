/**
 * A simple example test that proves the Vitest setup works.
 * Real tool logic tests live next to each tool (logic.test.ts).
 */
import { describe, it, expect } from "vitest";
import { scoreString, searchTools, expandQuery } from "../src/lib/search";
import type { ToolManifest } from "../src/lib/tool";

const sampleTool = (overrides: Partial<ToolManifest>): ToolManifest =>
  ({
    id: "x",
    name: "X",
    description: "",
    category: "developer",
    keywords: [],
    icon: "x",
    component: async () => ({ default: () => null as never }),
    ...overrides,
  }) as ToolManifest;

describe("scoreString", () => {
  it("scores exact matches highest", () => {
    expect(scoreString("json", "json")).toBeGreaterThan(scoreString("json", "json formatter"));
  });

  it("returns 0 when query is not a subsequence", () => {
    expect(scoreString("abc", "xyz")).toBe(0);
  });

  it("returns 1 for empty query", () => {
    expect(scoreString("", "anything")).toBe(1);
  });

  it("scores prefix matches higher than substring matches", () => {
    expect(scoreString("json", "json formatter")).toBeGreaterThan(
      scoreString("json", "pretty json"),
    );
  });
});

describe("expandQuery", () => {
  it("returns original tokens plus intent synonyms", () => {
    const terms = expandQuery("shrink my pdf");
    expect(terms).toContain("shrink");
    expect(terms).toContain("compress");
    expect(terms).toContain("reduce");
    expect(terms).toContain("pdf");
    // stopwords are dropped
    expect(terms).not.toContain("my");
  });

  it("drops short/noise tokens", () => {
    const terms = expandQuery("a to be");
    expect(terms.every((t) => t.length >= 3)).toBe(true);
  });

  it("handles everyday intent phrases", () => {
    const terms = expandQuery("make my pdf smaller");
    expect(terms).toContain("compress");
    expect(terms).toContain("create");
    expect(terms).toContain("convert");
  });
});

describe("searchTools", () => {
  const tools = [
    sampleTool({ id: "json-formatter", name: "JSON Formatter", keywords: ["json"] }),
    sampleTool({ id: "base64", name: "Base64 Encoder", keywords: ["base64", "encode"] }),
  ];

  it("returns all tools for empty query", () => {
    expect(searchTools("", tools).length).toBe(2);
  });

  it("ranks matching tools", () => {
    const out = searchTools("json", tools);
    expect(out.length).toBe(1);
    expect(out[0].tool.id).toBe("json-formatter");
  });

  it("returns empty array when nothing matches", () => {
    expect(searchTools("nothing-here", tools).length).toBe(0);
  });

  it("finds compress tools for intent phrasing 'shrink'", () => {
    const tools2 = [
      sampleTool({ id: "compress-pdf", name: "Compress PDF", keywords: ["compress pdf", "reduce"] }),
      sampleTool({ id: "merge-pdf", name: "Merge PDF", keywords: ["merge", "combine"] }),
    ];
    const out = searchTools("shrink my pdf", tools2);
    expect(out.length).toBeGreaterThan(0);
    expect(out[0].tool.id).toBe("compress-pdf");
  });

  it("finds merge tools for intent phrasing 'join'", () => {
    const tools2 = [
      sampleTool({ id: "compress-pdf", name: "Compress PDF", keywords: ["compress"] }),
      sampleTool({ id: "merge-pdf", name: "Merge PDF", keywords: ["merge", "combine"] }),
    ];
    const out = searchTools("join two pdfs", tools2);
    expect(out.length).toBeGreaterThan(0);
    expect(out[0].tool.id).toBe("merge-pdf");
  });

  it("does not flood results with synonym noise for direct queries", () => {
    const tools2 = [
      sampleTool({ id: "compress-pdf", name: "Compress PDF", keywords: ["compress"] }),
      sampleTool({ id: "image-compressor", name: "Image Compressor", keywords: ["compress image"] }),
      sampleTool({ id: "merge-pdf", name: "Merge PDF", keywords: ["merge"] }),
    ];
    const out = searchTools("compress pdf", tools2);
    expect(out[0].tool.id).toBe("compress-pdf");
  });
});
