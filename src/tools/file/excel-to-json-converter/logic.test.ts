import { describe, it, expect, beforeEach } from "vitest";
import {
  toCamelCase, toSnakeCase, transformKey, inferCellValue,
  sheetToJson, sheetsToJson, groupByColumn, toJsonl, toJson,
  getStats, loadHistory, saveToHistory, clearHistory,
  type SheetData,
} from "./logic";

describe("excel-to-json key transforms", () => {
  it("camelCase", () => {
    expect(toCamelCase("First Name")).toBe("firstName");
    expect(toCamelCase("user_email")).toBe("userEmail");
    expect(toCamelCase("HTTP-Response")).toBe("hTTPResponse"); // known edge case
  });
  it("snake_case", () => {
    expect(toSnakeCase("FirstName")).toBe("first_name");
    expect(toSnakeCase("user email")).toBe("user_email");
  });
  it("original", () => {
    expect(transformKey("My Key", "original")).toBe("My Key");
  });
});

describe("excel-to-json inferCellValue", () => {
  it("infers numbers", () => { expect(inferCellValue("42")).toBe(42); expect(inferCellValue("3.14")).toBe(3.14); });
  it("infers booleans", () => { expect(inferCellValue("true")).toBe(true); expect(inferCellValue("false")).toBe(false); });
  it("preserves dates", () => { expect(inferCellValue("2026-01-15")).toBe("2026-01-15"); });
  it("preserves strings", () => { expect(inferCellValue("hello")).toBe("hello"); });
  it("returns null for empty", () => { expect(inferCellValue("")).toBeNull(); });
});

describe("excel-to-json sheetToJson", () => {
  it("converts simple sheet", () => {
    const rows = [["name", "age"], ["Alice", "30"], ["Bob", "25"]];
    const json = sheetToJson(rows);
    expect(json).toHaveLength(2);
    expect(json[0].name).toBe("Alice");
    expect(json[0].age).toBe(30);
  });
  it("skips empty rows", () => {
    const rows = [["a", "b"], ["1", "2"], ["", ""]];
    const json = sheetToJson(rows);
    expect(json).toHaveLength(1);
  });
  it("applies key naming", () => {
    const rows = [["First Name", "Age"], ["Alice", "30"]];
    const json = sheetToJson(rows, { keyNaming: "camelCase" });
    expect(json[0]).toHaveProperty("firstName");
  });
  it("returns empty for no data rows", () => {
    expect(sheetToJson([["header"]])).toEqual([]);
    expect(sheetToJson([])).toEqual([]);
  });
});

describe("excel-to-json sheetsToJson", () => {
  it("converts multiple sheets", () => {
    const sheets: SheetData[] = [
      { name: "Sheet1", rows: [["a"], ["1"]] },
      { name: "Sheet2", rows: [["b"], ["2"]] },
    ];
    const result = sheetsToJson(sheets);
    expect(Object.keys(result)).toHaveLength(2);
    expect(result.Sheet1[0].a).toBe(1);
  });
});

describe("excel-to-json groupByColumn", () => {
  it("groups by column value", () => {
    const data = [{ dept: "Eng", name: "A" }, { dept: "Eng", name: "B" }, { dept: "Sales", name: "C" }];
    const grouped = groupByColumn(data, "dept");
    expect(Object.keys(grouped)).toHaveLength(2);
    expect(grouped.Eng).toHaveLength(2);
  });
});

describe("excel-to-json toJsonl", () => {
  it("one object per line", () => {
    const data = [{ a: 1 }, { b: 2 }];
    const jsonl = toJsonl(data);
    expect(jsonl.split("\n")).toHaveLength(2);
    expect(JSON.parse(jsonl.split("\n")[0]).a).toBe(1);
  });
});

describe("excel-to-json getStats", () => {
  it("computes stats", () => {
    const sheets: SheetData[] = [{ name: "S1", rows: [["a", "b"], ["1", "2"], ["3", "4"]] }];
    const stats = getStats(sheets, '{"a":1}', 0);
    expect(stats.rowCount).toBe(2);
    expect(stats.columnCount).toBe(2);
    expect(stats.sheetCount).toBe(1);
  });
});

describe("excel-to-json history", () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    (globalThis as any).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
    };
  });
  it("saves and loads", () => {
    saveToHistory({ filename: "test.xlsx", sheetName: "Sheet1", rowCount: 10, convertedAt: "2026-01-01" });
    expect(loadHistory()).toHaveLength(1);
  });
  it("clears", () => {
    saveToHistory({ filename: "t.xlsx", sheetName: "S", rowCount: 1, convertedAt: "" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});
