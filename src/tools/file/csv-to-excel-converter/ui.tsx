"use client";
import React, { useState, useCallback, useMemo, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner, EmptyState, ShareButton } from "../../_shared";
import { toast } from "sonner";
import {
  parseCsv, detectDelimiter, detectEncoding, stripBom,
  convertCsvsToXlsx, previewRows, formatBytes,
  loadHistory, saveToHistory, clearHistory, buildShareUrl,
  DEFAULT_OPTIONS, type ConversionOptions, type Delimiter, type ConversionStats, type ConversionHistoryEntry,
} from "./logic";
import {
  Upload, FileSpreadsheet, Download, History, Eye, BarChart3,
} from "lucide-react";

interface CsvInput {
  fileName: string;
  content: string;
  encoding: string;
  hasBom: boolean;
  delimiter: string;
  headers: string[];
  rows: string[][];
  sheetName: string;
}

export default function CsvToExcelConverter() {
  const [inputs, setInputs] = useState<CsvInput[]>([]);
  const [options, setOptions] = useState<ConversionOptions>(DEFAULT_OPTIONS);
  const [delimiter, setDelimiter] = useState<Delimiter>("auto");
  const [outputFileName, setOutputFileName] = useState("converted.xlsx");
  const [stats, setStats] = useState<ConversionStats | null>(null);
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [history, setHistory] = useState<ConversionHistoryEntry[]>(() => loadHistory());
  const [showHistory, setShowHistory] = useState(false);
  const [showPreview, setShowPreview] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalStats = useMemo(() => {
    const totalRows = inputs.reduce((s, i) => s + i.rows.length, 0);
    const totalCells = inputs.reduce((s, i) => s + i.rows.reduce((rs, r) => rs + r.length, 0), 0);
    return { sheets: inputs.length, totalRows, totalCells };
  }, [inputs]);

  const handleFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setError(null);
    const newInputs: CsvInput[] = [];
    for (const file of Array.from(fileList)) {
      try {
        const buf = new Uint8Array(await file.arrayBuffer());
        const enc = detectEncoding(buf);
        const text = stripBom(new TextDecoder(enc.encoding.toLowerCase() === "utf-16le" ? "utf-16le" : enc.encoding.toLowerCase() === "utf-16be" ? "utf-16be" : "utf-8").decode(buf));
        const delim = delimiter === "auto" ? detectDelimiter(text) : delimiter;
        const parsed = parseCsv(text, { delimiter: delim, hasHeader: options.hasHeader });
        newInputs.push({
          fileName: file.name,
          content: text,
          encoding: enc.encoding,
          hasBom: enc.hasBom,
          delimiter: delim,
          headers: parsed.headers,
          rows: parsed.rows,
          sheetName: file.name.replace(/\.csv$/i, ""),
        });
      } catch (e) {
        setError(`Failed to parse ${file.name}: ${(e as Error).message}`);
      }
    }
    setInputs((prev) => [...prev, ...newInputs]);
    setOutputBlob(null);
    setStats(null);
  }, [delimiter, options.hasHeader]);

  const removeInput = useCallback((index: number) => {
    setInputs((prev) => prev.filter((_, i) => i !== index));
    setOutputBlob(null);
    setStats(null);
  }, []);

  const updateSheetName = useCallback((index: number, name: string) => {
    setInputs((prev) => prev.map((inp, i) => i === index ? { ...inp, sheetName: name } : inp));
  }, []);

  const convert = useCallback(async () => {
    if (inputs.length === 0) return;
    setWorking(true);
    setError(null);
    try {
      const result = convertCsvsToXlsx(
        inputs.map((inp) => ({
          fileName: inp.fileName,
          content: inp.content,
          sheetName: inp.sheetName,
        })),
        options,
        delimiter,
        outputFileName,
      );
      setOutputBlob(result.blob);
      setStats(result.stats);
      setHistory(saveToHistory({
        outputFileName,
        sheetCount: result.stats.sheetCount,
        totalRows: result.stats.totalRows,
        totalCells: result.stats.totalCells,
        xlsxBytes: result.stats.xlsxBytes,
        convertedAt: new Date().toISOString(),
      }));
      toast.success(`Converted ${result.stats.sheetCount} sheet${result.stats.sheetCount === 1 ? "" : "s"} → ${formatBytes(result.stats.xlsxBytes)}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking(false);
    }
  }, [inputs, options, delimiter, outputFileName]);

  const downloadXlsx = useCallback(() => {
    if (!outputBlob) return;
    const url = URL.createObjectURL(outputBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = outputFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success(`Downloaded ${outputFileName}`);
  }, [outputBlob, outputFileName]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold">Conversion options</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Delimiter</Label>
              <select
                value={delimiter}
                onChange={(e) => setDelimiter(e.target.value as Delimiter)}
                className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm cursor-pointer"
                aria-label="Delimiter"
              >
                <option value="auto">Auto-detect</option>
                <option value=",">Comma (,)</option>
                <option value="\t">Tab</option>
                <option value=";">Semicolon (;)</option>
                <option value="|">Pipe (|)</option>
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Output filename</Label>
              <Input
                value={outputFileName}
                onChange={(e) => setOutputFileName(e.target.value)}
                aria-label="Output filename"
              />
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <CheckOption label="Force text cells" checked={options.forceText} onChange={(v) => setOptions({ ...options, forceText: v })} />
              <CheckOption label="Header styling" checked={options.styleHeader} onChange={(v) => setOptions({ ...options, styleHeader: v })} />
              <CheckOption label="Auto-fit cols" checked={options.autoFitColumns} onChange={(v) => setOptions({ ...options, autoFitColumns: v })} />
              <CheckOption label="First row header" checked={options.hasHeader} onChange={(v) => setOptions({ ...options, hasHeader: v })} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <ShareButton getUrl={() => buildShareUrl(options, delimiter)} label="Share options" size="sm" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <input
            type="file"
            multiple
            accept=".csv,text/csv,text/plain"
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
            id="csv-input"
            aria-label="Choose CSV files"
            ref={fileInputRef}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
            className="w-full rounded-xl border-2 border-dashed border-border p-8 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer"
          >
            <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Drop CSV files here or click to browse</p>
            <p className="mt-1 text-xs text-muted-foreground">Multiple CSVs → one multi-sheet XLSX · RFC 4180 · encoding detected</p>
          </button>
        </CardContent>
      </Card>

      {inputs.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">CSV inputs ({inputs.length})</Label>
              <button
                type="button"
                onClick={() => { setInputs([]); setOutputBlob(null); setStats(null); }}
                className="text-[10px] text-red-600 hover:underline cursor-pointer"
              >
                Clear all
              </button>
            </div>
            <div className="space-y-2">
              {inputs.map((inp, i) => (
                <div key={i} className="rounded-md border p-2 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <FileSpreadsheet className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <p className="text-xs font-medium truncate">{inp.fileName}</p>
                      <Badge variant="outline" className="text-[10px]">{inp.rows.length} rows</Badge>
                      <Badge variant="outline" className="text-[10px]">{inp.encoding}{inp.hasBom ? " BOM" : ""}</Badge>
                      <Badge variant="outline" className="text-[10px]">delim: {inp.delimiter === "\t" ? "\\t" : inp.delimiter}</Badge>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setShowPreview(showPreview === i ? null : i)}
                        className="p-1.5 rounded-md hover:bg-accent cursor-pointer"
                        aria-label="Preview"
                        title="Preview first 10 rows"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeInput(i)}
                        className="text-[10px] text-red-600 hover:underline cursor-pointer px-2"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-[120px_1fr] gap-2 items-center">
                    <Label className="text-[10px] text-muted-foreground">Sheet name</Label>
                    <Input
                      value={inp.sheetName}
                      onChange={(e) => updateSheetName(i, e.target.value)}
                      className="h-7 text-xs"
                      maxLength={31}
                      aria-label={`Sheet name for ${inp.fileName}`}
                    />
                  </div>
                  {showPreview === i && (
                    <div className="overflow-x-auto rounded-md border max-h-[200px] overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/30 sticky top-0">
                          <tr>
                            {inp.headers.map((h, j) => (
                              <th key={j} className="px-2 py-1 text-left text-[10px]">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {previewRows(inp.headers, inp.rows, 10).map((row, j) => (
                            <tr key={j} className="border-t border-border/40">
                              {inp.headers.map((h, k) => (
                                <td key={k} className="px-2 py-1 text-[10px] break-all">{row[h]}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {inputs.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <Label className="text-sm font-semibold">Convert & download</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={convert}
                  disabled={working}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground h-8 px-3 text-xs hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
                >
                  {working ? "Converting..." : "Convert to XLSX"}
                </button>
                {outputBlob && (
                  <button
                    type="button"
                    onClick={downloadXlsx}
                    className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background hover:bg-accent h-8 px-3 text-xs cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" /> Download XLSX
                  </button>
                )}
              </div>
            </div>
            {stats && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                <Stat label="Sheets" value={String(stats.sheetCount)} icon={<BarChart3 className="h-3 w-3" />} />
                <Stat label="Rows" value={String(stats.totalRows)} />
                <Stat label="Cells" value={String(stats.totalCells)} />
                <Stat label="Shared strings" value={String(stats.sharedStringsCount)} />
                <Stat label="XLSX size" value={formatBytes(stats.xlsxBytes)} accent />
              </div>
            )}
            <p className="text-[10px] text-muted-foreground">
              Total input: {totalStats.sheets} CSV{totalStats.sheets === 1 ? "" : "s"} · {totalStats.totalRows} rows · {totalStats.totalCells} cells
            </p>
          </CardContent>
        </Card>
      )}

      {error && <ErrorBanner message={error} />}

      {inputs.length === 0 && !error && !working && (
        <EmptyState
          title="Convert CSV to XLSX"
          hint="Pure-JS XLSX writer — no SheetJS dependency. Batch convert, typed cells, auto-fit columns. 100% local."
          icon={<FileSpreadsheet className="h-8 w-8" />}
        />
      )}

      <Card>
        <CardContent className="p-4 space-y-2">
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className="text-xs text-muted-foreground hover:text-foreground cursor-pointer inline-flex items-center gap-1"
          >
            <History className="h-3 w-3" /> History ({history.length})
          </button>
          {showHistory && (
            <>
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Recent conversions</Label>
                {history.length > 0 && (
                  <button
                    type="button"
                    onClick={() => { clearHistory(); setHistory([]); }}
                    className="text-[10px] text-red-600 hover:underline cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
              {history.length === 0 ? (
                <p className="text-xs text-muted-foreground">No history yet.</p>
              ) : (
                <div className="space-y-1 max-h-[200px] overflow-y-auto">
                  {history.map((h, i) => (
                    <div key={i} className="text-xs py-1 border-b border-border/40 last:border-0">
                      <p className="font-medium truncate">{h.outputFileName}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {h.sheetCount} sheet{h.sheetCount === 1 ? "" : "s"} · {h.totalRows} rows · {h.totalCells} cells · {formatBytes(h.xlsxBytes)} · {new Date(h.convertedAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all CSV parsing and XLSX generation runs in your browser. File contents never leave your device. Only conversion summaries (filename, row count) are saved to local history.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function CheckOption({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-1 cursor-pointer text-[10px]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3 w-3 rounded border-input"
      />
      <span>{label}</span>
    </label>
  );
}

function Stat({ label, value, icon, accent }: { label: string; value: string; icon?: React.ReactNode; accent?: boolean }) {
  return (
    <div className="rounded-md border p-2">
      <p className="text-[10px] text-muted-foreground flex items-center gap-1">{icon}{label}</p>
      <p className={`text-sm font-mono font-semibold ${accent ? "text-emerald-600 dark:text-emerald-400" : ""}`}>{value}</p>
    </div>
  );
}
