/**
 * Regenerate src/lib/catalog.ts — a lightweight tool catalog for client pages.
 *
 * Reads every src/tools/<cat>/<id>/manifest.ts, transpiles it to CommonJS,
 * evaluates it, and keeps ONLY the fields client pages need:
 *   { id, name, description, category, keywords, status }
 *
 * The heavy `seo` (FAQ / JSON-LD) field is intentionally DROPPED here.
 * Tool detail pages that need full manifests keep importing from
 * src/lib/registry.ts directly.
 *
 * Usage: `node scripts/regenerate-catalog.mjs`
 */
import fs from "node:fs";
import path from "node:path";
import Module from "node:module";
import ts from "typescript";

const ROOT = process.cwd();
const TOOLS_DIR = path.join(ROOT, "src/tools");
const OUT = path.join(ROOT, "src/lib/catalog.ts");

function findManifests(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findManifests(full, acc);
    else if (entry.name === "manifest.ts") acc.push(full);
  }
  return acc;
}

function loadManifest(file) {
  const src = fs.readFileSync(file, "utf8");
  const js = ts.transpileModule(src, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: file,
  }).outputText;
  const m = new Module(file);
  m.filename = file;
  m.paths = Module._nodeModulePaths(path.dirname(file));
  m._compile(js, file);
  return m.exports.manifest;
}

const files = findManifests(TOOLS_DIR);
const items = [];

for (const file of files) {
  try {
    const man = loadManifest(file);
    if (!man || !man.id) continue;
    items.push({
      id: man.id,
      name: man.name,
      description: man.description,
      category: man.category,
      keywords: Array.isArray(man.keywords) ? man.keywords : [],
      status: man.status ?? "planned",
    });
  } catch (e) {
    console.error("SKIP", path.relative(ROOT, file), "-", e.message);
  }
}

// Sort by id for stable, deterministic output.
items.sort((a, b) => a.id.localeCompare(b.id));

const lines = [];
lines.push("/**");
lines.push(" * Lightweight tool catalog for client pages (auto-generated).");
lines.push(" *");
lines.push(" * Contains only the fields client pages need: id, name, description,");
lines.push(" * category, keywords, status. The heavy `seo` field is intentionally");
lines.push(" * omitted here — it lives in src/lib/registry.ts and is only imported");
lines.push(" * by server-rendered tool detail pages.");
lines.push(" *");
lines.push(` * ${items.length} tools. Regenerate with: node scripts/regenerate-catalog.mjs`);
lines.push(" */");
lines.push('import type { ToolCategory } from "./tool";');
lines.push("");
lines.push("export interface CatalogItem {");
lines.push("  id: string;");
lines.push("  name: string;");
lines.push("  description: string;");
lines.push("  category: ToolCategory;");
lines.push("  keywords: string[];");
lines.push("  status: \"done\" | \"planned\" | \"beta\";");
lines.push("}");
lines.push("");
lines.push("export const CATALOG: readonly CatalogItem[] = [");

for (const it of items) {
  lines.push("  {");
  lines.push(`    id: ${JSON.stringify(it.id)},`);
  lines.push(`    name: ${JSON.stringify(it.name)},`);
  lines.push(`    description: ${JSON.stringify(it.description)},`);
  lines.push(`    category: ${JSON.stringify(it.category)},`);
  lines.push(`    keywords: ${JSON.stringify(it.keywords)},`);
  lines.push(`    status: ${JSON.stringify(it.status)},`);
  lines.push("  },");
}

lines.push("];");
lines.push("");
lines.push("export function countByCategory(): Record<ToolCategory, number> {");
lines.push("  const counts = {} as Record<ToolCategory, number>;");
lines.push("  for (const t of CATALOG) {");
lines.push("    counts[t.category] = (counts[t.category] ?? 0) + 1;");
lines.push("  }");
lines.push("  return counts;");
lines.push("}");
lines.push("");

fs.writeFileSync(OUT, lines.join("\n"));
console.log(`Catalog regenerated: ${OUT}`);
console.log(`  - ${items.length} tools`);
const cats = {};
for (const it of items) cats[it.category] = (cats[it.category] ?? 0) + 1;
console.log("  - by category:", JSON.stringify(cats));
