"use client";
import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, EmptyState, ShareButton, CopyButton, DownloadButton } from "../../_shared";
import { toast } from "sonner";
import {
  extractPdfText, formatAsPlainText, computeStats, formatBytes,
  DEFAULT_OPTIONS,
  loadHistory, saveToHistory, clearHistory, buildShareUrl,
  type ConvertOptions, type PdfTextResult, type HistoryEntry,
} from "./logic";
import {
  Upload, FileText, History, BarChart3, Settings,
} from "lucide-react";

export default function PdfToTextConverter() {
  const [opts, setOpts] = useState<ConvertOptions>(DEFAULT_OPTIONS);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PdfTextResult | null>(null);
  const [output, setOutput] = useState<string>("");
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
      const result = await extractPdfText(pdfBytes, opts);
      if (!result.ok) {
        setError(result.error);
        setResult(null);
        setOutput("");
        setWorking(false);
        return;
      }
      setResult(result.output);
      const text = formatAsPlainText(result.output, opts);
      setOutput(text);
      const stats = computeStats(result.output);
      setHistory(saveToHistory({
        fileName: file.name,
        pdfBytes: pdfBytes.length,
        pageCount: stats.pageCount,
        wordCount: stats.wordCount,
        extractedAt: new Date().toISOString(),
      }));
      toast.success(`Extracted ${stats.wordCount} words from ${file.name}`);
    } catch (e) {
      setError(`${file.name}: ${(e as Error).message}`);
    } finally {
      setWorking(false);
    }
  }, [opts]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold flex items-center gap-1.5">
            <Settings className="h-3.5 w-3.5" /> Options
          </Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="col-span-2">
              <Label className="text-[10px]">Page range (e.g. 1-3,5,7-9)</Label>
              <Input
                value={opts.pageRange}
                onChange={(e) => setOpts({ ...opts, pageRange: e.target.value })}
                placeholder="All pages"
                className="text-sm"
              />
            </div>
            <div>
              <Label className="text-[10px]">Page separator</Label>
              <select
                value={opts.pageSeparator === "\n\n--- Page Break ---\n\n" ? "break" : "none"}
                onChange={(e) => setOpts({ ...opts, pageSeparator: e.target.value === "break" ? "\n\n--- Page Break ---\n\n" : "\n\n" })}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm cursor-pointer"
              >
                <option value="break">--- Page Break ---</option>
                <option value="none">Blank line</option>
              </select>
            </div>
            <div>
              <Label className="text-[10px]">Encoding</Label>
              <select
                value={opts.addBom ? "bom" : "utf8"}
                onChange={(e) => setOpts({ ...opts, addBom: e.target.value === "bom" })}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm cursor-pointer"
              >
                <option value="utf8">UTF-8</option>
                <option value="bom">UTF-8 with BOM</option>
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 text-xs">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={opts.trimLines} onChange={(e) => setOpts({ ...opts, trimLines: e.target.checked })} className="cursor-pointer" />
              Trim whitespace
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={opts.removeEmptyLines} onChange={(e) => setOpts({ ...opts, removeEmptyLines: e.target.checked })} className="cursor-pointer" />
              Remove empty lines
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={opts.lineNumbers} onChange={(e) => setOpts({ ...opts, lineNumbers: e.target.checked })} className="cursor-pointer" />
              Line numbers
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
            <p className="mt-1 text-xs text-muted-foreground">Pure-JS PDF parser · text-showing operators (Tj/TJ/'/") · UTF-8 output</p>
          </button>
        </CardContent>
      </Card>

      {working && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            Extracting text from PDF…
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <Label className="text-sm font-semibold">{fileName}</Label>
              <div className="flex gap-2">
                <CopyButton getText={() => output} label="Copy" size="sm" />
                <DownloadButton getText={() => output} filename={fileName.replace(/\.pdf$/i, "") + ".txt"} label="Download .txt" size="sm" />
                <ShareButton getUrl={() => buildShareUrl(opts)} label="Share" size="sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2 text-xs">
              <Stat label="Pages" value={String(result.pageCount)} icon={<BarChart3 className="h-3 w-3" />} accent />
              <Stat label="Lines" value={String(result.totalLineCount)} />
              <Stat label="Words" value={String(result.totalWordCount)} />
              <Stat label="Chars" value={String(result.totalCharCount)} />
              <Stat label="Output size" value={formatBytes(output.length)} />
            </div>
          </CardContent>
        </Card>
      )}

      {output && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <Label className="text-sm font-semibold">Extracted text</Label>
            <pre className="text-xs font-mono bg-muted/30 rounded p-2 max-h-[400px] overflow-auto whitespace-pre-wrap break-all">
              {output.slice(0, 10000)}{output.length > 10000 ? "\n\n[...truncated for preview...]" : ""}
            </pre>
          </CardContent>
        </Card>
      )}

      {error && <ErrorBanner message={error} />}

      {!result && !error && !working && (
        <EmptyState
          title="Extract text from PDF"
          hint="Pure-JS PDF parser — no WASM. Reads content streams and decodes text-showing operators. Scanned PDFs (images of text) need OCR — use an OCR tool for those."
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
                        {h.pageCount} pages · {h.wordCount} words · {formatBytes(h.pdfBytes)} · {new Date(h.extractedAt).toLocaleString()}
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
            <strong className="text-foreground">Privacy:</strong> all PDF parsing and text extraction runs in your browser. File contents never leave your device.
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
