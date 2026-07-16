"use client";
import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, EmptyState, ShareButton } from "../../_shared";
import { toast } from "sonner";
import {
  convertMobiToEpub, formatBytes,
  DEFAULT_OPTIONS,
  loadHistory, saveToHistory, clearHistory, buildShareUrl,
  type MobiToEpubOptions, type MobiToEpubResult, type HistoryEntry,
} from "./logic";
import {
  Upload, Book, Download, History, BarChart3, Settings,
} from "lucide-react";

export default function MobiToEpubConverter() {
  const [opts, setOpts] = useState<MobiToEpubOptions>(DEFAULT_OPTIONS);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MobiToEpubResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const [showHistory, setShowHistory] = useState(false);
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState(0);
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
        const outName = file.name.replace(/\.mobi$/i, "") + ".epub";
        const result = await convertMobiToEpub(bytes, opts, outName);
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
            mobiBytes: file.size,
            epubBytes: result.output.epubBytes,
            chapterCount: result.output.chapterCount,
            wordCount: result.output.wordCount,
            convertedAt: new Date().toISOString(),
          }),
        );
        toast.success(
          `Converted ${file.name} to EPUB (${result.output.chapterCount} chapters, ${result.output.wordCount} words)`,
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
              <Label className="text-[10px]">Title (defaults to MOBI title)</Label>
              <Input
                value={opts.title}
                onChange={(e) => setOpts({ ...opts, title: e.target.value })}
                className="text-sm"
              />
            </div>
            <div>
              <Label className="text-[10px]">Author (defaults to MOBI author)</Label>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px]">Font size (px)</Label>
              <Input
                type="number"
                min={10}
                max={36}
                value={opts.fontSize}
                onChange={(e) =>
                  setOpts({
                    ...opts,
                    fontSize: Math.max(10, Math.min(36, Number(e.target.value) || 16)),
                  })
                }
                className="text-sm"
              />
            </div>
            <div>
              <Label className="text-[10px]">Chapter mode</Label>
              <select
                value={opts.chapterMode}
                onChange={(e) =>
                  setOpts({ ...opts, chapterMode: e.target.value as "page" | "heading" | "single" })
                }
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm cursor-pointer"
              >
                <option value="heading">Split by headings (default)</option>
                <option value="page">One per MOBI chapter</option>
                <option value="single">Single combined chapter</option>
              </select>
            </div>
          </div>
          <div>
            <Label className="text-[10px]">Custom CSS (appended to stylesheet)</Label>
            <textarea
              value={opts.customCss}
              onChange={(e) => setOpts({ ...opts, customCss: e.target.value })}
              className="w-full rounded-md border border-input bg-background p-2 text-xs font-mono h-20 resize-y"
              aria-label="Custom CSS"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <input
            type="file"
            accept=".mobi,.azw,application/x-mobipocket-ebook"
            onChange={(e) => handleConvert(e.target.files)}
            className="hidden"
            id="mobi-input"
            aria-label="Choose a .mobi file"
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
            <p className="text-sm font-medium">Drop a .mobi file here or click to browse</p>
            <p className="mt-1 text-xs text-muted-foreground">
              MOBI parser · PalmDB + PalmDOC + EXTH · EPUB 3 + NCX TOC · chapter splitting
            </p>
          </button>
        </CardContent>
      </Card>

      {working && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            Converting MOBI to EPUB…
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
                    <Download className="h-3.5 w-3.5" /> Download .epub
                  </button>
                  <ShareButton getUrl={() => buildShareUrl(opts)} label="Share" size="sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat
                  label="Chapters"
                  value={String(result.chapterCount)}
                  icon={<BarChart3 className="h-3 w-3" />}
                  accent
                />
                <Stat label="Words" value={String(result.wordCount)} />
                <Stat label="Chars" value={String(result.charCount)} />
                <Stat label="EPUB size" value={formatBytes(result.epubBytes)} />
              </div>
              <div className="text-xs">
                <span className="text-muted-foreground">Title:</span>{" "}
                <span className="font-medium">{result.metadata.title}</span>
                {" · "}
                <span className="text-muted-foreground">Author:</span>{" "}
                <span className="font-medium">{result.metadata.author}</span>
                {" · "}
                <span className="text-muted-foreground">Language:</span>{" "}
                <span className="font-medium">{result.metadata.language}</span>
                {" · "}
                <span className="text-muted-foreground">Encoding:</span>{" "}
                <span className="font-medium">{result.metadata.encoding}</span>
              </div>
              <div className="text-[10px] text-muted-foreground">
                MOBI size: {formatBytes(fileSize)} → EPUB size: {formatBytes(result.epubBytes)}
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
          title="Convert MOBI to EPUB"
          hint="Pure-JS MOBI parser + EPUB 3 generator. Parses PalmDB + MOBI + EXTH headers, decompresses PalmDOC, splits chapters, generates EPUB with NCX + NAV TOC."
          icon={<Book className="h-8 w-8" />}
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
                        {h.chapterCount} chapters · {h.wordCount} words ·{" "}
                        {formatBytes(h.mobiBytes)} → {formatBytes(h.epubBytes)} ·{" "}
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
            <strong className="text-foreground">Privacy:</strong> all MOBI parsing and EPUB
            generation runs in your browser using pure JavaScript. File contents never leave your
            device. Only file summaries (filename, chapter count, word count) are saved to local
            history. DRM-protected and HuffCDic-compressed MOBIs are not supported.
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
