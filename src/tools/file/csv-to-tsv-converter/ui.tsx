"use client";
import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { CopyButton, DownloadButton, ShareButton, ErrorBanner, EmptyState } from "../../_shared";
import {
  convertCsvToTsv, detectDelimiter, detectEncoding, stripBom, previewRows,
  deriveOutputFilename, formatBytes,
  loadHistory, saveToHistory, clearHistory, buildShareUrl,
  DEFAULT_OPTIONS,
  type ConvertOptions, type CsvToTsvHistoryEntry,
} from "./logic";
import { createZipBlob } from "../csv-file-splitter/logic";
import { ArrowRightLeft, Upload, FileText, X, History, ArrowRight } from "lucide-react";
import { toast } from "sonner";

interface BatchEntry {
  inputName: string;
  output: string;
  outputName: string;
  rowCount: number;
  columnCount: number;
  inputBytes: number;
  outputBytes: number;
  error?: string;
}

const SAMPLE_CSV = `name,age,city
Alice,30,Hyderabad
Bob,25,Mumbai
Carol,35,Delhi`;

export default function CsvToTsvConverter() {
  const [input, setInput] = useState<string>(SAMPLE_CSV);
  const [options, setOptions] = useState<ConvertOptions>(DEFAULT_OPTIONS);
  const [batch, setBatch] = useState<BatchEntry[]>([]);
  const [history, setHistory] = useState<CsvToTsvHistoryEntry[]>(() => loadHistory());
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restore settings from URL fragment
  useEffect(() => {
    if (typeof window === "undefined") return;
    const h = window.location.hash;
    if (!h) return;
    const params = new URLSearchParams(h.slice(1));
    setOptions((o) => ({
      ...o,
      inputDelimiter: params.get("in") === "\\t" ? "\t" : (params.get("in") ?? o.inputDelimiter),
      outputDelimiter: params.get("out") === "\\t" ? "\t" : (params.get("out") ?? o.outputDelimiter),
      trimWhitespace: params.get("trim") === "true",
      removeEmptyRows: params.get("empty") === "true",
      skipHeader: params.get("skiphdr") === "true",
    }));
  }, []);

  const update = <K extends keyof ConvertOptions>(key: K, value: ConvertOptions[K]) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
  };

  const result = useMemo(() => {
    if (!input.trim()) return null;
    try {
      const r = convertCsvToTsv(input, options);
      const parsedHeaders = r.output.split("\n")[0]?.split(options.outputDelimiter) ?? [];
      const dataRows = r.output.split("\n").slice(1);
      const preview = previewRows(parsedHeaders, dataRows.map((r) => r.split(options.outputDelimiter)), 5);
      return { ...r, preview, headers: parsedHeaders };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [input, options]);

  const batchError = result && "error" in result ? result.error : null;

  const handleFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setError(null);
    const entries: BatchEntry[] = [];
    for (const file of Array.from(fileList)) {
      try {
        const buf = await file.arrayBuffer();
        const bytes = new Uint8Array(buf);
        const enc = detectEncoding(bytes);
        let text = new TextDecoder(enc.encoding === "UTF-8" ? "utf-8" : enc.encoding.toLowerCase().replace("-", "")).decode(bytes);
        text = stripBom(text);
        const inputDelim = options.inputDelimiter === "auto" ? detectDelimiter(text) : options.inputDelimiter;
        const r = convertCsvToTsv(text, { ...options, inputDelimiter: inputDelim });
        entries.push({
          inputName: file.name,
          output: r.output,
          outputName: deriveOutputFilename(file.name, options.outputDelimiter === "\t" ? "tsv" : "txt"),
          rowCount: r.stats.rowCount,
          columnCount: r.stats.columnCount,
          inputBytes: r.stats.inputBytes,
          outputBytes: r.stats.outputBytes,
        });
      } catch (e) {
        entries.push({
          inputName: file.name,
          output: "",
          outputName: "",
          rowCount: 0,
          columnCount: 0,
          inputBytes: file.size,
          outputBytes: 0,
          error: (e as Error).message,
        });
      }
    }
    setBatch(entries);
  }, [options]);

  const downloadZip = useCallback(() => {
    if (batch.length === 0) return;
    const valid = batch.filter((b) => !b.error);
    if (valid.length === 0) {
      toast.error("No valid conversions to download");
      return;
    }
    const blob = createZipBlob(valid.map((b) => ({ name: b.outputName, content: b.output })));
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "converted_tsv.zip";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success(`Downloaded ${valid.length} files as ZIP`);
  }, [batch]);

  const onSaveHistory = () => {
    if (!result || "error" in result || !result.output) return;
    const entry: CsvToTsvHistoryEntry = {
      fileName: "inline-input",
      inputDelimiter: options.inputDelimiter,
      outputDelimiter: options.outputDelimiter,
      rowCount: result.stats.rowCount,
      convertedAt: new Date().toISOString(),
    };
    setHistory(saveToHistory(entry));
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
            id="csv2tsv-input"
            aria-label="Choose CSV files to convert"
          />
          <button
            type="button"
            onClick={() => document.getElementById("csv2tsv-input")?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
            className="w-full rounded-xl border-2 border-dashed border-border p-6 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer"
          >
            <Upload className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
            <p className="text-xs font-medium">Drop CSV files for batch conversion</p>
            <p className="mt-1 text-[10px] text-muted-foreground">Multiple files · auto-detect delimiter · ZIP download</p>
          </button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label htmlFor="csv2tsv-textarea" className="text-sm font-semibold">CSV input</Label>
          <Textarea
            id="csv2tsv-textarea"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste CSV here..."
            className="min-h-[160px] font-mono text-xs resize-y"
            spellCheck={false}
            aria-label="CSV input"
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold">Options</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Input delimiter</label>
              <select value={options.inputDelimiter} onChange={(e) => update("inputDelimiter", e.target.value)} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs cursor-pointer" aria-label="Input delimiter">
                <option value=",">Comma (,)</option>
                <option value={"\t"}>Tab</option>
                <option value=";">Semicolon (;)</option>
                <option value="|">Pipe (|)</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Output delimiter</label>
              <select value={options.outputDelimiter} onChange={(e) => update("outputDelimiter", e.target.value)} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs cursor-pointer" aria-label="Output delimiter">
                <option value={"\t"}>Tab (TSV)</option>
                <option value=",">Comma</option>
                <option value=";">Semicolon</option>
                <option value="|">Pipe</option>
              </select>
            </div>
            <div className="space-y-1 flex items-end gap-3">
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={options.trimWhitespace} onChange={(e) => update("trimWhitespace", e.target.checked)} className="cursor-pointer" />
                <span>Trim</span>
              </label>
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={options.removeEmptyRows} onChange={(e) => update("removeEmptyRows", e.target.checked)} className="cursor-pointer" />
                <span>Drop empty</span>
              </label>
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={options.skipHeader} onChange={(e) => update("skipHeader", e.target.checked)} className="cursor-pointer" />
                <span>Skip header</span>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {result && !("error" in result) && result.output && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">TSV output</Label>
              <div className="flex gap-2">
                <CopyButton getText={() => result.output} label="Copy" size="sm" />
                <DownloadButton getText={() => result.output} filename="converted.tsv" mime="text/tab-separated-values" label="Download" size="sm" />
                <ShareButton getUrl={() => buildShareUrl(options)} label="" size="icon-sm" />
                <button type="button" onClick={onSaveHistory} className="text-xs text-primary hover:underline cursor-pointer">Save</button>
                <button type="button" onClick={() => setShowHistory(!showHistory)} className="text-xs text-muted-foreground hover:text-foreground cursor-pointer inline-flex items-center gap-1">
                  <History className="h-3 w-3" /> ({history.length})
                </button>
              </div>
            </div>
            <Textarea
              value={result.output}
              readOnly
              className="min-h-[160px] font-mono text-xs resize-y"
              aria-label="TSV output"
            />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="rounded-md border p-2"><p className="text-[10px] text-muted-foreground">Rows</p><p className="font-mono font-semibold">{result.stats.rowCount}</p></div>
              <div className="rounded-md border p-2"><p className="text-[10px] text-muted-foreground">Columns</p><p className="font-mono font-semibold">{result.stats.columnCount}</p></div>
              <div className="rounded-md border p-2"><p className="text-[10px] text-muted-foreground">Input size</p><p className="font-mono font-semibold">{formatBytes(result.stats.inputBytes)}</p></div>
              <div className="rounded-md border p-2"><p className="text-[10px] text-muted-foreground">Output size</p><p className="font-mono font-semibold">{formatBytes(result.stats.outputBytes)}</p></div>
            </div>
          </CardContent>
        </Card>
      )}

      {result && !("error" in result) && result.preview && result.preview.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <Label className="text-sm font-semibold">Preview (first 5 rows)</Label>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-xs">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="px-2 py-1 text-left text-[10px] text-muted-foreground">#</th>
                    {result.headers.map((h) => <th key={h} className="px-2 py-1 text-left font-mono">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {result.preview.map((row, i) => (
                    <tr key={i} className="border-t border-border/40">
                      <td className="px-2 py-1 text-[10px] text-muted-foreground">{i + 1}</td>
                      {result.headers.map((h) => <td key={h} className="px-2 py-1 font-mono">{row[h]}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {batch.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Batch results ({batch.length})</Label>
              <button type="button" onClick={downloadZip} className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2 py-1 text-xs cursor-pointer hover:bg-muted/30">
                <ArrowRightLeft className="h-3 w-3" /> Download all as ZIP
              </button>
            </div>
            <div className="space-y-1 max-h-[300px] overflow-y-auto">
              {batch.map((b, i) => (
                <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center text-xs py-1 border-b border-border/40 last:border-0">
                  <span className="truncate font-mono" title={b.inputName}>
                    <FileText className="inline h-3 w-3 mr-1" />
                    {b.inputName}
                    <ArrowRight className="inline h-3 w-3 mx-1 text-muted-foreground" />
                    {b.outputName}
                  </span>
                  {b.error ? (
                    <Badge variant="outline" className="text-[9px] text-red-600 dark:text-red-400">error</Badge>
                  ) : (
                    <>
                      <Badge variant="outline" className="text-[9px]">{b.rowCount} rows</Badge>
                      <Badge variant="outline" className="text-[9px]">{formatBytes(b.outputBytes)}</Badge>
                    </>
                  )}
                  {!b.error && (
                    <div className="flex gap-1">
                      <CopyButton getText={() => b.output} label="" size="icon-sm" />
                      <DownloadButton getText={() => b.output} filename={b.outputName} mime="text/tab-separated-values" label="" size="icon-sm" />
                    </div>
                  )}
                </div>
              ))}
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
                    <p className="text-[10px] text-muted-foreground">{h.inputDelimiter} → {h.outputDelimiter === "\t" ? "\\t" : h.outputDelimiter} · {h.rowCount} rows · {new Date(h.convertedAt).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {(error || batchError) && <ErrorBanner message={error || batchError || ""} />}

      {!input && !batch.length && !error && (
        <EmptyState
          title="Convert CSV to TSV"
          hint="RFC 4180 compliant · custom delimiters · batch convert · trim · drop empty · skip header · preview · shareable URL. 100% local."
          icon={<ArrowRightLeft className="h-8 w-8" />}
        />
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all conversion runs in your browser. Your data never leaves your device.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
