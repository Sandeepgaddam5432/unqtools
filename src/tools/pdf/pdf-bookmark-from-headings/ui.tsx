"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  PDFDocument,
  PDFRawStream,
  PDFStream,
  PDFContentStream,
  PDFArray,
  PDFDict,
  PDFName,
  PDFNumber,
  decodePDFRawStream,
  type PDFPage,
  type PDFRef,
} from "pdf-lib";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Download,
  FileUp,
  Trash2,
  History,
  AlertTriangle,
  ListTree,
  Code2,
} from "lucide-react";
import { toast } from "sonner";
import {
  ActionBar,
  ClearButton,
  CopyButton,
  DownloadButton,
  EmptyState,
  ErrorBanner,
  RunButton,
  ShareButton,
} from "../../_shared";
import { formatBytes, downloadBytes } from "../_shared/download";
import {
  DEFAULT_OPTIONS,
  DEFAULT_THRESHOLDS,
  DETECTION_METHODS,
  DETECTION_METHOD_LABELS,
  HEADING_LEVELS,
  HEADING_LEVEL_LABELS,
  cleanHeadingText,
  parseTextPatterns,
  detectHeadings,
  buildBookmarkTree,
  removeDuplicateBookmarks,
  computeSummaryStats,
  validateBookmarkDestinations,
  validateOptions,
  renderTextTree,
  renderCsvTree,
  renderJsonTree,
  flattenTree,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type DetectionMethod,
  type HeadingLevel,
  type TextItem,
  type HeadingCandidate,
  type BookmarkNode,
  type BookmarkOptions,
  type SummaryStats,
  type HistoryEntry,
  type CompiledPattern,
} from "./logic";

// ---------------------------------------------------------------------------
// PDF content-stream text extraction
// ---------------------------------------------------------------------------

function getStreamBytes(stream: unknown): Uint8Array {
  if (!stream) return new Uint8Array(0);
  try {
    if (stream instanceof PDFRawStream) {
      return decodePDFRawStream(stream).decode();
    }
    if (stream instanceof PDFContentStream) {
      // fall through to PDFStream
    }
    if (stream instanceof PDFStream) {
      return stream.getContents();
    }
  } catch {
    // ignore
  }
  return new Uint8Array(0);
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

function readPageContent(page: PDFPage): string {
  let contents: unknown;
  try {
    contents = (page.node as unknown as { Contents?: () => unknown }).Contents?.();
  } catch {
    return "";
  }
  if (!contents) return "";
  let bytes: Uint8Array;
  if (contents instanceof PDFArray) {
    const parts: Uint8Array[] = [];
    for (let i = 0; i < contents.size(); i++) {
      const item = contents.lookup(i);
      parts.push(getStreamBytes(item));
    }
    bytes = concatBytes(parts);
  } else {
    bytes = getStreamBytes(contents);
  }
  if (bytes.length === 0) return "";
  return new TextDecoder("latin1").decode(bytes);
}

/** Decode a (...) literal string body. Returns text and end index (just after closing paren). */
function consumeParenString(content: string, start: number): { text: string; end: number } {
  let i = start + 1;
  let depth = 1;
  let body = "";
  while (i < content.length && depth > 0) {
    const ch = content[i];
    if (ch === "\\") {
      body += ch + (content[i + 1] ?? "");
      i += 2;
      continue;
    }
    if (ch === "(") depth += 1;
    else if (ch === ")") {
      depth -= 1;
      if (depth === 0) break;
    }
    body += ch;
    i++;
  }
  // Decode escapes
  let decoded = "";
  let j = 0;
  while (j < body.length) {
    const ch = body[j];
    if (ch === "\\") {
      const next = body[j + 1];
      if (next === "n") { decoded += "\n"; j += 2; }
      else if (next === "r") { decoded += "\r"; j += 2; }
      else if (next === "t") { decoded += "\t"; j += 2; }
      else if (next === "b") { decoded += "\b"; j += 2; }
      else if (next === "f") { decoded += "\f"; j += 2; }
      else if (next === "(") { decoded += "("; j += 2; }
      else if (next === ")") { decoded += ")"; j += 2; }
      else if (next === "\\") { decoded += "\\"; j += 2; }
      else if (next && /[0-7]/.test(next)) {
        let octal = next;
        if (/[0-7]/.test(body[j + 2] ?? "")) octal += body[j + 2];
        if (/[0-7]/.test(body[j + 3] ?? "")) octal += body[j + 3];
        decoded += String.fromCharCode(parseInt(octal, 8));
        j += 1 + octal.length;
      } else {
        decoded += next ?? "";
        j += 2;
      }
    } else {
      decoded += ch;
      j++;
    }
  }
  return { text: decoded, end: i + 1 };
}

/** Decode a hex string body like "48656c6c6f" → "Hello". */
function decodeHexBody(hex: string): string {
  const clean = hex.replace(/\s/g, "");
  const padded = clean.length % 2 === 0 ? clean : clean + "0";
  let out = "";
  for (let i = 0; i < padded.length; i += 2) {
    out += String.fromCharCode(parseInt(padded.slice(i, i + 2), 16));
  }
  return out;
}

/** Inspect the page's /Resources/Font dictionary to find which font names are bold. */
function collectBoldFontNames(page: PDFPage): Set<string> {
  const bold = new Set<string>();
  try {
    const resources = (page.node as unknown as { Resources?: () => unknown }).Resources?.();
    if (!(resources instanceof PDFDict)) return bold;
    const fontDict = resources.lookup(PDFName.of("Font"));
    if (!(fontDict instanceof PDFDict)) return bold;
    for (const [name] of fontDict.entries()) {
      const fontObj = fontDict.lookup(name);
      if (!(fontObj instanceof PDFDict)) continue;
      // Font name lives in /BaseFont (e.g. "Helvetica-Bold"); if it contains
      // "bold", mark this font name as bold.
      const baseFont = fontObj.get(PDFName.of("BaseFont"));
      const fontNameStr = baseFont?.toString() ?? "";
      if (/bold/i.test(fontNameStr)) {
        bold.add(name.toString());
      }
    }
  } catch {
    // ignore
  }
  return bold;
}

/** Walk a content stream and collect TextItems (text + font size + bold + x/y). */
function extractTextItems(page: PDFPage, pageNumber: number): TextItem[] {
  const content = readPageContent(page);
  if (!content) return [];
  const boldFonts = collectBoldFontNames(page);
  const items: TextItem[] = [];

  let currentFontSize = 12;
  let currentFontName = "";
  let currentX = 0;
  let currentY = 0;
  let pendingNumbers: number[] = [];

  const len = content.length;
  let i = 0;
  while (i < len) {
    const ch = content[i];

    // Whitespace
    if (ch === " " || ch === "\n" || ch === "\r" || ch === "\t") {
      i++;
      continue;
    }

    // Numbers
    if (ch === "-" || ch === "+" || ch === "." || (ch >= "0" && ch <= "9")) {
      let numStr = "";
      let j = i;
      while (j < len && /[0-9.\-+]/.test(content[j])) {
        numStr += content[j];
        j++;
      }
      const num = parseFloat(numStr);
      if (Number.isFinite(num)) pendingNumbers.push(num);
      i = j;
      continue;
    }

    // Literal string (...)
    if (ch === "(") {
      const { text, end } = consumeParenString(content, i);
      i = end;
      const isBold = currentFontName ? boldFonts.has(currentFontName) : false;
      if (text) {
        items.push({
          text,
          fontSize: currentFontSize,
          isBold,
          pageNumber,
          x: currentX,
          y: currentY,
        });
      }
      pendingNumbers = [];
      continue;
    }

    // Hex string <...>
    if (ch === "<" && content[i + 1] !== "<") {
      const end = content.indexOf(">", i + 1);
      if (end === -1) { i++; continue; }
      const hex = content.slice(i + 1, end);
      const text = decodeHexBody(hex);
      i = end + 1;
      const isBold = currentFontName ? boldFonts.has(currentFontName) : false;
      if (text) {
        items.push({
          text,
          fontSize: currentFontSize,
          isBold,
          pageNumber,
          x: currentX,
          y: currentY,
        });
      }
      pendingNumbers = [];
      continue;
    }

    // Name token /Name
    if (ch === "/") {
      let j = i + 1;
      while (j < len && /[A-Za-z0-9._+-]/.test(content[j])) j++;
      i = j;
      continue;
    }

    // Comment %...
    if (ch === "%") {
      let j = i;
      while (j < len && content[j] !== "\n") j++;
      i = j;
      continue;
    }

    // Array / dict brackets
    if (ch === "[" || ch === "]" || ch === "{" || ch === "}") {
      i++;
      continue;
    }

    // Operators
    // Tf — set font: /name size Tf
    if (ch === "T" && content[i + 1] === "f") {
      // Last pending number is size; the name precedes it (we already consumed it)
      if (pendingNumbers.length > 0) {
        const size = pendingNumbers[pendingNumbers.length - 1];
        if (size > 0 && size < 1000) currentFontSize = size;
      }
      // Try to recover the font name from the text just before this operator
      const before = content.slice(Math.max(0, i - 64), i);
      const m = before.match(/\/([A-Za-z0-9._+-]+)\s+[\d.\-+]+\s*$/);
      if (m) currentFontName = "/" + m[1];
      pendingNumbers = [];
      i += 2;
      continue;
    }

    // Td / TD / Tm — text-positioning operators (update x/y)
    if (ch === "T" && (content[i + 1] === "d" || content[i + 1] === "D")) {
      if (pendingNumbers.length >= 2) {
        const tx = pendingNumbers[pendingNumbers.length - 2];
        const ty = pendingNumbers[pendingNumbers.length - 1];
        currentX += tx;
        currentY += ty;
      }
      pendingNumbers = [];
      i += 2;
      continue;
    }
    if (ch === "T" && content[i + 1] === "m") {
      if (pendingNumbers.length >= 6) {
        currentX = pendingNumbers[pendingNumbers.length - 2];
        currentY = pendingNumbers[pendingNumbers.length - 1];
      }
      pendingNumbers = [];
      i += 2;
      continue;
    }

    // T* — next line
    if (ch === "T" && content[i + 1] === "*") {
      currentY -= currentFontSize * 1.2;
      pendingNumbers = [];
      i += 2;
      continue;
    }

    // TJ — show text array (may contain strings and kerning numbers)
    if (ch === "T" && content[i + 1] === "J") {
      // We've already consumed strings inside [...] via the bracket handling? No,
      // we don't handle brackets by extracting strings. We need to walk back and
      // find string literals in the pending array. Simpler: scan backwards for
      // strings between this TJ and the previous operator.
      const before = content.slice(Math.max(0, i - 4096), i);
      const parts: string[] = [];
      // Find last balanced [...] in `before`
      const lastOpen = before.lastIndexOf("[");
      if (lastOpen >= 0) {
        const arrBody = before.slice(lastOpen + 1);
        let k = 0;
        while (k < arrBody.length) {
          const c = arrBody[k];
          if (c === "(") {
            const { text, end } = consumeParenString(arrBody, k);
            parts.push(text);
            k = end;
            continue;
          }
          if (c === "<") {
            const end = arrBody.indexOf(">", k + 1);
            if (end === -1) break;
            parts.push(decodeHexBody(arrBody.slice(k + 1, end)));
            k = end + 1;
            continue;
          }
          k++;
        }
      }
      const joined = parts.join("");
      const isBold = currentFontName ? boldFonts.has(currentFontName) : false;
      if (joined) {
        items.push({
          text: joined,
          fontSize: currentFontSize,
          isBold,
          pageNumber,
          x: currentX,
          y: currentY,
        });
      }
      pendingNumbers = [];
      i += 2;
      continue;
    }

    // Tj — show text (string already consumed by ( or < handlers above)
    if (ch === "T" && content[i + 1] === "j") {
      pendingNumbers = [];
      i += 2;
      continue;
    }

    // ' and " — show text with move
    if (ch === "'" || ch === '"') {
      pendingNumbers = [];
      i += 1;
      continue;
    }

    // q / Q — save/restore graphics state
    if (ch === "q" || ch === "Q") {
      pendingNumbers = [];
      i += 1;
      continue;
    }

    // Generic — clear pendingNumbers on any other letter operator
    if (/[a-zA-Z*'"]/.test(ch)) {
      let j = i;
      while (j < len && /[a-zA-Z*'"]/.test(content[j])) j++;
      pendingNumbers = [];
      i = j;
      continue;
    }

    i++;
  }

  return items;
}

// ---------------------------------------------------------------------------
// Outline (bookmark tree) writing
// ---------------------------------------------------------------------------

interface OutlinePayload {
  ref: PDFRef;
  node: BookmarkNode;
}

function buildOutline(
  doc: PDFDocument,
  tree: BookmarkNode[],
  pages: PDFPage[],
): { rootRef: PDFRef | null; count: number } {
  if (tree.length === 0) return { rootRef: null, count: 0 };

  function findPageRef(pageNumber: number): PDFRef | null {
    const idx = pageNumber - 1;
    if (idx < 0 || idx >= pages.length) return null;
    return pages[idx].ref;
  }

  function buildNode(node: BookmarkNode, parent: PDFRef | null): OutlinePayload {
    const childrenPayloads: OutlinePayload[] = [];
    for (const child of node.children) {
      childrenPayloads.push(buildNode(child, null)); // parent set below
    }
    // Assign real parent refs after creation
    const pageRef = findPageRef(node.page);
    const dict = doc.context.obj({
      Title: node.title,
      Dest: pageRef ? [pageRef, "Fit"] : undefined,
    }) as PDFDict;
    const ref = doc.context.register(dict);
    // Re-assign children parents (we couldn't pass ref before creation)
    for (const cp of childrenPayloads) {
      // We'll set Parent on the child dict directly
      const childDict = doc.context.lookup(cp.ref);
      if (childDict instanceof PDFDict) {
        childDict.set(PDFName.of("Parent"), ref);
      }
    }
    // Set First / Last / Count
    if (childrenPayloads.length > 0) {
      dict.set(PDFName.of("First"), childrenPayloads[0].ref);
      dict.set(PDFName.of("Last"), childrenPayloads[childrenPayloads.length - 1].ref);
      // Count: number of open descendants (we mark all as open).
      function countFromNode(n: BookmarkNode): number {
        let c = 0;
        for (const child of n.children) {
          c += 1 + countFromNode(child);
        }
        return c;
      }
      const descendantCount = countFromNode(node);
      dict.set(PDFName.of("Count"), PDFNumber.of(descendantCount));
    }
    // Link children siblings
    for (let i = 0; i < childrenPayloads.length; i++) {
      const childDict = doc.context.lookup(childrenPayloads[i].ref);
      if (childDict instanceof PDFDict) {
        if (i > 0) childDict.set(PDFName.of("Prev"), childrenPayloads[i - 1].ref);
        if (i < childrenPayloads.length - 1) childDict.set(PDFName.of("Next"), childrenPayloads[i + 1].ref);
      }
    }
    if (parent) {
      dict.set(PDFName.of("Parent"), parent);
    }
    return { ref, node };
  }

  // Build root-level nodes (their parent will be the Outlines dict)
  const rootPayloads: OutlinePayload[] = tree.map((node) => buildNode(node, null));
  // Create Outlines dict
  const outlinesDict = doc.context.obj({
    Type: "Outlines",
    First: rootPayloads[0].ref,
    Last: rootPayloads[rootPayloads.length - 1].ref,
  }) as PDFDict;
  const outlinesRef = doc.context.register(outlinesDict);
  // Set Parent on each root payload + link siblings
  for (let i = 0; i < rootPayloads.length; i++) {
    const d = doc.context.lookup(rootPayloads[i].ref);
    if (d instanceof PDFDict) {
      d.set(PDFName.of("Parent"), outlinesRef);
      if (i > 0) d.set(PDFName.of("Prev"), rootPayloads[i - 1].ref);
      if (i < rootPayloads.length - 1) d.set(PDFName.of("Next"), rootPayloads[i + 1].ref);
    }
  }
  // Count on Outlines: total open descendants (positive = all open)
  let totalCount = 0;
  function countAll(n: BookmarkNode): number {
    let c = 0;
    for (const child of n.children) {
      c += 1 + countAll(child);
    }
    return c;
  }
  for (const root of tree) totalCount += 1 + countAll(root);
  outlinesDict.set(PDFName.of("Count"), PDFNumber.of(totalCount));

  doc.catalog.set(PDFName.of("Outlines"), outlinesRef);
  return { rootRef: outlinesRef, count: totalCount };
}

// ---------------------------------------------------------------------------
// React component
// ---------------------------------------------------------------------------

export default function PdfBookmarkFromHeadings() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array; pageCount: number } | null>(null);
  const [opts, setOpts] = useState<BookmarkOptions>(DEFAULT_OPTIONS);
  const [result, setResult] = useState<Uint8Array | null>(null);
  const [tree, setTree] = useState<BookmarkNode[] | null>(null);
  const [stats, setStats] = useState<SummaryStats | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (Object.keys(p).length > 0) {
        setOpts((prev) => ({ ...prev, ...p }));
        toast.info("Loaded settings from share link");
      }
    }
  }, []);

  function updateOpts<K extends keyof BookmarkOptions>(key: K, value: BookmarkOptions[K]) {
    setOpts((prev) => ({ ...prev, [key]: value }));
  }

  async function loadFile(f: File) {
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const doc = await PDFDocument.load(bytes);
      setFile({ name: f.name, bytes, pageCount: doc.getPageCount() });
      setResult(null);
      setTree(null);
      setStats(null);
      setError("");
    } catch {
      toast.error(`Could not read ${f.name} — it may be corrupted or password-protected.`);
    }
  }

  function reset() {
    setFile(null);
    setResult(null);
    setTree(null);
    setStats(null);
    setError("");
    setOpts(DEFAULT_OPTIONS);
  }

  const validation = useMemo(() => validateOptions(opts), [opts]);

  async function run() {
    if (!file) return;
    setWorking(true);
    setError("");
    setResult(null);
    setTree(null);
    setStats(null);
    try {
      if (!validation.ok) {
        setError(validation.error);
        setWorking(false);
        return;
      }
      const doc = await PDFDocument.load(file.bytes);
      const pages = doc.getPages();

      // Extract text items from every page
      const allItems: TextItem[] = [];
      for (let p = 0; p < pages.length; p++) {
        try {
          const items = extractTextItems(pages[p], p + 1);
          allItems.push(...items);
        } catch {
          // skip page on parse error
        }
      }

      // Compile patterns if needed
      let patterns: CompiledPattern[] = [];
      if (opts.detectionMethod === "by-text-pattern" && opts.textPatterns.trim()) {
        const pr = parseTextPatterns(opts.textPatterns);
        if (!pr.ok) {
          setError(pr.error);
          setWorking(false);
          return;
        }
        patterns = pr.output;
      }

      // Detect headings
      const candidates: HeadingCandidate[] = detectHeadings(allItems, opts.detectionMethod, {
        thresholds: opts.thresholds,
        patterns,
        minBoldSize: opts.minBoldSize,
      });

      if (candidates.length === 0) {
        setError(
          `No headings detected using "${DETECTION_METHOD_LABELS[opts.detectionMethod]}". Try lowering the H1/H2/H3 thresholds or switching methods.`,
        );
        setWorking(false);
        return;
      }

      // Build tree + dedupe
      let builtTree = buildBookmarkTree(candidates, opts.maxHeadingLevel);
      const deduped = removeDuplicateBookmarks(builtTree);
      builtTree = deduped.tree;

      // Validate destinations
      const destCheck = validateBookmarkDestinations(builtTree, pages.length);
      if (!destCheck.ok) {
        setError(destCheck.error);
        setWorking(false);
        return;
      }

      // Write outline
      const { count } = buildOutline(doc, builtTree, pages);
      const out = await doc.save();

      setResult(out);
      setTree(builtTree);
      setStats(computeSummaryStats(builtTree, deduped.removed));

      saveHistory({
        ts: Date.now(),
        fileName: file.name,
        pageCount: file.pageCount,
        bookmarkCount: count,
        detectionMethod: opts.detectionMethod,
      });
      setHistory(loadHistory());
      toast.success(`Added ${count} bookmarks`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong while building bookmarks.";
      setError(msg);
    } finally {
      setWorking(false);
    }
  }

  function handleClearHistory() {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }

  const flat = useMemo(() => (tree ? flattenTree(tree) : []), [tree]);
  const textTree = useMemo(
    () => (tree ? renderTextTree(tree, opts.includePageNumbers) : ""),
    [tree, opts.includePageNumbers],
  );
  const csvTree = useMemo(() => (tree ? renderCsvTree(tree) : ""), [tree]);
  const jsonTree = useMemo(() => (tree ? renderJsonTree(tree) : ""), [tree]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      {file ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">{file.pageCount} pages • {formatBytes(file.bytes.length)}</p>
          </div>
          <Button variant="ghost" size="icon" aria-label="Remove" onClick={reset}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files[0];
            if (f) void loadFile(f);
          }}
          className="w-full rounded-xl border-2 border-dashed border-border p-8 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors"
        >
          <FileUp className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">Drop a PDF here or click to browse</p>
          <p className="mt-1 text-xs text-muted-foreground">Auto-build a clickable bookmark outline</p>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        aria-label="Choose PDF"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void loadFile(f);
          e.target.value = "";
        }}
      />

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="hbm-method">Detection method</Label>
            <select
              id="hbm-method"
              value={opts.detectionMethod}
              onChange={(e) => updateOpts("detectionMethod", e.target.value as DetectionMethod)}
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            >
              {DETECTION_METHODS.map((m) => (
                <option key={m} value={m}>{DETECTION_METHOD_LABELS[m]}</option>
              ))}
            </select>
          </div>

          {(opts.detectionMethod === "by-font-size" || opts.detectionMethod === "by-bold-text") && (
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="hbm-h1">H1 font size ≥</Label>
                <Input
                  id="hbm-h1"
                  type="number"
                  min={1}
                  value={opts.thresholds.h1}
                  onChange={(e) =>
                    updateOpts("thresholds", { ...opts.thresholds, h1: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hbm-h2">H2 font size ≥</Label>
                <Input
                  id="hbm-h2"
                  type="number"
                  min={1}
                  value={opts.thresholds.h2}
                  onChange={(e) =>
                    updateOpts("thresholds", { ...opts.thresholds, h2: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hbm-h3">H3 font size ≥</Label>
                <Input
                  id="hbm-h3"
                  type="number"
                  min={1}
                  value={opts.thresholds.h3}
                  onChange={(e) =>
                    updateOpts("thresholds", { ...opts.thresholds, h3: Number(e.target.value) })
                  }
                />
              </div>
            </div>
          )}

          {opts.detectionMethod === "by-bold-text" && (
            <div className="space-y-1.5">
              <Label htmlFor="hbm-mbs">Minimum bold font size (pt)</Label>
              <Input
                id="hbm-mbs"
                type="number"
                min={0}
                value={opts.minBoldSize}
                onChange={(e) => updateOpts("minBoldSize", Number(e.target.value))}
                className="w-32"
              />
              <p className="text-[10px] text-muted-foreground">Bold text below this size is treated as body text.</p>
            </div>
          )}

          {opts.detectionMethod === "by-text-pattern" && (
            <div className="space-y-1.5">
              <Label htmlFor="hbm-pat">Text patterns (one per line)</Label>
              <Textarea
                id="hbm-pat"
                value={opts.textPatterns}
                onChange={(e) => updateOpts("textPatterns", e.target.value)}
                placeholder={"H1: ^Chapter\\s+\\d+\nH2: ^\\d+\\.\\d+ \nH3: ^Note: "}
                className="min-h-[100px] resize-y font-mono text-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                Format: <code>H1: regex</code>, <code>H2: regex</code>, <code>H3: regex</code> (or bare regex defaults to H1).
              </p>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="hbm-ml">Max heading level</Label>
              <select
                id="hbm-ml"
                value={opts.maxHeadingLevel}
                onChange={(e) => updateOpts("maxHeadingLevel", Number(e.target.value) as HeadingLevel)}
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              >
                {HEADING_LEVELS.map((l) => (
                  <option key={l} value={l}>{HEADING_LEVEL_LABELS[l]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 flex items-end">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={opts.includePageNumbers}
                  onChange={(e) => updateOpts("includePageNumbers", e.target.checked)}
                />
                Include page numbers in text report
              </label>
            </div>
          </div>

          {!validation.ok && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300/40 bg-amber-50 dark:bg-amber-950/20 p-2 text-xs text-amber-800 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{validation.error}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <ActionBar>
        <RunButton onClick={() => void run()} disabled={!file || !validation.ok} loading={working} label="Build bookmarks" />
        <CopyButton getText={() => textTree} disabled={!tree} label="Copy tree" />
        <DownloadButton getText={() => csvTree} filename="bookmarks.csv" mime="text/csv" disabled={!tree} label="Download CSV" />
        <DownloadButton getText={() => jsonTree} filename="bookmarks.json" mime="application/json" disabled={!tree} label="Download JSON" />
        <ShareButton getUrl={() => buildShareUrl(opts)} />
        <ClearButton onClick={reset} disabled={!file && !result && !error} label="Clear" />
      </ActionBar>

      {error && <ErrorBanner message={error} />}

      {tree && stats && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <ListTree className="h-4 w-4" /> Bookmark tree ({stats.totalBookmarks} bookmarks)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat label="Total" value={stats.totalBookmarks} />
              <Stat label="Max depth" value={stats.maxDepth} />
              <Stat label="Orphans" value={stats.orphanCount} highlight={stats.orphanCount > 0 ? "bad" : undefined} />
              <Stat label="Duplicates removed" value={stats.duplicateCount} />
            </div>
            <div className="flex flex-wrap gap-2 text-[10px]">
              <Badge variant="outline">H1: {stats.byLevel[1]}</Badge>
              <Badge variant="outline">H2: {stats.byLevel[2]}</Badge>
              <Badge variant="outline">H3: {stats.byLevel[3]}</Badge>
              {Object.entries(stats.byPage).slice(0, 6).map(([page, count]) => (
                <Badge key={page} variant="secondary">p.{page}: {count}</Badge>
              ))}
            </div>
            <pre className="text-[11px] font-mono whitespace-pre-wrap max-h-[400px] overflow-auto rounded-md border bg-background p-2">
              {textTree}
            </pre>
            <p className="text-[10px] text-muted-foreground">
              Showing {flat.length} bookmark(s) across {Object.keys(stats.byPage).length} page(s).
            </p>
          </CardContent>
        </Card>
      )}

      {!tree && file && (
        <EmptyState
          title="No bookmarks yet — click 'Build bookmarks'"
          hint={`Choose a detection method above and click "Build bookmarks" to scan ${file.pageCount} page(s) for headings.`}
          icon={<Code2 className="h-8 w-8" />}
        />
      )}

      {result && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <p className="text-sm font-medium">Bookmarked PDF ready • {formatBytes(result.length)}</p>
          <Button
            onClick={() => downloadBytes(result, `bookmarked-${file?.name ?? "output.pdf"}`)}
            className="gap-1.5"
          >
            <Download className="h-4 w-4" /> Download
          </Button>
        </div>
      )}

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent ({history.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <Badge variant="outline" className="mr-2">{h.bookmarkCount} bookmarks</Badge>
                  <Badge variant="outline" className="mr-2">{DETECTION_METHOD_LABELS[h.detectionMethod]}</Badge>
                  <span className="font-mono text-muted-foreground">{h.fileName}</span>
                  <span className="text-muted-foreground ml-2">· {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        <strong className="text-foreground">Privacy:</strong> All PDF parsing and outline writing runs 100% locally in your browser using pdf-lib. Your PDF never leaves your device.
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: "bad" | "good";
}) {
  const color =
    highlight === "bad"
      ? "text-red-600 dark:text-red-400"
      : highlight === "good"
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-foreground";
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold ${color}`}>{value}</div>
    </div>
  );
}
