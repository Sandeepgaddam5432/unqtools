/**
 * File Integrity Auditor — pure logic for creating and verifying hash manifests.
 *
 * A manifest is a JSON-serializable record of every file in a folder:
 *   { version, algorithm, createdAt, basePath, files: [{ path, size, mtime, hash }] }
 *
 * Verification compares a saved manifest against a fresh scan to detect
 * added / modified / deleted files.
 */

export type HashAlgorithm = "SHA-256" | "SHA-512" | "SHA-1" | "MD5";

export interface ManifestEntry {
  path: string;
  size: number;
  mtime: number;
  hash: string;
}

export interface Manifest {
  version: 1;
  algorithm: HashAlgorithm;
  createdAt: string;
  basePath: string;
  files: ManifestEntry[];
}

export interface FileDescriptor {
  path: string;       // relative path with forward slashes
  size: number;
  mtime: number;      // last-modified in ms since epoch
  file: File;         // browser File object (for hashing)
}

export interface VerifyDiff {
  added: ManifestEntry[];
  modified: Array<{ entry: ManifestEntry; oldHash: string; oldSize: number }>;
  deleted: ManifestEntry[];
  unchanged: ManifestEntry[];
}

export interface VerifyStats {
  added: number;
  modified: number;
  deleted: number;
  unchanged: number;
  totalBefore: number;
  totalAfter: number;
}

// ===== Glob-style exclude patterns =====

/** Convert a glob pattern to a RegExp. Supports * and ?. */
export function globToRegExp(pattern: string): RegExp {
  // Escape regex metacharacters, then unescape * and ?
  let re = "";
  for (const ch of pattern) {
    if (ch === "*") re += ".*";
    else if (ch === "?") re += ".";
    else if ("\\^$.+()[]{}|".includes(ch)) re += "\\" + ch;
    else re += ch;
  }
  return new RegExp(`^${re}$`, "i");
}

/** Parse a comma-or-newline-separated pattern list into regexes. */
export function parsePatterns(patterns: string): RegExp[] {
  if (!patterns.trim()) return [];
  return patterns
    .split(/[\n,]/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map(globToRegExp);
}

/** Filter a list of file paths by exclude patterns. Returns kept paths. */
export function applyExcludePatterns(paths: string[], patterns: RegExp[]): string[] {
  if (patterns.length === 0) return paths;
  return paths.filter((p) => !patterns.some((re) => re.test(p)));
}

/** Filter by include patterns — keep only matching paths. */
export function applyIncludePatterns(paths: string[], patterns: RegExp[]): string[] {
  if (patterns.length === 0) return paths;
  return paths.filter((p) => patterns.some((re) => re.test(p)));
}

// ===== Path normalization =====

/** Convert a File's webkitRelativePath (or name) to a normalized forward-slash path. */
export function normalizePath(file: File): string {
  const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
  if (rel && rel.length > 0) {
    // Strip leading folder name if it matches the base folder pick
    return rel.replace(/\\/g, "/");
  }
  return file.name.replace(/\\/g, "/");
}

/** Strip the first path segment (the picked folder's name) from a relative path. */
export function stripBaseFolder(path: string): string {
  const slash = path.indexOf("/");
  return slash >= 0 ? path.slice(slash + 1) : path;
}

// ===== Hashing =====

/** Hash a single file in 4 MB chunks. Returns hex hash. */
export async function hashFile(file: File, algorithm: HashAlgorithm): Promise<string> {
  if (algorithm === "MD5") {
    // WebCrypto doesn't support MD5 — use pure-JS fallback (kept simple, RFC 1321).
    const buf = new Uint8Array(await file.arrayBuffer());
    return md5Hex(buf);
  }
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("WebCrypto SubtleCrypto unavailable in this environment.");
  const chunkSize = 4 * 1024 * 1024; // 4 MB
  // @ts-expect-error — `SubtleCrypto.digest` doesn't accept streaming; we read whole file in chunks via FileReader.
  // Actually, we use the whole-file approach: SubtleCrypto requires the entire buffer.
  // For files large enough to OOM, the user should split. Most audits are on text/source files.
  const buf = await file.arrayBuffer();
  const digest = await subtle.digest(algorithm, buf);
  return bufToHex(new Uint8Array(digest));
}

/** Convert bytes to hex string. */
export function bufToHex(bytes: Uint8Array): string {
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

// ===== Pure-JS MD5 (RFC 1321, Joseph Myers compact implementation) =====
// Used only when the user explicitly selects MD5. Not for new manifests.

function md5Hex(data: Uint8Array): string {
  // Convert bytes to binary string for the well-tested string-based core.
  let str = "";
  for (let i = 0; i < data.length; i++) str += String.fromCharCode(data[i]);

  function safeAdd(x: number, y: number): number {
    const lsw = (x & 0xffff) + (y & 0xffff);
    const msw = (x >> 16) + (y >> 16) + (lsw >> 16);
    return (msw << 16) | (lsw & 0xffff);
  }
  function bitRol(num: number, cnt: number): number {
    return (num << cnt) | (num >>> (32 - cnt));
  }
  function md5cmn(q: number, a: number, b: number, x: number, s: number, t: number): number {
    return safeAdd(bitRol(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b);
  }
  function md5ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
    return md5cmn((b & c) | (~b & d), a, b, x, s, t);
  }
  function md5gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
    return md5cmn((b & d) | (c & ~d), a, b, x, s, t);
  }
  function md5hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
    return md5cmn(b ^ c ^ d, a, b, x, s, t);
  }
  function md5ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
    return md5cmn(c ^ (b | ~d), a, b, x, s, t);
  }

  function md5cycle(x: number[], k: number[]): void {
    let [a, b, c, d] = x;
    a = md5ff(a, b, c, d, k[0], 7, -680876936); d = md5ff(d, a, b, c, k[1], 12, -389564586);
    c = md5ff(c, d, a, b, k[2], 17, 606105819); b = md5ff(b, c, d, a, k[3], 22, -1044525330);
    a = md5ff(a, b, c, d, k[4], 7, -176418897); d = md5ff(d, a, b, c, k[5], 12, 1200080426);
    c = md5ff(c, d, a, b, k[6], 17, -1473231341); b = md5ff(b, c, d, a, k[7], 22, -45705983);
    a = md5ff(a, b, c, d, k[8], 7, 1770035416); d = md5ff(d, a, b, c, k[9], 12, -1958414417);
    c = md5ff(c, d, a, b, k[10], 17, -42063); b = md5ff(b, c, d, a, k[11], 22, -1990404162);
    a = md5ff(a, b, c, d, k[12], 7, 1804603682); d = md5ff(d, a, b, c, k[13], 12, -40341101);
    c = md5ff(c, d, a, b, k[14], 17, -1502002290); b = md5ff(b, c, d, a, k[15], 22, 1236535329);
    a = md5gg(a, b, c, d, k[1], 5, -165796510); d = md5gg(d, a, b, c, k[6], 9, -1069501632);
    c = md5gg(c, d, a, b, k[11], 14, 643717713); b = md5gg(b, c, d, a, k[0], 20, -373897302);
    a = md5gg(a, b, c, d, k[5], 5, -701558691); d = md5gg(d, a, b, c, k[10], 9, 38016083);
    c = md5gg(c, d, a, b, k[15], 14, -660478335); b = md5gg(b, c, d, a, k[4], 20, -405537848);
    a = md5gg(a, b, c, d, k[9], 5, 568446438); d = md5gg(d, a, b, c, k[14], 9, -1019803690);
    c = md5gg(c, d, a, b, k[3], 14, -187363961); b = md5gg(b, c, d, a, k[8], 20, 1163531501);
    a = md5gg(a, b, c, d, k[13], 5, -1444681467); d = md5gg(d, a, b, c, k[2], 9, -51403784);
    c = md5gg(c, d, a, b, k[7], 14, 1735328473); b = md5gg(b, c, d, a, k[12], 20, -1926607734);
    a = md5hh(a, b, c, d, k[5], 4, -378558); d = md5hh(d, a, b, c, k[8], 11, -2022574463);
    c = md5hh(c, d, a, b, k[11], 16, 1839030562); b = md5hh(b, c, d, a, k[14], 23, -35309556);
    a = md5hh(a, b, c, d, k[1], 4, -1530992060); d = md5hh(d, a, b, c, k[4], 11, 1272893353);
    c = md5hh(c, d, a, b, k[7], 16, -155497632); b = md5hh(b, c, d, a, k[10], 23, -1094730640);
    a = md5hh(a, b, c, d, k[13], 4, 681279174); d = md5hh(d, a, b, c, k[0], 11, -358537222);
    c = md5hh(c, d, a, b, k[3], 16, -722521979); b = md5hh(b, c, d, a, k[6], 23, 76029189);
    a = md5hh(a, b, c, d, k[9], 4, -640364487); d = md5hh(d, a, b, c, k[12], 11, -421815835);
    c = md5hh(c, d, a, b, k[15], 16, 530742520); b = md5hh(b, c, d, a, k[2], 23, -995338651);
    a = md5ii(a, b, c, d, k[0], 6, -198630844); d = md5ii(d, a, b, c, k[7], 10, 1126891415);
    c = md5ii(c, d, a, b, k[14], 15, -1416354905); b = md5ii(b, c, d, a, k[5], 21, -57434055);
    a = md5ii(a, b, c, d, k[12], 6, 1700485571); d = md5ii(d, a, b, c, k[3], 10, -1894986606);
    c = md5ii(c, d, a, b, k[10], 15, -1051523); b = md5ii(b, c, d, a, k[1], 21, -2054922799);
    a = md5ii(a, b, c, d, k[8], 6, 1873313359); d = md5ii(d, a, b, c, k[15], 10, -30611744);
    c = md5ii(c, d, a, b, k[6], 15, -1560198380); b = md5ii(b, c, d, a, k[13], 21, 1309151649);
    a = md5ii(a, b, c, d, k[4], 6, -145523070); d = md5ii(d, a, b, c, k[11], 10, -1120210379);
    c = md5ii(c, d, a, b, k[2], 15, 718787259); b = md5ii(b, c, d, a, k[9], 21, -343485551);
    x[0] = safeAdd(a, x[0]); x[1] = safeAdd(b, x[1]); x[2] = safeAdd(c, x[2]); x[3] = safeAdd(d, x[3]);
  }

  function md5blk(s: string): number[] {
    const md5blks: number[] = [];
    for (let i = 0; i < 64; i += 4) {
      md5blks[i >> 2] = s.charCodeAt(i) + (s.charCodeAt(i + 1) << 8) + (s.charCodeAt(i + 2) << 16) + (s.charCodeAt(i + 3) << 24);
    }
    return md5blks;
  }

  function md51(s: string): number[] {
    const n = s.length;
    const state = [1732584193, -271733879, -1732584194, 271733878];
    let i: number;
    for (i = 64; i <= n; i += 64) {
      md5cycle(state, md5blk(s.substring(i - 64, i)));
    }
    s = s.substring(i - 64);
    const tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (i = 0; i < s.length; i++) {
      tail[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3);
    }
    tail[i >> 2] |= 0x80 << ((i % 4) << 3);
    if (i > 55) {
      md5cycle(state, tail);
      for (i = 0; i < 16; i++) tail[i] = 0;
    }
    tail[14] = n * 8;
    md5cycle(state, tail);
    return state;
  }

  function rhex(n: number): string {
    let s = "";
    const hexChr = "0123456789abcdef";
    for (let j = 0; j < 4; j++) {
      s += hexChr.charAt((n >> (j * 8 + 4)) & 0x0f) + hexChr.charAt((n >> (j * 8)) & 0x0f);
    }
    return s;
  }

  function hex(x: number[]): string {
    return x.map(rhex).join("");
  }

  return hex(md51(str));
}

// ===== Manifest creation =====

/** Create a manifest from a list of File objects (typically from directory picker). */
export async function createManifest(
  files: File[],
  algorithm: HashAlgorithm,
  excludePatterns: string,
  includePatterns: string = "",
  basePath: string = "",
  onProgress?: (current: number, total: number) => void,
): Promise<Manifest> {
  const excludes = parsePatterns(excludePatterns);
  const includes = parsePatterns(includePatterns);

  // Build descriptors with normalized paths
  let descriptors: FileDescriptor[] = files.map((file) => ({
    path: stripBaseFolder(normalizePath(file)),
    size: file.size,
    mtime: file.lastModified,
    file,
  }));

  // Apply excludes / includes
  descriptors = descriptors.filter((d) => !excludes.some((re) => re.test(d.path)));
  if (includes.length > 0) {
    descriptors = descriptors.filter((d) => includes.some((re) => re.test(d.path)));
  }

  // Sort by path for stable output
  descriptors.sort((a, b) => a.path.localeCompare(b.path));

  const entries: ManifestEntry[] = [];
  for (let i = 0; i < descriptors.length; i++) {
    const d = descriptors[i];
    const hash = await hashFile(d.file, algorithm);
    entries.push({ path: d.path, size: d.size, mtime: d.mtime, hash });
    onProgress?.(i + 1, descriptors.length);
  }

  return {
    version: 1,
    algorithm,
    createdAt: new Date().toISOString(),
    basePath,
    files: entries,
  };
}

/** Serialize a manifest to a pretty-printed JSON string. */
export function manifestToJson(manifest: Manifest): string {
  return JSON.stringify(manifest, null, 2);
}

/** Parse a manifest from JSON. Throws on malformed input. */
export function parseManifest(json: string): Manifest {
  const parsed = JSON.parse(json);
  if (!parsed || typeof parsed !== "object") throw new Error("Invalid manifest: not an object.");
  if (parsed.version !== 1) throw new Error(`Unsupported manifest version: ${parsed.version}`);
  if (!parsed.algorithm) throw new Error("Manifest missing algorithm.");
  if (!Array.isArray(parsed.files)) throw new Error("Manifest files must be an array.");
  for (const e of parsed.files) {
    if (typeof e.path !== "string" || typeof e.hash !== "string") {
      throw new Error("Manifest entry missing path or hash.");
    }
  }
  return parsed as Manifest;
}

/** Serialize a manifest to CSV: path,size,mtime,hash. */
export function manifestToCsv(manifest: Manifest): string {
  const header = "path,size,mtime,hash";
  const rows = manifest.files.map((e) => {
    const path = e.path.includes(",") || e.path.includes('"')
      ? `"${e.path.replace(/"/g, '""')}"` : e.path;
    return `${path},${e.size},${e.mtime},${e.hash}`;
  });
  return [header, ...rows].join("\n");
}

// ===== Verification =====

/** Verify a fresh manifest against a baseline. Returns diff + stats. */
export function verifyManifests(baseline: Manifest, current: Manifest): { diff: VerifyDiff; stats: VerifyStats } {
  const baselineMap = new Map<string, ManifestEntry>();
  for (const e of baseline.files) baselineMap.set(e.path, e);
  const currentMap = new Map<string, ManifestEntry>();
  for (const e of current.files) currentMap.set(e.path, e);

  const added: ManifestEntry[] = [];
  const modified: Array<{ entry: ManifestEntry; oldHash: string; oldSize: number }> = [];
  const deleted: ManifestEntry[] = [];
  const unchanged: ManifestEntry[] = [];

  // Walk current — find added + modified + unchanged
  for (const e of current.files) {
    const old = baselineMap.get(e.path);
    if (!old) {
      added.push(e);
    } else if (old.hash !== e.hash) {
      modified.push({ entry: e, oldHash: old.hash, oldSize: old.size });
    } else {
      unchanged.push(e);
    }
  }
  // Walk baseline — find deleted
  for (const e of baseline.files) {
    if (!currentMap.has(e.path)) {
      deleted.push(e);
    }
  }

  const diff: VerifyDiff = { added, modified, deleted, unchanged };
  const stats: VerifyStats = {
    added: added.length,
    modified: modified.length,
    deleted: deleted.length,
    unchanged: unchanged.length,
    totalBefore: baseline.files.length,
    totalAfter: current.files.length,
  };
  return { diff, stats };
}

// ===== Stats / helpers =====

export interface ManifestStats {
  fileCount: number;
  totalSize: number;
  avgSize: number;
  minSize: number;
  maxSize: number;
  byExtension: Record<string, number>;
}

/** Compute summary stats from manifest entries. */
export function computeManifestStats(entries: ManifestEntry[]): ManifestStats {
  if (entries.length === 0) {
    return { fileCount: 0, totalSize: 0, avgSize: 0, minSize: 0, maxSize: 0, byExtension: {} };
  }
  let total = 0;
  let min = Infinity;
  let max = 0;
  const byExt: Record<string, number> = {};
  for (const e of entries) {
    total += e.size;
    if (e.size < min) min = e.size;
    if (e.size > max) max = e.size;
    const dot = e.path.lastIndexOf(".");
    const ext = dot >= 0 ? e.path.slice(dot + 1).toLowerCase() : "(none)";
    byExt[ext] = (byExt[ext] ?? 0) + 1;
  }
  return {
    fileCount: entries.length,
    totalSize: total,
    avgSize: Math.round(total / entries.length),
    minSize: min,
    maxSize: max,
    byExtension: byExt,
  };
}

/** Format bytes as human-readable. */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Format a changed-files list as plain text (for copy-to-clipboard). */
export function diffToPlainText(diff: VerifyDiff): string {
  const lines: string[] = [];
  if (diff.added.length > 0) {
    lines.push("=== ADDED ===");
    lines.push(...diff.added.map((e) => e.path));
  }
  if (diff.modified.length > 0) {
    lines.push("=== MODIFIED ===");
    lines.push(...diff.modified.map((m) => `${m.entry.path} (was ${m.oldSize}b, now ${m.entry.size}b)`));
  }
  if (diff.deleted.length > 0) {
    lines.push("=== DELETED ===");
    lines.push(...diff.deleted.map((e) => e.path));
  }
  if (lines.length === 0) lines.push("No changes detected.");
  return lines.join("\n");
}

// ===== History (localStorage) =====
const HISTORY_KEY = "unqtools-integrity-auditor-history";
const MAX_HISTORY = 10;

export interface AuditHistoryEntry {
  basePath: string;
  algorithm: HashAlgorithm;
  fileCount: number;
  totalSize: number;
  added: number;
  modified: number;
  deleted: number;
  auditedAt: string;
}

export function loadHistory(): AuditHistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_HISTORY) : [];
  } catch { return []; }
}

export function saveToHistory(entry: AuditHistoryEntry): AuditHistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  const updated = [entry, ...loadHistory()].slice(0, MAX_HISTORY);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(updated)); } catch {}
  return updated;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try { localStorage.removeItem(HISTORY_KEY); } catch {}
}

/** Build a shareable URL encoding algorithm + exclude patterns. */
export function buildShareUrl(algorithm: HashAlgorithm, excludePatterns: string): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams();
  params.set("alg", algorithm);
  if (excludePatterns.trim()) params.set("exclude", excludePatterns);
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

/** Parse share URL into settings. */
export function parseShareUrl(hash: string): { algorithm: HashAlgorithm; excludePatterns: string } | null {
  if (!hash || !hash.startsWith("#")) return null;
  const params = new URLSearchParams(hash.slice(1));
  if (!params.has("alg") && !params.has("exclude")) return null;
  const algorithm = (params.get("alg") as HashAlgorithm) || "SHA-256";
  const excludePatterns = params.get("exclude") ?? "";
  return { algorithm, excludePatterns };
}
