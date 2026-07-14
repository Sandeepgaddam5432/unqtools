"use client";
import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner, EmptyState } from "../../_shared";
import {
  parseCsv, splitCsv, estimateSplitCount, detectEncoding, detectDelimiter, stripBom,
  formatBytes, createZipBlob, stripExtension,
  loadHistory, saveToHistory, clearHistory,
  type ParsedCsv, type SplitMode, type Delimiter, type SplitOptions, type SplitResult, type SplitStats, type CsvSplitHistoryEntry,
} from "./logic";
import { Upload, FileText, Scissors, X, History, Archive, Download, Eye } from "lucide-react";

interface LoadedFile {
  name: string;
  size: number;
  parsed: ParsedCsv;
}

export default function CsvFileSplitter() {
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [mode, setMode] = useState<SplitMode>("rowCount");
  const [rowsPerFile, setRowsPerFile] = useState(1000);
  const [fileCount, setFileCount] = useState(5);
  const [bytesPerFile, setBytesPerFile] = useState(1); // MB
  const [groupColumn, setGroupColumn] = useState("");
  const [preserveHeader, setPreserveHeader] = useState(true);
  const [delimiter, setDelimiter] = useState<Delimiter>(",");
  const [template, setTemplate] = useState("{base}_part{index}_of_{total}.csv");
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [dedupEnabled, setDedupEnabled] = useState(false);
  const [removeEmpty, setRemoveEmpty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState(0);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [history, setHistory] = useState<CsvSplitHistoryEntry[]>(() => loadHistory());
  const [showHistory, setShowHistory] = useState(false);

  // Restore template + delimiter from URL fragment (shareable link)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const h = window.location.hash;
    if (!h) return;
    const params = new URLSearchParams(h.slice(1));
    if (params.has("mode")) setMode(params.get("mode") as SplitMode);
    if (params.has("rows")) setRowsPerFile(parseInt(params.get("rows")!));
    if (params.has("bytes")) setBytesPerFile(parseInt(params.get("bytes")!) / (1024 * 1024));
    if (params.has("col")) setGroupColumn(params.get("col")!);
    if (params.has("count")) setFileCount(parseInt(params.get("count")!));
    if (params.has("hdr")) setPreserveHeader(params.get("hdr") === "true");
    if (params.has("delim")) {
      const d = params.get("delim")!;
      setDelimiter(d === "\\t" ? "\t" : d);
    }
    if (params.has("tpl")) setTemplate(params.get("tpl")!);
  }, []);

  const handleFile = useCallback(async (f: File | null) => {
    if (!f) return;
    setError(null);
    setWorking(true);
    setProgress(10);
    try {
      const buf = await f.arrayBuffer();
      const bytes = new Uint8Array(buf);
      const enc = detectEncoding(bytes);
      let text = new TextDecoder(enc.encoding === "UTF-8" ? "utf-8" : enc.encoding.toLowerCase().replace("-", "")).decode(bytes);
      text = stripBom(text);
      const detectedDelim = detectDelimiter(text);
      const parsed = parseCsv(text, { delimiter: detectedDelim, hasHeader: true });
      setFile({ name: f.name, size: f.size, parsed });
      setDelimiter(detectedDelim);
      setProgress(100);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking(false);
      setTimeout(() => setProgress(0), 800);
    }
  }, []);

  const allHeaders = file?.parsed.headers ?? [];

  const opts: SplitOptions = useMemo(() => {
    if (mode === "rowCount") return { mode, rowsPerFile, preserveHeader, delimiter };
    if (mode === "fileCount") return { mode, fileCount, preserveHeader, delimiter };
    if (mode === "fileSize") return { mode, bytesPerFile: bytesPerFile * 1024 * 1024, preserveHeader, delimiter };
    return { mode, groupColumn, preserveHeader, delimiter };
  }, [mode, rowsPerFile, fileCount, bytesPerFile, groupColumn, preserveHeader, delimiter]);

  const split = useMemo<{ results: SplitResult[]; stats: SplitStats } | null>(() => {
    if (!file) return null;
    try {
      const base = stripExtension(file.name);
      return splitCsv(file.parsed, opts, base, template, selectedColumns, dedupEnabled, removeEmpty);
    } catch (e) {
      return null;
    }
  }, [file, opts, template, selectedColumns, dedupEnabled, removeEmpty]);

  const estimatedCount = useMemo(() => {
    if (!file) return 0;
    try { return estimateSplitCount(file.parsed, opts); } catch { return 0; }
  }, [file, opts]);

  const toggleColumn = (col: string) => {
    setSelectedColumns((prev) => prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]);
  };

  const downloadZip = useCallback(async () => {
    if (!split) return;
    setWorking(true);
    try {
      const blob = createZipBlob(split.results.map((r) => ({ name: r.filename, content: r.content })));
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const zipName = file ? `${stripExtension(file.name)}_splits.zip` : "splits.zip";
      a.download = zipName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking(false);
    }
  }, [split, file]);

  const saveHistoryEntry = () => {
    if (!file || !split) return;
    const entry: CsvSplitHistoryEntry = {
      fileName: file.name,
      mode,
      delimiter: String(delimiter),
      splitCount: split.stats.splitCount,
      totalRows: split.stats.totalRows,
      splitAt: new Date().toISOString(),
    };
    setHistory(saveToHistory(entry));
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <input
            type="file"
            accept=".csv,.tsv,.txt"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            className="hidden"
            id="csv-split-input"
            aria-label="Choose a CSV file to split"
          />
          <button
            type="button"
            onClick={() => document.getElementById("csv-split-input")?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0] ?? null); }}
            className="w-full rounded-xl border-2 border-dashed border-border p-8 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer"
          >
            <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Drop a CSV file here or click to browse</p>
            <p className="mt-1 text-xs text-muted-foreground">Auto-detects delimiter · UTF-8/UTF-16 BOM sniffing · unlimited size</p>
          </button>
        </CardContent>
      </Card>

      {working && progress > 0 && (
        <Card><CardContent className="p-4">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-muted-foreground">Processing…</span>
            <span className="font-mono">{progress}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary transition-all duration-200" style={{ width: `${progress}%` }} />
          </div>
        </CardContent></Card>
      )}

      {file && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold inline-flex items-center gap-1">
                <FileText className="h-3 w-3" /> {file.name}
              </Label>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">{formatBytes(file.size)}</Badge>
                <Badge variant="outline" className="text-[10px]">{file.parsed.rows.length} rows</Badge>
                <Badge variant="outline" className="text-[10px]">{file.parsed.headers.length} cols</Badge>
                <button type="button" onClick={() => { setFile(null); setSelectedColumns([]); setPreviewIndex(null); }} className="text-muted-foreground hover:text-red-600 cursor-pointer" aria-label="Remove file">
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {file && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <Label className="text-sm font-semibold">Split options</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Mode</label>
                <select value={mode} onChange={(e) => setMode(e.target.value as SplitMode)} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs cursor-pointer" aria-label="Split mode">
                  <option value="rowCount">Row count</option>
                  <option value="fileSize">File size (MB)</option>
                  <option value="columnValue">Column value (group-by)</option>
                  <option value="fileCount">Number of files</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Delimiter</label>
                <select value={delimiter} onChange={(e) => setDelimiter(e.target.value as Delimiter)} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs cursor-pointer" aria-label="Delimiter">
                  <option value=",">Comma (,)</option>
                  <option value={"\t"}>Tab</option>
                  <option value=";">Semicolon (;)</option>
                  <option value="|">Pipe (|)</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Preserve header</label>
                <button type="button" onClick={() => setPreserveHeader(!preserveHeader)} className={`h-8 w-full rounded-md border px-2 text-xs cursor-pointer ${preserveHeader ? "bg-primary/10 border-primary/30" : "bg-background border-input"}`} aria-label="Toggle preserve header">
                  {preserveHeader ? "Yes (in every file)" : "No"}
                </button>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Filename template</label>
                <Input value={template} onChange={(e) => setTemplate(e.target.value)} className="h-8 text-xs font-mono" aria-label="Filename template" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {mode === "rowCount" && (
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground">Rows per file</label>
                  <Input type="number" min={1} value={rowsPerFile} onChange={(e) => setRowsPerFile(Math.max(1, parseInt(e.target.value) || 1))} className="h-8 text-xs" aria-label="Rows per file" />
                </div>
              )}
              {mode === "fileSize" && (
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground">Target size per file (MB)</label>
                  <Input type="number" min={0.1} step={0.1} value={bytesPerFile} onChange={(e) => setBytesPerFile(Math.max(0.1, parseFloat(e.target.value) || 0.1))} className="h-8 text-xs" aria-label="Bytes per file" />
                </div>
              )}
              {mode === "columnValue" && (
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground">Group by column</label>
                  <select value={groupColumn} onChange={(e) => setGroupColumn(e.target.value)} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs cursor-pointer" aria-label="Group column">
                    <option value="">— select —</option>
                    {allHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              )}
              {mode === "fileCount" && (
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground">Number of output files</label>
                  <Input type="number" min={1} value={fileCount} onChange={(e) => setFileCount(Math.max(1, parseInt(e.target.value) || 1))} className="h-8 text-xs" aria-label="Number of files" />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={dedupEnabled} onChange={(e) => setDedupEnabled(e.target.checked)} className="cursor-pointer" />
                <span>Dedup rows in each split</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={removeEmpty} onChange={(e) => setRemoveEmpty(e.target.checked)} className="cursor-pointer" />
                <span>Remove empty rows</span>
              </label>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Column selection (uncheck = drop)</label>
              <div className="flex flex-wrap gap-1">
                {allHeaders.map((h) => {
                  const isOn = selectedColumns.length === 0 || selectedColumns.includes(h);
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => toggleColumn(h)}
                      className={`rounded-md border px-2 py-1 text-[10px] font-mono cursor-pointer ${isOn ? "bg-primary/10 border-primary/30" : "bg-muted/30 border-input opacity-50"}`}
                      aria-pressed={isOn}
                    >
                      {h}
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {file && split && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <Label className="text-sm font-semibold">Stats</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="rounded-md border p-2"><p className="text-[10px] text-muted-foreground">Total rows</p><p className="font-mono font-semibold">{split.stats.totalRows}</p></div>
                <div className="rounded-md border p-2"><p className="text-[10px] text-muted-foreground">Split files</p><p className="font-mono font-semibold">{split.stats.splitCount}</p></div>
                <div className="rounded-md border p-2"><p className="text-[10px] text-muted-foreground">Columns</p><p className="font-mono font-semibold">{split.stats.totalColumns}</p></div>
                <div className="rounded-md border p-2"><p className="text-[10px] text-muted-foreground">Deduped</p><p className="font-mono font-semibold">{split.stats.dedupedCount}</p></div>
              </div>
              {estimatedCount !== split.stats.splitCount && (
                <p className="text-[10px] text-muted-foreground">Estimated: {estimatedCount} · Actual: {split.stats.splitCount}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Split files ({split.results.length})</Label>
                <div className="flex gap-2">
                  <button type="button" onClick={downloadZip} disabled={working} className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2 py-1 text-xs cursor-pointer hover:bg-muted/30 disabled:opacity-50">
                    <Archive className="h-3 w-3" /> Download ZIP
                  </button>
                  <button type="button" onClick={saveHistoryEntry} className="text-xs text-primary hover:underline cursor-pointer">Save to history</button>
                  <button type="button" onClick={() => setShowHistory(!showHistory)} className="text-xs text-muted-foreground hover:text-foreground cursor-pointer inline-flex items-center gap-1">
                    <History className="h-3 w-3" /> ({history.length})
                  </button>
                </div>
              </div>
              <div className="space-y-1 max-h-[400px] overflow-y-auto">
                {split.results.map((r, i) => (
                  <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center text-xs py-1 border-b border-border/40 last:border-0">
                    <span className="truncate font-mono" title={r.filename}>
                      <span className="text-muted-foreground mr-1">{String(i + 1).padStart(3, "0")}.</span>
                      {r.filename}
                    </span>
                    <Badge variant="outline" className="text-[9px]">{r.rowCount} rows</Badge>
                    <Badge variant="outline" className="text-[9px]">{formatBytes(r.byteSize)}</Badge>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => setPreviewIndex(previewIndex === i ? null : i)} className="p-1 hover:text-primary cursor-pointer" aria-label={`Preview ${r.filename}`}>
                        <Eye className="h-3 w-3" />
                      </button>
                      <CopyButton getText={() => r.content} label="" size="icon-sm" />
                      <DownloadButton getText={() => r.content} filename={r.filename} mime="text/csv" label="" size="icon-sm" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {previewIndex !== null && split.results[previewIndex] && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Preview: {split.results[previewIndex].filename}</Label>
                  <button type="button" onClick={() => setPreviewIndex(null)} className="text-muted-foreground hover:text-foreground cursor-pointer"><X className="h-3 w-3" /></button>
                </div>
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/30">
                      <tr>
                        <th className="px-2 py-1 text-left text-[10px] text-muted-foreground">#</th>
                        {split.results[previewIndex].headers.map((h) => <th key={h} className="px-2 py-1 text-left font-mono">{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {split.results[previewIndex].preview.map((row, i) => (
                        <tr key={i} className="border-t border-border/40">
                          <td className="px-2 py-1 text-[10px] text-muted-foreground">{i + 1}</td>
                          {split.results[previewIndex].headers.map((h) => <td key={h} className="px-2 py-1 font-mono">{row[h]}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

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
                        <p className="font-medium">{h.fileName}</p>
                        <p className="text-[10px] text-muted-foreground">{h.mode} · {h.splitCount} files · {h.totalRows} rows · {new Date(h.splitAt).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {error && <ErrorBanner message={error} />}

      {!file && !error && (
        <EmptyState
          title="Drop a CSV to split"
          hint="By row count · file size · column value · or N output files. Header preservation · dedup · column selection · ZIP export. 100% local."
          icon={<Scissors className="h-8 w-8" />}
        />
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all CSV parsing, splitting, and ZIP packaging happen in your browser. Your file never leaves your device.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
