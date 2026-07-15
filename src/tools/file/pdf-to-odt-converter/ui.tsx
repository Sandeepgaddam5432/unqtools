"use client";
import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorBanner, EmptyState, ShareButton } from "../../_shared";
import { toast } from "sonner";
import {
  convertPdfToOdt, formatBytes,
  DEFAULT_OPTIONS,
  loadHistory, saveToHistory, clearHistory, buildShareUrl,
  type OdtOptions, type OdtResult, type HistoryEntry, type OdtFontFamily, type OdtPageSize,
} from "./logic";
import {
  Upload, FileText, Download, History, BarChart3, Settings,
} from "lucide-react";

export default function PdfToOdtConverter() {
  const [opts, setOpts] = useState<OdtOptions>(DEFAULT_OPTIONS);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OdtResult | null>(null);
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
      const result = await convertPdfToOdt(pdfBytes, opts, file.name.replace(/\.pdf$/i, "") + ".odt");
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
        odtBytes: result.output.odtBytes,
        paragraphCount: result.output.paragraphCount,
        wordCount: result.output.wordCount,
        convertedAt: new Date().toISOString(),
      }));
      toast.success(`Converted ${file.name} to ODT (${result.output.paragraphCount} paragraphs)`);
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
              <Label className="text-[10px]">Page size</Label>
              <select
                value={opts.pageSize}
                onChange={(e) => setOpts({ ...opts, pageSize: e.target.value as OdtPageSize })}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm cursor-pointer"
              >
                <option value="a4">A4</option>
                <option value="letter">Letter</option>
                <option value="legal">Legal</option>
              </select>
            </div>
            <div>
              <Label className="text-[10px]">Font family</Label>
              <select
                value={opts.fontFamily}
                onChange={(e) => setOpts({ ...opts, fontFamily: e.target.value as OdtFontFamily })}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm cursor-pointer"
              >
                <option value="serif">Serif (Liberation Serif)</option>
                <option value="sans">Sans (Liberation Sans)</option>
                <option value="mono">Mono (Liberation Mono)</option>
              </select>
            </div>
            <div>
              <Label className="text-[10px]">Font size (pt)</Label>
              <Input
                type="number"
                min={8}
                max={36}
                value={opts.fontSize}
                onChange={(e) => setOpts({ ...opts, fontSize: Number(e.target.value) })}
                className="text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <Label className="text-[10px]">Margins (cm)</Label>
              <Input
                type="number"
                min={0}
                max={5}
                step={0.25}
                value={opts.margin}
                onChange={(e) => setOpts({ ...opts, margin: Number(e.target.value) })}
                className="text-sm"
              />
            </div>
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
          <div className="flex gap-4 text-xs">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={opts.insertPageBreaks}
                onChange={(e) => setOpts({ ...opts, insertPageBreaks: e.target.checked })}
                className="cursor-pointer"
              />
              Insert page breaks between PDF pages
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={opts.markPageHeadings}
                onChange={(e) => setOpts({ ...opts, markPageHeadings: e.target.checked })}
                className="cursor-pointer"
              />
              Mark first line of each page as Heading 1
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
            <p className="mt-1 text-xs text-muted-foreground">Pure-JS PDF parser · OpenDocument Text generator · .odt ZIP</p>
          </button>
        </CardContent>
      </Card>

      {working && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            Converting PDF to ODT…
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
                  <Download className="h-3.5 w-3.5" /> Download .odt
                </button>
                <ShareButton getUrl={() => buildShareUrl(opts)} label="Share" size="sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2 text-xs">
              <Stat label="Pages" value={String(result.pageCount)} />
              <Stat label="Paragraphs" value={String(result.paragraphCount)} icon={<BarChart3 className="h-3 w-3" />} accent />
              <Stat label="Words" value={String(result.wordCount)} />
              <Stat label="Chars" value={String(result.charCount)} />
              <Stat label="ODT size" value={formatBytes(result.odtBytes)} />
            </div>
          </CardContent>
        </Card>
      )}

      {error && <ErrorBanner message={error} />}

      {!result && !error && !working && (
        <EmptyState
          title="Convert PDF to ODT"
          hint="Pure-JS PDF text extraction + OpenDocument Text generator. Page size, margins, font family. Opens in LibreOffice, OpenOffice, Google Docs."
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
                        {h.paragraphCount} paragraphs · {h.wordCount} words · {formatBytes(h.pdfBytes)} → {formatBytes(h.odtBytes)} · {new Date(h.convertedAt).toLocaleString()}
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
            <strong className="text-foreground">Privacy:</strong> all PDF parsing and ODT generation runs in your browser. File contents never leave your device.
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
