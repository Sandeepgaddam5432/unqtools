"use client";
import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorBanner, EmptyState, ShareButton, CopyButton, DownloadButton } from "../../_shared";
import { toast } from "sonner";
import {
  convertPdfToRtf, formatBytes,
  DEFAULT_OPTIONS,
  loadHistory, saveToHistory, clearHistory, buildShareUrl,
  type RtfOptions, type RtfResult, type HistoryEntry, type RtfFont,
} from "./logic";
import {
  Upload, FileText, History, BarChart3, Settings,
} from "lucide-react";

export default function PdfToRtfConverter() {
  const [opts, setOpts] = useState<RtfOptions>(DEFAULT_OPTIONS);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RtfResult | null>(null);
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
      const result = await convertPdfToRtf(pdfBytes, opts, file.name.replace(/\.pdf$/i, "") + ".rtf");
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
        rtfBytes: result.output.rtfBytes,
        pageCount: result.output.pageCount,
        wordCount: result.output.wordCount,
        convertedAt: new Date().toISOString(),
      }));
      toast.success(`Converted ${file.name} to RTF (${result.output.pageCount} pages)`);
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
              <Label className="text-[10px]">Font</Label>
              <select
                value={opts.fontFamily}
                onChange={(e) => setOpts({ ...opts, fontFamily: e.target.value as RtfFont })}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm cursor-pointer"
              >
                <option value="Arial">Arial</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Courier New">Courier New</option>
                <option value="Calibri">Calibri</option>
              </select>
            </div>
            <div>
              <Label className="text-[10px]">Font size (pt)</Label>
              <Input
                type="number"
                min={8}
                max={36}
                value={opts.fontSize / 2}
                onChange={(e) => setOpts({ ...opts, fontSize: Number(e.target.value) * 2 })}
                className="text-sm"
              />
            </div>
            <div>
              <Label className="text-[10px]">Margin (inches)</Label>
              <Input
                type="number"
                min={0.5}
                max={3}
                step={0.25}
                value={opts.margin / 1440}
                onChange={(e) => setOpts({ ...opts, margin: Math.round(Number(e.target.value) * 1440) })}
                className="text-sm"
              />
            </div>
          </div>
          <div>
            <Label className="text-[10px]">Title</Label>
            <Input
              value={opts.title}
              onChange={(e) => setOpts({ ...opts, title: e.target.value })}
              className="text-sm"
            />
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
            <p className="mt-1 text-xs text-muted-foreground">Pure-JS PDF parser · RTF control words · opens in Word / LibreOffice</p>
          </button>
        </CardContent>
      </Card>

      {working && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            Converting PDF to RTF…
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <Label className="text-sm font-semibold">{fileName}</Label>
              <div className="flex gap-2">
                <CopyButton getText={() => result.rtf} label="Copy RTF" size="sm" />
                <DownloadButton getText={() => result.rtf} filename={result.fileName} label="Download .rtf" size="sm" mime="application/rtf" />
                <ShareButton getUrl={() => buildShareUrl(opts)} label="Share" size="sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2 text-xs">
              <Stat label="Pages" value={String(result.pageCount)} icon={<BarChart3 className="h-3 w-3" />} accent />
              <Stat label="Paragraphs" value={String(result.paragraphCount)} />
              <Stat label="Words" value={String(result.wordCount)} />
              <Stat label="Chars" value={String(result.charCount)} />
              <Stat label="RTF size" value={formatBytes(result.rtfBytes)} />
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <Label className="text-sm font-semibold">RTF preview</Label>
            <pre className="text-[10px] font-mono bg-muted/30 rounded p-2 max-h-[300px] overflow-auto whitespace-pre-wrap break-all">
              {result.rtf.slice(0, 5000)}{result.rtf.length > 5000 ? "\n\n[...truncated for preview...]" : ""}
            </pre>
          </CardContent>
        </Card>
      )}

      {error && <ErrorBanner message={error} />}

      {!result && !error && !working && (
        <EmptyState
          title="Convert PDF to RTF"
          hint="Pure-JS PDF parser + RTF control word generator. Cross-platform format that opens in Word, WordPad, LibreOffice, Pages, and Google Docs."
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
                        {h.pageCount} pages · {h.wordCount} words · {formatBytes(h.pdfBytes)} → {formatBytes(h.rtfBytes)} · {new Date(h.convertedAt).toLocaleString()}
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
            <strong className="text-foreground">Privacy:</strong> all PDF parsing and RTF generation runs in your browser. File contents never leave your device.
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
