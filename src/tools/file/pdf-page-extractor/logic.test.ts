import { describe, it, expect, beforeEach } from "vitest";
import { parsePageRanges, formatBytes, loadHistory, saveToHistory, clearHistory, type ExtractOptions } from "./logic";

describe("pdf-page-extractor parsePageRanges", () => {
  it("returns all pages for empty string", () => { expect(parsePageRanges("", 5)).toEqual([0,1,2,3,4]); });
  it("parses single page", () => { expect(parsePageRanges("3", 10)).toEqual([2]); });
  it("parses range", () => { expect(parsePageRanges("1-3", 10)).toEqual([0,1,2]); });
  it("parses comma-separated", () => { expect(parsePageRanges("1,3,5", 10)).toEqual([0,2,4]); });
  it("parses mixed", () => { expect(parsePageRanges("1-3,5,7-8", 10)).toEqual([0,1,2,4,6,7]); });
  it("deduplicates", () => { expect(parsePageRanges("1,1,2", 5)).toEqual([0,1]); });
  it("clamps to total", () => { expect(parsePageRanges("1-100", 5)).toEqual([0,1,2,3,4]); });
  it("skips invalid", () => { expect(parsePageRanges("abc,2", 5)).toEqual([1]); });
  it("handles whitespace", () => { expect(parsePageRanges(" 1 - 3 , 5 ", 10)).toEqual([0,1,2,4]); });
  it("handles zero page", () => { expect(parsePageRanges("0", 5)).toEqual([]); });
  it("handles negative", () => { expect(parsePageRanges("-1", 5)).toEqual([]); });
  it("handles reverse range", () => { expect(parsePageRanges("5-3", 10)).toEqual([]); });
  it("handles single page beyond total", () => { expect(parsePageRanges("100", 5)).toEqual([]); });
  it("handles range starting beyond total", () => { expect(parsePageRanges("6-10", 5)).toEqual([]); });
  it("handles partial range beyond total", () => { expect(parsePageRanges("3-10", 5)).toEqual([2,3,4]); });
});

describe("pdf-page-extractor formatBytes", () => {
  it("formats 0", () => { expect(formatBytes(0)).toBe("0 B"); });
  it("formats KB", () => { expect(formatBytes(1024)).toBe("1.0 KB"); });
  it("formats MB", () => { expect(formatBytes(1048576)).toBe("1.0 MB"); });
});

describe("pdf-page-extractor history", () => {
  beforeEach(() => { const s:Record<string,string>={}; (globalThis as any).localStorage={getItem:(k:string)=>s[k]??null,setItem:(k:string,v:string)=>{s[k]=v;},removeItem:(k:string)=>{delete s[k];}}; });
  it("saves and loads", () => { saveToHistory({filename:"test.pdf",pageCount:3,extractedAt:"2026-01-01"}); expect(loadHistory()).toHaveLength(1); });
  it("clears", () => { saveToHistory({filename:"t.pdf",pageCount:1,extractedAt:""}); clearHistory(); expect(loadHistory()).toEqual([]); });
});
