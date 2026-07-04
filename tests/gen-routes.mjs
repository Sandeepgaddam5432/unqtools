/**
 * Generate the route list from the built `out/` directory.
 * Run AFTER `npm run build`. Used by smoke + overflow gates.
 *
 * Output: tests/routes.json
 */
import { readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = "out";
const routes = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (entry === "_next" || entry === "_not-found") continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full);
    } else if (entry.endsWith(".html")) {
      let route = "/" + relative(ROOT, full).replace(/\.html$/, "").replace(/\/index$/, "");
      if (route === "/index") route = "/";
      if (route === "/404") continue; // skip 404 page itself
      routes.push(route);
    }
  }
}

walk(ROOT);
routes.sort();
writeFileSync("tests/routes.json", JSON.stringify(routes, null, 2) + "\n");
console.log(`Wrote ${routes.length} routes to tests/routes.json`);
