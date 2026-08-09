/**
 * Regression test — tool-page loader map must never point at missing files.
 *
 * The v18.0 merge broke the production build because 12 loader entries in
 * src/app/tools/[id]/tool-page-client.tsx still imported /ui files from
 * directories that had been deleted (12 "Module not found" errors on
 * Cloudflare). This test catches exactly that class of bug in CI before build.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..");
const LOADER_FILE = join(ROOT, "src/app/tools/[id]/tool-page-client.tsx");

describe("tool loader map integrity", () => {
  const src = readFileSync(LOADER_FILE, "utf8");
  const imports = [...src.matchAll(/import\("(@\/tools\/[^"]+)\/ui"\)/g)].map(
    (m) => m[1]
  );

  it("loader map is non-empty", () => {
    expect(imports.length).toBeGreaterThan(1000);
  });

  it("every lazy import target exists on disk", () => {
    const missing = imports
      .map((imp) => ({ imp, rel: join(ROOT, imp.replace("@/", "src/") + "/ui.tsx") }))
      .filter(({ rel }) => !existsSync(rel))
      .map(({ imp }) => imp);
    expect(missing).toEqual([]);
  });

  it("every registered tool id has a loader entry", () => {
    const regSrc = readFileSync(join(ROOT, "src/lib/registry.ts"), "utf8");
    const ids = [
      ...regSrc.matchAll(/from\s+"@\/tools\/(?:[a-z-]+)\/([a-z0-9-]+)\/manifest"/g),
    ].map((m) => m[1]);
    const loaderIds = new Set(
      [...src.matchAll(/^\s*"([^"]+)": \(\) => import/gm)].map((m) => m[1])
    );
    const missing = [...new Set(ids)].filter((id) => !loaderIds.has(id));
    // Note: planned tools without a UI intentionally have no loader entry.
    // Only flag tools that have a ui.tsx on disk but no loader entry.
    const missingWithUi = missing.filter((id) =>
      existsSync(join(ROOT, "src/tools/pdf", id, "ui.tsx")) ||
      // check all categories quickly
      (() => {
        for (const cat of [
          "pdf", "image", "audio-video", "developer", "seo", "calculators",
          "text", "network-security", "file", "business", "education", "social", "ai",
        ]) {
          if (existsSync(join(ROOT, "src/tools", cat, id, "ui.tsx"))) return true;
        }
        return false;
      })()
    );
    expect(missingWithUi).toEqual([]);
  });
});
