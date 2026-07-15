import { describe, it, expect, beforeEach, afterAll } from "vitest";
import {
  splitFilename, applyCase, validateExtension, normalizeExtension,
  applyFindReplace, renameOne, buildRenamePlan, planToJson, planToCsv,
  buildUndoPlan, EXTENSION_PRESETS,
  loadHistory, saveToHistory, clearHistory, buildShareUrl, parseShareUrl,
  DEFAULT_OPTIONS, type ExtensionOptions, type FileEntry,
} from "./logic";

function file(name: string, size: number = 100, lastModified: number = 0): FileEntry {
  return {
    id: `${name}-${size}-${lastModified}`,
    name, size, lastModified,
    file: new File(["x"], name),
  };
}

const opts = (o: Partial<ExtensionOptions> = {}): ExtensionOptions => ({ ...DEFAULT_OPTIONS, ...o });

describe("extc splitFilename", () => {
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

describe("extc applyCase", () => {
  it("upper", () => {
    expect(applyCase("txt", "upper")).toBe("TXT");
  });
  it("lower", () => {
    expect(applyCase("TXT", "lower")).toBe("txt");
  });
  it("none leaves unchanged", () => {
    expect(applyCase("TxT", "none")).toBe("TxT");
  });
});

describe("extc validateExtension", () => {
  it("accepts valid extension", () => {
    expect(validateExtension("txt").ok).toBe(true);
    expect(validateExtension("json").ok).toBe(true);
  });
  it("accepts extension with dash/underscore", () => {
    expect(validateExtension("my-ext_1").ok).toBe(true);
  });
  it("rejects empty", () => {
    expect(validateExtension("").ok).toBe(false);
  });
  it("rejects too long", () => {
    expect(validateExtension("verylongextension1234567").ok).toBe(false);
  });
  it("rejects special chars", () => {
    expect(validateExtension("tx.t").ok).toBe(false);
    expect(validateExtension("tx t").ok).toBe(false);
  });
});

describe("extc normalizeExtension", () => {
  it("strips leading dot", () => {
    expect(normalizeExtension(".txt")).toBe("txt");
  });
  it("strips multiple leading dots", () => {
    expect(normalizeExtension("..txt")).toBe("txt");
  });
  it("trims whitespace", () => {
    expect(normalizeExtension("  txt  ")).toBe("txt");
  });
});

describe("extc applyFindReplace", () => {
  it("plain replace", () => {
    expect(applyFindReplace("txt", "t", "x", "plain")).toBe("xxx");
  });
  it("regex with capture groups", () => {
    expect(applyFindReplace("jpg2000", "(jpg)(\\d+)", "$1", "regex")).toBe("jpg");
  });
  it("regex invalid returns unchanged", () => {
    expect(applyFindReplace("jpg", "(", "", "regex")).toBe("jpg");
  });
  it("empty find returns unchanged", () => {
    expect(applyFindReplace("jpg", "", "x", "plain")).toBe("jpg");
  });
});

describe("extc renameOne — add mode", () => {
  it("adds extension when none exists", () => {
    const r = renameOne("README", opts({ mode: "add", addExtension: "md" }));
    expect(r.renamed).toBe("README.md");
    expect(r.newExt).toBe("md");
  });
  it("does not add extension when one exists", () => {
    const r = renameOne("file.txt", opts({ mode: "add", addExtension: "md" }));
    expect(r.renamed).toBe("file.txt");
  });
  it("strips leading dot from addExtension", () => {
    const r = renameOne("README", opts({ mode: "add", addExtension: ".md" }));
    expect(r.renamed).toBe("README.md");
  });
});

describe("extc renameOne — remove mode", () => {
  it("removes extension", () => {
    const r = renameOne("file.txt", opts({ mode: "remove" }));
    expect(r.renamed).toBe("file");
    expect(r.newExt).toBe("");
  });
  it("leaves files without extension unchanged", () => {
    const r = renameOne("README", opts({ mode: "remove" }));
    expect(r.renamed).toBe("README");
  });
});

describe("extc renameOne — replace mode (plain)", () => {
  it("replaces matching extension", () => {
    const r = renameOne("file.jpeg", opts({
      mode: "replace", findMode: "plain", findExtension: "jpeg", replaceExtension: "jpg",
    }));
    expect(r.renamed).toBe("file.jpg");
  });
  it("does not change non-matching extension", () => {
    const r = renameOne("file.png", opts({
      mode: "replace", findMode: "plain", findExtension: "jpeg", replaceExtension: "jpg",
    }));
    expect(r.renamed).toBe("file.png");
  });
  it("empty find replaces any extension", () => {
    const r = renameOne("file.png", opts({
      mode: "replace", findMode: "plain", findExtension: "", replaceExtension: "jpg",
    }));
    expect(r.renamed).toBe("file.jpg");
  });
  it("case-insensitive match", () => {
    const r = renameOne("file.JPEG", opts({
      mode: "replace", findMode: "plain", findExtension: "jpeg", replaceExtension: "jpg",
    }));
    expect(r.renamed).toBe("file.jpg");
  });
  it("applies case conversion after replace", () => {
    const r = renameOne("file.txt", opts({
      mode: "replace", findMode: "plain", findExtension: "", replaceExtension: "TXT", caseMode: "lower",
    }));
    expect(r.renamed).toBe("file.txt");
  });
  it("uppercase case conversion", () => {
    const r = renameOne("file.txt", opts({
      mode: "replace", findMode: "plain", findExtension: "", replaceExtension: "md", caseMode: "upper",
    }));
    expect(r.renamed).toBe("file.MD");
  });
});

describe("extc renameOne — replace mode (regex)", () => {
  it("replaces extension using regex", () => {
    // Match digits at end of extension, replace with X
    const r = renameOne("file.jpg2000", opts({
      mode: "replace", findMode: "regex", findExtension: "\\d+$", replaceExtension: "",
    }));
    expect(r.renamed).toBe("file.jpg");
  });
  it("uses replaceExtension when regex strips entire ext", () => {
    const r = renameOne("file.jpeg", opts({
      mode: "replace", findMode: "regex", findExtension: "jpeg", replaceExtension: "jpg",
    }));
    expect(r.renamed).toBe("file.jpg");
  });
});

describe("extc buildRenamePlan", () => {
  it("builds plan for multiple files", () => {
    const files = [file("a.txt"), file("b.txt"), file("c.txt")];
    const { plan, stats } = buildRenamePlan(files, opts({ mode: "replace", findMode: "plain", findExtension: "txt", replaceExtension: "md" }));
    expect(plan).toHaveLength(3);
    expect(stats.changed).toBe(3);
    expect(plan[0].renamed).toBe("a.md");
  });
  it("detects unchanged files", () => {
    const files = [file("a.png"), file("b.txt")];
    const { stats } = buildRenamePlan(files, opts({ mode: "replace", findMode: "plain", findExtension: "txt", replaceExtension: "md" }));
    expect(stats.changed).toBe(1);
    expect(stats.unchanged).toBe(1);
  });
  it("detects name collisions", () => {
    const files = [file("a.jpg"), file("a.jpeg")];
    const { plan, stats } = buildRenamePlan(files, opts({
      mode: "replace", findMode: "plain", findExtension: "", replaceExtension: "img",
    }));
    expect(stats.warnings).toBeGreaterThan(0);
    const collision = plan.find((p) => p.warning?.includes("collision"));
    expect(collision).toBeDefined();
  });
  it("remove mode drops all extensions", () => {
    const files = [file("a.txt"), file("b.png"), file("c")];
    const { plan } = buildRenamePlan(files, opts({ mode: "remove" }));
    expect(plan[0].renamed).toBe("a");
    expect(plan[1].renamed).toBe("b");
    expect(plan[2].renamed).toBe("c");
  });
});

describe("extc planToJson + planToCsv", () => {
  it("exports JSON with stats + options", () => {
    const files = [file("a.txt")];
    const o = opts({ mode: "replace", findExtension: "txt", replaceExtension: "md" });
    const { plan, stats } = buildRenamePlan(files, o);
    const json = planToJson(plan, stats, o);
    const parsed = JSON.parse(json);
    expect(parsed.stats.total).toBe(1);
    expect(parsed.options.mode).toBe("replace");
    expect(parsed.plan[0].renamed).toBe("a.md");
  });
  it("exports CSV with header", () => {
    const files = [file("a.txt")];
    const { plan } = buildRenamePlan(files, opts({ mode: "replace", findExtension: "txt", replaceExtension: "md" }));
    const csv = planToCsv(plan);
    expect(csv).toContain("original,renamed,original_ext,new_ext,changed,warning");
    expect(csv).toContain("a.txt");
    expect(csv).toContain("a.md");
  });
});

describe("extc buildUndoPlan", () => {
  it("reverses original ↔ renamed", () => {
    const files = [file("a.txt"), file("b.txt")];
    const o = opts({ mode: "replace", findExtension: "txt", replaceExtension: "md" });
    const { plan } = buildRenamePlan(files, o);
    const undo = buildUndoPlan(plan);
    expect(undo).toHaveLength(2);
    expect(undo[0].original).toBe("a.md");
    expect(undo[0].renamed).toBe("a.txt");
  });
  it("excludes unchanged entries", () => {
    const files = [file("a.txt"), file("b.png")];
    const o = opts({ mode: "replace", findExtension: "txt", replaceExtension: "md" });
    const { plan } = buildRenamePlan(files, o);
    const undo = buildUndoPlan(plan);
    expect(undo).toHaveLength(1);
  });
});

describe("extc EXTENSION_PRESETS", () => {
  it("includes common presets", () => {
    const values = EXTENSION_PRESETS.map((p) => p.value);
    expect(values).toContain("txt");
    expect(values).toContain("csv");
    expect(values).toContain("json");
    expect(values).toContain("xml");
    expect(values).toContain("html");
    expect(EXTENSION_PRESETS.length).toBeGreaterThanOrEqual(5);
  });
});

describe("extc history", () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    (globalThis as unknown as { localStorage: Storage }).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { for (const k of Object.keys(store)) delete store[k]; },
      key: (_i: number) => null,
      length: 0,
    } as Storage;
  });
  it("saves and loads", () => {
    saveToHistory({ fileCount: 5, changed: 3, mode: "replace", options: DEFAULT_OPTIONS, renamedAt: "2026-01-01" });
    expect(loadHistory()).toHaveLength(1);
  });
  it("clears", () => {
    saveToHistory({ fileCount: 5, changed: 3, mode: "replace", options: DEFAULT_OPTIONS, renamedAt: "2026-01-01" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("extc share URL", () => {
  beforeEach(() => {
    (globalThis as unknown as { window: { location: { origin: string; pathname: string } } }).window = {
      location: { origin: "https://x.io", pathname: "/tools/file-extension-changer" },
    };
  });
  afterAll(() => {
    delete (globalThis as unknown as { window?: unknown }).window;
  });
  it("builds a share URL with options", () => {
    const url = buildShareUrl(opts({ mode: "replace", findExtension: "txt", replaceExtension: "md" }));
    expect(url).toContain("#mode=replace");
    expect(url).toContain("find=txt");
    expect(url).toContain("replace=md");
  });
  it("parses back", () => {
    const url = buildShareUrl(opts({ mode: "remove", caseMode: "lower" }));
    const hash = url.slice(url.indexOf("#"));
    const parsed = parseShareUrl(hash);
    expect(parsed).not.toBeNull();
    if (parsed) {
      expect(parsed.mode).toBe("remove");
      expect(parsed.caseMode).toBe("lower");
    }
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
  });
});
