"use client";
import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorBanner, EmptyState, ShareButton } from "../../_shared";
import { toast } from "sonner";
import {
  convertPdfToOdp, formatBytes,
  DEFAULT_OPTIONS,
  loadHistory, saveToHistory, clearHistory, buildShareUrl,
  type OdpOptions, type OdpResult, type HistoryEntry, type OdpLayout, type OdpRatio,
} from "./logic";
import {
  Upload, FileText, Download, History, BarChart3, Settings, Presentation,
} from "lucide-react";

export default function PdfToOdpConverter() {
  const [opts, setOpts] = useState<OdpOptions>(DEFAULT_OPTIONS);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OdpResult | null>(null);
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
      const result = await convertPdfToOdp(pdfBytes, opts, file.name.replace(/\.pdf$/i, "") + ".odp");
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
        odpBytes: result.output.odpBytes,
        slideCount: result.output.slideCount,
        wordCount: result.output.wordCount,
        convertedAt: new Date().toISOString(),
      }));
      toast.success(`Converted ${file.name} to ODP (${result.output.slideCount} slides)`);
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
              <Label className="text-[10px]">Layout</Label>
              <select
                value={opts.layout}
                onChange={(e) => setOpts({ ...opts, layout: e.target.value as OdpLayout })}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm cursor-pointer"
              >
                <option value="title-bullets">Title + Bullets</option>
                <option value="bullets-only">Bullets only</option>
              </select>
            </div>
            <div>
              <Label className="text-[10px]">Aspect ratio</Label>
              <select
                value={opts.ratio}
                onChange={(e) => setOpts({ ...opts, ratio: e.target.value as OdpRatio })}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm cursor-pointer"
              >
                <option value="16:9">16:9 (widescreen)</option>
                <option value="4:3">4:3 (standard)</option>
                <option value="a4">A4 (portrait)</option>
              </select>
            </div>
            <div>
              <Label className="text-[10px]">Font size (pt)</Label>
              <Input
                type="number"
                min={10}
                max={36}
                value={opts.fontSize}
                onChange={(e) => setOpts({ ...opts, fontSize: Number(e.target.value) })}
                className="text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <div>
              <Label className="text-[10px]">Background color</Label>
              <input
                type="color"
                value={"#" + opts.backgroundColor.replace(/^#/, "")}
                onChange={(e) => setOpts({ ...opts, backgroundColor: e.target.value.replace(/^#/, "") })}
                className="h-9 w-full rounded-md border border-input bg-background px-2 cursor-pointer"
              />
            </div>
            <div>
              <Label className="text-[10px]">Title color</Label>
              <input
                type="color"
                value={"#" + opts.titleColor.replace(/^#/, "")}
                onChange={(e) => setOpts({ ...opts, titleColor: e.target.value.replace(/^#/, "") })}
                className="h-9 w-full rounded-md border border-input bg-background px-2 cursor-pointer"
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
            <p className="mt-1 text-xs text-muted-foreground">Pure-JS PDF parser · OpenDocument Presentation generator · .odp ZIP</p>
          </button>
        </CardContent>
      </Card>

      {working && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            Converting PDF to ODP…
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
                    <Download className="h-3.5 w-3.5" /> Download .odp
                  </button>
                  <ShareButton getUrl={() => buildShareUrl(opts)} label="Share" size="sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2 text-xs">
                <Stat label="Pages" value={String(result.pageCount)} />
                <Stat label="Slides" value={String(result.slideCount)} icon={<BarChart3 className="h-3 w-3" />} accent />
                <Stat label="Words" value={String(result.wordCount)} />
                <Stat label="Chars" value={String(result.charCount)} />
                <Stat label="ODP size" value={formatBytes(result.odpBytes)} />
              </div>
            </CardContent>
          </Card>

          {result.slides[0] && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <Label className="text-sm font-semibold">First slide preview</Label>
                <div className="text-xs text-muted-foreground">
                  <strong>{result.slides[0].title || "(no title)"}</strong>
                  {result.slides[0].bullets.length > 0 && (
                    <> · {result.slides[0].bullets.length} bullet(s)</>
                  )}
                </div>
                <ul className="text-xs text-muted-foreground list-disc list-inside space-y-0.5 max-h-[200px] overflow-y-auto">
                  {result.slides[0].bullets.slice(0, 10).map((b, i) => (
                    <li key={i} className="truncate">{b}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {error && <ErrorBanner message={error} />}

      {!result && !error && !working && (
        <EmptyState
          title="Convert PDF to ODP"
          hint="Pure-JS PDF text extraction + OpenDocument Presentation generator. One slide per page. Title + bullet layout. Opens in LibreOffice Impress, OpenOffice Impress, Google Slides."
          icon={<Presentation className="h-8 w-8" />}
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
                        {h.slideCount} slides · {h.wordCount} words · {formatBytes(h.pdfBytes)} → {formatBytes(h.odpBytes)} · {new Date(h.convertedAt).toLocaleString()}
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
            <strong className="text-foreground">Privacy:</strong> all PDF parsing and ODP generation runs in your browser. File contents never leave your device.
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
