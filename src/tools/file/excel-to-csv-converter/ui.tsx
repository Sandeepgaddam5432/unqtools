"use client";
import React, { useState, useCallback, useMemo, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, EmptyState, ShareButton } from "../../_shared";
import { toast } from "sonner";
import {
  convertXlsxToCsv, previewRows, formatBytes,
  loadHistory, saveToHistory, clearHistory,
  buildShareUrl,
  type CsvDelimiter, type ConversionResult, type HistoryEntry,
} from "./logic";
import {
  Upload, FileSpreadsheet, Download, History, BarChart3, X, Eye,
} from "lucide-react";

interface InputFile {
  fileName: string;
  size: number;
  bytes: Uint8Array;
}

interface OutputView {
  fileName: string;
  result: ConversionResult;
}

export default function ExcelToCsvConverter() {
  const [inputs, setInputs] = useState<InputFile[]>([]);
  const [delimiter, setDelimiter] = useState<CsvDelimiter>(",");
  const [convertAllSheets, setConvertAllSheets] = useState(false);
  const [sheetIndex, setSheetIndex] = useState<number | null>(null);
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [outputs, setOutputs] = useState<OutputView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const [showHistory, setShowHistory] = useState(false);
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setError(null);
    const newInputs: InputFile[] = [];
    for (const file of Array.from(fileList)) {
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        newInputs.push({ fileName: file.name, size: file.size, bytes });
      } catch (e) {
        setError(`Failed to read ${file.name}: ${(e as Error).message}`);
      }
    }
    setInputs((prev) => [...prev, ...newInputs]);
    setOutputs([]);
  }, []);

  const removeInput = useCallback((index: number) => {
    setInputs((prev) => prev.filter((_, i) => i !== index));
    setOutputs([]);
  }, []);

  const convert = useCallback(async () => {
    if (inputs.length === 0) return;
    setWorking(true);
    setError(null);
    setProgress({ current: 0, total: inputs.length });
    const newOutputs: OutputView[] = [];
    try {
      for (let i = 0; i < inputs.length; i++) {
        const inp = inputs[i]!;
        try {
          const result = await convertXlsxToCsv(
            { fileName: inp.fileName, bytes: inp.bytes },
            delimiter,
            sheetIndex,
            convertAllSheets,
          );
          newOutputs.push({ fileName: inp.fileName, result });
          setHistory(saveToHistory({
            fileName: inp.fileName,
            sheetCount: result.sheets.length,
            totalRows: result.totalRows,
            totalCells: result.totalCells,
            csvBytes: result.totalCsvBytes,
            convertedAt: new Date().toISOString(),
          }));
        } catch (e) {
          setError(`Failed to convert ${inp.fileName}: ${(e as Error).message}`);
        }
        setProgress({ current: i + 1, total: inputs.length });
      }
      setOutputs(newOutputs);
      if (newOutputs.length > 0) {
        toast.success(`Converted ${newOutputs.length} file${newOutputs.length === 1 ? "" : "s"}`);
      }
    } finally {
      setWorking(false);
      setProgress(null);
    }
  }, [inputs, delimiter, sheetIndex, convertAllSheets]);

  const downloadOutput = useCallback((out: OutputView) => {
    if (!out.result.blob) return;
    const url = URL.createObjectURL(out.result.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = out.result.outputFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success(`Downloaded ${out.result.outputFileName}`);
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold">Conversion options</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">CSV delimiter</Label>
              <select
                value={delimiter}
                onChange={(e) => setDelimiter(e.target.value as CsvDelimiter)}
                className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm cursor-pointer"
                aria-label="CSV delimiter"
              >
                <option value=",">Comma (,)</option>
                <option value="\t">Tab</option>
                <option value=";">Semicolon (;)</option>
                <option value="|">Pipe (|)</option>
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Sheet index (optional)</Label>
              <Input
                type="number"
                min={0}
                value={sheetIndex ?? ""}
                onChange={(e) => setSheetIndex(e.target.value === "" ? null : parseInt(e.target.value, 10))}
                placeholder="auto (first)"
                aria-label="Sheet index"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={convertAllSheets}
                  onChange={(e) => {
                    setConvertAllSheets(e.target.checked);
                    if (e.target.checked) setSheetIndex(null);
                  }}
                  className="h-3 w-3 rounded border-input"
                />
                <span>Convert all sheets (ZIP)</span>
              </label>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <ShareButton getUrl={() => buildShareUrl({ delimiter, convertAllSheets })} label="Share options" size="sm" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <input
            type="file"
            multiple
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
            id="xlsx-input"
            aria-label="Choose XLSX files"
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
            <p className="text-sm font-medium">Drop .xlsx files here or click to browse</p>
            <p className="mt-1 text-xs text-muted-foreground">Pure-JS XLSX parser · no SheetJS · sharedStrings + styles + sheet XML</p>
          </button>
        </CardContent>
      </Card>

      {inputs.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Input files ({inputs.length})</Label>
              <button
                type="button"
                onClick={() => { setInputs([]); setOutputs([]); }}
                className="text-[10px] text-red-600 hover:underline cursor-pointer"
              >
                Clear all
              </button>
            </div>
            <div className="space-y-2">
              {inputs.map((inp, i) => (
                <div key={i} className="flex items-center justify-between gap-2 rounded-md border p-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <FileSpreadsheet className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <p className="text-xs font-medium truncate">{inp.fileName}</p>
                    <Badge variant="outline" className="text-[10px]">{formatBytes(inp.size)}</Badge>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeInput(i)}
                    className="p-1 rounded-md hover:bg-accent cursor-pointer"
                    aria-label={`Remove ${inp.fileName}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
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
              <button
                type="button"
                onClick={convert}
                disabled={working}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground h-8 px-3 text-xs hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
              >
                {working ? `Converting ${progress ? `(${progress.current}/${progress.total})` : "..."}` : "Convert to CSV"}
              </button>
            </div>
            {working && progress && (
              <div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">{progress.current} / {progress.total} files</p>
              </div>
            )}
            {outputs.length > 0 && (
              <div className="space-y-2">
                {outputs.map((out, i) => (
                  <div key={i} className="rounded-md border p-2 space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <FileSpreadsheet className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <p className="text-xs font-medium truncate">{out.fileName}</p>
                        <Badge variant="outline" className="text-[10px]">{out.result.sheets.length} sheet{out.result.sheets.length === 1 ? "" : "s"}</Badge>
                        <Badge variant="outline" className="text-[10px]">{out.result.totalRows} rows</Badge>
                        <Badge variant="outline" className="text-[10px]">{out.result.totalCells} cells</Badge>
                        <Badge variant="outline" className="text-[10px]">{formatBytes(out.result.totalCsvBytes)}</Badge>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => setPreviewIdx(previewIdx === i ? null : i)}
                          className="p-1.5 rounded-md hover:bg-accent cursor-pointer"
                          aria-label="Preview"
                          title="Preview first 10 rows"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadOutput(out)}
                          className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background hover:bg-accent h-7 px-2 text-xs cursor-pointer"
                        >
                          <Download className="h-3 w-3" /> {out.result.sheets.length === 1 ? "CSV" : "ZIP"}
                        </button>
                      </div>
                    </div>
                    {previewIdx === i && out.result.sheets.length > 0 && (
                      <div className="overflow-x-auto rounded-md border max-h-[200px] overflow-y-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-muted/30 sticky top-0">
                            <tr>
                              {out.result.sheets[0]!.rowCount > 0 && out.result.sheets[0]!.columnCount > 0 && (
                                <>
                                  <th className="px-2 py-1 text-left text-[10px]">#</th>
                                  {Array.from({ length: out.result.sheets[0]!.columnCount }, (_, c) => (
                                    <th key={c} className="px-2 py-1 text-left text-[10px]">{String.fromCharCode(65 + c)}</th>
                                  ))}
                                </>
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {/* Render the CSV rows from the first sheet */}
                            {out.result.sheets[0]!.csv.split("\n").slice(0, 10).map((row, j) => {
                              const cells = row.split(delimiter);
                              return (
                                <tr key={j} className="border-t border-border/40">
                                  <td className="px-2 py-1 text-[10px] text-muted-foreground">{j + 1}</td>
                                  {Array.from({ length: out.result.sheets[0]!.columnCount }, (_, c) => (
                                    <td key={c} className="px-2 py-1 text-[10px] break-all">{cells[c] ?? ""}</td>
                                  ))}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {error && <ErrorBanner message={error} />}

      {inputs.length === 0 && !error && !working && (
        <EmptyState
          title="Convert XLSX to CSV"
          hint="Pure-JS XLSX parser — no SheetJS. Reads sharedStrings.xml, sheetN.xml, styles.xml. Supports multiple sheets, custom delimiters, ZIP export. 100% local."
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
                      <p className="font-medium truncate">{h.fileName}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {h.sheetCount} sheet{h.sheetCount === 1 ? "" : "s"} · {h.totalRows} rows · {h.totalCells} cells · {formatBytes(h.csvBytes)} · {new Date(h.convertedAt).toLocaleString()}
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
            <strong className="text-foreground">Privacy:</strong> all XLSX parsing runs in your browser using pure JavaScript. File contents never leave your device. Only conversion summaries are saved to local history.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
