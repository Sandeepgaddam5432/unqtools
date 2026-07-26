import { describe, it, expect } from "vitest";
import {
  DEFAULT_DICTIONARY,
  buildDictionary,
  findAcronyms,
  matchCase,
  expandAcronym,
  expandInline,
  buildGlossary,
  parseCustomDictionary,
  batchExpand,
  analyzeAcronyms,
  suggestExpansion,
  validateEntry,
  filterByCategory,
  exportCsv,
  glossaryToMarkdown,
} from "./logic";

const dict = buildDictionary(DEFAULT_DICTIONARY);

describe("buildDictionary", () => {
  it("builds case-insensitive map", () => {
    expect(dict.has("NASA")).toBe(true);
    expect(dict.has("nasa")).toBe(false); // keys are uppercased
  });
  it("groups multiple entries for same acronym", () => {
    expect(dict.get("USA")?.length).toBeGreaterThanOrEqual(1);
  });
});

describe("findAcronyms", () => {
  it("finds uppercase tokens", () => {
    expect(findAcronyms("NASA uses AI and ML")).toEqual(["NASA", "AI", "ML"]);
  });
  it("ignores single chars", () => {
    expect(findAcronyms("I went A to B")).toEqual([]);
  });
  it("allows digits", () => {
    expect(findAcronyms("B2B uses HTTP2")).toEqual(["B2B", "HTTP2"]);
  });
  it("returns empty for no acronyms", () => {
    expect(findAcronyms("hello world")).toEqual([]);
  });
});

describe("matchCase", () => {
  it("title-cases for upper acronym", () => {
    expect(matchCase("NASA", "national aeronautics")).toBe("National Aeronautics");
  });
  it("lowercases for lower acronym", () => {
    expect(matchCase("nasa", "National Aeronautics")).toBe("national aeronautics");
  });
});

describe("expandAcronym", () => {
  it("expands known acronym", () => {
    expect(expandAcronym("NASA", dict)).toBe("National Aeronautics and Space Administration");
  });
  it("returns null for unknown acronym", () => {
    expect(expandAcronym("ZZZ", dict)).toBeNull();
  });
  it("is case-insensitive", () => {
    expect(expandAcronym("nasa", dict)).toBeTruthy();
  });
});

describe("expandInline", () => {
  it("expands all acronyms inline", () => {
    expect(expandInline("NASA did X", dict)).toBe("National Aeronautics and Space Administration did X");
  });
  it("leaves unknown acronyms untouched", () => {
    expect(expandInline("XYZQ did X", dict)).toBe("XYZQ did X");
  });
  it("supports keepAcronym mode", () => {
    const out = expandInline("NASA did X", dict, { keepAcronym: true });
    expect(out).toMatch(/^NASA \(National Aeronautics/);
  });
});

describe("buildGlossary", () => {
  it("builds unique sorted glossary", () => {
    const g = buildGlossary("NASA NASA AI ML", dict);
    expect(g).toHaveLength(3);
    expect(g[0].acronym).toBe("NASA");
    expect(g[0].count).toBe(2);
  });
  it("includes unknown acronyms with — expansion", () => {
    const g = buildGlossary("ZZZQ", dict);
    expect(g[0].expansion).toBe("—");
  });
});

describe("parseCustomDictionary", () => {
  it("parses = format", () => {
    const r = parseCustomDictionary("XYZ = eXample Zebras Yelling");
    expect(r[0].acronym).toBe("XYZ");
    expect(r[0].expansion).toBe("eXample Zebras Yelling");
  });
  it("parses comma format", () => {
    const r = parseCustomDictionary("ABC,Alpha Beta Gamma");
    expect(r[0].acronym).toBe("ABC");
  });
  it("parses tab format", () => {
    const r = parseCustomDictionary("DEF\tDelta Epsilon Foxtrot");
    expect(r[0].acronym).toBe("DEF");
  });
  it("ignores empty lines", () => {
    expect(parseCustomDictionary("\n  \nABC,Alpha Beta")).toHaveLength(1);
  });
});

describe("batchExpand", () => {
  it("preserves newlines", () => {
    const out = batchExpand("NASA\nAI", dict);
    expect(out.split("\n")).toHaveLength(2);
  });
  it("supports keepAcronym", () => {
    const out = batchExpand("NASA", dict, true);
    expect(out).toMatch(/^NASA \(/);
  });
});

describe("analyzeAcronyms", () => {
  it("counts totals", () => {
    const r = analyzeAcronyms("NASA NASA AI XYZQ", dict);
    expect(r.total).toBe(4);
    expect(r.unique).toBe(3);
    expect(r.recognized).toBe(2);
    expect(r.unrecognized).toBe(1);
    expect(r.unrecognizedList).toEqual(["XYZQ"]);
  });
});

describe("suggestExpansion", () => {
  it("suggests based on initials in surrounding text", () => {
    const s = suggestExpansion("NASA", "the National Aeronautics and Space Administration works hard");
    expect(s).toContain("National Aeronautics and Space Administration");
  });
  it("returns empty when no match", () => {
    expect(suggestExpansion("XYZQ", "no matching words here")).toHaveLength(0);
  });
});

describe("validateEntry", () => {
  it("flags empty acronym", () => {
    expect(validateEntry({ acronym: "", expansion: "x" })).toContain("Acronym is empty");
  });
  it("flags empty expansion", () => {
    expect(validateEntry({ acronym: "ABC", expansion: "" })).toContain("Expansion is empty");
  });
  it("flags too-long acronym", () => {
    expect(validateEntry({ acronym: "A".repeat(25), expansion: "x" })).toContain("Acronym too long");
  });
  it("passes valid entry", () => {
    expect(validateEntry({ acronym: "ABC", expansion: "Alpha Beta" })).toHaveLength(0);
  });
});

describe("filterByCategory", () => {
  it("filters by category", () => {
    const r = filterByCategory(DEFAULT_DICTIONARY, "govt");
    expect(r.length).toBeGreaterThan(5);
    expect(r.every((e) => e.category === "govt")).toBe(true);
  });
});

describe("exportCsv", () => {
  it("produces CSV header + rows", () => {
    const csv = exportCsv([{ acronym: "ABC", expansion: "Alpha Beta", category: "test" }]);
    expect(csv.split("\n")[0]).toBe("acronym,expansion,category");
    expect(csv).toContain("ABC");
  });
  it("escapes quotes in expansion", () => {
    const csv = exportCsv([{ acronym: "ABC", expansion: 'Alpha "Beta"' }]);
    expect(csv).toContain('""Beta""');
  });
});

describe("glossaryToMarkdown", () => {
  it("produces markdown table", () => {
    const md = glossaryToMarkdown([{ acronym: "NASA", expansion: "National Aeronautics and Space Administration", count: 2, category: "govt" }]);
    expect(md.split("\n")[0]).toBe("| Acronym | Expansion | Count | Category |");
    expect(md).toContain("| NASA |");
  });
});
