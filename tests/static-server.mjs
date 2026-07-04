import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const ROOT = "out";
const PORT = 4322;

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".txt": "text/plain",
  ".ico": "image/x-icon",
  ".map": "application/json",
};

// Simple in-memory cache for repeated static assets (chunks, fonts)
const cache = new Map();

const server = http.createServer(async (req, res) => {
  try {
    let path = normalize(req.url || "/");
    path = path.split("?")[0];
    if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
    if (path === "") path = "/";
    if (path === "/") path = "/index.html";

    // Check cache first
    const cacheKey = path;
    if (cache.has(cacheKey)) {
      const { data, mime, status } = cache.get(cacheKey);
      res.writeHead(status, { "Content-Type": mime, "Content-Length": data.length });
      res.end(data);
      return;
    }

    // Try exact file first
    let filePath = join(ROOT, path);
    let st = await stat(filePath).catch(() => null);
    if (!st || !st.isFile()) {
      filePath = join(ROOT, path, "index.html");
      st = await stat(filePath).catch(() => null);
    }
    if (!st || !st.isFile()) {
      filePath = join(ROOT, path + ".html");
      st = await stat(filePath).catch(() => null);
    }

    if (!st || !st.isFile()) {
      // 404 — serve 404.html with 404 status
      filePath = join(ROOT, "404.html");
      st = await stat(filePath).catch(() => null);
      if (!st) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      const data = await readFile(filePath);
      const mime = MIME[extname(filePath)] || "text/html";
      res.writeHead(404, { "Content-Type": mime, "Content-Length": data.length });
      res.end(data);
      return;
    }

    const data = await readFile(filePath);
    const mime = MIME[extname(filePath)] || "application/octet-stream";

    // Cache static assets (not HTML pages — those have unique routes)
    if (path.startsWith("/_next/") || path.match(/\.(js|css|woff2?|svg|png|jpg|ico)$/)) {
      cache.set(cacheKey, { data, mime, status: 200 });
    }

    res.writeHead(200, { "Content-Type": mime, "Content-Length": data.length });
    res.end(data);
  } catch (e) {
    res.writeHead(500);
    res.end(e.message);
  }
});

server.listen(PORT, () => {
  console.log(`Static server running on http://localhost:${PORT}`);
});
