import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_CONFIG,
  COMPRESSION_INFO,
  FORMAT_LABELS,
  MODE_LABELS,
  MODE_LETTER,
  MODE_HINTS,
  RECIPES,
  shellQuote,
  normalizeArchiveName,
  suggestArchiveName,
  hasMatchingExtension,
  parseList,
  buildCommand,
  explainIntent,
  explainFlags,
  validateConfig,
  renderRecipesText,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type BuilderConfig,
  type TarMode,
  type TarCompression,
} from "./logic";

beforeEach(() => {
  const store: Record<string, string> = {};
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  };
});

// ---- Constants ----

describe("tar constants", () => {
  it("has 5 compression choices", () => {
    expect(Object.keys(COMPRESSION_INFO)).toHaveLength(5);
    expect(COMPRESSION_INFO.gzip.shortFlag).toBe("z");
    expect(COMPRESSION_INFO.bzip2.shortFlag).toBe("j");
    expect(COMPRESSION_INFO.xz.shortFlag).toBe("J");
    expect(COMPRESSION_INFO.zstd.shortFlag).toBe("");
  });
  it("compression extension matches flag", () => {
    expect(COMPRESSION_INFO.none.extension).toBe(".tar");
    expect(COMPRESSION_INFO.gzip.extension).toBe(".tar.gz");
    expect(COMPRESSION_INFO.bzip2.extension).toBe(".tar.bz2");
    expect(COMPRESSION_INFO.xz.extension).toBe(".tar.xz");
    expect(COMPRESSION_INFO.zstd.extension).toBe(".tar.zst");
  });
  it("has 5 format labels", () => {
    expect(Object.keys(FORMAT_LABELS)).toHaveLength(5);
  });
  it("has 4 modes with letters", () => {
    expect(Object.keys(MODE_LABELS)).toHaveLength(4);
    expect(MODE_LETTER.create).toBe("c");
    expect(MODE_LETTER.extract).toBe("x");
    expect(MODE_LETTER.list).toBe("t");
    expect(MODE_LETTER.append).toBe("r");
  });
  it("has mode hints", () => {
    expect(MODE_HINTS.create).toBeTruthy();
    expect(MODE_HINTS.extract).toContain("-C");
  });
  it("default config has gzip + create", () => {
    expect(DEFAULT_CONFIG.mode).toBe("create");
    expect(DEFAULT_CONFIG.compression).toBe("gzip");
    expect(DEFAULT_CONFIG.verbose).toBe(true);
  });
  it("has 10 recipes", () => {
    expect(RECIPES).toHaveLength(10);
  });
});

// ---- shellQuote ----

describe("tar shellQuote", () => {
  it("passes through safe strings", () => {
    expect(shellQuote("archive.tar.gz")).toBe("archive.tar.gz");
    expect(shellQuote("./project")).toBe("./project");
  });
  it("quotes empty string", () => {
    expect(shellQuote("")).toBe("''");
  });
  it("single-quotes unsafe chars", () => {
    expect(shellQuote("my archive.tar")).toBe("'my archive.tar'");
  });
  it("escapes embedded single quote", () => {
    const q = shellQuote("bob's file");
    expect(q).toContain("'\\''");
  });
});

// ---- name helpers ----

describe("tar name helpers", () => {
  it("normalizeArchiveName trims", () => {
    expect(normalizeArchiveName("  out.tar.gz  ")).toBe("out.tar.gz");
    expect(normalizeArchiveName("")).toBe("");
  });
  it("suggestArchiveName picks the right extension", () => {
    expect(suggestArchiveName("gzip", "data")).toBe("data.tar.gz");
    expect(suggestArchiveName("bzip2", "data")).toBe("data.tar.bz2");
    expect(suggestArchiveName("xz", "data")).toBe("data.tar.xz");
    expect(suggestArchiveName("zstd", "data")).toBe("data.tar.zst");
    expect(suggestArchiveName("none", "data")).toBe("data.tar");
  });
  it("suggestArchiveName defaults base to archive", () => {
    expect(suggestArchiveName("gzip")).toBe("archive.tar.gz");
  });
  it("hasMatchingExtension detects .tar.gz", () => {
    expect(hasMatchingExtension("backup.tar.gz", "gzip")).toBe(true);
    expect(hasMatchingExtension("backup.tgz", "gzip")).toBe(true);
  });
  it("hasMatchingExtension detects mismatch", () => {
    expect(hasMatchingExtension("backup.tar.gz", "xz")).toBe(false);
    expect(hasMatchingExtension("backup.tar", "gzip")).toBe(false);
  });
  it("parseList splits newline-separated", () => {
    expect(parseList("a\nb\nc")).toEqual(["a", "b", "c"]);
  });
  it("parseList splits comma-separated", () => {
    expect(parseList("a, b , c")).toEqual(["a", "b", "c"]);
  });
  it("parseList handles empty", () => {
    expect(parseList("")).toEqual([]);
  });
});

// ---- buildCommand ----

describe("tar buildCommand create gzip", () => {
  it("creates a tar.gz with cvzf and the archive name", () => {
    const built = buildCommand({
      ...DEFAULT_CONFIG,
      mode: "create",
      compression: "gzip",
      verbose: true,
      archiveName: "out.tar.gz",
      files: ["./project"],
    });
    expect(built.command).toContain("tar -czvf");
    expect(built.command).toContain("out.tar.gz");
    expect(built.command).toContain("./project");
  });
  it("does NOT emit a redundant --gzip long flag for gzip (short z is used)", () => {
    const built = buildCommand({
      ...DEFAULT_CONFIG,
      mode: "create",
      compression: "gzip",
      verbose: true,
      archiveName: "out.tar.gz",
      files: ["./project"],
    });
    expect(built.command).not.toContain("--gzip");
  });
});

describe("tar buildCommand create bzip2/xz/none", () => {
  it("creates tar.bz2 with cjvf", () => {
    const built = buildCommand({
      ...DEFAULT_CONFIG,
      mode: "create",
      compression: "bzip2",
      archiveName: "out.tar.bz2",
      files: ["./dir"],
    });
    expect(built.command).toContain("-cjvf");
  });
  it("creates tar.xz with cJvf", () => {
    const built = buildCommand({
      ...DEFAULT_CONFIG,
      mode: "create",
      compression: "xz",
      archiveName: "out.tar.xz",
      files: ["./dir"],
    });
    expect(built.command).toContain("-cJvf");
  });
  it("creates plain .tar with cvf (no compression letter)", () => {
    const built = buildCommand({
      ...DEFAULT_CONFIG,
      mode: "create",
      compression: "none",
      archiveName: "out.tar",
      files: ["./dir"],
    });
    expect(built.command).toContain("-cvf");
    expect(built.command).not.toContain("-czvf");
    expect(built.command).not.toContain("-cJvf");
  });
});

describe("tar buildCommand zstd", () => {
  it("uses --zstd long flag with cvf", () => {
    const built = buildCommand({
      ...DEFAULT_CONFIG,
      mode: "create",
      compression: "zstd",
      archiveName: "out.tar.zst",
      files: ["./dir"],
    });
    expect(built.command).toContain("-cvf");
    expect(built.command).toContain("--zstd");
    expect(built.command).toContain("out.tar.zst");
  });
  it("includes a note about GNU tar version requirement", () => {
    const built = buildCommand({
      ...DEFAULT_CONFIG,
      mode: "create",
      compression: "zstd",
      archiveName: "out.tar.zst",
      files: ["./dir"],
    });
    expect(built.notes.some((n) => n.includes("GNU tar"))).toBe(true);
  });
});

describe("tar buildCommand extract", () => {
  it("extracts tar.gz with xvzf and -C target", () => {
    const built = buildCommand({
      ...DEFAULT_CONFIG,
      mode: "extract",
      compression: "gzip",
      archiveName: "archive.tar.gz",
      targetDir: "./out",
      files: [],
    });
    expect(built.command).toContain("-xzvf");
    expect(built.command).toContain("archive.tar.gz");
    expect(built.command).toContain("-C");
    expect(built.command).toContain("./out");
  });
  it("adds -p when preservePermissions is set on extract", () => {
    const built = buildCommand({
      ...DEFAULT_CONFIG,
      mode: "extract",
      compression: "gzip",
      archiveName: "archive.tar.gz",
      targetDir: "/restore",
      preservePermissions: true,
      files: [],
    });
    expect(built.command).toContain("-xzvpf");
  });
  it("warns about tar bomb when extracting without -C", () => {
    const built = buildCommand({
      ...DEFAULT_CONFIG,
      mode: "extract",
      compression: "gzip",
      archiveName: "archive.tar.gz",
      targetDir: "",
      files: [],
    });
    expect(built.warnings.some((w) => /tar-?bomb/i.test(w))).toBe(true);
  });
  it("emits --strip-components=N when set", () => {
    const built = buildCommand({
      ...DEFAULT_CONFIG,
      mode: "extract",
      compression: "gzip",
      archiveName: "archive.tar.gz",
      targetDir: "./out",
      stripComponents: 1,
      files: [],
    });
    expect(built.command).toContain("--strip-components=1");
  });
});

describe("tar buildCommand list", () => {
  it("lists with tvzf", () => {
    const built = buildCommand({
      ...DEFAULT_CONFIG,
      mode: "list",
      compression: "gzip",
      archiveName: "archive.tar.gz",
      files: [],
    });
    expect(built.command).toContain("-tzvf");
    expect(built.command).toContain("archive.tar.gz");
  });
});

describe("tar buildCommand append", () => {
  it("appends to uncompressed .tar with rvf", () => {
    const built = buildCommand({
      ...DEFAULT_CONFIG,
      mode: "append",
      compression: "none",
      archiveName: "archive.tar",
      files: ["./new-file"],
    });
    expect(built.command).toContain("-rvf");
  });
  it("warns when appending to a compressed archive", () => {
    const built = buildCommand({
      ...DEFAULT_CONFIG,
      mode: "append",
      compression: "gzip",
      archiveName: "archive.tar.gz",
      files: ["./new-file"],
    });
    expect(built.warnings.some((w) => /compress/i.test(w))).toBe(true);
  });
});

describe("tar buildCommand f-order invariant", () => {
  it("f always immediately precedes the archive name", () => {
    for (const mode of ["create", "extract", "list", "append"] as TarMode[]) {
      for (const comp of ["none", "gzip", "bzip2", "xz"] as TarCompression[]) {
        const built = buildCommand({
          ...DEFAULT_CONFIG,
          mode,
          compression: comp,
          archiveName: "x.tar.gz",
          files: mode === "create" || mode === "append" ? ["./d"] : [],
        });
        // The f-letter must be adjacent to x.tar.gz in the joined string
        // (after short flag cluster, the next token is the archive name).
        expect(built.command).toMatch(/f 'x\.tar\.gz'|f x\.tar\.gz/);
      }
    }
  });
});

describe("tar buildCommand excludes + exclude-file", () => {
  it("emits --exclude=PATTERN for each exclude", () => {
    const built = buildCommand({
      ...DEFAULT_CONFIG,
      mode: "create",
      compression: "gzip",
      archiveName: "out.tar.gz",
      files: ["./project"],
      excludes: ["node_modules", "*.log"],
    });
    expect(built.command).toContain("--exclude=node_modules");
    expect(built.command).toContain("--exclude='*.log'");
  });
  it("emits -X file when excludeFile is set", () => {
    const built = buildCommand({
      ...DEFAULT_CONFIG,
      mode: "create",
      compression: "gzip",
      archiveName: "out.tar.gz",
      files: ["./project"],
      excludeFile: "excludes.txt",
    });
    expect(built.command).toContain("-X");
    expect(built.command).toContain("excludes.txt");
  });
});

describe("tar buildCommand format + verify + totals", () => {
  it("emits --format=posix", () => {
    const built = buildCommand({
      ...DEFAULT_CONFIG,
      mode: "create",
      compression: "gzip",
      archiveName: "out.tar.gz",
      files: ["./dir"],
      format: "posix",
    });
    expect(built.command).toContain("--format=posix");
  });
  it("emits --verify on create (no compression)", () => {
    const built = buildCommand({
      ...DEFAULT_CONFIG,
      mode: "create",
      compression: "none",
      archiveName: "out.tar",
      files: ["./dir"],
      verify: true,
    });
    expect(built.command).toContain("--verify");
  });
  it("warns when verify + compression combined", () => {
    const built = buildCommand({
      ...DEFAULT_CONFIG,
      mode: "create",
      compression: "gzip",
      archiveName: "out.tar.gz",
      files: ["./dir"],
      verify: true,
    });
    expect(built.warnings.some((w) => /compress/i.test(w))).toBe(true);
  });
  it("emits --totals on create when showTotals is true", () => {
    const built = buildCommand({
      ...DEFAULT_CONFIG,
      mode: "create",
      compression: "none",
      archiveName: "out.tar",
      files: ["./dir"],
      showTotals: true,
    });
    expect(built.command).toContain("--totals");
  });
  it("emits --xattrs and --numeric-owner when set", () => {
    const built = buildCommand({
      ...DEFAULT_CONFIG,
      mode: "create",
      compression: "gzip",
      archiveName: "out.tar.gz",
      files: ["./dir"],
      preserveXattrs: true,
      numericOwner: true,
    });
    expect(built.command).toContain("--xattrs");
    expect(built.command).toContain("--numeric-owner");
  });
});

describe("tar buildCommand absolute-path guard", () => {
  it("warns about absolute path on create", () => {
    const built = buildCommand({
      ...DEFAULT_CONFIG,
      mode: "create",
      compression: "gzip",
      archiveName: "out.tar.gz",
      files: ["/etc/hosts"],
    });
    expect(built.warnings.some((w) => /absolute/i.test(w))).toBe(true);
  });
  it("warns about ../ in path", () => {
    const built = buildCommand({
      ...DEFAULT_CONFIG,
      mode: "create",
      compression: "gzip",
      archiveName: "out.tar.gz",
      files: ["../secret"],
    });
    expect(built.warnings.some((w) => /\.\./.test(w))).toBe(true);
  });
});

describe("tar buildCommand extension mismatch", () => {
  it("warns when archive name extension does not match compression", () => {
    const built = buildCommand({
      ...DEFAULT_CONFIG,
      mode: "create",
      compression: "gzip",
      archiveName: "out.tar.xz",
      files: ["./dir"],
    });
    expect(built.warnings.some((w) => /match/.test(w))).toBe(true);
  });
  it("does NOT warn when name matches compression", () => {
    const built = buildCommand({
      ...DEFAULT_CONFIG,
      mode: "create",
      compression: "gzip",
      archiveName: "out.tar.gz",
      files: ["./dir"],
    });
    expect(built.warnings.some((w) => /match/.test(w))).toBe(false);
  });
});

// ---- explainIntent / explainFlags / validateConfig ----

describe("tar explainIntent", () => {
  it("mentions the mode verb", () => {
    const s = explainIntent(DEFAULT_CONFIG);
    expect(s).toContain("Create");
    expect(s).toContain("gzip");
  });
  it("mentions -C in extract mode", () => {
    const s = explainIntent({
      ...DEFAULT_CONFIG,
      mode: "extract",
      archiveName: "x.tar.gz",
      targetDir: "./out",
    });
    expect(s).toContain("./out");
  });
});

describe("tar explainFlags", () => {
  it("includes the mode letter and -f", () => {
    const flags = explainFlags(DEFAULT_CONFIG);
    expect(flags.some((f) => f.flag === "-c")).toBe(true);
    expect(flags.some((f) => f.flag === "-z")).toBe(true);
    expect(flags.some((f) => f.flag.startsWith("-f"))).toBe(true);
  });
  it("includes --strip-components when set", () => {
    const flags = explainFlags({
      ...DEFAULT_CONFIG,
      mode: "extract",
      compression: "gzip",
      archiveName: "x.tar.gz",
      stripComponents: 2,
      targetDir: "./out",
    });
    expect(flags.some((f) => f.flag === "--strip-components=2")).toBe(true);
  });
});

describe("tar validateConfig", () => {
  it("warns on append+compression", () => {
    const v = validateConfig({
      ...DEFAULT_CONFIG,
      mode: "append",
      compression: "gzip",
      archiveName: "x.tar.gz",
      files: ["./d"],
    });
    expect(v.warnings.some((w) => /compress/i.test(w))).toBe(true);
  });
  it("warns on extract without -C", () => {
    const v = validateConfig({
      ...DEFAULT_CONFIG,
      mode: "extract",
      compression: "gzip",
      archiveName: "x.tar.gz",
      targetDir: "",
    });
    expect(v.warnings.some((w) => /tar-?bomb|cwd|-C/i.test(w))).toBe(true);
  });
  it("warns on extension mismatch", () => {
    const v = validateConfig({
      ...DEFAULT_CONFIG,
      mode: "create",
      compression: "gzip",
      archiveName: "wrong.tar.xz",
      files: ["./d"],
    });
    expect(v.warnings.some((w) => /match/.test(w))).toBe(true);
  });
});

// ---- renderRecipesText ----

describe("tar renderRecipesText", () => {
  it("renders all recipes", () => {
    const text = renderRecipesText();
    expect(text).toContain("Create tar.gz");
    expect(text).toContain("Extract tar.gz");
    expect(text).toContain("tar -");
  });
});

// ---- History ----

describe("tar history (localStorage)", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    saveHistory({ ts: 1, mode: "create", compression: "gzip", command: "tar -cvzf x.tar.gz ./d" });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].mode).toBe("create");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, mode: "create", compression: "gzip", command: `tar -cvzf x${i}.tar.gz ./d` });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, mode: "create", compression: "gzip", command: "tar -cvzf x.tar.gz ./d" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ---- Share URL ----

describe("tar share URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      ...DEFAULT_CONFIG,
      mode: "extract",
      compression: "gzip",
      archiveName: "out.tar.gz",
      targetDir: "./out",
      stripComponents: 1,
    });
    expect(url).toContain("m=extract");
    expect(url).toContain("c=gzip");
    expect(url).toContain("a=out.tar.gz");
    expect(url).toContain("d=.%2Fout");
    expect(url).toContain("s=1");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const { config } = parseShareUrl("m=extract&c=xz&a=out.tar.xz&d=.%2Fout&s=2&v=1");
    expect(config.mode).toBe("extract");
    expect(config.compression).toBe("xz");
    expect(config.archiveName).toBe("out.tar.xz");
    expect(config.targetDir).toBe("./out");
    expect(config.stripComponents).toBe(2);
    expect(config.verbose).toBe(true);
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ config: {} });
  });
  it("filters unknown modes / compression", () => {
    const { config } = parseShareUrl("m=bogus&c=also-bogus");
    expect(config.mode).toBeUndefined();
    expect(config.compression).toBeUndefined();
  });
  it("round-trips a recipe config", () => {
    const cfg: BuilderConfig = {
      ...DEFAULT_CONFIG,
      mode: "create",
      compression: "zstd",
      archiveName: "snap.tar.zst",
      files: ["./project"],
      excludes: ["node_modules"],
      format: "posix",
      showTotals: true,
      preserveXattrs: true,
      numericOwner: true,
    };
    const url = buildShareUrl(cfg);
    const { config: parsed } = parseShareUrl(url.split("#")[1] ?? url);
    expect(parsed.mode).toBe("create");
    expect(parsed.compression).toBe("zstd");
    expect(parsed.archiveName).toBe("snap.tar.zst");
    expect(parsed.files).toEqual(["./project"]);
    expect(parsed.excludes).toEqual(["node_modules"]);
    expect(parsed.format).toBe("posix");
    expect(parsed.showTotals).toBe(true);
    expect(parsed.preserveXattrs).toBe(true);
    expect(parsed.numericOwner).toBe(true);
  });
});

// Suppress unused-import lint
export type _Unused = TarMode | TarCompression | BuilderConfig;
