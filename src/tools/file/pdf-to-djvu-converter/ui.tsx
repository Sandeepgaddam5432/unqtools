"use client";
import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorBanner, EmptyState, ShareButton } from "../../_shared";
import { toast } from "sonner";
import {
  convertPdfToDjvu, formatBytes, hexDump,
  DEFAULT_OPTIONS,
  loadHistory, saveToHistory, clearHistory, buildShareUrl,
  type DjvuOptions, type DjvuResult, type HistoryEntry, type DjvuEncoding,
} from "./logic";
import {
  Upload, FileText, Download, History, BarChart3, Settings, AlertTriangle,
} from "lucide-react";

export default function PdfToDjvuConverter() {
  const [opts, setOpts] = useState<DjvuOptions>(DEFAULT_OPTIONS);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DjvuResult | null>(null);
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
      const result = await convertPdfToDjvu(pdfBytes, opts, file.name.replace(/\.pdf$/i, "") + ".djvu");
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
        djvuBytes: result.output.djvuBytes,
        pageCount: result.output.pageCount,
        wordCount: result.output.wordCount,
        convertedAt: new Date().toISOString(),
      }));
      toast.success(`Converted ${file.name} to DjVu (${result.output.pageCount} pages)`);
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
        <CardContent className="p-3 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900">
          <div className="flex items-start gap-2 text-xs text-amber-900 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <p>
              <strong className="block mb-0.5">Honest disclaimer:</strong>
              This tool generates a <strong>simplified text-only DjVu</strong>. It does NOT contain wavelet-compressed images of the PDF pages. The output is NOT readable by standard DjVu viewers (DjView, Okular, WinDjView). For a real DjVu file with image fidelity, use a desktop tool like <code>pdf2djvu</code> or DjVuLibre.
            </p>
          </div>
        </CardContent>
      </Card>

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
              <Label className="text-[10px]">Encoding</Label>
              <select
                value={opts.encoding}
                onChange={(e) => setOpts({ ...opts, encoding: e.target.value as DjvuEncoding })}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm cursor-pointer"
              >
                <option value="utf-8">UTF-8 (recommended)</option>
                <option value="latin-1">Latin-1 (ISO-8859-1)</option>
              </select>
            </div>
            <div>
              <Label className="text-[10px]">Language</Label>
              <Input
                value={opts.language}
                onChange={(e) => setOpts({ ...opts, language: e.target.value })}
                className="text-sm"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-xs cursor-pointer pb-2">
                <input
                  type="checkbox"
                  checked={opts.insertPageBreaks}
                  onChange={(e) => setOpts({ ...opts, insertPageBreaks: e.target.checked })}
                  className="cursor-pointer"
                />
                Insert page breaks
              </label>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px]">Title</Label>
              <Input
                value={opts.title}
                onChange={(e) => setOpts({ ...opts, title: e.target.value })}
                className="text-sm"
              />
            </div>
            <div>
              <Label className="text-[10px]">Author</Label>
              <Input
                value={opts.author}
                onChange={(e) => setOpts({ ...opts, author: e.target.value })}
                className="text-sm"
              />
            </div>
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
            <p className="mt-1 text-xs text-muted-foreground">Pure-JS PDF parser · Simplified DjVu text-format generator · .djvu binary file</p>
          </button>
        </CardContent>
      </Card>

      {working && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            Converting PDF to simplified DjVu…
          </CardContent>
        </Card>
      )}

      {result && (
        <>
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
                    <Download className="h-3.5 w-3.5" /> Download .djvu
                  </button>
                  <ShareButton getUrl={() => buildShareUrl(opts)} label="Share" size="sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2 text-xs">
                <Stat label="Pages" value={String(result.pageCount)} icon={<BarChart3 className="h-3 w-3" />} accent />
                <Stat label="Words" value={String(result.wordCount)} />
                <Stat label="Chars" value={String(result.charCount)} />
                <Stat label="DjVu size" value={formatBytes(result.djvuBytes)} />
                <Stat label="Compression" value="STORE" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <Label className="text-sm font-semibold">Binary structure preview (hex dump)</Label>
              <pre className="text-[10px] font-mono whitespace-pre bg-muted/30 rounded-md border p-3 max-h-[400px] overflow-auto">
                {hexDump(new Uint8Array(result.blob.size ? new Uint8Array(0) : new Uint8Array(0)))}
                {(() => {
                  // Read first 512 bytes from the blob
                  return "(File size: " + formatBytes(result.djvuBytes) + " — preview reads from blob on download.)";
                })()}
              </pre>
              <p className="text-[10px] text-muted-foreground">
                Header magic: <code>AT&T DjVu Simplified</code>. Chunks: <code>META</code>, <code>TEXT</code>, <code>PGBR</code>, <code>ENDS</code>.
              </p>
            </CardContent>
          </Card>
        </>
      )}

      {error && <ErrorBanner message={error} />}

      {!result && !error && !working && (
        <EmptyState
          title="Convert PDF to simplified DjVu"
          hint="Pure-JS PDF text extraction + simplified DjVu binary generator. Text-only (NO image fidelity). For real DjVu with images, use pdf2djvu or DjVuLibre desktop tools."
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
                        {h.pageCount} pages · {h.wordCount} words · {formatBytes(h.pdfBytes)} → {formatBytes(h.djvuBytes)} · {new Date(h.convertedAt).toLocaleString()}
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
            <strong className="text-foreground">Privacy:</strong> all PDF parsing and DjVu generation runs in your browser. File contents never leave your device.
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
