/**
 * Generate a tool registry JSON from the built dist/ output.
 * The smoke suite reads this JSON so it auto-grows with every new tool.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const distTools = "dist/tools";
const dirs = readdirSync(distTools, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

const tools = dirs.map((id) => {
  const html = readFileSync(join(distTools, id, "index.html"), "utf-8");
  const nameMatch = html.match(/<h1[^>]*class="[^"]*unq-h1[^"]*"[^>]*>([^<]+)/);
  const name = nameMatch ? nameMatch[1].trim() : id;
  return { id, name, route: `/tools/${id}` };
});

writeFileSync("tests/tool-registry.json", JSON.stringify(tools, null, 2) + "\n");
console.log(`Generated tests/tool-registry.json with ${tools.length} tools`);
