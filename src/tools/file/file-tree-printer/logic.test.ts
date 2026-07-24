/**
 * File Tree Printer — unit tests.
 */
import { describe, it, expect } from "vitest";
import { buildTreeFromPaths, printTree, treeToCsv, treeToJson, COMMON_IGNORES } from "./logic";

describe("buildTreeFromPaths", () => {
  it("builds a tree from flat paths", () => {
    const tree = buildTreeFromPaths([
      { path: "src/index.ts", size: 100 },
      { path: "src/utils.ts", size: 200 },
      { path: "README.md", size: 50 },
    ]);
    expect(tree.children?.length).toBe(2); // src + README.md
    const src = tree.children!.find((c) => c.name === "src");
    expect(src?.isDirectory).toBe(true);
    expect(src?.children?.length).toBe(2);
  });
  it("computes directory sizes as sum of children", () => {
    const tree = buildTreeFromPaths([
      { path: "a/b.txt", size: 100 },
      { path: "a/c.txt", size: 200 },
    ]);
    const a = tree.children!.find((c) => c.name === "a");
    expect(a?.size).toBe(300);
  });
  it("handles nested directories", () => {
    const tree = buildTreeFromPaths([
      { path: "a/b/c/d.txt", size: 10 },
    ]);
    let cursor = tree;
    for (const part of ["a", "b", "c"]) {
      cursor = cursor.children!.find((c) => c.name === part)!;
      expect(cursor.isDirectory).toBe(true);
    }
    expect(cursor.children?.[0]?.name).toBe("d.txt");
  });
});

describe("printTree", () => {
  const tree = buildTreeFromPaths([
    { path: "src/index.ts", size: 100 },
    { path: "src/utils.ts", size: 200 },
    { path: "README.md", size: 50 },
  ]);

  it("renders unicode tree by default", () => {
    const r = printTree(tree);
    expect(r.text).toContain("├──");
    expect(r.text).toContain("└──");
    expect(r.text).toContain("src");
    expect(r.text).toContain("index.ts");
  });
  it("renders ASCII tree when style=ascii", () => {
    const r = printTree(tree, { style: "ascii" });
    expect(r.text).toContain("|--");
    expect(r.text).toContain("`--");
  });
  it("shows file sizes when showSize=true", () => {
    const r = printTree(tree, { showSize: true });
    expect(r.text).toContain("[");
    expect(r.text).toContain("B]");
  });
  it("counts files and directories", () => {
    const r = printTree(tree);
    expect(r.fileCount).toBe(3); // index.ts, utils.ts, README.md
    expect(r.dirCount).toBeGreaterThanOrEqual(1); // src
  });
  it("truncates at maxDepth", () => {
    const deep = buildTreeFromPaths([{ path: "a/b/c/d/e/f.txt", size: 10 }]);
    const r = printTree(deep, { maxDepth: 2 });
    expect(r.truncated).toBe(true);
  });
  it("hides hidden files by default", () => {
    const withHidden = buildTreeFromPaths([
      { path: ".gitignore", size: 10 },
      { path: "README.md", size: 50 },
    ]);
    const r = printTree(withHidden);
    expect(r.text).not.toContain(".gitignore");
  });
  it("shows hidden files when includeHidden=true", () => {
    const withHidden = buildTreeFromPaths([
      { path: ".gitignore", size: 10 },
      { path: "README.md", size: 50 },
    ]);
    const r = printTree(withHidden, { includeHidden: true });
    expect(r.text).toContain(".gitignore");
  });
  it("excludes matched patterns", () => {
    const withNodeModules = buildTreeFromPaths([
      { path: "node_modules/pkg/index.js", size: 100 },
      { path: "src/index.ts", size: 50 },
    ]);
    const r = printTree(withNodeModules, { excludes: ["node_modules"] });
    expect(r.text).not.toContain("node_modules");
  });
  it("wraps in markdown fence when markdownWrap=true", () => {
    const r = printTree(tree, { markdownWrap: true });
    expect(r.text.startsWith("```")).toBe(true);
    expect(r.text.endsWith("```\n")).toBe(true);
  });
  it("sorts by name", () => {
    const unsorted = buildTreeFromPaths([
      { path: "zebra.txt", size: 1 },
      { path: "apple.txt", size: 1 },
      { path: "mango.txt", size: 1 },
    ]);
    const r = printTree(unsorted, { sort: "name" });
    const lines = r.text.trim().split("\n");
    expect(lines[0]).toContain("apple");
    expect(lines[2]).toContain("zebra");
  });
  it("sorts by size descending", () => {
    const unsorted = buildTreeFromPaths([
      { path: "small.txt", size: 10 },
      { path: "big.txt", size: 1000 },
      { path: "medium.txt", size: 100 },
    ]);
    const r = printTree(unsorted, { sort: "size" });
    const lines = r.text.trim().split("\n");
    expect(lines[0]).toContain("big.txt");
  });
  it("returns total size", () => {
    const r = printTree(tree);
    expect(r.totalSize).toBe(350); // 100 + 200 + 50
  });
  it("warns when empty", () => {
    const empty = buildTreeFromPaths([]);
    const r = printTree(empty);
    expect(r.warnings.some((w) => w.includes("No files"))).toBe(true);
  });
});

describe("treeToCsv", () => {
  it("generates CSV with header", () => {
    const tree = buildTreeFromPaths([{ path: "a.txt", size: 100 }]);
    const csv = treeToCsv(tree);
    expect(csv.split("\n")[0]).toBe("Path,Type,Size");
    expect(csv).toContain("a.txt");
    expect(csv).toContain("file");
    expect(csv).toContain("100");
  });
});

describe("treeToJson", () => {
  it("generates nested JSON", () => {
    const tree = buildTreeFromPaths([{ path: "src/index.ts", size: 100 }]);
    const json = treeToJson(tree);
    const parsed = JSON.parse(json);
    expect(parsed.children[0].path).toBe("src");
    expect(parsed.children[0].children[0].path).toBe("src/index.ts");
  });
});

describe("COMMON_IGNORES preset", () => {
  it("contains node_modules and .git", () => {
    expect(COMMON_IGNORES).toContain("node_modules");
    expect(COMMON_IGNORES).toContain(".git");
  });
});
