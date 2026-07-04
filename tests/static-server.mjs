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

const server = http.createServer(async (req, res) => {
  try {
    let path = normalize(req.url || "/");
    if (path === "/") path = "/index.html";
    // Try exact file first
    let filePath = join(ROOT, path);
    let st = await stat(filePath).catch(() => null);
    if (!st || !st.isFile()) {
      // Try .html fallback (Next.js static export: /tools → /tools.html)
      filePath = join(ROOT, path + ".html");
      st = await stat(filePath).catch(() => null);
    }
    if (!st || !st.isFile()) {
      // Try /404.html — return with 404 status (production-identical to Cloudflare Pages)
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
