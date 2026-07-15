/**
 * FB2 Reader — pure-JS FictionBook 2.0 XML parser.
 *
 * FB2 is a single XML file containing a full ebook. We use the browser's
 * native DOMParser to parse the XML, then walk the tree to extract:
 *   - <description>/<title-info>: title, authors, genre, lang, annotation
 *   - <body>: main content with nested <section> elements (chapters)
 *   - optional <body name="notes">: footnotes
 *
 * Rendering: convert FB2 elements to clean HTML. We strip stylesheets and
 * disallow scripts for safety. Images referenced via <image l:href="#id"/>
 * are resolved to the <binary> element with matching id attribute and
 * inlined as data URIs.
 */

// ===== Types =====

export interface Fb2Author {
  firstName: string;
  middleName: string;
  lastName: string;
  nickname: string;
  /** Formatted full name. */
  fullName: string;
}

export interface Fb2Metadata {
  title: string;
  authors: Fb2Author[];
  genres: string[];
  lang: string;
  srcLang: string;
  annotation: string;
  keywords: string;
  date: string;
  publisher: string;
  year: string;
  isbn: string;
}

export interface Fb2Chapter {
  /** Chapter ID (from the section's id attribute, or generated). */
  id: string;
  /** Chapter title (from <title> element). */
  title: string;
  /** Rendered HTML content. */
  html: string;
  /** Plain text content (for search). */
  text: string;
  /** Nesting level (0 = top-level). */
  level: number;
}

export interface Fb2Book {
  metadata: Fb2Metadata;
  chapters: Fb2Chapter[];
  fileName: string;
  fileSize: number;
  /** Total character count of all chapters' plain text. */
  totalChars: number;
  /** Map of binary ID → data URI for embedded images. */
  images: Record<string, string>;
}

// ===== XML parsing (uses DOMParser in browser; minimal shim for tests) =====

interface XmlElement {
  tagName: string;
  attributes: Record<string, string>;
  textContent: string;
  children: XmlElement[];
  querySelectorAll(selector: string): XmlElement[];
}

interface XmlDocument {
  documentElement: XmlElement | null;
  querySelector(selector: string): XmlElement | null;
  querySelectorAll(selector: string): XmlElement[];
}

let domParserAvailable = false;
try {
  if (typeof DOMParser !== "undefined") domParserAvailable = true;
} catch {
  /* ignore */
}

function parseXmlString(xml: string): XmlDocument {
  if (domParserAvailable) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, "application/xml") as unknown as XmlDocument;
    return doc;
  }
  // Minimal fallback parser (used in tests without DOMParser).
  return minimalXmlParse(xml);
}

// ===== Minimal XML parser (test environment fallback) =====
// This is a very simple parser — does NOT handle namespaces, CDATA, or
// entity expansion correctly. Used only for unit tests.

function minimalXmlParse(xml: string): XmlDocument {
  const root: XmlElement = {
    tagName: "#document",
    attributes: {},
    textContent: "",
    children: [],
    querySelectorAll(selector: string): XmlElement[] {
      return findAllByTag(this, selector);
    },
  };
  const stack: XmlElement[] = [root];
  let i = 0;
  const len = xml.length;
  while (i < len) {
    while (i < len && /\s/.test(xml[i]!)) i++;
    if (i >= len) break;
    if (xml[i] !== "<") {
      let textEnd = xml.indexOf("<", i);
      if (textEnd === -1) textEnd = len;
      const text = xml.slice(i, textEnd);
      if (text.length > 0 && stack.length > 0) {
        stack[stack.length - 1]!.textContent += decodeEntities(text);
      }
      i = textEnd;
      continue;
    }
    if (xml.startsWith("<?", i)) {
      const end = xml.indexOf("?>", i);
      i = end === -1 ? len : end + 2;
      continue;
    }
    if (xml.startsWith("<!--", i)) {
      const end = xml.indexOf("-->", i);
      i = end === -1 ? len : end + 3;
      continue;
    }
    if (xml.startsWith("<![CDATA[", i)) {
      const end = xml.indexOf("]]>", i);
      const cdata = end === -1 ? xml.slice(i + 9) : xml.slice(i + 9, end);
      if (stack.length > 0) stack[stack.length - 1]!.textContent += cdata;
      i = end === -1 ? len : end + 3;
      continue;
    }
    if (xml[i + 1] === "/") {
      const end = xml.indexOf(">", i);
      i = end === -1 ? len : end + 1;
      if (stack.length > 1) stack.pop();
      continue;
    }
    const end = xml.indexOf(">", i);
    if (end === -1) break;
    let tagContent = xml.slice(i + 1, end);
    const selfClosing = tagContent.endsWith("/");
    if (selfClosing) tagContent = tagContent.slice(0, -1);
    const nameMatch = tagContent.match(/^([^\s/]+)/);
    const name = nameMatch ? nameMatch[1]! : "";
    // Strip namespace prefix for selector matching but keep original name
    const localName = name.includes(":") ? name.split(":")[1]! : name;
    const attributes: Record<string, string> = {};
    const attrRegex = /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
    let m: RegExpExecArray | null;
    let attrStr = tagContent.slice(name.length).trim();
    while ((m = attrRegex.exec(attrStr)) !== null) {
      // Normalize attribute names: strip namespace prefix
      const attrName = m[1]!.includes(":") ? m[1]!.split(":")[1]! : m[1]!;
      attributes[attrName.toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? "");
    }
    const node: XmlElement = {
      tagName: localName,
      attributes,
      textContent: "",
      children: [],
      querySelectorAll(selector: string): XmlElement[] {
        return findAllByTag(this, selector);
      },
    };
    if (stack.length > 0) stack[stack.length - 1]!.children.push(node);
    if (!selfClosing) stack.push(node);
    i = end + 1;
  }
  const doc: XmlDocument = {
    documentElement: root.children[0] ?? null,
    querySelector(selector: string): XmlElement | null {
      const results = findAllByTag(root, selector);
      return results[0] ?? null;
    },
    querySelectorAll(selector: string): XmlElement[] {
      return findAllByTag(root, selector);
    },
  };
  return doc;
}

function findAllByTag(node: XmlElement, selector: string): XmlElement[] {
  // Selector is a tag name like "title-info" or a CSS-like "FictionBook description title-info"
  const parts = selector.trim().split(/\s+/);
  if (parts.length === 1) {
    return findAllBySingleTag(node, parts[0]!);
  }
  // Descendant combinator: walk to find any descendant matching the chain
  // Simplified: just find the last tag anywhere in descendants of the first match
  let currentMatches: XmlElement[] = [node];
  for (const part of parts) {
    const next: XmlElement[] = [];
    for (const m of currentMatches) {
      next.push(...findAllBySingleTag(m, part));
    }
    currentMatches = next;
  }
  return currentMatches;
}

function findAllBySingleTag(node: XmlElement, tag: string): XmlElement[] {
  const results: XmlElement[] = [];
  for (const child of node.children) {
    if (child.tagName === tag) results.push(child);
    results.push(...findAllBySingleTag(child, tag));
  }
  return results;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

// ===== Helpers =====

function getChildText(parent: XmlElement, tag: string): string {
  for (const child of parent.children) {
    if (child.tagName === tag) return child.textContent.trim();
  }
  return "";
}

function getChildrenByTag(parent: XmlElement, tag: string): XmlElement[] {
  return parent.children.filter((c) => c.tagName === tag);
}

function findFirstByTag(node: XmlElement, tag: string): XmlElement | null {
  for (const child of node.children) {
    if (child.tagName === tag) return child;
    const found = findFirstByTag(child, tag);
    if (found) return found;
  }
  return null;
}

// ===== Metadata extraction =====

export function parseAuthor(authorEl: XmlElement): Fb2Author {
  const firstName = getChildText(authorEl, "first-name");
  const middleName = getChildText(authorEl, "middle-name");
  const lastName = getChildText(authorEl, "last-name");
  const nickname = getChildText(authorEl, "nickname");
  const parts = [firstName, middleName, lastName].filter((s) => s.length > 0);
  const fullName = parts.length > 0 ? parts.join(" ") : nickname || "(unknown author)";
  return { firstName, middleName, lastName, nickname, fullName };
}

export function parseMetadata(doc: XmlDocument): Fb2Metadata {
  const titleInfo = doc.querySelector("description title-info") ?? doc.querySelector("title-info");
  const publishInfo = doc.querySelector("description publish-info");
  const empty: Fb2Metadata = {
    title: "(untitled)",
    authors: [],
    genres: [],
    lang: "",
    srcLang: "",
    annotation: "",
    keywords: "",
    date: "",
    publisher: "",
    year: "",
    isbn: "",
  };
  if (!titleInfo) return empty;
  const title = getChildText(titleInfo, "book-title") || "(untitled)";
  const authorEls = getChildrenByTag(titleInfo, "author");
  const authors = authorEls.map(parseAuthor);
  const genreEls = getChildrenByTag(titleInfo, "genre");
  const genres = genreEls.map((e) => e.textContent.trim()).filter((s) => s.length > 0);
  const lang = getChildText(titleInfo, "lang");
  const srcLang = getChildText(titleInfo, "src-lang");
  const annotation = getChildrenByTag(titleInfo, "annotation")
    .map((a) => a.textContent.trim())
    .join(" ")
    .trim();
  const keywords = getChildText(titleInfo, "keywords");
  const date = getChildText(titleInfo, "date");
  const publisher = publishInfo ? getChildText(publishInfo, "publisher") : "";
  const year = publishInfo ? getChildText(publishInfo, "year") : "";
  const isbn = publishInfo ? getChildText(publishInfo, "isbn") : "";
  return { title, authors, genres, lang, srcLang, annotation, keywords, date, publisher, year, isbn };
}

// ===== Body / chapter extraction =====

const SELF_CLOSING_TAGS = new Set(["empty-line", "image", "strikethrough"]);

/** Convert an FB2 element to HTML. */
export function elementToHtml(el: XmlElement): string {
  const tag = el.tagName;
  if (tag === "p") {
    return `<p>${childrenToHtml(el)}</p>`;
  }
  if (tag === "empty-line") {
    return `<div class="fb2-empty-line"></div>`;
  }
  if (tag === "emphasis") {
    return `<em>${childrenToHtml(el)}</em>`;
  }
  if (tag === "strong") {
    return `<strong>${childrenToHtml(el)}</strong>`;
  }
  if (tag === "strikethrough") {
    return `<del>${childrenToHtml(el)}</del>`;
  }
  if (tag === "code") {
    return `<code>${childrenToHtml(el)}</code>`;
  }
  if (tag === "sub") return `<sub>${childrenToHtml(el)}</sub>`;
  if (tag === "sup") return `<sup>${childrenToHtml(el)}</sup>`;
  if (tag === "a") {
    const href = el.attributes["href"] ?? el.attributes["l:href"] ?? "#";
    return `<a href="${escapeAttr(href)}">${childrenToHtml(el)}</a>`;
  }
  if (tag === "image") {
    const href = el.attributes["href"] ?? el.attributes["l:href"] ?? "";
    return `<img data-href="${escapeAttr(href)}" alt="[image]"/>`;
  }
  if (tag === "poem") {
    return `<div class="fb2-poem">${childrenToHtml(el)}</div>`;
  }
  if (tag === "stanza") {
    return `<div class="fb2-stanza">${childrenToHtml(el)}</div>`;
  }
  if (tag === "v") {
    return `<div class="fb2-verse-line">${childrenToHtml(el)}</div>`;
  }
  if (tag === "epigraph") {
    return `<blockquote class="fb2-epigraph">${childrenToHtml(el)}</blockquote>`;
  }
  if (tag === "cite") {
    return `<cite class="fb2-cite">${childrenToHtml(el)}</cite>`;
  }
  if (tag === "table") {
    return `<table>${childrenToHtml(el)}</table>`;
  }
  if (tag === "tr") return `<tr>${childrenToHtml(el)}</tr>`;
  if (tag === "th") return `<th>${childrenToHtml(el)}</th>`;
  if (tag === "td") return `<td>${childrenToHtml(el)}</td>`;
  if (tag === "title") {
    return `<h2 class="fb2-section-title">${childrenToHtml(el)}</h2>`;
  }
  if (tag === "subtitle") {
    return `<h3 class="fb2-subtitle">${childrenToHtml(el)}</h3>`;
  }
  // Default: just render children
  return childrenToHtml(el);
}

function childrenToHtml(el: XmlElement): string {
  let html = "";
  for (const child of el.children) {
    html += elementToHtml(child);
  }
  // If element has text but no children, return the text
  if (html === "" && el.textContent.trim()) {
    return escapeHtml(el.textContent.trim());
  }
  return html;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Recursively walk <section> elements and build chapter list. */
export function extractChapters(bodyEl: XmlElement): Fb2Chapter[] {
  const chapters: Fb2Chapter[] = [];
  let chapterIdx = 0;
  const walk = (section: XmlElement, level: number) => {
    const id = section.attributes["id"] ?? `section-${chapterIdx}`;
    const titleEl = getChildrenByTag(section, "title")[0];
    const title = titleEl ? titleEl.textContent.trim() : `Section ${chapterIdx + 1}`;
    // Build HTML for non-title children
    let html = "";
    let text = "";
    for (const child of section.children) {
      if (child.tagName === "title") continue;
      html += elementToHtml(child);
      text += child.textContent.trim() + "\n";
    }
    // If this section has a title, prepend it
    if (titleEl) {
      html = `<h2 class="fb2-section-title">${escapeHtml(title)}</h2>` + html;
    }
    chapters.push({
      id,
      title: title || `Section ${chapterIdx + 1}`,
      html,
      text: title + "\n" + text,
      level,
    });
    chapterIdx++;
    // Recurse into nested sections
    for (const child of section.children) {
      if (child.tagName === "section") {
        walk(child, level + 1);
      }
    }
  };
  // Top-level: body may have direct <section> children, or a single <section> wrapper
  const topLevelSections = getChildrenByTag(bodyEl, "section");
  if (topLevelSections.length > 0) {
    for (const section of topLevelSections) {
      walk(section, 0);
    }
  } else {
    // Body has no sections — render the whole body as a single chapter
    let html = "";
    let text = "";
    for (const child of bodyEl.children) {
      html += elementToHtml(child);
      text += child.textContent.trim() + "\n";
    }
    chapters.push({
      id: "body",
      title: "(untitled)",
      html,
      text,
      level: 0,
    });
  }
  return chapters;
}

// ===== Image extraction =====

/** Find all <binary> elements and return a map of id → data URI. */
export function extractImages(doc: XmlDocument): Record<string, string> {
  const images: Record<string, string> = {};
  const binaryEls = doc.querySelectorAll("binary");
  for (const bin of binaryEls) {
    const id = bin.attributes["id"];
    const contentType = bin.attributes["content-type"] ?? "image/jpeg";
    if (id && bin.textContent.trim()) {
      images[id] = `data:${contentType};base64,${bin.textContent.trim()}`;
    }
  }
  return images;
}

/** Resolve image references in chapter HTML to inline data URIs. */
export function resolveImages(html: string, images: Record<string, string>): string {
  return html.replace(/<img data-href="([^"]+)"([^>]*)\/>/g, (match, href, rest) => {
    // href may start with "#" (internal reference)
    const id = href.startsWith("#") ? href.slice(1) : href;
    const dataUri = images[id];
    if (dataUri) {
      return `<img src="${escapeAttr(dataUri)}"${rest}/>`;
    }
    return `<img src="" alt="[missing image: ${escapeAttr(href)}]"${rest}/>`;
  });
}

// ===== Top-level parsing =====

export function parseFb2(xml: string, fileName: string, fileSize: number): Fb2Book {
  const doc = parseXmlString(xml);
  if (!doc.documentElement) {
    throw new Error("FB2 file is empty or could not be parsed as XML.");
  }
  const metadata = parseMetadata(doc);
  const bodyEl = doc.querySelector("body");
  if (!bodyEl) {
    throw new Error("FB2 file has no <body> element — not a valid FictionBook.");
  }
  const chapters = extractChapters(bodyEl);
  const images = extractImages(doc);
  // Resolve image references in each chapter's HTML
  for (const ch of chapters) {
    ch.html = resolveImages(ch.html, images);
  }
  const totalChars = chapters.reduce((s, c) => s + c.text.length, 0);
  return {
    metadata,
    chapters,
    fileName,
    fileSize,
    totalChars,
    images,
  };
}

// ===== Validation =====

export function isFb2Xml(xml: string): boolean {
  // Quick check: must contain <FictionBook> root element
  const trimmed = xml.trimStart().slice(0, 500);
  return /<FictionBook[\s>]/i.test(trimmed) || /<\?xml[\s\S]*?<FictionBook/i.test(trimmed);
}

// ===== Search =====

export interface SearchResult {
  chapterIndex: number;
  chapterTitle: string;
  snippet: string;
  matchIndex: number;
}

export function searchBook(book: Fb2Book, query: string): SearchResult[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  const results: SearchResult[] = [];
  for (let i = 0; i < book.chapters.length; i++) {
    const chapter = book.chapters[i]!;
    const text = chapter.text;
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

export function readingProgress(currentChapter: number, totalChapters: number): number {
  if (totalChapters === 0) return 0;
  return Math.round(((currentChapter + 1) / totalChapters) * 100);
}

// ===== Utilities =====

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

// ===== Bookmarks + history (localStorage) =====

const BOOKMARK_KEY = "unqtools-fb2-bookmarks";
const HISTORY_KEY = "unqtools-fb2-history";
const MAX_HISTORY = 10;

export interface Fb2Bookmark {
  fileName: string;
  title: string;
  author: string;
  chapterIndex: number;
  totalChapters: number;
  savedAt: string;
}

export interface Fb2HistoryEntry {
  fileName: string;
  title: string;
  author: string;
  chapterCount: number;
  fileSize: number;
  openedAt: string;
}

export function loadBookmarks(): Fb2Bookmark[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(BOOKMARK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveBookmark(bookmark: Fb2Bookmark): Fb2Bookmark[] {
  if (typeof localStorage === "undefined") return [];
  const others = loadBookmarks().filter((b) => b.fileName !== bookmark.fileName);
  const updated = [bookmark, ...others].slice(0, MAX_HISTORY);
  try {
    localStorage.setItem(BOOKMARK_KEY, JSON.stringify(updated));
  } catch {
    /* ignore */
  }
  return updated;
}

export function getBookmark(fileName: string): Fb2Bookmark | null {
  return loadBookmarks().find((b) => b.fileName === fileName) ?? null;
}

export function clearBookmarks(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(BOOKMARK_KEY);
  } catch {
    /* ignore */
  }
}

export function loadHistory(): Fb2HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_HISTORY) : [];
  } catch {
    return [];
  }
}

export function saveToHistory(entry: Fb2HistoryEntry): Fb2HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  const others = loadHistory().filter((e) => e.fileName !== entry.fileName);
  const updated = [entry, ...others].slice(0, MAX_HISTORY);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch {
    /* ignore */
  }
  return updated;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    /* ignore */
  }
}

// ===== Shareable URL (reader settings) =====

export interface ShareOptions {
  fontSize: string;
  theme: string;
}

export function buildShareUrl(opts: ShareOptions): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams();
  params.set("size", opts.fontSize);
  params.set("theme", opts.theme);
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareOptions | null {
  if (!hash || !hash.startsWith("#")) return null;
  const params = new URLSearchParams(hash.slice(1));
  if (!params.has("size") && !params.has("theme")) return null;
  return {
    fontSize: params.get("size") ?? "md",
    theme: params.get("theme") ?? "light",
  };
}
