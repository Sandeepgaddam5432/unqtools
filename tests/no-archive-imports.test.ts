import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Guard: no production code may import from archive/.
 * This prevents accidentally importing archived showcase/demo components.
 */
function getAllTsFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory() && entry !== "node_modules" && entry !== ".next" && entry !== "out" && entry !== "archive") {
      results.push(...getAllTsFiles(full));
    } else if (st.isFile() && (full.endsWith(".ts") || full.endsWith(".tsx"))) {
      results.push(full);
    }
  }
  return results;
}

describe("Archive import guard", () => {
  it("no production file imports from archive/", () => {
    const files = getAllTsFiles("src");
    const violations: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, "utf-8");
      if (/from\s+['"](@\/|\.\.\/|\.\/)+archive\//.test(content)) {
        violations.push(file);
      }
    }
    expect(violations, `Files importing from archive/: ${violations.join(", ")}`).toEqual([]);
  });
});
