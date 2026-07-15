"use client";
import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, EmptyState, ShareButton } from "../../_shared";
import { toast } from "sonner";
import {
  convertOdsToPdf, isOdsArchive, DEFAULT_OPTIONS, formatBytes,
  loadHistory, saveToHistory, clearHistory, buildShareUrl,
  type ConvertOptions, type OdsStats, type OdsMetadata, type HistoryEntry,
} from "./logic";
import {
  Upload, FileText, Download, History, BarChart3, Settings,
} from "lucide-react";

export default function OdsToPdfConverter() {
  const [opts, setOpts] = useState<ConvertOptions>(DEFAULT_OPTIONS);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<OdsStats | null>(null);
  const [metadata, setMetadata] = useState<OdsMetadata | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const [showHistory, setShowHistory] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleConvert = useCallback(async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0]!;
    setError(null);
    setWorking(true);
    try {
      const odsBytes = new Uint8Array(await file.arrayBuffer());
      if (!isOdsArchive(odsBytes)) {
        setError(`${file.name}: not an ODS file (missing ZIP signature).`);
        setWorking(false);
        return;
      }
      const result = await convertOdsToPdf(odsBytes, opts);
      if (!result.ok) {
        setError(result.error);
        setWorking(false);
        return;
      }
      setStats(result.stats);
      setMetadata(result.metadata);
      const blob = new Blob([result.output.bytes as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
      setHistory(saveToHistory({
        fileName: file.name,
        odsBytes: odsBytes.length,
        pdfBytes: result.output.bytes.length,
        sheetCount: result.stats.sheetCount,
        rowCount: result.stats.rowCount,
        convertedAt: new Date().toISOString(),
      }));
      toast.success(`Converted ${file.name} to PDF (${result.stats.pageCount} pages)`);
    } catch (e) {
      setError(`${file.name}: ${(e as Error).message}`);
    } finally {
      setWorking(false);
    }
  }, [opts]);

  const handleDownload = useCallback(() => {
    if (!pdfUrl) return;
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = "converted.pdf";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success("Downloaded converted.pdf");
  }, [pdfUrl]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold flex items-center gap-1.5">
            <Settings className="h-3.5 w-3.5" /> Options
          </Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <Label className="text-[10px]">Sheet index</Label>
              <Input
                type="number"
                min={-1}
                value={opts.sheetIndex}
                onChange={(e) => setOpts({ ...opts, sheetIndex: Number(e.target.value) })}
                className="text-sm"
              />
              <p className="text-[9px] text-muted-foreground">-1 = all sheets</p>
            </div>
            <div>
              <Label className="text-[10px]">Orientation</Label>
              <select
                value={opts.orientation}
                onChange={(e) => setOpts({ ...opts, orientation: e.target.value as ConvertOptions["orientation"] })}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm cursor-pointer"
              >
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </select>
            </div>
            <div>
              <Label className="text-[10px]">Margin (pt)</Label>
              <Input
                type="number"
                min={20}
                max={80}
                value={opts.margin}
                onChange={(e) => setOpts({ ...opts, margin: Number(e.target.value) })}
                className="text-sm"
              />
            </div>
            <div>
              <Label className="text-[10px]">Font size</Label>
              <Input
                type="number"
                min={7}
                max={14}
                value={opts.fontSize}
                onChange={(e) => setOpts({ ...opts, fontSize: Number(e.target.value) })}
                className="text-sm"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={opts.boldHeader}
              onChange={(e) => setOpts({ ...opts, boldHeader: e.target.checked })}
              className="cursor-pointer"
            />
            Bold header row
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <input
            type="file"
            accept=".ods,application/vnd.oasis.opendocument.spreadsheet"
            onChange={(e) => handleConvert(e.target.files)}
            className="hidden"
            id="ods-input"
            aria-label="Choose an .ods file"
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
            <p className="text-sm font-medium">Drop an .ods file here or click to browse</p>
            <p className="mt-1 text-xs text-muted-foreground">Pure-JS ODS parser · pdf-lib table renderer · auto-fit columns</p>
          </button>
        </CardContent>
      </Card>

      {working && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            Converting ODS to PDF…
          </CardContent>
        </Card>
      )}

      {stats && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <Label className="text-sm font-semibold">Conversion result</Label>
                <div className="flex gap-2">
                  {pdfUrl && (
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 h-8 px-3 text-xs cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5" /> Download PDF
                    </button>
                  )}
                  <ShareButton getUrl={() => buildShareUrl(opts)} label="Share" size="sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
                <Stat label="Pages" value={String(stats.pageCount)} icon={<BarChart3 className="h-3 w-3" />} accent />
                <Stat label="Sheets" value={String(stats.sheetCount)} />
                <Stat label="Rows" value={String(stats.rowCount)} />
                <Stat label="Cells" value={String(stats.cellCount)} />
                <Stat label="Max cols" value={String(stats.maxColumnCount)} />
                <Stat label="PDF size" value={formatBytes(stats.pdfBytes)} />
              </div>
            </CardContent>
          </Card>

          {metadata && metadata.metaFound && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <Label className="text-sm font-semibold">Metadata</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <Field label="Title" value={metadata.title} />
                  <Field label="Author" value={metadata.author} />
                  <Field label="Subject" value={metadata.subject} />
                  <Field label="Generator" value={metadata.generator} />
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {error && <ErrorBanner message={error} />}

      {!stats && !error && !working && (
        <EmptyState
          title="Convert ODS to PDF"
          hint="Pure-JS ODS parser + pdf-lib renderer. Extracts tables, rows, and cells from content.xml. Auto-fits column widths. Large sheets may be truncated."
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
                        {h.sheetCount} sheets · {h.rowCount} rows · {formatBytes(h.odsBytes)} → {formatBytes(h.pdfBytes)} · {new Date(h.convertedAt).toLocaleString()}
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
            <strong className="text-foreground">Privacy:</strong> all ODS parsing and PDF rendering runs in your browser. File contents never leave your device.
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

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="font-mono break-all">{value || "—"}</p>
    </div>
  );
}
