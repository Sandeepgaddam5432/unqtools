import { describe, it, expect, beforeEach } from "vitest";
import {
  isValidUrl,
  extractDomain,
  parseUrlInput,
  parseBulkUrls,
  dedupEntries,
  sortEntries,
  formatEntry,
  validateEntry,
  generateDisavowFile,
  parseDisavowFile,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  GOOGLE_DISAVOW_DOCS_URL,
  type DisavowEntry,
} from "./logic";

beforeEach(() => {
  const store: Record<string, string> = {};
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k];
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  };
});

describe("disavow-file-generator validators", () => {
  it("isValidUrl accepts https", () => {
    expect(isValidUrl("https://example.com/x")).toBe(true);
  });
  it("isValidUrl accepts http", () => {
    expect(isValidUrl("http://example.com/x")).toBe(true);
  });
  it("isValidUrl rejects bare strings", () => {
    expect(isValidUrl("not a url")).toBe(false);
    expect(isValidUrl("")).toBe(false);
    expect(isValidUrl("example.com")).toBe(false);
  });
  it("extractDomain extracts from URL", () => {
    expect(extractDomain("https://www.example.com/path")).toBe("example.com");
    expect(extractDomain("https://sub.example.com/path")).toBe("sub.example.com");
  });
  it("extractDomain accepts bare domain", () => {
    expect(extractDomain("example.com")).toBe("example.com");
  });
  it("extractDomain strips www", () => {
    expect(extractDomain("www.example.com")).toBe("example.com");
  });
  it("extractDomain returns null for invalid", () => {
    expect(extractDomain("not a domain")).toBeNull();
    expect(extractDomain("")).toBeNull();
  });
});

describe("disavow-file-generator parseUrlInput", () => {
  it("parses a valid URL", () => {
    const r = parseUrlInput("https://example.com/x");
    expect(r.valid).toBe(true);
    expect(r.domain).toBe("example.com");
  });
  it("parses a bare domain", () => {
    const r = parseUrlInput("example.com");
    expect(r.valid).toBe(true);
    expect(r.domain).toBe("example.com");
  });
  it("rejects empty input", () => {
    const r = parseUrlInput("");
    expect(r.valid).toBe(false);
  });
  it("rejects garbage input", () => {
    const r = parseUrlInput("not a url");
    expect(r.valid).toBe(false);
  });
});

describe("disavow-file-generator parseBulkUrls", () => {
  it("splits lines into urls", () => {
    const { urls } = parseBulkUrls("https://a.com\nhttps://b.com");
    expect(urls).toHaveLength(2);
  });
  it("extracts comments", () => {
    const { urls, comments } = parseBulkUrls("# my comment\nhttps://a.com");
    expect(urls).toEqual(["https://a.com"]);
    expect(comments).toEqual(["my comment"]);
  });
  it("ignores empty lines", () => {
    const { urls } = parseBulkUrls("https://a.com\n\n\nhttps://b.com");
    expect(urls).toHaveLength(2);
  });
  it("handles empty input", () => {
    expect(parseBulkUrls("")).toEqual({ urls: [], comments: [] });
  });
});

describe("disavow-file-generator dedupEntries", () => {
  it("removes duplicates case-insensitively", () => {
    const entries: DisavowEntry[] = [
      { mode: "domain", value: "example.com", raw: "example.com" },
      { mode: "domain", value: "EXAMPLE.COM", raw: "EXAMPLE.COM" },
      { mode: "domain", value: "test.com", raw: "test.com" },
    ];
    const { entries: out, removed } = dedupEntries(entries);
    expect(out).toHaveLength(2);
    expect(removed).toBe(1);
  });
  it("preserves order of first occurrence", () => {
    const entries: DisavowEntry[] = [
      { mode: "domain", value: "b.com", raw: "" },
      { mode: "domain", value: "a.com", raw: "" },
      { mode: "domain", value: "b.com", raw: "" },
    ];
    const { entries: out } = dedupEntries(entries);
    expect(out.map((e) => e.value)).toEqual(["b.com", "a.com"]);
  });
  it("returns 0 removed when no dupes", () => {
    const entries: DisavowEntry[] = [
      { mode: "domain", value: "a.com", raw: "" },
      { mode: "domain", value: "b.com", raw: "" },
    ];
    const { removed } = dedupEntries(entries);
    expect(removed).toBe(0);
  });
});

describe("disavow-file-generator sortEntries", () => {
  it("sorts alphabetically within mode", () => {
    const entries: DisavowEntry[] = [
      { mode: "domain", value: "z.com", raw: "" },
      { mode: "domain", value: "a.com", raw: "" },
    ];
    const out = sortEntries(entries);
    expect(out.map((e) => e.value)).toEqual(["a.com", "z.com"]);
  });
  it("domains come before urls", () => {
    const entries: DisavowEntry[] = [
      { mode: "url", value: "https://aaa.com/", raw: "" },
      { mode: "domain", value: "zzz.com", raw: "" },
    ];
    const out = sortEntries(entries);
    expect(out[0].mode).toBe("domain");
  });
});

describe("disavow-file-generator formatEntry", () => {
  it("formats domain with domain: prefix", () => {
    expect(formatEntry({ mode: "domain", value: "example.com", raw: "" })).toBe(
      "domain:example.com",
    );
  });
  it("formats URL as-is", () => {
    expect(formatEntry({ mode: "url", value: "https://example.com/x", raw: "" })).toBe(
      "https://example.com/x",
    );
  });
});

describe("disavow-file-generator validateEntry", () => {
  it("accepts valid domain", () => {
    expect(validateEntry({ mode: "domain", value: "example.com", raw: "" }).valid).toBe(true);
  });
  it("rejects invalid domain", () => {
    expect(validateEntry({ mode: "domain", value: "not_a_domain", raw: "" }).valid).toBe(false);
  });
  it("accepts valid URL", () => {
    expect(validateEntry({ mode: "url", value: "https://example.com/x", raw: "" }).valid).toBe(true);
  });
  it("rejects invalid URL", () => {
    expect(validateEntry({ mode: "url", value: "not a url", raw: "" }).valid).toBe(false);
  });
});

describe("disavow-file-generator generateDisavowFile", () => {
  it("generates domain-level disavow file", () => {
    const r = generateDisavowFile(
      "https://spam1.com/x\nhttps://spam2.com/y",
      { mode: "domain" },
    );
    expect(r.output).toContain("domain:spam1.com");
    expect(r.output).toContain("domain:spam2.com");
    expect(r.stats.mode).toBe("domain");
    expect(r.stats.validEntries).toBe(2);
  });
  it("generates URL-level disavow file", () => {
    const r = generateDisavowFile(
      "https://spam1.com/x\nhttps://spam2.com/y",
      { mode: "url" },
    );
    expect(r.output).toContain("https://spam1.com/x");
    expect(r.output).toContain("https://spam2.com/y");
    expect(r.stats.mode).toBe("url");
  });
  it("includes header comment with date", () => {
    const r = generateDisavowFile("https://a.com", { mode: "domain" });
    expect(r.output).toContain("# Disavow file generated");
    expect(r.output).toContain("# Mode:");
  });
  it("includes user comments when provided", () => {
    const r = generateDisavowFile("https://a.com", {
      mode: "domain",
      comment: "Spammy sites from Oct 2026",
    });
    expect(r.output).toContain("Spammy sites from Oct 2026");
  });
  it("dedups by default", () => {
    const r = generateDisavowFile(
      "https://spam.com/a\nhttps://spam.com/b",
      { mode: "domain" },
    );
    expect(r.stats.validEntries).toBe(1);
    expect(r.stats.duplicatesRemoved).toBe(1);
  });
  it("can disable dedup", () => {
    const r = generateDisavowFile(
      "https://spam.com/a\nhttps://spam.com/b",
      { mode: "url", dedup: false },
    );
    expect(r.stats.validEntries).toBe(2);
  });
  it("sorts when enabled", () => {
    const r = generateDisavowFile(
      "https://z.com\nhttps://a.com",
      { mode: "domain", sort: true },
    );
    const lines = r.output.split("\n").filter((l) => l.startsWith("domain:"));
    expect(lines[0]).toBe("domain:a.com");
    expect(lines[1]).toBe("domain:z.com");
  });
  it("records invalid URLs in errors", () => {
    const r = generateDisavowFile("https://a.com\nnot a url", { mode: "domain" });
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.stats.invalidEntries).toBe(1);
  });
  it("computes unique counts", () => {
    const r = generateDisavowFile(
      "https://a.com\nhttps://b.com\nhttps://c.com",
      { mode: "domain" },
    );
    expect(r.stats.uniqueDomains).toBe(3);
    expect(r.stats.uniqueUrls).toBe(0);
  });
  it("handles empty input", () => {
    const r = generateDisavowFile("", { mode: "domain" });
    expect(r.entries).toHaveLength(0);
    expect(r.stats.validEntries).toBe(0);
  });
});

describe("disavow-file-generator parseDisavowFile", () => {
  it("parses domain: lines", () => {
    const { entries } = parseDisavowFile("domain:spam.com\ndomain:bad.com");
    expect(entries).toHaveLength(2);
    expect(entries[0].mode).toBe("domain");
    expect(entries[0].value).toBe("spam.com");
  });
  it("parses URL lines", () => {
    const { entries } = parseDisavowFile("https://spam.com/x");
    expect(entries).toHaveLength(1);
    expect(entries[0].mode).toBe("url");
  });
  it("extracts comments", () => {
    const { comments } = parseDisavowFile("# my note\ndomain:spam.com");
    expect(comments).toEqual(["my note"]);
  });
  it("records errors for unrecognized lines", () => {
    const { errors } = parseDisavowFile("garbage line\ndomain:spam.com");
    expect(errors.length).toBe(1);
  });
  it("handles empty input", () => {
    const { entries, comments, errors } = parseDisavowFile("");
    expect(entries).toHaveLength(0);
    expect(comments).toHaveLength(0);
    expect(errors).toHaveLength(0);
  });
});

describe("disavow-file-generator history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, mode: "domain", entryCount: 5, snippet: "..." });
    saveHistory({ ts: 2, mode: "url", entryCount: 3, snippet: "..." });
    expect(loadHistory()).toHaveLength(2);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, mode: "domain", entryCount: 1, snippet: "x" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, mode: "domain", entryCount: 1, snippet: "x" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("disavow-file-generator shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      text: "https://a.com",
      mode: "domain",
      dedup: true,
      sort: false,
      comment: "",
    });
    expect(url).toContain("text=");
    expect(url).toContain("mode=domain");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const parsed = parseShareUrl("text=https%3A%2F%2Fa.com&mode=url&dedup=1&sort=0");
    expect(parsed.text).toBe("https://a.com");
    expect(parsed.mode).toBe("url");
    expect(parsed.dedup).toBe(true);
    expect(parsed.sort).toBe(false);
  });
  it("returns empty for empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("includes comment when set", () => {
    const url = buildShareUrl({
      text: "x",
      mode: "domain",
      dedup: true,
      sort: false,
      comment: "spam sites",
    });
    expect(url).toContain("comment=spam+sites");
  });
});

describe("disavow-file-generator docs URL", () => {
  it("points to Google disavow docs", () => {
    expect(GOOGLE_DISAVOW_DOCS_URL).toContain("support.google.com");
    expect(GOOGLE_DISAVOW_DOCS_URL).toContain("2648487");
  });
});
