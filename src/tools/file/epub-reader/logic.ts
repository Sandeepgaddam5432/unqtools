/**
 * EPUB Reader — pure logic for parsing EPUB (ZIP) files, OPF manifests, and
 * building chapter lists / tables of contents.
 *
 * EPUB structure:
 *   - ZIP archive (we support STORE method only; most EPUBs use STORE for
 *     small XHTML files and DEFLATE for larger ones. We support both via a
 *     minimal DEFLATE decompressor — actually, we don't: we use STORE-only
 *     like the CBZ reader since browsers' DecompressionStream can handle
 *     DEFLATE in production, but to keep this pure-JS and offline-safe we
 *     also implement a tiny DEFLATE decoder... no, that's huge. The truth is:
 *     in production we use `DecompressionStream` which is available in all
 *     modern browsers. For the unit tests (Node), we use STORE-only test
 *     EPUBs. The parser accepts both and the runtime path uses
 *     `DecompressionStream` for DEFLATE entries.)
 */

export interface ZipEntry {
  name: string;
  compressionMethod: number; // 0 = STORE, 8 = DEFLATE
  compressedSize: number;
  uncompressedSize: number;
  dataOffset: number;
  bytes: Uint8Array;
}

export interface EpubChapter {
  /** Chapter ID from the OPF manifest. */
  id: string;
  /** href relative to the OPF file location. */
  href: string;
  /** Absolute path inside the EPUB ZIP. */
  absolutePath: string;
  /** Chapter title (extracted from TOC or first heading). */
  title: string;
  /** Media type (usually application/xhtml+xml). */
  mediaType: string;
  /** Decoded XHTML content (raw). */
  content: string;
}

export interface EpubMetadata {
  title: string;
  author: string;
  language: string;
  identifier: string;
  publisher: string;
  description: string;
  rights: string;
}

export interface TocEntry {
  /** Title of the entry. */
  title: string;
  /** Absolute path inside the EPUB ZIP. */
  absolutePath: string;
  /** Anchor (fragment) within the target, if any. */
  anchor?: string;
  /** Nesting level (0 = top-level). */
  level: number;
}

export interface EpubBook {
  metadata: EpubMetadata;
  chapters: EpubChapter[];
  toc: TocEntry[];
  fileName: string;
  fileSize: number;
}

// ===== ZIP parsing (STORE + DEFLATE via DecompressionStream) =====

/** Parse a ZIP file's local file headers. Returns entries with byte slices. */
export function parseZipEntries(bytes: Uint8Array): ZipEntry[] {
  const entries: ZipEntry[] = [];
  let pos = 0;
  while (pos < bytes.length - 4) {
    if (bytes[pos] !== 0x50 || bytes[pos + 1] !== 0x4b || bytes[pos + 2] !== 0x03 || bytes[pos + 3] !== 0x04) {
      pos++;
      continue;
    }
    if (pos + 30 > bytes.length) break;
    const dv = new DataView(bytes.buffer, bytes.byteOffset + pos, Math.min(bytes.length - pos, 30 + 65535));
    const compressionMethod = dv.getUint16(8, true);
    const compressedSize = dv.getUint32(18, true);
    const uncompressedSize = dv.getUint32(22, true);
    const nameLen = dv.getUint16(26, true);
    const extraLen = dv.getUint16(28, true);
    if (pos + 30 + nameLen + extraLen > bytes.length) {
      pos++;
      continue;
    }
    const nameBytes = bytes.subarray(pos + 30, pos + 30 + nameLen);
    const name = new TextDecoder("utf-8").decode(nameBytes);
    const dataOffset = pos + 30 + nameLen + extraLen;
    const dataEnd = dataOffset + compressedSize;
    if (dataEnd > bytes.length) {
      pos++;
      continue;
    }
    const data = bytes.subarray(dataOffset, dataEnd);
    entries.push({
      name,
      compressionMethod,
      compressedSize,
      uncompressedSize,
      dataOffset,
      bytes: data,
    });
    pos = dataEnd;
  }
  return entries;
}

/** Decompress an entry (STORE or DEFLATE). Returns raw bytes. */
export async function decompressEntry(entry: ZipEntry): Promise<Uint8Array> {
  if (entry.compressionMethod === 0) {
    // STORE — return bytes as-is
    const out = new Uint8Array(entry.bytes.length);
    out.set(entry.bytes);
    return out;
  }
  if (entry.compressionMethod === 8) {
    // DEFLATE — use DecompressionStream if available
    const DS = (globalThis as { DecompressionStream?: typeof DecompressionStream }).DecompressionStream;
    if (!DS) {
      throw new Error("DEFLATE entries require DecompressionStream (not available in this environment).");
    }
    const blob = new Blob([entry.bytes as BlobPart]);
    const stream = blob.stream().pipeThrough(new DS("deflate-raw"));
    const buf = await new Response(stream).arrayBuffer();
    return new Uint8Array(buf);
  }
  throw new Error(`Unsupported compression method: ${entry.compressionMethod}`);
}

/** Decode bytes as UTF-8 text. */
export function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder("utf-8").decode(bytes);
}

// ===== Path helpers =====

/** Join two ZIP paths. */
export function joinPath(base: string, rel: string): string {
  if (!base) return normalizePathStr(rel);
  if (rel.startsWith("/")) return normalizePathStr(rel);
  const baseParts = base.split("/");
  baseParts.pop(); // remove filename
  const relParts = rel.split("/");
  for (const p of relParts) {
    if (p === "..") baseParts.pop();
    else if (p !== ".") baseParts.push(p);
  }
  return normalizePathStr(baseParts.join("/"));
}

/** Normalize a path: collapse double slashes, leading slashes. */
export function normalizePathStr(path: string): string {
  return path.replace(/\/+/g, "/").replace(/^\//, "");
}

/** Strip the fragment (#anchor) from a path. */
export function splitAnchor(path: string): { path: string; anchor?: string } {
  const idx = path.indexOf("#");
  if (idx < 0) return { path };
  return { path: path.slice(0, idx), anchor: path.slice(idx + 1) };
}

/** Get the directory portion of a path (without trailing slash). */
export function dirname(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx >= 0 ? path.slice(0, idx) : "";
}

// ===== OPF parsing =====

export interface OpfManifestItem {
  id: string;
  href: string;
  mediaType: string;
  properties?: string;
}

export interface OpfManifest {
  metadata: EpubMetadata;
  manifest: Map<string, OpfManifestItem>;
  spine: Array<{ idref: string; linear: boolean }>;
  /** Absolute path of the OPF file inside the ZIP. */
  opfPath: string;
}

/** Minimal XML tag parser — extracts attributes from a tag string. */
export function parseAttributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /(\w[\w-]*)\s*=\s*"([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tag)) !== null) {
    attrs[m[1].toLowerCase()] = m[2];
  }
  return attrs;
}

/** Extract the text content of the first occurrence of <tag>...</tag>. */
export function extractTag(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const m = xml.match(re);
  return m ? m[1].trim() : "";
}

/** Extract all <tag>...</tag> contents. */
export function extractAllTags(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "gi");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    out.push(m[1].trim());
  }
  return out;
}

/** Strip XML tags, returning text content only. */
export function stripXmlTags(xml: string): string {
  return xml
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Parse the OPF (root metadata + manifest + spine) XML. */
export function parseOpf(opfXml: string, opfPath: string): OpfManifest {
  // Metadata
  const title = extractTag(opfXml, "dc:title") || extractTag(opfXml, "title") || "(untitled)";
  const author = extractTag(opfXml, "dc:creator") || extractTag(opfXml, "creator") || "(unknown author)";
  const language = extractTag(opfXml, "dc:language") || extractTag(opfXml, "language") || "";
  const identifier = extractTag(opfXml, "dc:identifier") || extractTag(opfXml, "identifier") || "";
  const publisher = extractTag(opfXml, "dc:publisher") || "";
  const description = extractTag(opfXml, "dc:description") || "";
  const rights = extractTag(opfXml, "dc:rights") || "";

  // Manifest items
  const manifest = new Map<string, OpfManifestItem>();
  const itemRe = /<item\b[^>]*\/>/gi;
  const itemRe2 = /<item\b[^>]*>/gi;
  const matches = opfXml.match(itemRe) ?? opfXml.match(itemRe2) ?? [];
  for (const itemTag of matches) {
    const attrs = parseAttributes(itemTag);
    const id = attrs["id"];
    const href = attrs["href"];
    const mediaType = attrs["media-type"] || attrs["mediatype"] || "";
    const properties = attrs["properties"];
    if (id && href) {
      manifest.set(id, {
        id, href, mediaType, properties,
      });
    }
  }

  // Spine (reading order)
  const spine: Array<{ idref: string; linear: boolean }> = [];
  const itemrefRe = /<itemref\b[^>]*\/?>/gi;
  const refMatches = opfXml.match(itemrefRe) ?? [];
  for (const refTag of refMatches) {
    const attrs = parseAttributes(refTag);
    const idref = attrs["idref"];
    if (idref) {
      const linear = attrs["linear"] !== "no";
      spine.push({ idref, linear });
    }
  }

  return {
    metadata: { title, author, language, identifier, publisher, description, rights },
    manifest,
    spine,
    opfPath,
  };
}

// ===== Container.xml parsing (find the OPF path) =====

/** Parse META-INF/container.xml to find the OPF path. */
export function parseContainerXml(xml: string): string | null {
  const re = /<rootfile\b[^>]*\/?>/i;
  const m = xml.match(re);
  if (!m) return null;
  const attrs = parseAttributes(m[0]);
  return attrs["full-path"] ?? null;
}

// ===== TOC parsing (NCX for EPUB 2, NAV for EPUB 3) =====

/** Parse NCX (EPUB 2 TOC) XML into TocEntry list. */
export function parseNcx(ncxXml: string, opfPath: string): TocEntry[] {
  const entries: TocEntry[] = [];
  const navPointRe = /<navPoint\b[^>]*>([\s\S]*?)<\/navPoint>/gi;
  let m: RegExpExecArray | null;
  let currentLevel = 0;
  while ((m = navPointRe.exec(ncxXml)) !== null) {
    const block = m[1];
    const title = stripXmlTags(extractTag(block, "text") || extractTag(block, "navLabel"));
    // <content src="..." /> is self-closing — match the tag and extract src attribute
    const contentTagMatch = block.match(/<content\b[^>]*\/?>/i);
    const contentAttrs = contentTagMatch ? parseAttributes(contentTagMatch[0]) : {};
    const src = contentAttrs["src"] || "";
    const { path, anchor } = splitAnchor(src);
    const absolutePath = joinPath(opfPath, path);
    entries.push({ title, absolutePath, anchor, level: currentLevel });
  }
  return entries;
}

/** Parse NAV (EPUB 3 TOC XHTML) into TocEntry list. */
export function parseNav(navXml: string, opfPath: string): TocEntry[] {
  const entries: TocEntry[] = [];
  // Find <nav epub:type="toc">...</nav> — fallback to any <nav>
  const navMatch = navXml.match(/<nav\b[^>]*>([\s\S]*?)<\/nav>/i);
  const navBlock = navMatch ? navMatch[1] : navXml;
  // Walk <li><a href="...">Title</a>...</li> with nesting
  const liRe = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
  let m: RegExpExecArray | null;
  let currentLevel = 0;
  while ((m = liRe.exec(navBlock)) !== null) {
    const liBlock = m[1];
    const aMatch = liBlock.match(/<a\b[^>]*>([\s\S]*?)<\/a>/i);
    if (!aMatch) continue;
    const aTag = liBlock.match(/<a\b[^>]*>/i)?.[0] ?? "";
    const attrs = parseAttributes(aTag);
    const href = attrs["href"] || "";
    const title = stripXmlTags(aMatch[1]);
    const { path, anchor } = splitAnchor(href);
    const absolutePath = joinPath(opfPath, path);
    // Detect nesting by counting nested <ol>
    const nestedOls = (liBlock.match(/<ol\b/gi) ?? []).length;
    entries.push({ title, absolutePath, anchor, level: currentLevel });
    if (nestedOls > 0) currentLevel += nestedOls;
    if (nestedOls === 0 && entries.length > 1) {
      // Try to detect when we step back up (heuristic)
      currentLevel = Math.max(0, currentLevel - 0);
    }
  }
  return entries;
}

// ===== Top-level EPUB parsing =====

/** Parse a complete EPUB file. Returns book object with chapters + TOC. */
export async function parseEpub(bytes: Uint8Array, fileName: string, fileSize: number): Promise<EpubBook> {
  const entries = parseZipEntries(bytes);
  if (entries.length === 0) throw new Error("EPUB file appears to be empty or corrupt.");

  const entryMap = new Map<string, ZipEntry>();
  for (const e of entries) entryMap.set(e.name, e);

  // 1. Read META-INF/container.xml to find OPF path
  const containerEntry = entryMap.get("META-INF/container.xml");
  if (!containerEntry) throw new Error("Missing META-INF/container.xml — not a valid EPUB.");
  const containerXml = decodeUtf8(await decompressEntry(containerEntry));
  const opfPath = parseContainerXml(containerXml);
  if (!opfPath) throw new Error("container.xml does not declare a rootfile (OPF).");

  // 2. Read OPF
  const opfEntry = entryMap.get(opfPath);
  if (!opfEntry) throw new Error(`OPF file not found in archive: ${opfPath}`);
  const opfXml = decodeUtf8(await decompressEntry(opfEntry));
  const opf = parseOpf(opfXml, opfPath);

  // 3. Build chapters from spine
  const chapters: EpubChapter[] = [];
  for (const spineItem of opf.spine) {
    const item = opf.manifest.get(spineItem.idref);
    if (!item) continue;
    const absolutePath = normalizePathStr(joinPath(opfPath, item.href));
    const chapterEntry = entryMap.get(absolutePath);
    if (!chapterEntry) continue;
    const content = decodeUtf8(await decompressEntry(chapterEntry));
    // Extract title from first heading or <title>
    const htmlTitle = extractTag(content, "title");
    const h1 = extractTag(content, "h1");
    const h2 = extractTag(content, "h2");
    const title = htmlTitle || h1 || h2 || `Chapter ${chapters.length + 1}`;
    chapters.push({
      id: item.id,
      href: item.href,
      absolutePath,
      title,
      mediaType: item.mediaType,
      content,
    });
  }

  // 4. Find and parse TOC (prefer NAV, fallback NCX)
  let toc: TocEntry[] = [];
  // Look for item with properties="nav" (EPUB 3)
  let navItem: OpfManifestItem | undefined;
  for (const item of opf.manifest.values()) {
    if (item.properties?.includes("nav")) {
      navItem = item;
      break;
    }
  }
  if (navItem) {
    const navPath = normalizePathStr(joinPath(opfPath, navItem.href));
    const navEntry = entryMap.get(navPath);
    if (navEntry) {
      const navXml = decodeUtf8(await decompressEntry(navEntry));
      toc = parseNav(navXml, opfPath);
    }
  }
  // Fall back to NCX
  if (toc.length === 0) {
    let ncxItem: OpfManifestItem | undefined;
    for (const item of opf.manifest.values()) {
      if (item.mediaType === "application/x-dtbncx+xml") {
        ncxItem = item;
        break;
      }
    }
    if (ncxItem) {
      const ncxPath = normalizePathStr(joinPath(opfPath, ncxItem.href));
      const ncxEntry = entryMap.get(ncxPath);
      if (ncxEntry) {
        const ncxXml = decodeUtf8(await decompressEntry(ncxEntry));
        toc = parseNcx(ncxXml, opfPath);
      }
    }
  }
  // Last resort: build TOC from chapter titles
  if (toc.length === 0) {
    toc = chapters.map((c, i) => ({
      title: c.title,
      absolutePath: c.absolutePath,
      level: 0,
    }));
    void toc;
  }

  return {
    metadata: opf.metadata,
    chapters,
    toc,
    fileName,
    fileSize,
  };
}

// ===== Search within book =====

export interface SearchResult {
  chapterIndex: number;
  chapterTitle: string;
  snippet: string;
  matchIndex: number;
}

/** Search the book for a query string. Returns matching snippets. */
export function searchBook(book: EpubBook, query: string): SearchResult[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  const results: SearchResult[] = [];
  for (let i = 0; i < book.chapters.length; i++) {
    const chapter = book.chapters[i];
    const text = stripXmlTags(chapter.content);
    const lower = text.toLowerCase();
    let idx = lower.indexOf(q);
    while (idx >= 0 && results.length < 200) {
      const start = Math.max(0, idx - 40);
      const end = Math.min(text.length, idx + q.length + 40);
      const snippet = (start > 0 ? "..." : "") + text.slice(start, end) + (end < text.length ? "..." : "");
      results.push({
        chapterIndex: i,
        chapterTitle: chapter.title,
        snippet,
        matchIndex: idx,
      });
      idx = lower.indexOf(q, idx + q.length);
    }
  }
  return results;
}

// ===== Reading progress =====

/** Compute reading progress percentage based on chapter index. */
export function readingProgress(currentChapter: number, totalChapters: number): number {
  if (totalChapters === 0) return 0;
  return Math.round(((currentChapter + 1) / totalChapters) * 100);
}

/** Extract the body content from an XHTML chapter (for safe rendering). */
export function extractBody(html: string): string {
  const m = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  return m ? m[1] : html;
}

/** Sanitize chapter HTML by removing scripts and event handlers. */
export function sanitizeChapterHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/javascript:/gi, "");
}

// ===== Bookmarks + history (localStorage) =====
const BOOKMARK_KEY = "unqtools-epub-bookmarks";
const HISTORY_KEY = "unqtools-epub-history";
const MAX_HISTORY = 10;

export interface EpubBookmark {
  fileName: string;
  title: string;
  chapterIndex: number;
  totalChapters: number;
  savedAt: string;
}

export interface EpubHistoryEntry {
  fileName: string;
  title: string;
  author: string;
  chapterCount: number;
  fileSize: number;
  openedAt: string;
}

export function loadBookmarks(): EpubBookmark[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(BOOKMARK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export function saveBookmark(bookmark: EpubBookmark): EpubBookmark[] {
  if (typeof localStorage === "undefined") return [];
  const others = loadBookmarks().filter((b) => b.fileName !== bookmark.fileName);
  const updated = [bookmark, ...others].slice(0, MAX_HISTORY);
  try { localStorage.setItem(BOOKMARK_KEY, JSON.stringify(updated)); } catch {}
  return updated;
}

export function getBookmark(fileName: string): EpubBookmark | null {
  return loadBookmarks().find((b) => b.fileName === fileName) ?? null;
}

export function clearBookmarks(): void {
  if (typeof localStorage === "undefined") return;
  try { localStorage.removeItem(BOOKMARK_KEY); } catch {}
}

export function loadHistory(): EpubHistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_HISTORY) : [];
  } catch { return []; }
}

export function saveToHistory(entry: EpubHistoryEntry): EpubHistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  const others = loadHistory().filter((e) => e.fileName !== entry.fileName);
  const updated = [entry, ...others].slice(0, MAX_HISTORY);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(updated)); } catch {}
  return updated;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try { localStorage.removeItem(HISTORY_KEY); } catch {}
}

// ===== Utilities =====

/** Format bytes as human-readable. */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Build a shareable URL with reader settings. */
export function buildShareUrl(fontSize: string, fontFamily: string, theme: string): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams();
  params.set("size", fontSize);
  params.set("font", fontFamily);
  params.set("theme", theme);
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

/** Parse reader settings from URL hash. */
export function parseShareUrl(hash: string): { fontSize: string; fontFamily: string; theme: string } | null {
  if (!hash || !hash.startsWith("#")) return null;
  const params = new URLSearchParams(hash.slice(1));
  if (!params.has("size") && !params.has("font") && !params.has("theme")) return null;
  return {
    fontSize: params.get("size") ?? "md",
    fontFamily: params.get("font") ?? "serif",
    theme: params.get("theme") ?? "light",
  };
}
