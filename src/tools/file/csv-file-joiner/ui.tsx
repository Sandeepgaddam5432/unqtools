"use client";
import React, { useState, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner, EmptyState } from "../../_shared";
import {
  parseCsv, toCsv, mergeCsvs, dedupRows, sortByColumn, filterRows,
  reorderColumns, previewRows, detectDelimiter, detectEncoding, stripBom,
  formatBytes, loadHistory, saveToHistory, clearHistory,
  type ParsedCsv, type JoinMode, type Delimiter, type CsvJoinHistoryEntry, type MergeStats,
} from "./logic";
import { Upload, FileText, ArrowUp, ArrowDown, X, History, Table2 } from "lucide-react";

interface FileEntry {
  name: string;
  size: number;
  parsed: ParsedCsv;
}

export default function CsvFileJoiner() {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [delimiter, setDelimiter] = useState<Delimiter>(",");
  const [mode, setMode] = useState<JoinMode>("append");
  const [joinKey, setJoinKey] = useState("");
  const [hasHeader, setHasHeader] = useState(true);
  const [dedupKey, setDedupKey] = useState("");
  const [dedupEnabled, setDedupEnabled] = useState(false);
  const [sortColumn, setSortColumn] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [sortNumeric, setSortNumeric] = useState(false);
  const [filterColumn, setFilterColumn] = useState("");
  const [filterQuery, setFilterQuery] = useState("");
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [history, setHistory] = useState<CsvJoinHistoryEntry[]>(() => loadHistory());
  const [showHistory, setShowHistory] = useState(false);

  const handleFiles = useCallback(async (newFiles: FileList | null) => {
    if (!newFiles || newFiles.length === 0) return;
    setError(null);
    setWorking(true);
    try {
      const entries: FileEntry[] = [];
      for (const file of Array.from(newFiles)) {
        const buf = await file.arrayBuffer();
        const bytes = new Uint8Array(buf);
        const enc = detectEncoding(bytes);
        let text = new TextDecoder(enc.encoding === "UTF-8" ? "utf-8" : enc.encoding.toLowerCase().replace("-", "")).decode(bytes);
        text = stripBom(text);
        const delim = delimiter === "auto" ? detectDelimiter(text) : delimiter;
        const parsed = parseCsv(text, { delimiter: delim, hasHeader });
        entries.push({ name: file.name, size: file.size, parsed });
      }
      setFiles((prev) => [...prev, ...entries]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking(false);
    }
  }, [delimiter, hasHeader]);

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const moveFile = (idx: number, dir: -1 | 1) => {
    setFiles((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  // All candidate headers (union of all file headers)
  const allHeaders = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const f of files) for (const h of f.parsed.headers) if (!seen.has(h)) { seen.add(h); out.push(h); }
    return out;
  }, [files]);

  // Reset columnOrder when headers change
  const effectiveOrder = columnOrder.length > 0 ? columnOrder : allHeaders;

  // Compute merged output (memoized). Errors are surfaced via the derived
  // `mergeError` rather than calling setState inside useMemo.
  const merged = useMemo<{ headers: string[]; rows: string[][]; csv: string; preview: Record<string, string>[]; stats: MergeStats | null; error: string | null }>(() => {
    if (files.length === 0) return { headers: [], rows: [], csv: "", preview: [], stats: null, error: null };
    try {
      const parsedFiles = files.map((f) => f.parsed);
      const result = mergeCsvs(parsedFiles, { mode, joinKey: joinKey || undefined, skipDuplicateHeaders: hasHeader });
      let { headers, rows, stats } = result;

      // Dedup
      if (dedupEnabled) {
        const deduped = dedupRows(headers, rows, dedupKey || undefined);
        rows = deduped.rows;
        stats = { ...stats, dedupedCount: deduped.removed };
      }
      // Filter
      if (filterColumn && filterQuery) {
        rows = filterRows(headers, rows, filterColumn, filterQuery);
      }
      // Sort
      if (sortColumn) {
        rows = sortByColumn(headers, rows, sortColumn, sortDir, sortNumeric);
      }
      // Reorder columns
      if (columnOrder.length > 0) {
        const reordered = reorderColumns(headers, rows, columnOrder);
        headers = reordered.headers;
        rows = reordered.rows;
      }
      const csv = toCsv(headers, rows, delimiter === "auto" ? "," : delimiter);
      const preview = previewRows(headers, rows, 5);
      return { headers, rows, csv, preview, stats, error: null };
    } catch (e) {
      return { headers: [], rows: [], csv: "", preview: [], stats: null, error: (e as Error).message };
    }
  }, [files, mode, joinKey, hasHeader, dedupEnabled, dedupKey, filterColumn, filterQuery, sortColumn, sortDir, sortNumeric, columnOrder, delimiter]);

  const hasFiles = files.length > 0;
  const mergeError = merged?.error ?? null;

  const onMerge = () => {
    if (!merged || !merged.stats) return;
    const entry: CsvJoinHistoryEntry = {
      fileNames: files.map((f) => f.name),
      mode,
      delimiter: String(delimiter),
      mergedAt: new Date().toISOString(),
      totalRows: merged.stats.totalRows,
    };
    setHistory(saveToHistory(entry));
  };

  const moveColumn = (idx: number, dir: -1 | 1) => {
    setColumnOrder((prev) => {
      const order = prev.length > 0 ? [...prev] : [...allHeaders];
      const target = idx + dir;
      if (target < 0 || target >= order.length) return order;
      [order[idx], order[target]] = [order[target], order[idx]];
      return order;
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <input
            type="file"
            multiple
            accept=".csv,.tsv,.txt"
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
            id="csv-join-input"
            aria-label="Choose CSV files to merge"
          />
          <button
            type="button"
            onClick={() => document.getElementById("csv-join-input")?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
            className="w-full rounded-xl border-2 border-dashed border-border p-8 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer"
          >
            <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Drop CSV files here or click to browse</p>
            <p className="mt-1 text-xs text-muted-foreground">Multiple files supported · header-aware alignment</p>
          </button>
        </CardContent>
      </Card>

      {files.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Files ({files.length})</Label>
              <button type="button" onClick={() => setShowHistory(!showHistory)} className="text-xs text-muted-foreground hover:text-foreground cursor-pointer inline-flex items-center gap-1">
                <History className="h-3 w-3" /> History ({history.length})
              </button>
            </div>
            {files.map((f, i) => (
              <div key={i} className="grid grid-cols-[auto_1fr_auto_auto] gap-2 items-center text-xs py-1 border-b border-border/40 last:border-0">
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => moveFile(i, -1)} disabled={i === 0} aria-label="Move up" className="p-0.5 hover:text-foreground cursor-pointer disabled:opacity-30"><ArrowUp className="h-3 w-3" /></button>
                  <button type="button" onClick={() => moveFile(i, 1)} disabled={i === files.length - 1} aria-label="Move down" className="p-0.5 hover:text-foreground cursor-pointer disabled:opacity-30"><ArrowDown className="h-3 w-3" /></button>
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium"><FileText className="inline h-3 w-3 mr-1" />{f.name}</p>
                  <p className="text-[10px] text-muted-foreground">{f.parsed.rows.length} rows · {f.parsed.headers.length} cols</p>
                </div>
                <Badge variant="outline" className="text-[9px]">{formatBytes(f.size)}</Badge>
                <button type="button" onClick={() => removeFile(i)} aria-label={`Remove ${f.name}`} className="p-0.5 text-muted-foreground hover:text-red-600 cursor-pointer"><X className="h-3 w-3" /></button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {files.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <Label className="text-sm font-semibold">Merge options</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Mode</label>
                <select value={mode} onChange={(e) => setMode(e.target.value as JoinMode)} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs cursor-pointer" aria-label="Join mode">
                  <option value="append">Append (stack rows)</option>
                  <option value="inner">Inner join</option>
                  <option value="outer">Outer join</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Delimiter</label>
                <select value={delimiter} onChange={(e) => setDelimiter(e.target.value as Delimiter)} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs cursor-pointer" aria-label="Delimiter">
                  <option value=",">Comma (,)</option>
                  <option value="\t">Tab</option>
                  <option value=";">Semicolon (;)</option>
                  <option value="|">Pipe (|)</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Join key</label>
                <select value={joinKey} onChange={(e) => setJoinKey(e.target.value)} disabled={mode === "append"} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs cursor-pointer disabled:opacity-50" aria-label="Join key column">
                  <option value="">— select —</option>
                  {allHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Has header</label>
                <button type="button" onClick={() => setHasHeader(!hasHeader)} className={`h-8 w-full rounded-md border px-2 text-xs cursor-pointer ${hasHeader ? "bg-primary/10 border-primary/30" : "bg-background border-input"}`} aria-label="Toggle header">
                  {hasHeader ? "Yes" : "No"}
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {hasFiles && merged.stats && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <Label className="text-sm font-semibold">Stats</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="rounded-md border p-2"><p className="text-[10px] text-muted-foreground">Files</p><p className="font-mono font-semibold">{merged.stats.fileCount}</p></div>
                <div className="rounded-md border p-2"><p className="text-[10px] text-muted-foreground">Total rows</p><p className="font-mono font-semibold">{merged.rows.length}</p></div>
                <div className="rounded-md border p-2"><p className="text-[10px] text-muted-foreground">Columns</p><p className="font-mono font-semibold">{merged.headers.length}</p></div>
                <div className="rounded-md border p-2"><p className="text-[10px] text-muted-foreground">Deduped</p><p className="font-mono font-semibold">{merged.stats.dedupedCount}</p></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <Label className="text-sm font-semibold">Extras — dedup / sort / filter</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={dedupEnabled} onChange={(e) => setDedupEnabled(e.target.checked)} className="cursor-pointer" />
                  <span>Dedup rows</span>
                  <select value={dedupKey} onChange={(e) => setDedupKey(e.target.value)} disabled={!dedupEnabled} className="h-7 flex-1 rounded-md border border-input bg-background px-2 text-xs cursor-pointer disabled:opacity-50" aria-label="Dedup key">
                    <option value="">full row</option>
                    {allHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  <span>Sort by:</span>
                  <select value={sortColumn} onChange={(e) => setSortColumn(e.target.value)} className="h-7 flex-1 rounded-md border border-input bg-background px-2 text-xs cursor-pointer" aria-label="Sort column">
                    <option value="">none</option>
                    {allHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                  <select value={sortDir} onChange={(e) => setSortDir(e.target.value as "asc" | "desc")} disabled={!sortColumn} className="h-7 rounded-md border border-input bg-background px-2 text-xs cursor-pointer disabled:opacity-50" aria-label="Sort direction">
                    <option value="asc">asc</option>
                    <option value="desc">desc</option>
                  </select>
                  <button type="button" onClick={() => setSortNumeric(!sortNumeric)} disabled={!sortColumn} className={`h-7 rounded-md border px-2 text-xs cursor-pointer disabled:opacity-50 ${sortNumeric ? "bg-primary/10 border-primary/30" : "bg-background border-input"}`} aria-label="Numeric sort">
                    123
                  </button>
                </label>
                <label className="flex items-center gap-2">
                  <span>Filter col:</span>
                  <select value={filterColumn} onChange={(e) => setFilterColumn(e.target.value)} className="h-7 rounded-md border border-input bg-background px-2 text-xs cursor-pointer" aria-label="Filter column">
                    <option value="">none</option>
                    {allHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </label>
                {filterColumn && (
                  <Input value={filterQuery} onChange={(e) => setFilterQuery(e.target.value)} placeholder="substring..." className="h-7 text-xs" aria-label="Filter query" />
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <Label className="text-sm font-semibold">Column reorder</Label>
              <p className="text-[10px] text-muted-foreground">Drag columns by clicking ↑/↓ to reorder. Empty list = original order.</p>
              <div className="flex flex-wrap gap-1">
                {effectiveOrder.map((h, i) => (
                  <span key={h} className="inline-flex items-center gap-1 rounded-md border bg-muted/30 px-2 py-1 text-[10px] font-mono">
                    <button type="button" onClick={() => moveColumn(i, -1)} disabled={i === 0} className="cursor-pointer disabled:opacity-30" aria-label="Move column up">↑</button>
                    <button type="button" onClick={() => moveColumn(i, 1)} disabled={i === effectiveOrder.length - 1} className="cursor-pointer disabled:opacity-30" aria-label="Move column down">↓</button>
                    {h}
                  </span>
                ))}
                {columnOrder.length > 0 && (
                  <button type="button" onClick={() => setColumnOrder([])} className="text-[10px] text-red-600 hover:underline cursor-pointer">reset</button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Preview (first 5 rows)</Label>
                <div className="flex gap-2">
                  <CopyButton getText={() => merged.csv} label="Copy CSV" size="sm" />
                  <DownloadButton getText={() => merged.csv} filename="merged.csv" mime="text/csv" label="Download" size="sm" />
                  <button type="button" onClick={onMerge} className="text-xs text-primary hover:underline cursor-pointer">Save to history</button>
                </div>
              </div>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/30">
                    <tr>
                      <th className="px-2 py-1 text-left text-[10px] text-muted-foreground">#</th>
                      {merged.headers.map((h) => <th key={h} className="px-2 py-1 text-left font-mono">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {merged.preview.map((row, i) => (
                      <tr key={i} className="border-t border-border/40">
                        <td className="px-2 py-1 text-[10px] text-muted-foreground">{i + 1}</td>
                        {merged.headers.map((h) => <td key={h} className="px-2 py-1 font-mono">{row[h]}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {showHistory && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">History ({history.length})</Label>
                  {history.length > 0 && (
                    <button type="button" onClick={() => { clearHistory(); setHistory([]); }} className="text-xs text-red-600 hover:underline cursor-pointer">Clear</button>
                  )}
                </div>
                {history.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No history yet.</p>
                ) : (
                  <div className="space-y-1 max-h-[200px] overflow-y-auto">
                    {history.map((h, i) => (
                      <div key={i} className="text-xs py-1 border-b border-border/40 last:border-0">
                        <p className="font-medium">{h.fileNames.join(" + ")}</p>
                        <p className="text-[10px] text-muted-foreground">{h.mode} · {h.totalRows} rows · {new Date(h.mergedAt).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {working && (
        <Card><CardContent className="p-4 text-center text-sm text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto mb-2" />
          Parsing files...
        </CardContent></Card>
      )}

      {(error || mergeError) && <ErrorBanner message={error || mergeError || ""} />}

      {!files.length && !error && !mergeError && (
        <EmptyState title="Drop CSV files to merge" hint="Header-aware alignment · inner/outer join · dedup · sort · filter · preview · export. 100% local." icon={<Table2 className="h-8 w-8" />} />
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all CSV parsing and merging runs in your browser. Files never leave your device.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
