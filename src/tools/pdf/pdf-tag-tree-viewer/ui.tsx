"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  PDFDocument,
  PDFDict,
  PDFArray,
  PDFName,
  PDFObject,
  PDFString,
  PDFHexString,
  PDFNumber,
} from "pdf-lib";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileUp,
  Trash2,
  Network as NetworkIcon,
  History,
  AlertTriangle,
  Lightbulb,
  ShieldCheck,
  BarChart3,
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
import { formatBytes } from "../_shared/download";
import {
  VIEW_MODES,
  VIEW_MODE_LABELS,
  TAG_TYPE_FILTERS,
  DEFAULT_OPTIONS,
  MIN_EXPAND_DEPTH,
  MAX_EXPAND_DEPTH,
  parseTagType,
  buildParsedTree,
  filterByType,
  validateTags,
  checkHeadingHierarchy,
  detectMissingStructure,
  verifyReadingOrder,
  computeSummaryStats,
  renderTextTree,
  renderHtmlTree,
  renderJsonTree,
  renderCsvTags,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  validateOptions,
  type TagOptions,
  type ViewMode,
  type TagTypeFilter,
  type RawTagNode,
  type ParsedTree,
  type SummaryStats,
  type ValidationIssue,
  type HistoryEntry,
} from "./logic";

// ---------------------------------------------------------------------------
// pdf-lib helpers — extract a plain-JS RawTagTree from a PDFDocument's
// StructTreeRoot. The logic layer operates on the plain shape; the ui layer
// is responsible for converting pdf-lib objects to plain values.
// ---------------------------------------------------------------------------

function nameToString(v: PDFObject | undefined): string {
  if (!v) return "";
  try {
    const s = v.toString();
    return s.startsWith("/") ? s.slice(1) : s;
  } catch {
    return "";
  }
}

function pdfStringToString(v: PDFObject | undefined): string {
  if (!v) return "";
  try {
    if (v instanceof PDFString) return v.asString();
    if (v instanceof PDFHexString) return v.decodeText();
    if (typeof (v as unknown as { asString?: () => string }).asString === "function") {
      return (v as unknown as { asString: () => string }).asString();
    }
    const s = v.toString();
    return s.startsWith("/") ? s.slice(1) : s;
  } catch {
    return "";
  }
}

/** Resolve a value that might be an indirect reference. */
function lookup(obj: PDFObject | undefined): PDFObject | undefined {
  // pdf-lib's PDFObject is a union; PDFRef has a lookup method on the doc.
  // We rely on dict.lookup() at the call sites; here we just pass through.
  return obj;
}

/** Read known scalar attributes from a structure-element dictionary. */
function readStructAttrs(dict: PDFDict): Record<string, string> {
  const out: Record<string, string> = {};
  const keys = ["S", "Alt", "ActualText", "Lang", "BBox", "Title", "ID", "Role", "C", "T", "P"];
  for (const key of keys) {
    const name = PDFName.of(key);
    let v: PDFObject | undefined;
    try {
      v = dict.get(name);
    } catch {
      v = undefined;
    }
    if (!v) continue;
    const s = pdfStringToString(v);
    if (s) out[key] = s;
    else {
      const n = nameToString(v);
      if (n) out[key] = n;
    }
  }
  return out;
}

/** Resolve a /Pg reference (page object) to a 1-based page number. */
function readPageNumber(
  pageRef: PDFObject | undefined,
  doc: PDFDocument,
): number {
  if (!pageRef) return 0;
  try {
    const pages = doc.getPages();
    for (let i = 0; i < pages.length; i++) {
      const node = pages[i].node;
      // Compare by reference — pdf-lib pages expose .ref indirectly.
      if ((node as unknown as { ref?: unknown }).ref === (pageRef as unknown as { ref?: unknown }).ref) {
        return i + 1;
      }
    }
  } catch {
    // ignore
  }
  return 0;
}

const MAX_DEPTH_GUARD = 50;
const MAX_NODES_GUARD = 5000;

/** Recursively walk a structure-element dictionary into a RawTagNode tree. */
function walkStructElement(
  dict: PDFDict,
  doc: PDFDocument,
  depth: number,
  visited: Set<PDFDict>,
): RawTagNode | null {
  if (depth > MAX_DEPTH_GUARD) return null;
  if (visited.has(dict)) return null;
  visited.add(dict);
  const sObj = dict.get(PDFName.of("S"));
  const rawType = sObj ? nameToString(sObj) || "Unknown" : "Unknown";
  const attributes = readStructAttrs(dict);
  // /Pg — page reference for this element's content.
  const pages: number[] = [];
  const pgObj = dict.get(PDFName.of("Pg"));
  if (pgObj) {
    const n = readPageNumber(pgObj, doc);
    if (n > 0) pages.push(n);
  }
  // Walk children via /K (kids).
  const children: RawTagNode[] = [];
  const kObj = dict.get(PDFName.of("K"));
  if (kObj) {
    if (kObj instanceof PDFArray) {
      for (let i = 0; i < kObj.size(); i++) {
        if (children.length >= MAX_NODES_GUARD) break;
        const item = kObj.lookup(i);
        const child = resolveKid(item, doc, depth + 1, visited);
        if (child) children.push(child);
      }
    } else {
      const child = resolveKid(kObj, doc, depth + 1, visited);
      if (child) children.push(child);
    }
  }
  // Also gather page references from kids.
  for (const c of children) {
    for (const p of c.pages) {
      if (!pages.includes(p)) pages.push(p);
    }
  }
  return { rawType, attributes, pages, children };
}

/** A /K entry can be a structure element dict, a number (MCID), or a dict with /Type/StructElem. */
function resolveKid(
  obj: PDFObject | undefined,
  doc: PDFDocument,
  depth: number,
  visited: Set<PDFDict>,
): RawTagNode | null {
  if (!obj) return null;
  if (obj instanceof PDFDict) {
    // Could be a structure element directly, or a reference with /Type=StructElem.
    const type = nameToString(obj.get(PDFName.of("Type")));
    const sObj = obj.get(PDFName.of("S"));
    if (type === "StructElem" || sObj) {
      return walkStructElement(obj, doc, depth, visited);
    }
    // Could be /ObjRef or /MCR — skip those.
    return null;
  }
  if (obj instanceof PDFNumber) {
    // MCID (marked-content reference) — no children, no type.
    return null;
  }
  return null;
}

/** Find the StructTreeRoot in the catalog and walk it. */
async function extractStructTree(bytes: Uint8Array): Promise<{ rawRoot: RawTagNode | null; pageCount: number }> {
  const doc = await PDFDocument.load(bytes);
  let structTreeRoot: PDFObject | undefined;
  try {
    structTreeRoot = (doc.catalog as unknown as { lookup: (k: PDFName) => PDFObject | undefined }).lookup(PDFName.of("StructTreeRoot"));
  } catch {
    structTreeRoot = undefined;
  }
  if (!(structTreeRoot instanceof PDFDict)) {
    return { rawRoot: null, pageCount: doc.getPageCount() };
  }
  // The StructTreeRoot has a /K (kids) array of top-level structure elements,
  // usually a single /Document element. We wrap it as a synthetic root.
  const kObj = structTreeRoot.get(PDFName.of("K"));
  const visited = new Set<PDFDict>();
  const children: RawTagNode[] = [];
  if (kObj) {
    if (kObj instanceof PDFArray) {
      for (let i = 0; i < kObj.size(); i++) {
        const item = kObj.lookup(i);
        const child = resolveKid(item, doc, 1, visited);
        if (child) children.push(child);
      }
    } else {
      const child = resolveKid(kObj, doc, 1, visited);
      if (child) children.push(child);
    }
  }
  if (children.length === 0) {
    return { rawRoot: null, pageCount: doc.getPageCount() };
  }
  // If exactly one top-level child (typically /Document), use it as the root.
  if (children.length === 1) {
    return { rawRoot: children[0], pageCount: doc.getPageCount() };
  }
  // Otherwise synthesize a wrapper root.
  return {
    rawRoot: {
      rawType: "Document",
      attributes: {},
      pages: [],
      children,
    },
    pageCount: doc.getPageCount(),
  };
}

// Suppress unused-import lint for lookup — kept for clarity (could be used
// in future for indirect-reference resolution).
void lookup;

// ---------------------------------------------------------------------------
// React component
// ---------------------------------------------------------------------------

export default function PdfTagTreeViewer() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array; pageCount: number } | null>(null);
  const [opts, setOpts] = useState<TagOptions>(DEFAULT_OPTIONS);
  const [parsed, setParsed] = useState<ParsedTree | null>(null);
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

  async function loadFile(f: File) {
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const doc = await PDFDocument.load(bytes);
      setFile({ name: f.name, bytes, pageCount: doc.getPageCount() });
      setParsed(null);
      setError("");
    } catch {
      toast.error(`Could not read ${f.name} — it may be corrupted or password-protected.`);
    }
  }

  function reset() {
    setFile(null);
    setOpts(DEFAULT_OPTIONS);
    setParsed(null);
    setError("");
  }

  async function run() {
    if (!file) return;
    setWorking(true);
    setError("");
    setParsed(null);
    try {
      const validation = validateOptions(opts);
      if (!validation.ok) {
        setError(validation.error);
        setWorking(false);
        return;
      }
      const { rawRoot, pageCount } = await extractStructTree(file.bytes);
      const result = buildParsedTree(rawRoot);
      // Override pageCount with the document's actual page count.
      result.pageCount = pageCount;
      setParsed(result);
      saveHistory({
        ts: Date.now(),
        fileName: file.name,
        pageCount,
        totalTags: result.totalTags,
        maxDepth: result.maxDepth,
        topLevelType: result.root ? result.root.type : "—",
        hasStructureTree: result.hasStructureTree,
      });
      setHistory(loadHistory());
      if (result.hasStructureTree) {
        toast.success(`Parsed ${result.totalTags} tag(s) at max depth ${result.maxDepth}.`);
      } else {
        toast.info("This PDF has no structure tree (untagged PDF).");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong while parsing the structure tree.");
    } finally {
      setWorking(false);
    }
  }

  function handleClearHistory() {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }

  const update = <K extends keyof TagOptions>(key: K, value: TagOptions[K]) =>
    setOpts((prev) => ({ ...prev, [key]: value }));

  const summary: SummaryStats | null = useMemo(
    () => parsed ? computeSummaryStats(parsed) : null,
    [parsed],
  );
  const tagValidation = useMemo<ValidationIssue[]>(() => parsed ? validateTags(parsed) : [], [parsed]);
  const headingIssues = useMemo<ValidationIssue[]>(() => parsed ? checkHeadingHierarchy(parsed) : [], [parsed]);
  const readingOrderIssues = useMemo<ValidationIssue[]>(() => parsed ? verifyReadingOrder(parsed) : [], [parsed]);
  const missingStructure = useMemo<ValidationIssue | null>(() => parsed ? detectMissingStructure(parsed) : null, [parsed]);

  const textReport = useMemo(
    () => parsed ? renderTextTree(parsed, opts) : "",
    [parsed, opts],
  );
  const htmlReport = useMemo(
    () => parsed ? renderHtmlTree(parsed, opts) : "",
    [parsed, opts],
  );
  const jsonReport = useMemo(
    () => parsed ? renderJsonTree(parsed, opts) : "",
    [parsed, opts],
  );
  const csvReport = useMemo(
    () => parsed ? renderCsvTags(parsed, opts) : "",
    [parsed, opts],
  );

  // Visible tags in the current view (used for tree/flat rendering below).
  const visibleTags = useMemo(() => {
    if (!parsed) return [];
    return filterByType(parsed.all, opts.tagTypeFilter);
  }, [parsed, opts.tagTypeFilter]);

  function renderTreeNode(node: { id: number; type: string; rawType: string; depth: number; pages: number[]; attributes: { key: string; value: string }[]; children: typeof visibleTags }): React.ReactNode {
    if (node.depth > opts.expandDepth && opts.expandDepth < MAX_EXPAND_DEPTH) {
      return null;
    }
    const typeMatch = opts.tagTypeFilter === "all" || parseTagType(node.rawType) === opts.tagTypeFilter;
    if (!typeMatch && node.children.length === 0) return null;
    return (
      <li key={node.id} className="text-xs">
        <div className="flex items-center gap-2 py-0.5">
          <span className="font-mono text-foreground">{"  ".repeat(node.depth)}└─</span>
          <Badge variant="outline" className="text-[10px]">{node.type}</Badge>
          <span className="text-[10px] text-muted-foreground">id {node.id}</span>
          {opts.includeAttributes && node.attributes.map((a, i) => (
            <span key={i} className="text-[10px] text-blue-600 dark:text-blue-400">
              {a.key}={a.value.length > 30 ? a.value.slice(0, 29) + "…" : a.value}
            </span>
          ))}
          {node.pages.length > 0 && (
            <span className="text-[10px] text-muted-foreground">p.{node.pages.join(",")}</span>
          )}
        </div>
        {node.children.length > 0 && (
          <ul>
            {node.children.map((c) => renderTreeNode(c as typeof node))}
          </ul>
        )}
      </li>
    );
  }

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      {file ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {file.pageCount} page{file.pageCount === 1 ? "" : "s"} • {formatBytes(file.bytes.length)}
            </p>
          </div>
          <Button variant="ghost" size="icon" aria-label="Remove file" onClick={reset}>
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
          <p className="mt-1 text-xs text-muted-foreground">Walks the /StructTreeRoot and displays the structure tree.</p>
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

      {file && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="view-mode">View mode</Label>
                <select
                  id="view-mode"
                  value={opts.viewMode}
                  onChange={(e) => update("viewMode", e.target.value as ViewMode)}
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                >
                  {VIEW_MODES.map((m) => (
                    <option key={m} value={m}>{VIEW_MODE_LABELS[m]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tag-filter">Tag-type filter</Label>
                <select
                  id="tag-filter"
                  value={opts.tagTypeFilter}
                  onChange={(e) => update("tagTypeFilter", e.target.value as TagTypeFilter)}
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                >
                  {TAG_TYPE_FILTERS.map((t) => (
                    <option key={t} value={t}>{t === "all" ? "All types" : t}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="expand-depth">Expand depth (tree view)</Label>
                <Input
                  id="expand-depth"
                  type="number"
                  min={MIN_EXPAND_DEPTH}
                  max={MAX_EXPAND_DEPTH}
                  value={opts.expandDepth}
                  onChange={(e) => update("expandDepth", Number(e.target.value))}
                  className="h-9"
                />
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer self-end pb-2">
                <input
                  type="checkbox"
                  checked={opts.includeAttributes}
                  onChange={(e) => update("includeAttributes", e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                Show tag attributes (Role, Alt, Lang, BBox)
              </label>
            </div>
          </CardContent>
        </Card>
      )}

      <ActionBar>
        <RunButton onClick={() => void run()} disabled={!file} loading={working} label="Parse tag tree" />
        <ClearButton onClick={reset} disabled={!file && !parsed && !error} label="Clear" />
      </ActionBar>

      {error && <ErrorBanner message={error} />}

      {parsed && summary && (
        <>
          <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Tag tree parsed</p>
                <p className="text-xs text-muted-foreground">
                  {summary.totalTags} tag(s) • max depth {summary.maxDepth} • {summary.uniqueTypes} type(s) • {summary.pageCount} page(s) • root: {summary.topLevelType}
                </p>
              </div>
              <Badge variant={summary.hasStructureTree ? "default" : "destructive"}>
                {summary.hasStructureTree ? "TAGGED" : "UNTAGGED"}
              </Badge>
            </div>
          </div>

          {missingStructure && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <div>
                <strong>{missingStructure.criterion}:</strong> {missingStructure.message}
              </div>
            </div>
          )}

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <BarChart3 className="h-4 w-4" /> Summary stats
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Total tags" value={summary.totalTags} />
                <Stat label="Max depth" value={summary.maxDepth} />
                <Stat label="Unique types" value={summary.uniqueTypes} />
                <Stat label="Pages" value={summary.pageCount} />
                <Stat label="Headings" value={summary.headingCount} />
                <Stat label="Figures" value={summary.figureCount} />
                <Stat label="Tables" value={summary.tableCount} />
                <Stat label="Lists" value={summary.listCount} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4" /> Validation ({tagValidation.length + headingIssues.length + readingOrderIssues.length})
              </h3>
              {tagValidation.length === 0 && headingIssues.length === 0 && readingOrderIssues.length === 0 ? (
                <p className="text-xs text-muted-foreground">No issues detected.</p>
              ) : (
                <div className="space-y-1 max-h-[200px] overflow-auto">
                  {[...tagValidation, ...headingIssues, ...readingOrderIssues].map((issue, i) => (
                    <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={issue.severity === "error" ? "destructive" : issue.severity === "warning" ? "secondary" : "outline"}
                          className="text-[10px]"
                        >
                          {issue.severity.toUpperCase()}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">{issue.criterion}</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{issue.message}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {summary.hasStructureTree && parsed.root && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <NetworkIcon className="h-4 w-4" /> Tree view ({visibleTags.length} tag{visibleTags.length === 1 ? "" : "s"})
                </h3>
                <div className="max-h-[400px] overflow-auto">
                  <ul className="font-mono">
                    {opts.viewMode === "tree" && renderTreeNode({
                      id: parsed.root.id,
                      type: parsed.root.type,
                      rawType: parsed.root.rawType,
                      depth: 0,
                      pages: parsed.root.pages,
                      attributes: parsed.root.attributes,
                      children: parsed.root.children as unknown as typeof visibleTags,
                    })}
                    {opts.viewMode === "flat-list" && (
                      <div className="space-y-0.5">
                        {visibleTags.map((t) => (
                          <div key={t.id} className="text-xs flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="text-[10px]">{t.type}</Badge>
                            <span className="text-[10px] text-muted-foreground">id {t.id} • depth {t.depth}</span>
                            <span className="text-[10px] text-muted-foreground">path: {t.path}</span>
                            {opts.includeAttributes && t.attributes.map((a, i) => (
                              <span key={i} className="text-[10px] text-blue-600 dark:text-blue-400">
                                {a.key}={a.value.length > 30 ? a.value.slice(0, 29) + "…" : a.value}
                              </span>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                    {opts.viewMode === "by-page" && (
                      <div className="space-y-2">
                        {Object.keys(parsed.byPage).map(Number).sort((a, b) => a - b).map((p) => {
                          const tags = filterByType(parsed.byPage[p], opts.tagTypeFilter);
                          return (
                            <div key={p}>
                              <div className="text-xs font-semibold">Page {p} ({tags.length})</div>
                              <div className="space-y-0.5 ml-2">
                                {tags.map((t) => (
                                  <div key={t.id} className="text-xs">
                                    <Badge variant="outline" className="text-[10px] mr-2">{t.type}</Badge>
                                    <span className="text-[10px] text-muted-foreground">id {t.id}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {opts.viewMode === "by-type" && (
                      <div className="space-y-2">
                        {Object.keys(parsed.byType).sort().map((type) => {
                          const tags = opts.tagTypeFilter === "all" || opts.tagTypeFilter === type
                            ? parsed.byType[type]
                            : [];
                          return (
                            <div key={type}>
                              <div className="text-xs font-semibold">{type} ({tags.length})</div>
                              <div className="space-y-0.5 ml-2">
                                {tags.map((t) => (
                                  <div key={t.id} className="text-xs">
                                    <span className="text-[10px] text-muted-foreground">id {t.id} • depth {t.depth}</span>
                                    {t.pages.length > 0 && (
                                      <span className="text-[10px] text-muted-foreground ml-2">p.{t.pages.join(",")}</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </ul>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Lightbulb className="h-4 w-4" /> Tag counts by type
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                {Object.entries(parsed.countsByType).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                  <div key={type} className="rounded border bg-background px-3 py-2">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{type}</div>
                    <div className="text-base font-semibold">{count}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2">
            <CopyButton getText={() => textReport} label="Copy report" />
            <DownloadButton getText={() => textReport} filename="tag-tree.txt" mime="text/plain" label=".txt" />
            <DownloadButton getText={() => htmlReport} filename="tag-tree.html" mime="text/html" label=".html" />
            <DownloadButton getText={() => jsonReport} filename="tag-tree.json" mime="application/json" label=".json" />
            <DownloadButton getText={() => csvReport} filename="tag-tree.csv" mime="text/csv" label=".csv" />
            <ShareButton getUrl={() => buildShareUrl(opts)} />
          </div>
        </>
      )}

      {!parsed && !error && file && (
        <EmptyState
          title="Ready to parse the tag tree"
          hint="Choose a view mode (tree, flat list, by page, by type), optionally filter by tag type, and click 'Parse tag tree'. The tool reads /StructTreeRoot from the catalog and walks every structure element."
          icon={<NetworkIcon className="h-8 w-8" />}
        />
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
                  <Badge variant={h.hasStructureTree ? "default" : "destructive"} className="mr-2">
                    {h.hasStructureTree ? "TAGGED" : "UNTAGGED"}
                  </Badge>
                  <span className="text-muted-foreground">
                    {h.totalTags} tags • depth {h.maxDepth} • root {h.topLevelType}
                  </span>
                  <span className="text-muted-foreground ml-2">· {h.fileName} · {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        <strong className="text-foreground">Privacy:</strong> All tag-tree parsing runs 100% locally in your browser using JavaScript and pdf-lib. Your PDF never leaves your device. History is stored in localStorage on this device only.
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-base font-semibold text-foreground">{value}</div>
    </div>
  );
}
