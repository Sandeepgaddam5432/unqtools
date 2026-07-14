import { describe, it, expect, beforeEach } from "vitest";
import {
  splitFilename, applyCase, removeCharacters, keepAlphanumeric,
  truncate, applyFindReplace, padNumber, sortFiles,
  renameOne, buildRenamePlan, planToJson, planToCsv, buildUndoPlan,
  loadHistory, saveToHistory, clearHistory, buildShareUrl,
  DEFAULT_OPTIONS,
  type RenameOptions, type FileEntry,
} from "./logic";

function file(name: string, size: number = 100, lastModified: number = 0): FileEntry {
  return {
    id: `${name}-${size}-${lastModified}`,
    name, size, lastModified,
    file: new File(["x"], name),
  };
}

describe("rename splitFilename", () => {
  it("splits stem + extension", () => {
    expect(splitFilename("file.txt")).toEqual({ stem: "file", ext: "txt" });
  });
  it("handles no extension", () => {
    expect(splitFilename("file")).toEqual({ stem: "file", ext: "" });
  });
  it("handles multiple dots (last dot wins)", () => {
    expect(splitFilename("archive.tar.gz")).toEqual({ stem: "archive.tar", ext: "gz" });
  });
  it("handles hidden files (leading dot)", () => {
    expect(splitFilename(".gitignore")).toEqual({ stem: ".gitignore", ext: "" });
  });
});

describe("rename applyCase", () => {
  it("upper", () => {
    expect(applyCase("hello", "upper")).toBe("HELLO");
  });
  it("lower", () => {
    expect(applyCase("HELLO", "lower")).toBe("hello");
  });
  it("title", () => {
    expect(applyCase("hello world", "title")).toBe("Hello World");
  });
  it("kebab", () => {
    expect(applyCase("helloWorld", "kebab")).toBe("hello-world");
  });
  it("kebab from snake", () => {
    expect(applyCase("hello_world", "kebab")).toBe("hello-world");
  });
  it("camel", () => {
    expect(applyCase("hello-world", "camel")).toBe("helloWorld");
  });
  it("camel from snake", () => {
    expect(applyCase("hello_world", "camel")).toBe("helloWorld");
  });
  it("snake", () => {
    expect(applyCase("helloWorld", "snake")).toBe("hello_world");
  });
  it("none leaves unchanged", () => {
    expect(applyCase("hello", "none")).toBe("hello");
  });
});

describe("rename removeCharacters + keepAlphanumeric + truncate", () => {
  it("removes specified characters", () => {
    expect(removeCharacters("a b-c", " -")).toBe("abc");
  });
  it("removes nothing if chars empty", () => {
    expect(removeCharacters("abc", "")).toBe("abc");
  });
  it("keeps only alphanumeric + dash + underscore", () => {
    expect(keepAlphanumeric("hello!@# world_123-")).toBe("helloworld_123-");
  });
  it("truncate to max length", () => {
    expect(truncate("hello world", 5)).toBe("hello");
  });
  it("truncate leaves short text unchanged", () => {
    expect(truncate("hi", 5)).toBe("hi");
  });
  it("truncate with 0 or negative = no-op", () => {
    expect(truncate("hello", 0)).toBe("hello");
  });
});

describe("rename applyFindReplace", () => {
  it("plain replace", () => {
    expect(applyFindReplace("hello world", "world", "there", "plain")).toBe("hello there");
  });
  it("plain replace all occurrences", () => {
    expect(applyFindReplace("aaa", "a", "b", "plain")).toBe("bbb");
  });
  it("regex with capture groups", () => {
    expect(applyFindReplace("2026-01-15", "(\\d{4})-(\\d{2})-(\\d{2})", "$3-$2-$1", "regex")).toBe("15-01-2026");
  });
  it("regex with invalid pattern returns text unchanged", () => {
    expect(applyFindReplace("hello", "(", "", "regex")).toBe("hello");
  });
  it("empty find returns text unchanged", () => {
    expect(applyFindReplace("hello", "", "x", "plain")).toBe("hello");
  });
});

describe("rename padNumber", () => {
  it("pads to width 3", () => {
    expect(padNumber(5, 3)).toBe("005");
  });
  it("does not truncate longer numbers", () => {
    expect(padNumber(12345, 3)).toBe("12345");
  });
});

describe("rename sortFiles", () => {
  it("sorts by name asc", () => {
    const files = [file("c"), file("a"), file("b")];
    const sorted = sortFiles(files, "name", "asc");
    expect(sorted.map((f) => f.name)).toEqual(["a", "b", "c"]);
  });
  it("sorts by size desc", () => {
    const files = [file("a", 10), file("b", 30), file("c", 20)];
    const sorted = sortFiles(files, "size", "desc");
    expect(sorted.map((f) => f.size)).toEqual([30, 20, 10]);
  });
  it("sorts by date asc", () => {
    const files = [file("a", 1, 200), file("b", 1, 100)];
    const sorted = sortFiles(files, "date", "asc");
    expect(sorted[0].name).toBe("b");
  });
  it("none key returns same order", () => {
    const files = [file("b"), file("a")];
    expect(sortFiles(files, "none", "asc")).toHaveLength(2);
  });
});

describe("rename renameOne", () => {
  it("applies find/replace (plain)", () => {
    const opts: RenameOptions = { ...DEFAULT_OPTIONS, find: "hello", replace: "world" };
    expect(renameOne("hello.txt", opts, 0)).toBe("world.txt");
  });
  it("applies find/replace (regex)", () => {
    const opts: RenameOptions = { ...DEFAULT_OPTIONS, find: "\\d+", replace: "NUM", findMode: "regex" };
    expect(renameOne("file123.txt", opts, 0)).toBe("fileNUM.txt");
  });
  it("applies case conversion", () => {
    const opts: RenameOptions = { ...DEFAULT_OPTIONS, caseConversion: "upper" };
    expect(renameOne("hello.txt", opts, 0)).toBe("HELLO.txt");
  });
  it("applies prefix + suffix", () => {
    const opts: RenameOptions = { ...DEFAULT_OPTIONS, prefix: "pre_", suffix: "_post" };
    expect(renameOne("file.txt", opts, 0)).toBe("pre_file_post.txt");
  });
  it("removes extension", () => {
    const opts: RenameOptions = { ...DEFAULT_OPTIONS, removeExtension: true };
    expect(renameOne("file.txt", opts, 0)).toBe("file");
  });
  it("changes extension", () => {
    const opts: RenameOptions = { ...DEFAULT_OPTIONS, changeExtension: "csv" };
    expect(renameOne("file.txt", opts, 0)).toBe("file.csv");
  });
  it("removes specific characters", () => {
    const opts: RenameOptions = { ...DEFAULT_OPTIONS, removeChars: " -" };
    expect(renameOne("my file - v2.txt", opts, 0)).toBe("myfilev2.txt");
  });
  it("keeps only alphanumeric", () => {
    const opts: RenameOptions = { ...DEFAULT_OPTIONS, keepAlphanumericOnly: true };
    expect(renameOne("hello!@# world_123-.txt", opts, 0)).toBe("helloworld_123-.txt");
  });
  it("truncates to max length", () => {
    const opts: RenameOptions = { ...DEFAULT_OPTIONS, maxLength: 5 };
    expect(renameOne("verylongfilename.txt", opts, 0)).toBe("veryl.txt");
  });
  it("applies pattern with {n} placeholder", () => {
    const opts: RenameOptions = { ...DEFAULT_OPTIONS, pattern: "img_{n}", numberStart: 1, numberPad: 3 };
    expect(renameOne("photo.jpg", opts, 0)).toBe("img_001.jpg");
    expect(renameOne("photo.jpg", opts, 9)).toBe("img_010.jpg");
  });
  it("applies pattern with {name} placeholder", () => {
    const opts: RenameOptions = { ...DEFAULT_OPTIONS, pattern: "{name}_backup" };
    expect(renameOne("file.txt", opts, 0)).toBe("file_backup.txt");
  });
  it("combines multiple rules", () => {
    const opts: RenameOptions = {
      ...DEFAULT_OPTIONS,
      prefix: "2026_",
      caseConversion: "lower",
      pattern: "{name}",
    };
    expect(renameOne("MyFile.TXT", opts, 0)).toBe("2026_myfile.TXT");
  });
});

describe("rename buildRenamePlan", () => {
  it("builds plan for multiple files", () => {
    const files = [file("a.txt"), file("b.txt"), file("c.txt")];
    const opts: RenameOptions = { ...DEFAULT_OPTIONS, caseConversion: "upper" };
    const { plan, stats } = buildRenamePlan(files, opts);
    expect(plan).toHaveLength(3);
    expect(stats.changed).toBe(3);
    expect(stats.total).toBe(3);
  });
  it("detects unchanged files", () => {
    const files = [file("a.txt")];
    const opts: RenameOptions = { ...DEFAULT_OPTIONS };
    const { stats } = buildRenamePlan(files, opts);
    expect(stats.changed).toBe(0);
    expect(stats.unchanged).toBe(1);
  });
  it("detects name collisions", () => {
    const files = [file("a.txt"), file("b.txt")];
    const opts: RenameOptions = { ...DEFAULT_OPTIONS, pattern: "same", changeExtension: "txt" };
    const { plan, stats } = buildRenamePlan(files, opts);
    expect(stats.warnings).toBeGreaterThan(0);
    const collision = plan.find((p) => p.warning?.includes("collision"));
    expect(collision).toBeDefined();
  });
  it("sorts files before numbering", () => {
    const files = [file("c.jpg"), file("a.jpg"), file("b.jpg")];
    const opts: RenameOptions = {
      ...DEFAULT_OPTIONS,
      pattern: "img_{n}",
      numberPad: 3,
      sortKey: "name",
      sortDir: "asc",
    };
    const { plan } = buildRenamePlan(files, opts);
    // After sort, a.jpg gets index 0 → img_001
    expect(plan[0].original).toBe("a.jpg");
    expect(plan[0].renamed).toBe("img_001.jpg");
  });
});

describe("rename planToJson + planToCsv", () => {
  it("exports JSON with stats", () => {
    const files = [file("a.txt"), file("b.txt")];
    const opts: RenameOptions = { ...DEFAULT_OPTIONS, caseConversion: "upper" };
    const { plan, stats } = buildRenamePlan(files, opts);
    const json = planToJson(plan, stats);
    const parsed = JSON.parse(json);
    expect(parsed.stats.total).toBe(2);
    expect(parsed.plan).toHaveLength(2);
    expect(parsed.plan[0].original).toBe("a.txt");
    expect(parsed.plan[0].renamed).toBe("A.txt");
  });
  it("exports CSV with header", () => {
    const files = [file("a.txt")];
    const opts: RenameOptions = { ...DEFAULT_OPTIONS, caseConversion: "upper" };
    const { plan } = buildRenamePlan(files, opts);
    const csv = planToCsv(plan);
    expect(csv).toContain("original,renamed,changed,warning");
    expect(csv).toContain("a.txt");
    expect(csv).toContain("A.txt");
  });
});

describe("rename buildUndoPlan", () => {
  it("reverses original ↔ renamed", () => {
    const files = [file("a.txt"), file("b.txt")];
    const opts: RenameOptions = { ...DEFAULT_OPTIONS, caseConversion: "upper" };
    const { plan } = buildRenamePlan(files, opts);
    const undo = buildUndoPlan(plan);
    expect(undo).toHaveLength(2);
    expect(undo[0].original).toBe("A.txt");
    expect(undo[0].renamed).toBe("a.txt");
  });
  it("excludes unchanged entries", () => {
    const files = [file("a.txt")];
    const opts: RenameOptions = { ...DEFAULT_OPTIONS };
    const { plan } = buildRenamePlan(files, opts);
    const undo = buildUndoPlan(plan);
    expect(undo).toHaveLength(0);
  });
});

describe("rename history", () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    (globalThis as any).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
    };
  });
  it("saves and loads", () => {
    saveToHistory({ fileCount: 5, changed: 3, options: DEFAULT_OPTIONS, renamedAt: "2026-01-01" });
    expect(loadHistory()).toHaveLength(1);
  });
  it("clears", () => {
    saveToHistory({ fileCount: 5, changed: 3, options: DEFAULT_OPTIONS, renamedAt: "2026-01-01" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("rename buildShareUrl", () => {
  it("builds share URL with params", () => {
    (globalThis as any).window = { location: { origin: "https://x.io", pathname: "/tools/rename" } };
    const url = buildShareUrl({ ...DEFAULT_OPTIONS, find: "old", replace: "new" });
    expect(url).toContain("#find=old");
    expect(url).toContain("replace=new");
    delete (globalThis as any).window;
  });
});
