/**
 * Regenerate public/sitemap.xml from src/lib/registry.ts.
 *
 * Reads all tool manifests via the registry, plus all category pages,
 * plus the static homepage + /tools. Writes a fresh sitemap.
 *
 * Usage: `node scripts/regenerate-sitemap.mjs`
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const REGISTRY = path.join(ROOT, "src/lib/registry.ts");
const OUT = path.join(ROOT, "public/sitemap.xml");
const BASE = "https://unqtools.pages.dev";
const TODAY = new Date().toISOString().slice(0, 10);

// Read registry.ts source and extract tool IDs + categories by simple regex.
const src = fs.readFileSync(REGISTRY, "utf8");

// Extract tool IDs from import paths like:
//   import { manifest as fooBar } from "@/tools/<cat>/<id>/manifest";
const toolRegex = /from\s+\"@\/tools\/([a-z-]+)\/([a-z0-9-]+)\/manifest\"/g;
const tools = [];
let m;
const seenIds = new Set();
while ((m = toolRegex.exec(src)) !== null) {
  if (seenIds.has(m[2])) continue; // registry has a few duplicate imports
  seenIds.add(m[2]);
  tools.push({ category: m[1], id: m[2] });
}

// Categories derived from the unique category values seen above.
const categories = [...new Set(tools.map((t) => t.category))].sort();

// Build sitemap XML.
const lines = [];
lines.push('<?xml version="1.0" encoding="UTF-8"?>');
lines.push('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');

// Static pages.
lines.push('  <url>');
lines.push(`    <loc>${BASE}/</loc>`);
lines.push(`    <lastmod>${TODAY}</lastmod>`);
lines.push('    <changefreq>weekly</changefreq>');
lines.push('    <priority>1.0</priority>');
lines.push('  </url>');
lines.push('  <url>');
lines.push(`    <loc>${BASE}/tools</loc>`);
lines.push(`    <lastmod>${TODAY}</lastmod>`);
lines.push('    <changefreq>weekly</changefreq>');
lines.push('    <priority>0.9</priority>');
lines.push('  </url>');

// Category pages.
for (const c of categories) {
  lines.push('  <url>');
  lines.push(`    <loc>${BASE}/category/${c}</loc>`);
  lines.push(`    <lastmod>${TODAY}</lastmod>`);
  lines.push('    <changefreq>weekly</changefreq>');
  lines.push('    <priority>0.8</priority>');
  lines.push('  </url>');
}

// Tool pages.
for (const t of tools) {
  lines.push('  <url>');
  lines.push(`    <loc>${BASE}/tools/${t.id}</loc>`);
  lines.push(`    <lastmod>${TODAY}</lastmod>`);
  lines.push('    <changefreq>monthly</changefreq>');
  lines.push('    <priority>0.7</priority>');
  lines.push('  </url>');
}

lines.push('</urlset>');

fs.writeFileSync(OUT, lines.join("\n") + "\n");

console.log(`Sitemap regenerated: ${OUT}`);
console.log(`  - ${tools.length} tool URLs`);
console.log(`  - ${categories.length} category URLs`);
console.log(`  - 2 static URLs`);
console.log(`  - total: ${tools.length + categories.length + 2} URLs`);
