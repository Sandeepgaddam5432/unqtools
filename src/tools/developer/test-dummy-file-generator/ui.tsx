"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  CopyButton,
  DownloadButton,
  EmptyState,
  ShareButton,
  ClearButton,
  ErrorBanner,
} from "../../_shared";
import { toast } from "sonner";
import {
  FILE_TYPES,
  CONTENT_MODES,
  UNITS,
  SIZE_PRESETS,
  MAX_BULK,
  PNG_MIN_SIZE,
  PDF_MIN_SIZE,
  ZIP_MIN_OVERHEAD,
  computeTargetBytes,
  validateOptions,
  generateFile,
  generateBulk,
  formatBytes,
  resolveFilename,
  mimeType,
  detectMagic,
  toHex,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type GenerateOptions,
  type FileType,
  type ContentMode,
  type Unit,
  type GeneratedFile,
  type HistoryEntry,
} from "./logic";
import {
  History, FilePlus, Wand2, AlertTriangle, Download,
  FileText, Image as ImageIcon, Archive, File,
} from "lucide-react";

function downloadBytes(name: string, bytes: Uint8Array, mime: string) {
  const blob = new Blob([bytes as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function TestDummyFileGenerator() {
  const [opts, setOpts] = useState<GenerateOptions>({
    size: 1,
    unit: "KB",
    type: "txt",
    contentMode: "lorem",
    filename: "",
    bulkCount: 1,
    imageColor: "#3B82F6",
    imageWidth: 1,
    imageHeight: 1,
    csvCols: 5,
  });
  const [files, setFiles] = useState<GeneratedFile[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      setOpts((prev) => ({ ...prev, ...p }));
      toast.info("Loaded options from share link");
    }
  }, []);

  const setOpt = useCallback(
    <K extends keyof GenerateOptions>(key: K, value: GenerateOptions[K]) => {
      setOpts((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const targetBytes = useMemo(() => computeTargetBytes(opts.size, opts.unit), [opts.size, opts.unit]);
  const validation = useMemo(() => validateOptions(opts), [opts]);

  const handleGenerate = useCallback(() => {
    setError(null);
    const v = validateOptions(opts);
    if (!v.ok) {
      setError(v.error);
      toast.error(v.error);
      return;
    }
    setGenerating(true);
    try {
      // Yield to UI thread so the spinner can render before the (potentially
      // heavy) generation runs.
      setTimeout(() => {
        try {
          const out = generateBulk(opts);
          setFiles(out);
          saveHistory({
            ts: Date.now(),
            type: opts.type,
            bytes: targetBytes,
            bulkCount: opts.bulkCount,
            contentMode: opts.contentMode,
            filename: opts.filename || `dummy.${opts.type}`,
          });
          setHistory(loadHistory());
          toast.success(`Generated ${out.length} file${out.length === 1 ? "" : "s"} (${formatBytes(out.reduce((s, f) => s + f.size, 0))})`);
        } catch (e) {
          setError((e as Error).message);
          toast.error((e as Error).message);
        } finally {
          setGenerating(false);
        }
      }, 0);
    } catch (e) {
      setError((e as Error).message);
      toast.error((e as Error).message);
      setGenerating(false);
    }
  }, [opts, targetBytes]);

  const handleDownloadOne = useCallback((file: GeneratedFile) => {
    try {
      downloadBytes(file.name, file.bytes, mimeType(opts.type));
      toast.success(`Downloaded ${file.name}`);
    } catch (e) {
      toast.error(`Download failed: ${(e as Error).message}`);
    }
  }, [opts.type]);

  const handleDownloadAll = useCallback(() => {
    if (files.length === 0) return;
    if (files.length === 1) {
      handleDownloadOne(files[0]);
      return;
    }
    // Download each file with a small stagger to avoid browser blocking.
    files.forEach((f, i) => {
      setTimeout(() => handleDownloadOne(f), i * 250);
    });
  }, [files, handleDownloadOne]);

  const handleClear = useCallback(() => {
    setFiles([]);
    setError(null);
    toast.info("Cleared output");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const typeMeta = FILE_TYPES.find((f) => f.value === opts.type);
  const isImage = opts.type === "png";

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <Wand2 className="h-4 w-4" /> File options
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <Field label="File type">
              <select
                value={opts.type}
                onChange={(e) => setOpt("type", e.target.value as FileType)}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                {FILE_TYPES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </Field>
            <Field label="Size">
              <Input
                type="number"
                min={1}
                value={opts.size}
                onChange={(e) => setOpt("size", Math.max(0, Number(e.target.value) || 0))}
                className="h-8 text-xs"
              />
            </Field>
            <Field label="Unit">
              <select
                value={opts.unit}
                onChange={(e) => setOpt("unit", e.target.value as Unit)}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                {UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </Field>
            <Field label="Content mode">
              <select
                value={opts.contentMode}
                onChange={(e) => setOpt("contentMode", e.target.value as ContentMode)}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                {CONTENT_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </Field>
            <Field label={`Bulk count (max ${MAX_BULK})`}>
              <Input
                type="number"
                min={1}
                max={MAX_BULK}
                value={opts.bulkCount}
                onChange={(e) => setOpt("bulkCount", Math.max(1, Math.min(MAX_BULK, Number(e.target.value) || 1)))}
                className="h-8 text-xs"
              />
            </Field>
            <Field label="Seed (optional)">
              <Input
                type="text"
                value={opts.seed ?? ""}
                onChange={(e) => setOpt("seed", e.target.value || undefined)}
                placeholder="random"
                className="h-8 text-xs"
              />
            </Field>
            <Field label="Filename (use {n} for bulk)">
              <Input
                type="text"
                value={opts.filename}
                onChange={(e) => setOpt("filename", e.target.value)}
                placeholder={`dummy-{n}.${typeMeta?.ext ?? "txt"}`}
                className="h-8 text-xs"
              />
            </Field>
            {opts.contentMode === "pattern" && (
              <Field label="Pattern (hex or text)">
                <Input
                  type="text"
                  value={opts.pattern ?? ""}
                  onChange={(e) => setOpt("pattern", e.target.value)}
                  placeholder="0xAA,0xBB or hello"
                  className="h-8 text-xs font-mono"
                />
              </Field>
            )}
            {isImage && (
              <>
                <Field label="PNG color">
                  <input
                    type="color"
                    value={opts.imageColor ?? "#3B82F6"}
                    onChange={(e) => setOpt("imageColor", e.target.value)}
                    className="h-8 w-full rounded border bg-background px-1"
                  />
                </Field>
                <Field label="Image width (px)">
                  <Input
                    type="number"
                    min={1}
                    value={opts.imageWidth ?? 1}
                    onChange={(e) => setOpt("imageWidth", Math.max(1, Number(e.target.value) || 1))}
                    className="h-8 text-xs"
                  />
                </Field>
                <Field label="Image height (px)">
                  <Input
                    type="number"
                    min={1}
                    value={opts.imageHeight ?? 1}
                    onChange={(e) => setOpt("imageHeight", Math.max(1, Number(e.target.value) || 1))}
                    className="h-8 text-xs"
                  />
                </Field>
              </>
            )}
            {opts.type === "csv" && (
              <Field label="CSV columns">
                <Input
                  type="number"
                  min={1}
                  value={opts.csvCols ?? 5}
                  onChange={(e) => setOpt("csvCols", Math.max(1, Number(e.target.value) || 5))}
                  className="h-8 text-xs"
                />
              </Field>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={handleGenerate} disabled={!validation.ok || generating} className="gap-1.5">
              {generating ? (
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              ) : (
                <FilePlus className="h-3.5 w-3.5" />
              )}
              {generating ? "Generating…" : "Generate"}
            </Button>
            <span className="text-[10px] text-muted-foreground">
              Target: <strong className="text-foreground">{formatBytes(targetBytes)}</strong> ({targetBytes.toLocaleString()} bytes)
            </span>
            <div className="flex flex-wrap gap-1">
              {SIZE_PRESETS.slice(0, 6).map((p) => (
                <Button
                  key={p.label}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={() => setOpts((prev) => ({ ...prev, size: p.size, unit: p.unit }))}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {files.length > 0 ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                {typeIcon(opts.type)} {files.length} file{files.length === 1 ? "" : "s"} — {formatBytes(files.reduce((s, f) => s + f.size, 0))}
              </h3>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={handleDownloadAll} disabled={files.length === 0} className="gap-1.5">
                  <Download className="h-3.5 w-3.5" /> Download {files.length === 1 ? "file" : "all"}
                </Button>
                <ShareButton getUrl={() => buildShareUrl(opts)} />
                <ClearButton onClick={handleClear} />
              </div>
            </div>
            <div className="space-y-1 max-h-[420px] overflow-auto">
              {files.map((f, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    {typeIcon(opts.type, "h-3 w-3")}
                    <span className="font-mono font-medium text-foreground">{f.name}</span>
                    <Badge variant="secondary" className="text-[10px]">{formatBytes(f.size)}</Badge>
                    <Badge variant="outline" className="text-[10px]">{detectMagic(f.bytes)}</Badge>
                    <Badge variant="outline" className="text-[10px] font-mono">fnv:{f.checksum}</Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 ml-auto text-[11px] gap-1"
                      onClick={() => handleDownloadOne(f)}
                    >
                      <Download className="h-3 w-3" /> Download
                    </Button>
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    <span className="font-mono">magic: {toHex(f.bytes, 8)}</span>
                    <span className="ml-3">{files.length > 1 ? `#${i + 1} of ${files.length}` : ""}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          title="Generate test dummy files of exact size"
          hint="Pick a file type, target size, and content mode. Supports TXT/CSV/JSON/XML/HTML (text), binary (random/zeros/pattern), and real openable PNG/ZIP/PDF — all generated client-side and never uploaded."
          icon={<FilePlus className="h-8 w-8" />}
        />
      )}

      {/* Format-specific size notes */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <h4 className="text-xs font-semibold flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" /> Per-format minimums & notes
          </h4>
          <ul className="text-[11px] text-muted-foreground space-y-1">
            <li><strong className="text-foreground">TXT/CSV/JSON/XML/HTML/binary:</strong> minimum 1 byte; exact-size via UTF-8 truncation.</li>
            <li><strong className="text-foreground">PNG:</strong> minimum {PNG_MIN_SIZE} bytes (1×1 base + tEXt chunk). Solid color, configurable dimensions. Real openable PNG file.</li>
            <li><strong className="text-foreground">ZIP:</strong> minimum {ZIP_MIN_OVERHEAD + 1} bytes (local header + central directory + EOCD). Real ZIP archive with one inner file padded to target size.</li>
            <li><strong className="text-foreground">PDF:</strong> minimum {PDF_MIN_SIZE} bytes. Header + comment-line padding + %%EOF trailer.</li>
          </ul>
        </CardContent>
      </Card>

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent ({history.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1 max-h-[200px] overflow-auto">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">{h.type}</Badge>
                    <Badge variant="outline" className="text-[10px]">{formatBytes(h.bytes)}</Badge>
                    <Badge variant="outline" className="text-[10px]">×{h.bulkCount}</Badge>
                    <Badge variant="outline" className="text-[10px]">{h.contentMode}</Badge>
                    <span className="text-muted-foreground ml-auto">{new Date(h.ts).toLocaleString()}</span>
                  </div>
                  <code className="block mt-1 text-[10px] text-muted-foreground truncate">{h.filename}</code>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All file generation runs locally in your browser
            using Uint8Array and Blob. Generated files never leave your device — nothing is uploaded. History
            (last 20) stores only metadata (size, type, timestamp) in localStorage on this device; the shareable
            URL encodes options in the fragment (after #) which browsers never transmit.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function typeIcon(type: FileType, className = "h-4 w-4"): React.ReactNode {
  switch (type) {
    case "png": return <ImageIcon className={className} />;
    case "zip": return <Archive className={className} />;
    case "pdf": return <FileText className={className} />;
    case "binary": return <File className={className} />;
    default: return <FileText className={className} />;
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      <div>{children}</div>
    </div>
  );
}
