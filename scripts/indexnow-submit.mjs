#!/usr/bin/env node
/**
 * IndexNow submission — pushes every URL from public/sitemap.xml to
 * Bing/DuckDuckGo/Yandex via the IndexNow protocol in ONE request
 * (protocol allows up to 10,000 URLs per POST; we have ~1,700).
 *
 * Usage:  node scripts/indexnow-submit.mjs
 * Requires the key file public/<KEY>.txt to be deployed and reachable.
 */

import { readFileSync } from "node:fs";

const HOST = "unqtools.pages.dev";
const KEY = "a9677dccba27b36fda02f58a4d714aa4";
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;
const ENDPOINT = "https://api.indexnow.org/indexnow";

const xml = readFileSync(new URL("../public/sitemap.xml", import.meta.url), "utf8");
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

if (urls.length === 0) {
  console.error("No URLs found in public/sitemap.xml");
  process.exit(1);
}

console.log(`Submitting ${urls.length} URLs via IndexNow...`);

const res = await fetch(ENDPOINT, {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({
    host: HOST,
    key: KEY,
    keyLocation: KEY_LOCATION,
    urlList: urls,
  }),
});

const text = await res.text();
// 200 = submitted. 202 = accepted, key verification pending. 4xx = something wrong.
console.log(`IndexNow response: ${res.status} ${text || "(empty body - OK)"}`);

if (!res.ok) {
  console.error("Submission failed. Common causes: key file not deployed yet, or host mismatch.");
  process.exit(1);
}
console.log("Done. Bing/DuckDuckGo/Yandex will now crawl the submitted URLs.");
