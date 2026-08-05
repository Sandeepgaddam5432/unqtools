"use client";
import React, { useState, useCallback, useMemo, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, EmptyState, ShareButton } from "../../_shared";
import { toast } from "sonner";
import {
  convertPsToPdf, parsePostscript, formatBytes,
  DEFAULT_OPTIONS,
  loadHistory, saveToHistory, clearHistory,
  buildShareUrl,
  type HistoryEntry, type PsOptions, type PsFont, type PsPageSize, type PsParseResult,
} from "./logic";
import {
  Upload, FileText, Download, History, BarChart3, X, Eye,
} from "lucide-react";

interface InputFile {
  fileName: string;
  size: number;
  source: string;
  parse: PsParseResult;
}

interface OutputResult {
  fileName: string;
  blob: Blob;
  size: number;
}

export default function PostscriptToPdfConverter() {
  const [inputs, setInputs] = useState<InputFile[]>([]);
  const [options, setOptions] = useState<PsOptions>(DEFAULT_OPTIONS);
  const [working, setWorking] = useState(false);
  const [result, setResult] = useState<OutputResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const [showHistory, setShowHistory] = useState(false);
  const [showPreview, setShowPreview] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setError(null);
    const newInputs: InputFile[] = [];
    for (const file of Array.from(fileList)) {
      try {
        const text = await file.text();
        const parse = parsePostscript(text);
        newInputs.push({ fileName: file.name, size: file.size, source: text, parse });
      } catch (e) {
        setError(`Failed to read ${file.name}: ${(e as Error).message}`);
      }
    }
    setInputs((prev) => [...prev, ...newInputs]);
    setResult(null);
  }, []);

  const removeInput = useCallback((index: number) => {
    setInputs((prev) => prev.filter((_, i) => i !== index));
    setResult(null);
  }, []);

  const convert = useCallback(async () => {
    if (inputs.length === 0) return;
    setWorking(true);
    setError(null);
    try {
      const inp = inputs[0]!;
      const r = await convertPsToPdf(inp.source, options, inp.fileName.replace(/\.ps$/i, "") + ".pdf");
      const blob = new Blob([r.pdfBytes as BlobPart], { type: "application/pdf" });
      setResult({ fileName: r.fileName, blob, size: r.pdfSize });
      setHistory(saveToHistory({
        fileName: inp.fileName,
        pageCount: r.parse.pageCount,
        wordCount: r.parse.wordCount,
        pdfSize: r.pdfSize,
        convertedAt: new Date().toISOString(),
      }));
      toast.success(`Converted ${r.fileName} — ${r.parse.pageCount} page${r.parse.pageCount === 1 ? "" : "s"}, ${formatBytes(r.pdfSize)}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking(false);
    }
  }, [inputs, options]);

  const download = useCallback(() => {
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

  const totalPages = useMemo(() => inputs.reduce((s, i) => s + i.parse.pageCount, 0), [inputs]);
  const totalWords = useMemo(() => inputs.reduce((s, i) => s + i.parse.wordCount, 0), [inputs]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold">PDF options</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Font</Label>
              <select
                value={options.font}
                onChange={(e) => setOptions({ ...options, font: e.target.value as PsFont })}
                className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm cursor-pointer"
                aria-label="Font family"
              >
                <option value="Helvetica">Helvetica</option>
                <option value="Times-Roman">Times-Roman</option>
                <option value="Courier">Courier</option>
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Font size (pt)</Label>
              <Input
                type="number"
                min={8} max={24}
                value={options.fontSize}
                onChange={(e) => setOptions({ ...options, fontSize: Number(e.target.value) })}
                aria-label="Font size"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Page size</Label>
              <select
                value={options.pageSize}
                onChange={(e) => setOptions({ ...options, pageSize: e.target.value as PsPageSize })}
                className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm cursor-pointer"
                aria-label="Page size"
              >
                <option value="a4">A4 (595×842 pt)</option>
                <option value="letter">Letter (612×792 pt)</option>
                <option value="legal">Legal (612×1008 pt)</option>
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Margin (pt)</Label>
              <Input
                type="number"
                min={0} max={100}
                value={options.margin}
                onChange={(e) => setOptions({ ...options, margin: Number(e.target.value) })}
                aria-label="Margin"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <ShareButton
              getUrl={() => buildShareUrl({ font: options.font, fontSize: options.fontSize, pageSize: options.pageSize, margin: options.margin })}
              label="Share options"
              size="sm"
            />
            <Badge variant="outline" className="text-[10px]">
              Text-only rendering (no vector graphics)
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <input
            type="file"
            multiple
            accept=".ps,.eps,application/postscript"
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
            id="ps-input"
            aria-label="Choose .ps files to convert"
            ref={fileInputRef}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
            className="w-full rounded-xl border-2 border-dashed border-border p-8 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer"
          >
            <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Drop .ps / .eps files here or click to browse</p>
            <p className="mt-1 text-xs text-muted-foreground">PS text extractor · showpage detection · %%Page: DSC parsing · pdf-lib renderer</p>
          </button>
        </CardContent>
      </Card>

      {inputs.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">
                Input files ({inputs.length}) · {totalPages} page{totalPages === 1 ? "" : "s"} · {totalWords} word{totalWords === 1 ? "" : "s"}
              </Label>
              <button
                type="button"
                onClick={() => { setInputs([]); setResult(null); }}
                className="text-[10px] text-red-600 hover:underline cursor-pointer"
              >
                Clear all
              </button>
            </div>
            <div className="space-y-2">
              {inputs.map((inp, i) => (
                <div key={i} className="rounded-md border p-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <p className="text-xs font-medium truncate">{inp.fileName}</p>
                      <Badge variant="outline" className="text-[10px]">{formatBytes(inp.size)}</Badge>
                      {inp.parse.hasPsHeader ? (
                        <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30">%!PS</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/30">no %!PS header</Badge>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setShowPreview(showPreview === i ? null : i)}
                        className="p-1 rounded-md hover:bg-accent cursor-pointer"
                        aria-label={`Preview ${inp.fileName}`}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeInput(i)}
                        className="p-1 rounded-md hover:bg-accent cursor-pointer"
                        aria-label={`Remove ${inp.fileName}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
                    <Badge variant="outline" className="text-[9px]">{inp.parse.pageCount} page{inp.parse.pageCount === 1 ? "" : "s"}</Badge>
                    <Badge variant="outline" className="text-[9px]">{inp.parse.wordCount} words</Badge>
                    <Badge variant="outline" className="text-[9px]">{inp.parse.charCount} chars</Badge>
                    {inp.parse.boundingBox && (
                      <Badge variant="outline" className="text-[9px]">BBox: {inp.parse.boundingBox.join(" ")}</Badge>
                    )}
                    {inp.parse.unrecognizedCommandCount > 0 && (
                      <Badge variant="outline" className="text-[9px] text-amber-600 border-amber-500/30">
                        {inp.parse.unrecognizedCommandCount} unrecognized ops
                      </Badge>
                    )}
                  </div>
                  {showPreview === i && (
                    <pre className="mt-2 text-[10px] font-mono bg-muted/40 p-2 rounded-md overflow-x-auto max-h-[200px] overflow-y-auto whitespace-pre-wrap">
                      {inp.parse.pages.map((p, pi) => `[Page ${p.pageNumber}${p.label ? ` (${p.label})` : ""}]\n${p.textLines.join("\n") || "(no text)"}`).join("\n\n")}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {inputs.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <Label className="text-sm font-semibold">Convert & download</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={convert}
                  disabled={working}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground h-8 px-3 text-xs hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
                >
                  {working ? "Converting..." : "Convert to PDF"}
                </button>
                {result && (
                  <button
                    type="button"
                    onClick={download}
                    className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background hover:bg-accent h-8 px-3 text-xs cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" /> Download
                  </button>
                )}
              </div>
            </div>
            {result && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="PDF size" value={formatBytes(result.size)} icon={<BarChart3 className="h-3 w-3" />} />
                <Stat label="Pages" value={String(inputs[0]?.parse.pageCount ?? 0)} />
                <Stat label="Words" value={String(inputs[0]?.parse.wordCount ?? 0)} />
                <Stat label="Font" value={options.font} />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {error && <ErrorBanner message={error} />}

      {inputs.length === 0 && !error && !working && (
        <EmptyState
          title="Convert PostScript to PDF"
          hint="Parses showpage, moveto, show commands. Renders text to PDF via pdf-lib. Honest about vector graphics limitation."
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
                        {h.pageCount} page{h.pageCount === 1 ? "" : "s"} · {h.wordCount} words · {formatBytes(h.pdfSize)} · {new Date(h.convertedAt).toLocaleString()}
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
            <strong className="text-foreground">Privacy + Honesty:</strong> all PS parsing, text extraction, and PDF rendering runs in your browser using pure JavaScript + pdf-lib. File contents never leave your device. This tool extracts text from <code className="text-[10px]">show</code> operators and renders it as PDF text. Vector graphics (lineto, curveto, arc), images (image operator), and complex font metrics are NOT supported — for faithful PS rendering use Ghostscript. Only conversion summaries (filename + page count) are saved to local history.
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
