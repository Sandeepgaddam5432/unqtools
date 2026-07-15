"use client";
import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorBanner, EmptyState, ShareButton } from "../../_shared";
import { toast } from "sonner";
import {
  convertLitToEpub, formatBytes,
  DEFAULT_OPTIONS,
  loadHistory, saveToHistory, clearHistory, buildShareUrl,
  type LitConvertOptions, type LitConvertResult, type HistoryEntry,
} from "./logic";
import {
  Upload, FileText, Download, History, BarChart3, Settings, BookOpen,
} from "lucide-react";

export default function LitToEpubConverter() {
  const [opts, setOpts] = useState<LitConvertOptions>(DEFAULT_OPTIONS);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LitConvertResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const [showHistory, setShowHistory] = useState(false);
  const [fileName, setFileName] = useState("");
  const [litBytes, setLitBytes] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleConvert = useCallback(async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0]!;
    setError(null);
    setWorking(true);
    setFileName(file.name);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      setLitBytes(bytes.length);
      const result = await convertLitToEpub(bytes, opts, file.name.replace(/\.lit$/i, "") + ".epub");
      if (!result.ok) {
        setError(result.error);
        setResult(null);
        setWorking(false);
        return;
      }
      setResult(result.output);
      setHistory(saveToHistory({
        fileName: file.name,
        litBytes: bytes.length,
        epubBytes: result.output.stats.epubBytes,
        sectionCount: result.output.stats.sectionCount,
        chapterCount: result.output.stats.chapterCount,
        wordCount: result.output.stats.wordCount,
        convertedAt: new Date().toISOString(),
      }));
      toast.success(`Converted ${file.name} to EPUB (${result.output.stats.chapterCount} chapters)`);
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
                onChange={(e) => setOpts({ ...opts, fontSize: Number(e.target.value) })}
                className="text-sm"
              />
            </div>
            <div>
              <Label className="text-[10px]">Chapter mode</Label>
              <select
                value={opts.chapterMode}
                onChange={(e) => setOpts({ ...opts, chapterMode: e.target.value as typeof opts.chapterMode })}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm cursor-pointer"
              >
                <option value="heading">Split by headings</option>
                <option value="page">One per section</option>
                <option value="single">Single chapter</option>
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
            accept=".lit,application/x-ms-reader"
            onChange={(e) => handleConvert(e.target.files)}
            className="hidden"
            id="lit-input"
            aria-label="Choose a .lit file"
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
            <p className="text-sm font-medium">Drop a .lit file here or click to browse</p>
            <p className="mt-1 text-xs text-muted-foreground">Pure-JS LIT parser · EPUB 3 + NCX TOC · DRM-free files only</p>
          </button>
        </CardContent>
      </Card>

      {working && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            Converting LIT to EPUB…
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
                    <Download className="h-3.5 w-3.5" /> Download .epub
                  </button>
                  <ShareButton getUrl={() => buildShareUrl(opts)} label="Share" size="sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2 text-xs">
                <Stat label="Sections" value={String(result.stats.sectionCount)} />
                <Stat label="Chapters" value={String(result.stats.chapterCount)} icon={<BarChart3 className="h-3 w-3" />} accent />
                <Stat label="Words" value={String(result.stats.wordCount)} />
                <Stat label="Chars" value={String(result.stats.charCount)} />
                <Stat label="EPUB size" value={formatBytes(result.stats.epubBytes)} />
              </div>
              {result.stats.compressedSectionCount > 0 && (
                <p className="text-[10px] text-amber-600 dark:text-amber-400">
                  {result.stats.compressedSectionCount} compressed section(s) skipped (LZX not supported).
                </p>
              )}
            </CardContent>
          </Card>

          {result.chapters[0] && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <Label className="text-sm font-semibold">First chapter preview</Label>
                <div className="text-xs text-muted-foreground">
                  <strong>{result.chapters[0].title}</strong> · {result.chapters[0].wordCount} words
                </div>
                <div className="max-h-[300px] overflow-y-auto rounded-md border p-3 bg-muted/30">
                  <pre className="text-[10px] whitespace-pre-wrap font-mono">
                    {result.chapters[0].bodyHtml.slice(0, 2000)}
                    {result.chapters[0].bodyHtml.length > 2000 ? "\n…(truncated)" : ""}
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
          title="Convert LIT to EPUB"
          hint="Pure-JS LIT (Microsoft Reader) parser + EPUB 3 generator. DRM-free files only. Detects chapters by heading. NCX + NAV TOC."
          icon={<BookOpen className="h-8 w-8" />}
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
                        {h.sectionCount} sections · {h.chapterCount} chapters · {h.wordCount} words · {formatBytes(h.litBytes)} → {formatBytes(h.epubBytes)} · {new Date(h.convertedAt).toLocaleString()}
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
            <strong className="text-foreground">Privacy:</strong> all LIT parsing and EPUB generation runs in your browser. File contents never leave your device.
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
