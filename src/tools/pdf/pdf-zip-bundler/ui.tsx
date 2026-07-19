"use client";

import React, { useRef, useState, useMemo, useEffect, useCallback } from "react";
import { PDFDocument } from "pdf-lib";
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
  ActionBar,
  RunButton,
  ErrorBanner,
} from "../../_shared";
import { toast } from "sonner";
import { History, FileUp, Trash2, Archive, AlertTriangle, CheckCircle2, FileText } from "lucide-react";
import {
  ORGANIZE_MODES,
  COMPRESSION_LEVELS,
  ORGANIZE_LABELS,
  COMPRESSION_LABELS,
  DEFAULT_OPTIONS,
  extractFileMeta,
  buildBundleReport,
  buildBundleZip,
  verifyBundle,
  renderTextReport,
  renderCsvReport,
  renderJsonReport,
  sanitizeBundleName,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type BundlerOptions,
  type OrganizeMode,
  type CompressionLevel,
  type PdfFileMeta,
  type BundleEntry,
  type DuplicateGroup,
  type SummaryStats,
  type IntegrityIssue,
  type HistoryEntry,
} from "./logic";
import { formatBytes, downloadBytes } from "../_shared/download";

interface LoadedFile {
  id: string;
  file: File;
  meta: PdfFileMeta | null;
  loading: boolean;
  error: string;
}

export default function PdfZipBundler() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<LoadedFile[]>([]);
  const [options, setOptions] = useState<BundlerOptions>(DEFAULT_OPTIONS);
  const [report, setReport] = useState<{
    entries: BundleEntry[];
    duplicates: DuplicateGroup[];
    stats: SummaryStats;
    manifest: string;
    readme: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      if (Object.keys(parsed).length > 0) {
        setOptions((prev) => ({ ...prev, ...parsed }));
        toast.info("Loaded options from share link");
      }
    }
  }, []);

  const addFiles = useCallback(async (fileList: FileList | File[]) => {
    const newFiles: LoadedFile[] = Array.from(fileList)
      .filter((f) => /\.pdf$/i.test(f.name) || f.type === "application/pdf")
      .map((f) => ({
        id: `${f.name}-${f.size}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        file: f,
        meta: null,
        loading: true,
        error: "",
      }));
    if (newFiles.length === 0) {
      toast.error("No PDF files selected");
      return;
    }
    setFiles((prev) => [...prev, ...newFiles]);
    setReport(null);

    // Load each new file's metadata with pdf-lib
    for (const lf of newFiles) {
      try {
        const bytes = new Uint8Array(await lf.file.arrayBuffer());
        const doc = await PDFDocument.load(bytes);
        const meta = extractFileMeta(lf.file.name, bytes, {
          pageCount: doc.getPageCount(),
          title: doc.getTitle(),
          author: doc.getAuthor(),
          subject: doc.getSubject(),
          creator: doc.getCreator(),
          producer: doc.getProducer(),
          creationDate: doc.getCreationDate(),
        });
        // Attach bytes for ZIP building later
        meta.bytes = bytes;
        setFiles((prev) => prev.map((x) => (x.id === lf.id ? { ...x, meta, loading: false } : x)));
      } catch {
        setFiles((prev) => prev.map((x) => (x.id === lf.id ? { ...x, loading: false, error: "Could not read PDF" } : x)));
      }
    }
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((x) => x.id !== id));
    setReport(null);
  }, []);

  const clearAll = useCallback(() => {
    setFiles([]);
    setReport(null);
    setError("");
    setOptions(DEFAULT_OPTIONS);
  }, []);

  const moveFile = useCallback((id: string, direction: -1 | 1) => {
    setFiles((prev) => {
      const idx = prev.findIndex((x) => x.id === id);
      if (idx < 0) return prev;
      const newIdx = idx + direction;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const next = prev.slice();
      const tmp = next[idx];
      next[idx] = next[newIdx];
      next[newIdx] = tmp;
      return next;
    });
    setReport(null);
  }, []);

  const loadedMetas = useMemo(
    () => files.filter((f) => f.meta).map((f) => f.meta as PdfFileMeta),
    [files],
  );

  const run = useCallback(async () => {
    if (loadedMetas.length === 0) {
      setError("Add at least one PDF to bundle.");
      return;
    }
    setWorking(true);
    setError("");
    setReport(null);
    try {
      const res = buildBundleReport(loadedMetas, options);
      if (!res.ok) {
        setError(res.error);
        setWorking(false);
        return;
      }
      // Re-attach bytes to the entries (buildBundleReport doesn't see them since
      // they're not serialized in the meta we passed)
      const entriesWithBytes = res.output.entries.map((e) => {
        const source = loadedMetas.find((m) => m.name === e.meta.name && m.contentHash === e.meta.contentHash);
        return { ...e, meta: { ...e.meta, bytes: source?.bytes } };
      });
      setReport({
        ...res.output,
        entries: entriesWithBytes,
      });
      saveHistory({
        ts: Date.now(),
        bundleName: options.bundleName,
        fileCount: res.output.stats.totalFiles,
        totalSize: res.output.stats.totalSize,
        totalPages: res.output.stats.totalPages,
        organizeBy: options.organizeBy,
        compressionLevel: options.compressionLevel,
      });
      setHistory(loadHistory());
      toast.success(`Bundle ready: ${res.output.stats.totalFiles} file(s), ${formatBytes(res.output.stats.totalSize)}`);
    } catch {
      setError("Something went wrong while building the bundle.");
    }
    setWorking(false);
  }, [loadedMetas, options]);

  const integrityIssues = useMemo<IntegrityIssue[]>(() => {
    if (!report) return [];
    return verifyBundle(report.entries);
  }, [report]);

  const textReport = useMemo(() => {
    if (!report) return "";
    return renderTextReport(report.entries, report.duplicates, report.stats, options);
  }, [report, options]);

  const csvReport = useMemo(() => (report ? renderCsvReport(report.entries) : ""), [report]);

  const jsonReport = useMemo(() => {
    if (!report) return "";
    return renderJsonReport(report.entries, report.duplicates, report.stats, options);
  }, [report, options]);

  const handleDownloadZip = useCallback(() => {
    if (!report) return;
    const zip = buildBundleZip(report.entries, report.manifest, report.readme, options);
    const bundleName = sanitizeBundleName(options.bundleName);
    downloadBytes(zip, `${bundleName}.zip`, "application/zip");
    toast.success(`Downloaded ${bundleName}.zip`);
  }, [report, options]);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const loadedCount = loadedMetas.length;
  const totalSize = loadedMetas.reduce((sum, m) => sum + m.size, 0);
  const totalPages = loadedMetas.reduce((sum, m) => sum + m.pageCount, 0);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-2">
            <Label className="text-xs">PDF files ({files.length})</Label>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files.length > 0) void addFiles(e.dataTransfer.files);
              }}
              className="w-full rounded-xl border-2 border-dashed border-border p-6 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors"
            >
              <FileUp className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
              <p className="text-sm font-medium">Drop PDFs here or click to browse</p>
              <p className="mt-1 text-xs text-muted-foreground">Multiple files supported — drag to reorder in flat mode.</p>
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              multiple
              className="hidden"
              aria-label="Choose PDFs"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) void addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          {files.length > 0 && (
            <div className="space-y-1 max-h-[400px] overflow-auto">
              {files.map((f, i) => (
                <div key={f.id} className="flex flex-wrap items-center gap-2 rounded border bg-background px-3 py-2 text-xs">
                  <span className="font-mono text-muted-foreground text-[10px] w-6">{i + 1}.</span>
                  {f.loading ? (
                    <>
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      <span className="text-muted-foreground">Loading {f.file.name}…</span>
                    </>
                  ) : f.error ? (
                    <>
                      <AlertTriangle className="h-3 w-3 text-destructive" />
                      <span className="text-destructive">{f.file.name}: {f.error}</span>
                    </>
                  ) : f.meta ? (
                    <>
                      <Badge variant="outline" className="text-[10px]">{f.meta.pageCount}p</Badge>
                      <Badge variant="outline" className="text-[10px]">{formatBytes(f.meta.size)}</Badge>
                      <span className="font-mono text-foreground text-[11px] truncate flex-1 min-w-0">{f.meta.name}</span>
                      {f.meta.title && <span className="text-muted-foreground text-[10px] truncate">{f.meta.title}</span>}
                    </>
                  ) : null}
                  <div className="ml-auto flex items-center gap-1">
                    {options.organizeBy === "flat" && (
                      <>
                        <Button variant="ghost" size="icon" disabled={i === 0} onClick={() => moveFile(f.id, -1)} aria-label="Move up" className="h-7 w-7">
                          ↑
                        </Button>
                        <Button variant="ghost" size="icon" disabled={i === files.length - 1} onClick={() => moveFile(f.id, 1)} aria-label="Move down" className="h-7 w-7">
                          ↓
                        </Button>
                      </>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => removeFile(f.id)} aria-label="Remove" className="h-7 w-7">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {files.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <Label htmlFor="pzb-name" className="text-xs">Bundle name</Label>
                <Input
                  id="pzb-name"
                  value={options.bundleName}
                  onChange={(e) => setOptions((prev) => ({ ...prev, bundleName: e.target.value }))}
                  placeholder="my-pdf-bundle"
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="pzb-organize" className="text-xs">Organize by</Label>
                <select
                  id="pzb-organize"
                  value={options.organizeBy}
                  onChange={(e) => setOptions((prev) => ({ ...prev, organizeBy: e.target.value as OrganizeMode }))}
                  className="h-9 w-full text-sm rounded border bg-background px-2"
                >
                  {ORGANIZE_MODES.map((m) => (
                    <option key={m} value={m}>{ORGANIZE_LABELS[m]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="pzb-compress" className="text-xs">Compression level</Label>
                <select
                  id="pzb-compress"
                  value={options.compressionLevel}
                  onChange={(e) => setOptions((prev) => ({ ...prev, compressionLevel: e.target.value as CompressionLevel }))}
                  className="h-9 w-full text-sm rounded border bg-background px-2"
                >
                  {COMPRESSION_LEVELS.map((l) => (
                    <option key={l} value={l}>{COMPRESSION_LABELS[l]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1 flex items-end gap-4 pb-2">
                <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={options.includeManifest}
                    onChange={(e) => setOptions((prev) => ({ ...prev, includeManifest: e.target.checked }))}
                    className="h-4 w-4 rounded border-border"
                  />
                  Include manifest.json
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={options.includeReadme}
                    onChange={(e) => setOptions((prev) => ({ ...prev, includeReadme: e.target.checked }))}
                    className="h-4 w-4 rounded border-border"
                  />
                  Include README.txt
                </label>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ActionBar>
        <RunButton onClick={() => void run()} disabled={loadedCount === 0} loading={working} label="Build bundle" />
        <ShareButton getUrl={() => buildShareUrl(options)} disabled={loadedCount === 0} />
        <ClearButton onClick={clearAll} disabled={files.length === 0 && !report} />
      </ActionBar>

      {error && <ErrorBanner message={error} />}

      {report && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Archive className="h-4 w-4" /> Bundle ready: {report.stats.totalFiles} file(s)
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Total files" value={report.stats.totalFiles} />
                <Stat label="Total size" value={formatBytes(report.stats.totalSize)} />
                <Stat label="Total pages" value={report.stats.totalPages} />
                <Stat label="Est. ZIP size" value={formatBytes(report.stats.estimatedZipSize)} />
                <Stat label="Unique files" value={report.stats.uniqueFiles} />
                <Stat
                  label="Duplicates"
                  value={report.stats.duplicateFiles}
                  highlight={report.stats.duplicateFiles > 0 ? "bad" : undefined}
                />
                <Stat label="Wasted bytes" value={formatBytes(report.stats.wastedBytes)} highlight={report.stats.wastedBytes > 0 ? "bad" : undefined} />
                <Stat label="Avg pages/file" value={report.stats.avgPagesPerFile} />
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button onClick={handleDownloadZip} className="gap-1.5">
                  <Archive className="h-3.5 w-3.5" /> Download {sanitizeBundleName(options.bundleName)}.zip
                </Button>
                {options.includeManifest && (
                  <CopyButton getText={() => report.manifest} label="Copy manifest.json" />
                )}
                {options.includeManifest && (
                  <DownloadButton getText={() => report.manifest} filename="manifest.json" mime="application/json" label="Manifest" />
                )}
                {options.includeReadme && (
                  <CopyButton getText={() => report.readme} label="Copy README.txt" />
                )}
                {options.includeReadme && (
                  <DownloadButton getText={() => report.readme} filename="README.txt" mime="text/plain" label="README" />
                )}
                <DownloadButton getText={() => textReport} filename="bundle-report.txt" mime="text/plain" label="Report .txt" />
                <DownloadButton getText={() => csvReport} filename="bundle-report.csv" mime="text/csv" label="Report .csv" />
                <DownloadButton getText={() => jsonReport} filename="bundle-report.json" mime="application/json" label="Report .json" />
              </div>
            </CardContent>
          </Card>

          {integrityIssues.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4" /> Integrity checks ({integrityIssues.length})
                </h3>
                <div className="space-y-1">
                  {integrityIssues.map((iss, i) => (
                    <div key={i} className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                      <Badge variant={iss.severity === "error" ? "destructive" : "secondary"} className="text-[10px]">
                        {iss.severity}
                      </Badge>
                      <span className="font-mono text-muted-foreground text-[10px]">#{iss.entry}</span>
                      <span className="text-foreground">{iss.fileName}</span>
                      <span className="text-muted-foreground ml-auto">{iss.message}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {integrityIssues.length === 0 && report.stats.duplicateFiles === 0 && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  All files passed integrity checks. No duplicates detected.
                </div>
              </CardContent>
            </Card>
          )}

          {report.duplicates.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4" /> Duplicate groups ({report.duplicates.length})
                </h3>
                <div className="space-y-1">
                  {report.duplicates.map((g, i) => (
                    <div key={i} className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                      <Badge variant="secondary" className="text-[10px]">{g.members.length} copies</Badge>
                      <span className="font-mono text-muted-foreground text-[10px]">{g.contentHash}</span>
                      <span className="text-foreground">{formatBytes(g.size)} each</span>
                      <span className="ml-auto text-destructive">{formatBytes(g.wastedBytes)} wasted</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <FileText className="h-4 w-4" /> Bundle contents ({report.entries.length})
              </h3>
              <div className="space-y-1 max-h-[400px] overflow-auto">
                {report.entries.map((e, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                    <Badge variant="outline" className="text-[10px]">#{e.bundleIndex}</Badge>
                    {e.isDuplicate && <Badge variant="secondary" className="text-[10px]">DUP</Badge>}
                    <span className="font-mono text-foreground text-[11px] truncate flex-1 min-w-0">{e.zipPath}</span>
                    <span className="text-muted-foreground text-[10px]">{formatBytes(e.meta.size)} • {e.meta.pageCount}p</span>
                    {e.meta.title && <span className="text-muted-foreground text-[10px] truncate max-w-[150px]">{e.meta.title}</span>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!report && !error && (
        <EmptyState
          title="Add PDFs to bundle into a ZIP archive"
          hint="Drag-and-drop multiple PDFs, choose an organize mode and compression level, and download a single .zip with optional manifest.json and README.txt — 100% in your browser."
          icon={<Archive className="h-8 w-8" />}
        />
      )}

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent ({history.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <Badge variant="outline" className="mr-2">{h.fileCount} files</Badge>
                  <Badge variant="outline" className="mr-2">{formatBytes(h.totalSize)}</Badge>
                  <Badge variant="outline" className="mr-2">{h.totalPages}p</Badge>
                  <span className="text-muted-foreground">{h.bundleName}</span>
                  <span className="text-muted-foreground ml-2">· {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> ZIP bundling runs 100% locally in your browser — your PDFs never leave your device. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: "bad" | "good";
}) {
  const color = highlight === "bad"
    ? "text-red-600 dark:text-red-400"
    : highlight === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-foreground";
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold ${color}`}>{value}</div>
    </div>
  );
}
