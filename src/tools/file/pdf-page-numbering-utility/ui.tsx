"use client";
import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, EmptyState, ShareButton } from "../../_shared";
import { toast } from "sonner";
import {
  addPageNumbers, formatBytes, isValidHexColor,
  DEFAULT_OPTIONS,
  loadHistory, saveToHistory, clearHistory, buildShareUrl,
  type PageNumberOptions, type PageNumberResult, type HistoryEntry,
  type NumberFormat, type NumberPosition,
} from "./logic";
import {
  Upload, FileText, Download, History, BarChart3, Settings, Hash,
} from "lucide-react";

const POSITIONS: NumberPosition[] = [
  "top-left", "top-center", "top-right",
  "middle-left", "middle-center", "middle-right",
  "bottom-left", "bottom-center", "bottom-right",
];
const FORMATS: Array<{ value: NumberFormat; label: string }> = [
  { value: "arabic", label: "Arabic (1, 2, 3)" },
  { value: "roman-lower", label: "Roman lower (i, ii, iii)" },
  { value: "roman-upper", label: "Roman upper (I, II, III)" },
  { value: "alpha-lower", label: "Alpha lower (a, b, c)" },
  { value: "alpha-upper", label: "Alpha upper (A, B, C)" },
  { value: "custom", label: "Custom template" },
];

export default function PdfPageNumberingUtility() {
  const [opts, setOpts] = useState<PageNumberOptions>(DEFAULT_OPTIONS);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PageNumberResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const [showHistory, setShowHistory] = useState(false);
  const [fileName, setFileName] = useState("");
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
        const outName = file.name.replace(/\.pdf$/i, "") + "-numbered.pdf";
        const result = await addPageNumbers(bytes, opts, outName);
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
            pageCount: result.output.pageCount,
            numberedCount: result.output.numberedCount,
            format: opts.format,
            position: opts.position,
            pdfBytes: result.output.pdfBytes,
            convertedAt: new Date().toISOString(),
          }),
        );
        toast.success(
          `Numbered ${result.output.numberedCount}/${result.output.pageCount} pages in ${file.name}`,
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

  const previewLabel = (() => {
    const num = opts.startNumber;
    const total = opts.skipPages + 3;
    const numberedTotal = total - opts.skipPages;
    if (opts.format === "custom") {
      return opts.customFormat
        .replace(/\{page\}/g, String(num))
        .replace(/\{total\}/g, String(numberedTotal));
    }
    if (opts.format === "arabic") return String(num);
    if (opts.format === "roman-lower") return "i";
    if (opts.format === "roman-upper") return "I";
    if (opts.format === "alpha-lower") return "a";
    if (opts.format === "alpha-upper") return "A";
    return String(num);
  })();

  const colorValid = isValidHexColor(opts.color);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold flex items-center gap-1.5">
            <Settings className="h-3.5 w-3.5" /> Numbering Options
          </Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px]">Position</Label>
              <select
                value={opts.position}
                onChange={(e) =>
                  setOpts({ ...opts, position: e.target.value as NumberPosition })
                }
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm cursor-pointer"
              >
                {POSITIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-[10px]">Format</Label>
              <select
                value={opts.format}
                onChange={(e) => setOpts({ ...opts, format: e.target.value as NumberFormat })}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm cursor-pointer"
              >
                {FORMATS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-[10px]">Start number</Label>
              <Input
                type="number"
                min={1}
                value={opts.startNumber}
                onChange={(e) =>
                  setOpts({ ...opts, startNumber: Math.max(1, Number(e.target.value) || 1) })
                }
                className="text-sm"
              />
            </div>
            <div>
              <Label className="text-[10px]">Skip first N pages</Label>
              <Input
                type="number"
                min={0}
                value={opts.skipPages}
                onChange={(e) =>
                  setOpts({ ...opts, skipPages: Math.max(0, Number(e.target.value) || 0) })
                }
                className="text-sm"
              />
            </div>
            <div>
              <Label className="text-[10px]">Font size (pt)</Label>
              <Input
                type="number"
                min={6}
                max={72}
                value={opts.fontSize}
                onChange={(e) =>
                  setOpts({
                    ...opts,
                    fontSize: Math.max(6, Math.min(72, Number(e.target.value) || 12)),
                  })
                }
                className="text-sm"
              />
            </div>
            <div>
              <Label className="text-[10px]">Margin (pt)</Label>
              <Input
                type="number"
                min={0}
                max={200}
                value={opts.margin}
                onChange={(e) =>
                  setOpts({ ...opts, margin: Math.max(0, Number(e.target.value) || 0) })
                }
                className="text-sm"
              />
            </div>
            <div>
              <Label className="text-[10px]">Text color (hex)</Label>
              <Input
                value={opts.color}
                onChange={(e) => setOpts({ ...opts, color: e.target.value })}
                className={`text-sm font-mono ${colorValid ? "" : "border-red-500"}`}
                placeholder="#000000"
              />
            </div>
            <div>
              <Label className="text-[10px]">Preview</Label>
              <div className="h-9 px-2 rounded-md border bg-muted/30 flex items-center justify-center text-sm font-mono">
                <Hash className="h-3 w-3 mr-1 inline" />
                {previewLabel}
              </div>
            </div>
          </div>
          {opts.format === "custom" && (
            <div>
              <Label className="text-[10px]">
                Custom template — use <code>{"{page}"}</code> for current page, <code>{"{total}"}</code> for total
              </Label>
              <Input
                value={opts.customFormat}
                onChange={(e) => setOpts({ ...opts, customFormat: e.target.value })}
                className="text-sm font-mono"
                placeholder="Page {page} of {total}"
              />
            </div>
          )}
          {!colorValid && (
            <p className="text-[10px] text-red-600">
              Invalid hex color — use #RGB or #RRGGBB format.
            </p>
          )}
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
            onDrop={(e) => {
              e.preventDefault();
              handleConvert(e.dataTransfer.files);
            }}
            className="w-full rounded-xl border-2 border-dashed border-border p-8 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer"
          >
            <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Drop a .pdf file here or click to browse</p>
            <p className="mt-1 text-xs text-muted-foreground">
              9 positions · 6 number formats (arabic/roman/alpha/custom) · skip pages · custom color · 100% client-side
            </p>
          </button>
        </CardContent>
      </Card>

      {working && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            Adding page numbers…
          </CardContent>
        </Card>
      )}

      {result && (
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
                <ShareButton getUrl={() => buildShareUrl(opts)} label="Share settings" size="sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat label="Total pages" value={String(result.pageCount)} icon={<BarChart3 className="h-3 w-3" />} />
              <Stat label="Numbered" value={String(result.numberedCount)} accent />
              <Stat label="Skipped" value={String(result.skippedCount)} />
              <Stat label="Output size" value={formatBytes(result.pdfBytes)} />
            </div>
            <div className="text-[10px] text-muted-foreground">
              Position: <code className="font-mono">{opts.position}</code> · Format:{" "}
              <code className="font-mono">{opts.format}</code> · Color:{" "}
              <code className="font-mono" style={{ color: colorValid ? opts.color : undefined }}>
                {opts.color}
              </code>
            </div>
          </CardContent>
        </Card>
      )}

      {error && <ErrorBanner message={error} />}

      {!result && !error && !working && (
        <EmptyState
          title="Add page numbers to PDF"
          hint="9 positions, 6 formats (arabic/roman/alpha/custom), skip first N pages, custom start, font size, color, margin. 100% client-side via pdf-lib."
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
                        {h.numberedCount}/{h.pageCount} pages · {h.format} · {h.position} ·{" "}
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
            <strong className="text-foreground">Privacy:</strong> all PDF parsing and page-number
            rendering happens in your browser using pdf-lib. File contents never leave your device.
            Only file summaries (filename, page count, format used) are saved to local history.
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
