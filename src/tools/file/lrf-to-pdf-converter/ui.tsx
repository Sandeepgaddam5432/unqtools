"use client";
import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, EmptyState, ShareButton } from "../../_shared";
import { toast } from "sonner";
import {
  convertLrfToPdf, formatBytes,
  DEFAULT_OPTIONS,
  loadHistory, saveToHistory, clearHistory, buildShareUrl,
  type LrfConvertOptions, type LrfConvertResult, type HistoryEntry,
  type LrfPdfPageSize, type LrfPdfOrientation,
} from "./logic";
import {
  Upload, FileText, Download, History, BarChart3, Settings,
} from "lucide-react";

const PAGE_SIZES: Array<{ value: LrfPdfPageSize; label: string }> = [
  { value: "letter", label: "US Letter (8.5×11in)" },
  { value: "a4", label: "A4 (210×297mm)" },
];
const ORIENTATIONS: Array<{ value: LrfPdfOrientation; label: string }> = [
  { value: "portrait", label: "Portrait" },
  { value: "landscape", label: "Landscape" },
];

export default function LrfToPdfConverter() {
  const [opts, setOpts] = useState<LrfConvertOptions>(DEFAULT_OPTIONS);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LrfConvertResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const [showHistory, setShowHistory] = useState(false);
  const [fileName, setFileName] = useState("");
  const [lrfBytes, setLrfBytes] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleConvert = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      const file = fileList[0]!;
      setError(null);
      setWorking(true);
      setFileName(file.name);
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        setLrfBytes(bytes.length);
        const outName = file.name.replace(/\.lrf$/i, "") + ".pdf";
        const result = await convertLrfToPdf(bytes, opts, outName);
        if (!result.ok) {
          setError(result.error);
          setResult(null);
          setWorking(false);
          return;
        }
        setResult(result.output);
        setHistory(
          saveToHistory({
            fileName: file.name,
            lrfBytes: bytes.length,
            pdfBytes: result.output.stats.epubBytes,
            objectCount: result.output.stats.objectCount,
            chapterCount: result.output.stats.chapterCount,
            wordCount: result.output.stats.wordCount,
            pageCount: result.output.stats.pageCount,
            convertedAt: new Date().toISOString(),
          }),
        );
        toast.success(
          `Converted ${file.name} to PDF (${result.output.stats.chapterCount} chapters, ${result.output.stats.pageCount} pages)`,
        );
      } catch (e) {
        setError(`${file.name}: ${(e as Error).message}`);
      } finally {
        setWorking(false);
      }
    },
    [opts],
  );

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
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold flex items-center gap-1.5">
            <Settings className="h-3.5 w-3.5" /> Conversion Options
          </Label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <Label className="text-[10px]">Title (defaults to LRF title)</Label>
              <Input
                value={opts.title}
                onChange={(e) => setOpts({ ...opts, title: e.target.value })}
                className="text-sm"
              />
            </div>
            <div>
              <Label className="text-[10px]">Author (defaults to LRF author)</Label>
              <Input
                value={opts.author}
                onChange={(e) => setOpts({ ...opts, author: e.target.value })}
                className="text-sm"
              />
            </div>
            <div>
              <Label className="text-[10px]">Language</Label>
              <Input
                value={opts.language}
                onChange={(e) => setOpts({ ...opts, language: e.target.value })}
                className="text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <div>
              <Label className="text-[10px]">Page size</Label>
              <select
                value={opts.pageSize}
                onChange={(e) => setOpts({ ...opts, pageSize: e.target.value as LrfPdfPageSize })}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm cursor-pointer"
              >
                {PAGE_SIZES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-[10px]">Orientation</Label>
              <select
                value={opts.orientation}
                onChange={(e) => setOpts({ ...opts, orientation: e.target.value as LrfPdfOrientation })}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm cursor-pointer"
              >
                {ORIENTATIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-[10px]">Font size (pt)</Label>
              <Input
                type="number"
                min={8}
                max={24}
                value={opts.fontSize}
                onChange={(e) =>
                  setOpts({
                    ...opts,
                    fontSize: Math.max(8, Math.min(24, Number(e.target.value) || 12)),
                  })
                }
                className="text-sm"
              />
            </div>
            <div>
              <Label className="text-[10px]">Margin (pt)</Label>
              <Input
                type="number"
                min={20}
                max={100}
                value={opts.margin}
                onChange={(e) =>
                  setOpts({ ...opts, margin: Math.max(20, Number(e.target.value) || 50) })
                }
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
            accept=".lrf,application/x-sony-bbeb"
            onChange={(e) => handleConvert(e.target.files)}
            className="hidden"
            id="lrf-input"
            aria-label="Choose a .lrf file"
            ref={fileInputRef}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleConvert(e.dataTransfer.files);
            }}
            className="w-full rounded-xl border-2 border-dashed border-border p-8 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer"
          >
            <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Drop a .lrf file here or click to browse</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Pure-JS LRF parser · 'LRF' signature · object table · TEXT object extraction · pdf-lib
            </p>
          </button>
        </CardContent>
      </Card>

      {working && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            Converting LRF to PDF…
          </CardContent>
        </Card>
      )}

      {result && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <Label className="text-sm font-semibold truncate">{fileName}</Label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 h-8 px-3 text-xs cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" /> Download .pdf
                  </button>
                  <ShareButton getUrl={() => buildShareUrl(opts)} label="Share" size="sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Objects" value={String(result.stats.objectCount)} />
                <Stat
                  label="Chapters"
                  value={String(result.stats.chapterCount)}
                  icon={<BarChart3 className="h-3 w-3" />}
                  accent
                />
                <Stat label="Words" value={String(result.stats.wordCount)} />
                <Stat label="Pages" value={String(result.stats.pageCount)} />
              </div>
              {result.stats.textObjectCount === 0 && (
                <p className="text-[10px] text-amber-600 dark:text-amber-400">
                  No TEXT objects found — LRF may use compressed objects (Sony zlib variant, not
                  supported in pure JS).
                </p>
              )}
              <div className="text-[10px] text-muted-foreground">
                LRF size: {formatBytes(lrfBytes)} → PDF size:{" "}
                {formatBytes(result.stats.epubBytes)}
              </div>
            </CardContent>
          </Card>

          {result.previewText && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <Label className="text-sm font-semibold">First chapter preview</Label>
                <div className="max-h-[200px] overflow-y-auto rounded-md border p-3 bg-muted/30">
                  <pre className="text-[10px] whitespace-pre-wrap font-mono">
                    {result.previewText.slice(0, 2000)}
                    {result.previewText.length > 2000 ? "\n…(truncated)" : ""}
                  </pre>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {error && <ErrorBanner message={error} />}

      {!result && !error && !working && (
        <EmptyState
          title="Convert LRF to PDF"
          hint="Pure-JS LRF (Sony BroadBook) parser + pdf-lib PDF generator. Extracts text from uncompressed TEXT objects. Detects chapters by heading. 'LRF' signature."
          icon={<FileText className="h-8 w-8" />}
        />
      )}

      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className="text-xs text-muted-foreground hover:text-foreground cursor-pointer inline-flex items-center gap-1"
            >
              <History className="h-3 w-3" /> History ({history.length})
            </button>
            <Badge variant="outline" className="text-[10px]">localStorage · max 10</Badge>
          </div>
          {showHistory && (
            <>
              {history.length === 0 ? (
                <p className="text-xs text-muted-foreground">No history yet.</p>
              ) : (
                <div className="space-y-1 max-h-[200px] overflow-y-auto">
                  {history.map((h, i) => (
                    <div key={i} className="text-xs py-1 border-b border-border/40 last:border-0">
                      <p className="font-medium truncate">{h.fileName}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {h.objectCount} objects · {h.chapterCount} chapters · {h.wordCount} words ·{" "}
                        {h.pageCount} pages · {formatBytes(h.lrfBytes)} →{" "}
                        {formatBytes(h.pdfBytes)} · {new Date(h.convertedAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      clearHistory();
                      setHistory([]);
                    }}
                    className="text-[10px] text-red-600 hover:underline cursor-pointer mt-1"
                  >
                    Clear history
                  </button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all LRF parsing and PDF generation
            runs in your browser using pure JavaScript + pdf-lib. File contents never leave your
            device. Compressed LRF objects (Sony zlib variant) are not supported — we only extract
            text from uncompressed TEXT objects.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="rounded-md border p-2">
      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
        {icon}
        {label}
      </p>
      <p
        className={`text-sm font-mono font-semibold ${accent ? "text-emerald-600 dark:text-emerald-400" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}
