"use client";
import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorBanner, EmptyState, ShareButton } from "../../_shared";
import { toast } from "sonner";
import {
  convertPdfToExcel, splitLine, formatBytes,
  DEFAULT_OPTIONS,
  loadHistory, saveToHistory, clearHistory, buildShareUrl,
  type ExcelOptions, type ExcelResult, type HistoryEntry, type Delimiter,
} from "./logic";
import {
  Upload, FileText, Download, History, BarChart3, Settings,
} from "lucide-react";

export default function PdfToExcelConverter() {
  const [opts, setOpts] = useState<ExcelOptions>(DEFAULT_OPTIONS);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExcelResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const [showHistory, setShowHistory] = useState(false);
  const [fileName, setFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleConvert = useCallback(async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0]!;
    setError(null);
    setWorking(true);
    setFileName(file.name);
    try {
      const pdfBytes = new Uint8Array(await file.arrayBuffer());
      const result = await convertPdfToExcel(pdfBytes, opts, file.name.replace(/\.pdf$/i, "") + ".xlsx");
      if (!result.ok) {
        setError(result.error);
        setResult(null);
        setWorking(false);
        return;
      }
      setResult(result.output);
      setHistory(saveToHistory({
        fileName: file.name,
        pdfBytes: pdfBytes.length,
        xlsxBytes: result.output.xlsxBytes,
        pageCount: result.output.pageCount,
        rowCount: result.output.rowCount,
        convertedAt: new Date().toISOString(),
      }));
      toast.success(`Converted ${file.name} to XLSX (${result.output.rowCount} rows)`);
    } catch (e) {
      setError(`${file.name}: ${(e as Error).message}`);
    } finally {
      setWorking(false);
    }
  }, [opts]);

  const handleDownload = useCallback(() => {
    if (!result) return;
    const url = URL.createObjectURL(result.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = result.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success(`Downloaded ${result.fileName}`);
  }, [result]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold flex items-center gap-1.5">
            <Settings className="h-3.5 w-3.5" /> Options
          </Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <Label className="text-[10px]">Page range</Label>
              <Input
                value={opts.pageRange}
                onChange={(e) => setOpts({ ...opts, pageRange: e.target.value })}
                placeholder="All pages"
                className="text-sm"
              />
            </div>
            <div>
              <Label className="text-[10px]">Delimiter</Label>
              <select
                value={opts.delimiter === "\t" ? "\\t" : opts.delimiter}
                onChange={(e) => {
                  const v = e.target.value;
                  const delim: Delimiter = v === "\\t" ? "\t" : v as Delimiter;
                  setOpts({ ...opts, delimiter: delim });
                }}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm cursor-pointer"
              >
                <option value=",">Comma (,)</option>
                <option value="\\t">Tab</option>
                <option value=";">Semicolon (;)</option>
                <option value="|">Pipe (|)</option>
                <option value=" ">Custom</option>
              </select>
            </div>
            <div>
              <Label className="text-[10px]">Sheet name</Label>
              <Input
                value={opts.sheetName}
                onChange={(e) => setOpts({ ...opts, sheetName: e.target.value })}
                placeholder="Default per page"
                className="text-sm"
              />
            </div>
            <div>
              <Label className="text-[10px]">Layout</Label>
              <select
                value={opts.singleSheet ? "single" : "per-page"}
                onChange={(e) => setOpts({ ...opts, singleSheet: e.target.value === "single" })}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm cursor-pointer"
              >
                <option value="per-page">One sheet per page</option>
                <option value="single">All rows in one sheet</option>
              </select>
            </div>
          </div>
          {opts.delimiter === " " && (
            <div>
              <Label className="text-[10px]">Custom delimiter</Label>
              <Input
                value={opts.customDelimiter}
                onChange={(e) => setOpts({ ...opts, customDelimiter: e.target.value })}
                placeholder="e.g. | or ::"
                className="text-sm"
              />
            </div>
          )}
          <div className="flex flex-wrap gap-3 text-xs">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={opts.hasHeader} onChange={(e) => setOpts({ ...opts, hasHeader: e.target.checked })} className="cursor-pointer" />
              First row is header
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={opts.autoDetectTypes} onChange={(e) => setOpts({ ...opts, autoDetectTypes: e.target.checked })} className="cursor-pointer" />
              Auto-detect cell types
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <input
            type="file"
            accept=".pdf,application/pdf"
            onChange={(e) => handleConvert(e.target.files)}
            className="hidden"
            id="pdf-input"
            aria-label="Choose a .pdf file"
            ref={fileInputRef}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleConvert(e.dataTransfer.files); }}
            className="w-full rounded-xl border-2 border-dashed border-border p-8 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer"
          >
            <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Drop a .pdf file here or click to browse</p>
            <p className="mt-1 text-xs text-muted-foreground">Pure-JS PDF parser · SpreadsheetML generator · XLSX ZIP writer</p>
          </button>
        </CardContent>
      </Card>

      {working && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            Converting PDF to XLSX…
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <Label className="text-sm font-semibold">{fileName}</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleDownload}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 h-8 px-3 text-xs cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" /> Download .xlsx
                </button>
                <ShareButton getUrl={() => buildShareUrl(opts)} label="Share" size="sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2 text-xs">
              <Stat label="Pages" value={String(result.pageCount)} icon={<BarChart3 className="h-3 w-3" />} accent />
              <Stat label="Rows" value={String(result.rowCount)} />
              <Stat label="Max cols" value={String(result.columnCount)} />
              <Stat label="Cells" value={String(result.cellCount)} />
              <Stat label="XLSX size" value={formatBytes(result.xlsxBytes)} />
            </div>
          </CardContent>
        </Card>
      )}

      {error && <ErrorBanner message={error} />}

      {!result && !error && !working && (
        <EmptyState
          title="Convert PDF to Excel"
          hint="Pure-JS PDF parser + SpreadsheetML generator. Splits each text line by your chosen delimiter. For complex tables, use Tabula (desktop)."
          icon={<FileText className="h-8 w-8" />}
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
                      <p className="font-medium truncate">{h.fileName}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {h.pageCount} pages · {h.rowCount} rows · {formatBytes(h.pdfBytes)} → {formatBytes(h.xlsxBytes)} · {new Date(h.convertedAt).toLocaleString()}
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
            <strong className="text-foreground">Privacy:</strong> all PDF parsing and XLSX generation runs in your browser. File contents never leave your device.
          </p>
        </CardContent>
      </Card>
    </div>
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
