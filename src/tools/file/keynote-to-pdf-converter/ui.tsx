"use client";
import React, { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, EmptyState, ShareButton } from "../../_shared";
import { toast } from "sonner";
import {
  convertKeynoteToPdf, formatBytes,
  DEFAULT_OPTIONS,
  loadHistory, saveToHistory, clearHistory, buildShareUrl,
  type KeynoteConvertOptions, type KeynoteConvertResult, type HistoryEntry,
  type KeynotePageSize,
} from "./logic";
import {
  Upload, Presentation, Download, History, BarChart3, Settings, AlertTriangle,
} from "lucide-react";

const PAGE_SIZES: Array<{ value: KeynotePageSize; label: string }> = [
  { value: "16:9", label: "16:9 Widescreen (1920×1080)" },
  { value: "4:3", label: "4:3 Classic (1024×768)" },
  { value: "letter", label: "Letter portrait (8.5×11in)" },
];

export default function KeynoteToPdfConverter() {
  const [opts, setOpts] = useState<KeynoteConvertOptions>(DEFAULT_OPTIONS);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<KeynoteConvertResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const [showHistory, setShowHistory] = useState(false);
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleConvert = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      const file = fileList[0]!;
      setError(null);
      setWorking(true);
      setFileName(file.name);
      setFileSize(file.size);
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const outName = file.name.replace(/\.key$/i, "") + ".pdf";
        const result = await convertKeynoteToPdf(bytes, opts, outName);
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
            fileSize: file.size,
            slideCount: result.output.slideCount,
            title: result.output.metadata.title,
            pdfBytes: result.output.pdfBytes,
            convertedAt: new Date().toISOString(),
          }),
        );
        // Build preview URL if preview.jpg was extracted
        if (result.output.previewImage) {
          const blob = new Blob([result.output.previewImage as BlobPart], { type: "image/jpeg" });
          setPreviewUrl(URL.createObjectURL(blob));
        } else {
          setPreviewUrl(null);
        }
        toast.success(
          `Converted ${file.name} to PDF (${result.output.slideCount} slide${result.output.slideCount === 1 ? "" : "s"})`,
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px]">Page size</Label>
              <select
                value={opts.pageSize}
                onChange={(e) => setOpts({ ...opts, pageSize: e.target.value as KeynotePageSize })}
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
              <Label className="text-[10px]">Custom title (optional)</Label>
              <Input
                value={opts.title}
                onChange={(e) => setOpts({ ...opts, title: e.target.value })}
                className="text-sm"
                placeholder="Use Keynote title"
              />
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <label className="inline-flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={opts.includeSlideNumbers}
                onChange={(e) => setOpts({ ...opts, includeSlideNumbers: e.target.checked })}
              />
              <span>Include slide numbers</span>
            </label>
            <label className="inline-flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={opts.includeTitlePage}
                onChange={(e) => setOpts({ ...opts, includeTitlePage: e.target.checked })}
              />
              <span>Include title page</span>
            </label>
          </div>
        </CardContent>
      </Card>

      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-700 dark:text-amber-400">
              <p className="font-semibold mb-1">Honesty clause — actual slide content is not rendered</p>
              <p>
                Keynote&apos;s slide content lives inside .iwa files (Snappy-compressed Protocol
                Buffers with Apple&apos;s undocumented schema). We extract metadata.json for the
                slide count + title, parse preview.jpg for a thumbnail, and generate a PDF with
                <strong> placeholder slides</strong> showing the title and slide numbers. For full
                slide rendering, use Apple Keynote (macOS) or iCloud.com web Keynote to export to
                PDF.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <input
            type="file"
            accept=".key,application/vnd.apple.keynote,application/zip"
            onChange={(e) => handleConvert(e.target.files)}
            className="hidden"
            id="key-input"
            aria-label="Choose a .key file"
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
            <p className="text-sm font-medium">Drop a .key file here or click to browse</p>
            <p className="mt-1 text-xs text-muted-foreground">
              ZIP parser · metadata.json extraction · preview.jpg · placeholder PDF via pdf-lib
            </p>
          </button>
        </CardContent>
      </Card>

      {working && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            Converting Keynote to PDF…
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
                <Stat
                  label="Slides"
                  value={String(result.slideCount)}
                  icon={<BarChart3 className="h-3 w-3" />}
                  accent
                />
                <Stat label="File size" value={formatBytes(fileSize)} />
                <Stat label="PDF size" value={formatBytes(result.pdfBytes)} />
                <Stat
                  label="Slide dimensions"
                  value={`${result.metadata.width}×${result.metadata.height}`}
                />
              </div>
              {result.metadata.title && (
                <div className="text-xs">
                  <span className="text-muted-foreground">Title:</span>{" "}
                  <span className="font-medium">{result.metadata.title}</span>
                  {result.metadata.author && (
                    <>
                      {" · "}
                      <span className="text-muted-foreground">Author:</span>{" "}
                      <span className="font-medium">{result.metadata.author}</span>
                    </>
                  )}
                  {result.metadata.generatorVersion && (
                    <>
                      {" · "}
                      <span className="text-muted-foreground">Generator:</span>{" "}
                      <span className="font-medium">{result.metadata.generatorVersion}</span>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {previewUrl && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <Label className="text-sm font-semibold">Preview (from preview.jpg)</Label>
                <img
                  src={previewUrl}
                  alt="First slide preview"
                  className="max-h-[300px] mx-auto rounded-md border"
                />
                <p className="text-[10px] text-muted-foreground">
                  Apple includes this thumbnail in every Keynote file. The full slide content
                  (text, images, animations) is in proprietary .iwa files we cannot decode.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {error && <ErrorBanner message={error} />}

      {!result && !error && !working && (
        <EmptyState
          title="Convert Keynote to PDF"
          hint="Pure-JS ZIP parser + pdf-lib. Extracts metadata.json for slide count + title, parses preview.jpg, generates a placeholder PDF. Honest disclaimer about .iwa content rendering."
          icon={<Presentation className="h-8 w-8" />}
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
                        {h.slideCount} slide{h.slideCount === 1 ? "" : "s"} ·{" "}
                        {h.title || "(no title)"} · {formatBytes(h.fileSize)} →{" "}
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
            <strong className="text-foreground">Privacy + Honesty:</strong> all ZIP parsing,
            metadata extraction, and PDF generation runs in your browser using pure JavaScript +
            pdf-lib. File contents never leave your device. This tool does NOT render actual slide
            content — the .iwa files use Snappy-compressed Protocol Buffers with an undocumented
            schema. For full rendering, use Apple Keynote or iCloud web Keynote.
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
