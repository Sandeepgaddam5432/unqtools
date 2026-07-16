"use client";
import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, EmptyState, ShareButton } from "../../_shared";
import { toast } from "sonner";
import {
  convertPagesToPdf, formatBytes,
  DEFAULT_OPTIONS,
  loadHistory, saveToHistory, clearHistory, buildShareUrl,
  type PagesConvertOptions, type PagesConvertResult, type HistoryEntry,
  type PagesPageSize, type PagesOrientation,
} from "./logic";
import {
  Upload, FileText, Download, History, BarChart3, Settings, AlertTriangle, CheckCircle2,
} from "lucide-react";

const PAGE_SIZES: Array<{ value: PagesPageSize; label: string }> = [
  { value: "letter", label: "US Letter (8.5×11in)" },
  { value: "a4", label: "A4 (210×297mm)" },
];
const ORIENTATIONS: Array<{ value: PagesOrientation; label: string }> = [
  { value: "portrait", label: "Portrait" },
  { value: "landscape", label: "Landscape" },
];

export default function PagesToPdfConverter() {
  const [opts, setOpts] = useState<PagesConvertOptions>(DEFAULT_OPTIONS);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PagesConvertResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const [showHistory, setShowHistory] = useState(false);
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        const outName = file.name.replace(/\.pages$/i, "") + ".pdf";
        const result = await convertPagesToPdf(bytes, opts, outName);
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
            pageCount: result.output.pageCount,
            wordCount: result.output.wordCount,
            title: result.output.metadata.title,
            usedEmbeddedPdf: result.output.usedEmbeddedPdf,
            pdfBytes: result.output.pdfBytes,
            convertedAt: new Date().toISOString(),
          }),
        );
        if (result.output.previewImage) {
          const blob = new Blob([result.output.previewImage as BlobPart], { type: "image/jpeg" });
          setPreviewUrl(URL.createObjectURL(blob));
        } else {
          setPreviewUrl(null);
        }
        toast.success(
          result.output.usedEmbeddedPdf
            ? `Extracted Apple's embedded preview.pdf from ${file.name} (${result.output.pageCount} pages, 1:1 layout)`
            : `Converted ${file.name} to PDF (text-only, ${result.output.wordCount} words)`,
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
            <Settings className="h-3.5 w-3.5" /> Conversion Options (used for text re-rendering)
          </Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px]">Page size</Label>
              <select
                value={opts.pageSize}
                onChange={(e) => setOpts({ ...opts, pageSize: e.target.value as PagesPageSize })}
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
                onChange={(e) =>
                  setOpts({ ...opts, orientation: e.target.value as PagesOrientation })
                }
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
          <p className="text-[10px] text-muted-foreground">
            Note: when an embedded preview.pdf is present, these options are ignored — Apple&apos;s
            1:1 layout-faithful PDF is used directly.
          </p>
        </CardContent>
      </Card>

      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-700 dark:text-amber-400">
              <p className="font-semibold mb-1">Honesty clause — layout fidelity varies</p>
              <p>
                Pages files often contain Apple&apos;s own{" "}
                <code className="font-mono">preview.pdf</code> (1:1 layout). When present, we extract
                it directly — perfect fidelity. When <strong>not</strong> present, we extract text
                from Document.iwa using a heuristic (scan for printable UTF-8 sequences) and re-render
                as a fresh PDF — body text is preserved, but formatting (bold, italics, columns,
                images) is lost. For layout-perfect output, use Apple Pages or iCloud web Pages.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <input
            type="file"
            accept=".pages,application/vnd.apple.pages,application/zip"
            onChange={(e) => handleConvert(e.target.files)}
            className="hidden"
            id="pages-input"
            aria-label="Choose a .pages file"
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
            <p className="text-sm font-medium">Drop a .pages file here or click to browse</p>
            <p className="mt-1 text-xs text-muted-foreground">
              ZIP parser · preview.pdf extraction (1:1) · Document.iwa text extraction · pdf-lib
            </p>
          </button>
        </CardContent>
      </Card>

      {working && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            Converting Pages to PDF…
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
              {result.usedEmbeddedPdf ? (
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Used Apple&apos;s embedded preview.pdf — 1:1 layout fidelity preserved</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>Re-rendered from extracted text — layout fidelity may be reduced</span>
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat
                  label="Pages"
                  value={String(result.pageCount)}
                  icon={<BarChart3 className="h-3 w-3" />}
                  accent
                />
                <Stat label="File size" value={formatBytes(fileSize)} />
                <Stat label="PDF size" value={formatBytes(result.pdfBytes)} />
                <Stat
                  label="Words"
                  value={result.usedEmbeddedPdf ? "N/A" : String(result.wordCount)}
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

          {result.extractedText && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <Label className="text-sm font-semibold">Extracted text preview</Label>
                <div className="max-h-[200px] overflow-y-auto rounded-md border p-3 bg-muted/30">
                  <pre className="text-[10px] whitespace-pre-wrap font-mono">
                    {result.extractedText.slice(0, 2000)}
                    {result.extractedText.length > 2000 ? "\n…(truncated)" : ""}
                  </pre>
                </div>
              </CardContent>
            </Card>
          )}

          {previewUrl && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <Label className="text-sm font-semibold">Preview (from preview.jpg)</Label>
                <img
                  src={previewUrl}
                  alt="Document preview"
                  className="max-h-[300px] mx-auto rounded-md border"
                />
              </CardContent>
            </Card>
          )}
        </>
      )}

      {error && <ErrorBanner message={error} />}

      {!result && !error && !working && (
        <EmptyState
          title="Convert Pages to PDF"
          hint="Pure-JS ZIP parser + pdf-lib. Extracts embedded preview.pdf (1:1) when present, otherwise extracts text from Document.iwa and re-renders as PDF."
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
                        {h.pageCount} pages · {h.usedEmbeddedPdf ? "embedded PDF (1:1)" : `re-rendered (${h.wordCount} words)`}{" "}
                        · {formatBytes(h.fileSize)} → {formatBytes(h.pdfBytes)} ·{" "}
                        {new Date(h.convertedAt).toLocaleString()}
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
            preview.pdf extraction, text extraction, and PDF generation runs in your browser using
            pure JavaScript + pdf-lib. File contents never leave your device. When preview.pdf is
            absent, layout fidelity is reduced (text-only re-rendering). For full fidelity, use
            Apple Pages or iCloud web Pages.
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
