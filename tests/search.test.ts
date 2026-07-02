/**
 * A simple example test that proves the Vitest setup works.
 * Real tool logic tests live next to each tool (logic.test.ts).
 */
import { describe, it, expect } from "vitest";
import { scoreString, searchTools } from "../src/lib/search";
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
});
