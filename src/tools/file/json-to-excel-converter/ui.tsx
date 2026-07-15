"use client";
import React, { useState, useCallback, useMemo, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner, EmptyState, ShareButton } from "../../_shared";
import { toast } from "sonner";
import {
  parseJsonInput, flattenObject, detectColumns, previewRows,
  convertJsonToXlsx, formatBytes,
  loadHistory, saveToHistory, clearHistory,
  buildShareUrl,
  DEFAULT_OPTIONS, type ConversionOptions, type ColumnDetectionMode, type HistoryEntry, type ConversionStats,
} from "./logic";
import {
  Upload, FileSpreadsheet, Download, History, Eye, BarChart3, X,
} from "lucide-react";

interface JsonInput {
  fileName: string;
  content: string;
  encoding: string;
  hasBom: boolean;
  shape: string;
  rowCount: number;
  errors: Array<{ line: number; message: string }>;
  sheetName: string;
}

export default function JsonToExcelConverter() {
  const [inputs, setInputs] = useState<JsonInput[]>([]);
  const [options, setOptions] = useState<ConversionOptions>(DEFAULT_OPTIONS);
  const [outputFileName, setOutputFileName] = useState("converted.xlsx");
  const [stats, setStats] = useState<ConversionStats | null>(null);
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const [showHistory, setShowHistory] = useState(false);
  const [showPreview, setShowPreview] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalStats = useMemo(() => {
    const totalRows = inputs.reduce((s, i) => s + i.rowCount, 0);
    const errorCount = inputs.reduce((s, i) => s + i.errors.length, 0);
    return { sheets: inputs.length, totalRows, errorCount };
  }, [inputs]);

  const handleFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setError(null);
    const newInputs: JsonInput[] = [];
    for (const file of Array.from(fileList)) {
      try {
        const text = await file.text();
        const parsed = parseJsonInput(text);
        newInputs.push({
          fileName: file.name,
          content: text,
          encoding: "UTF-8",
          hasBom: text.charCodeAt(0) === 0xfeff,
          shape: parsed.shape,
          rowCount: parsed.rows.length,
          errors: parsed.errors,
          sheetName: file.name.replace(/\.(json|jsonl|ndjson)$/i, ""),
        });
      } catch (e) {
        setError(`Failed to read ${file.name}: ${(e as Error).message}`);
      }
    }
    setInputs((prev) => [...prev, ...newInputs]);
    setOutputBlob(null);
    setStats(null);
  }, []);

  const removeInput = useCallback((index: number) => {
    setInputs((prev) => prev.filter((_, i) => i !== index));
    setOutputBlob(null);
    setStats(null);
  }, []);

  const updateSheetName = useCallback((index: number, name: string) => {
    setInputs((prev) => prev.map((inp, i) => i === index ? { ...inp, sheetName: name } : inp));
  }, []);

  const convert = useCallback(() => {
    if (inputs.length === 0) return;
    setWorking(true);
    setError(null);
    try {
      const result = convertJsonToXlsx(
        inputs.map((inp) => ({
          fileName: inp.fileName,
          content: inp.content,
          sheetName: inp.sheetName,
        })),
        options,
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
  }, [inputs, options, outputFileName]);

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
              <Label className="text-xs text-muted-foreground">Flatten depth (0 = unlimited)</Label>
              <Input
                type="number"
                min={0}
                value={options.flattenDepth === Infinity ? 0 : options.flattenDepth}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  setOptions({ ...options, flattenDepth: isNaN(v) || v <= 0 ? Infinity : v });
                }}
                aria-label="Flatten depth"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Column detection</Label>
              <select
                value={options.columnMode}
                onChange={(e) => setOptions({ ...options, columnMode: e.target.value as ColumnDetectionMode })}
                className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm cursor-pointer"
                aria-label="Column detection mode"
              >
                <option value="first">First row's keys</option>
                <option value="union">Union (all keys)</option>
                <option value="intersection">Intersection (common keys)</option>
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
            <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-3">
              <CheckOption label="Force text cells" checked={options.forceText} onChange={(v) => setOptions({ ...options, forceText: v })} />
              <CheckOption label="Header styling" checked={options.styleHeader} onChange={(v) => setOptions({ ...options, styleHeader: v })} />
              <CheckOption label="Auto-fit cols" checked={options.autoFitColumns} onChange={(v) => setOptions({ ...options, autoFitColumns: v })} />
              <CheckOption label="First row header" checked={options.hasHeader} onChange={(v) => setOptions({ ...options, hasHeader: v })} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <ShareButton getUrl={() => buildShareUrl(options)} label="Share options" size="sm" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <input
            type="file"
            multiple
            accept=".json,.jsonl,.ndjson,application/json,text/plain"
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
            id="json-input"
            aria-label="Choose JSON files"
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
            <p className="text-sm font-medium">Drop JSON / JSONL files here or click to browse</p>
            <p className="mt-1 text-xs text-muted-foreground">Multiple JSONs → multi-sheet XLSX · nested objects flattened · cell types inferred</p>
          </button>
        </CardContent>
      </Card>

      {inputs.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">JSON inputs ({inputs.length})</Label>
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
                      <Badge variant="outline" className="text-[10px]">{inp.shape}</Badge>
                      <Badge variant="outline" className="text-[10px]">{inp.rowCount} rows</Badge>
                      {inp.errors.length > 0 && <Badge variant="destructive" className="text-[10px]">{inp.errors.length} errors</Badge>}
                      {inp.hasBom && <Badge variant="outline" className="text-[10px]">BOM</Badge>}
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
                  {inp.errors.length > 0 && (
                    <p className="text-[10px] text-destructive">
                      Line {inp.errors[0]!.line}: {inp.errors[0]!.message}{inp.errors.length > 1 ? ` (+${inp.errors.length - 1} more)` : ""}
                    </p>
                  )}
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
                  {showPreview === i && (() => {
                    const parsed = parseJsonInput(inp.content);
                    const cols = detectColumns(parsed.rows, { mode: options.columnMode });
                    const preview = previewRows(cols, parsed.rows, 10);
                    return (
                      <div className="overflow-x-auto rounded-md border max-h-[200px] overflow-y-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-muted/30 sticky top-0">
                            <tr>
                              {cols.map((c, j) => (
                                <th key={j} className="px-2 py-1 text-left text-[10px]">{c}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {preview.map((row, j) => (
                              <tr key={j} className="border-t border-border/40">
                                {cols.map((c, k) => (
                                  <td key={k} className="px-2 py-1 text-[10px] break-all">{row[c]}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
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
              Total input: {totalStats.sheets} JSON file{totalStats.sheets === 1 ? "" : "s"} · {totalStats.totalRows} rows · {totalStats.errorCount} parse error{totalStats.errorCount === 1 ? "" : "s"}
            </p>
          </CardContent>
        </Card>
      )}

      {error && <ErrorBanner message={error} />}

      {inputs.length === 0 && !error && !working && (
        <EmptyState
          title="Convert JSON to XLSX"
          hint="Pure-JS XLSX writer — reuses the CSV-to-Excel converter's writer. Flattens nested objects, infers cell types, supports JSONL. 100% local."
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
            <strong className="text-foreground">Privacy:</strong> all JSON parsing and XLSX generation runs in your browser. File contents never leave your device. Only conversion summaries are saved to local history.
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
