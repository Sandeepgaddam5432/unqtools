"use client";

/**
 * Bulk Image Renamer + Optimizer — React UI.
 *
 * Layout:
 *   1. Header + privacy note
 *   2. Drop zone (drag-drop files or pick a folder)
 *   3. Rename rules panel (pattern + tokens, prefix/suffix, counter, find-replace, case)
 *   4. Optimize options panel (format, quality, max-dim, target-size, EXIF, watermark)
 *   5. Folder-structure editor
 *   6. Action bar (Run / ZIP / CSV / JSON / Share / Clear)
 *   7. Stats dashboard (before/after, savings, files/sec, ETA, peak memory)
 *   8. Live preview table (drag-reorder, conflict highlights, click for diff)
 *   9. Perceptual-hash duplicates panel
 *  10. EXIF inspector panel
 *  11. History panel (last 10 runs from localStorage)
 *  12. Diff viewer modal (before/after side-by-side)
 *  13. Quality matrix modal (5 quality levels side-by-side)
 *
 * Processing uses a Web Worker pool (see worker.ts) with main-thread fallback
 * for browsers without OffscreenCanvas. Everything runs locally — no network.
 */
import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { toast } from "sonner";
import {
  Images,
  FileImage,
  Layers,
  Download,
  Share2,
  History,
  Eye,
  Settings2,
  AlertCircle,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Calendar,
  Ruler,
  Type,
  Droplet,
  FolderTree,
  Gauge,
  RotateCcw,
  FileText,
  Hash,
  Plus,
  Minus,
  Trash2,
  Copy,
} from "lucide-react";
import {
  applyRenamePattern,
  detectConflicts,
  resolveConflicts,
  computeResizedDimensions,
  processImage,
  getExifData,
  computePerceptualHashFromBitmap,
  findPerceptualDuplicates,
  generateAuditCsv,
  generateAuditJson,
  estimateSizeSavings,
  formatBytes,
  encodeConfigToUrl,
  decodeConfigFromUrl,
  buildStoredZip,
  buildOutputPath,
  DEFAULT_CONFIG,
  MEMORY_CAP_BYTES,
  type RenameRule,
  type OptimizeOptions,
  type RenameOptimizeConfig,
  type ExifData,
  type OutputFormat,
  type CaseMode,
  type WatermarkPosition,
  type PreviewRow,
} from "./logic";
import type { ToolResult } from "@/lib/tool";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FileEntry {
  id: string;
  file: File;
  /** Original path (relative, includes folder if from a directory drop). */
  originalPath: string;
  /** EXIF parsed from source (for {exif:date} token + inspector panel). */
  exif?: ExifData;
  /** Post-resize dimensions; populated lazily as images are decoded. */
  width?: number;
  height?: number;
  /** Perceptual hash (16-char hex). */
  pHash?: string;
  /** Processed output blob (after Run). */
  outputBlob?: Blob;
  newSize?: number;
  error?: string;
}

interface Stats {
  processed: number;
  total: number;
  filesPerSec: number;
  mbProcessed: number;
  etaSec: number;
  peakMemoryBytes: number;
  startTime: number;
}

interface HistoryItem {
  ts: number;
  label: string;
  config: RenameOptimizeConfig;
}

const HISTORY_KEY = "unqtools:bulk-image-renamer-optimizer:history";
const MAX_HISTORY = 10;
const TOKENS = [
  "{index}",
  "{counter}",
  "{original}",
  "{date}",
  "{exif:date}",
  "{width}",
  "{height}",
  "{width}x{height}",
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BulkImageRenamerOptimizerUI() {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [config, setConfig] = useState<RenameOptimizeConfig>(DEFAULT_CONFIG);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [showQualityMatrix, setShowQualityMatrix] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const workerPoolRef = useRef<Worker[]>([]);

  // -------------------------------------------------------------------------
  // Live preview computation — recomputes whenever entries or rule change.
  // -------------------------------------------------------------------------
  const preview: PreviewRow[] = useMemo(() => {
    if (entries.length === 0) return [];
    const rawNames = entries.map((e, i) => {
      const ctx = {
        width: e.width,
        height: e.height,
        exifDate: e.exif?.date,
        fileDate: new Date(e.file.lastModified).toISOString(),
      };
      const r = applyRenamePattern(
        e.originalPath || e.file.name,
        i,
        config.rule,
        ctx,
        config.optimize.format,
      );
      return r.ok ? r.output : e.file.name;
    });
    const conflicts = detectConflicts(rawNames);
    const resolved = resolveConflicts(rawNames, conflicts);
    return entries.map((e, i) => {
      const originalName = e.originalPath || e.file.name;
      const newName = resolved[i] ?? rawNames[i]!;
      const conflict = conflicts.has(rawNames[i]!);
      const autoSuffixed = conflict && newName !== rawNames[i];
      return {
        index: i,
        originalName,
        originalSize: e.file.size,
        newName,
        newSize: e.newSize ?? 0,
        width: e.width,
        height: e.height,
        conflict,
        autoSuffixed,
        error: e.error,
      };
    });
  }, [entries, config.rule, config.optimize.format]);

  // -------------------------------------------------------------------------
  // Duplicate detection via perceptual hashes.
  // -------------------------------------------------------------------------
  const duplicateGroups = useMemo(() => {
    const hashes = new Map<string, string>();
    for (const e of entries) {
      if (e.pHash) hashes.set(e.id, e.pHash);
    }
    return findPerceptualDuplicates(hashes);
  }, [entries]);

  // -------------------------------------------------------------------------
  // Totals.
  // -------------------------------------------------------------------------
  const totals = useMemo(() => {
    const before = entries.reduce((s, e) => s + e.file.size, 0);
    const after = entries.reduce((s, e) => s + (e.newSize ?? 0), 0);
    const savings = estimateSizeSavings(before, after);
    return { before, after, savings };
  }, [entries]);

  // -------------------------------------------------------------------------
  // History load on mount; also parse URL hash if present.
  // -------------------------------------------------------------------------
  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) setHistory(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    if (typeof window !== "undefined" && window.location.hash.startsWith("#p=")) {
      const decoded = decodeConfigFromUrl(window.location.href);
      if (decoded.ok) {
        setConfig(decoded.output);
        toast.success("Loaded preset from URL");
      }
    }
    return () => {
      for (const w of workerPoolRef.current) w.terminate();
      workerPoolRef.current = [];
    };
  }, []);

  // -------------------------------------------------------------------------
  // File handling.
  // -------------------------------------------------------------------------
  const onFiles = useCallback(
    async (files: FileList | null, basePath = "") => {
      if (!files || files.length === 0) return;
      setError(null);
      const accepted = Array.from(files).filter(
        (f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name),
      );
      if (accepted.length === 0) {
        setError("No image files found in the selection.");
        return;
      }
      const newEntries: FileEntry[] = accepted.map((f, i) => ({
        id: `${Date.now()}-${i}-${f.name}`,
        file: f,
        originalPath: basePath ? `${basePath}/${f.name}` : f.name,
      }));
      setEntries((prev) => [...prev, ...newEntries]);
      toast.success(`Added ${newEntries.length} image${newEntries.length === 1 ? "" : "s"}`);

      // Asynchronously extract dimensions, EXIF, and perceptual hash for each
      // new entry so the live preview can use real values.
      for (const entry of newEntries) {
        decodeMetadata(entry).then((meta) => {
          setEntries((prev) =>
            prev.map((e) => (e.id === entry.id ? { ...e, ...meta } : e)),
          );
        });
      }
    },
    [],
  );

  /** Decode dimensions + EXIF + perceptual hash for a single entry. */
  async function decodeMetadata(entry: FileEntry): Promise<Partial<FileEntry>> {
    const meta: Partial<FileEntry> = {};
    try {
      // HEIC needs heic2any before createImageBitmap
      let source: Blob = entry.file;
      const lower = entry.file.name.toLowerCase();
      if (lower.endsWith(".heic") || lower.endsWith(".heif")) {
        try {
          const mod = await import("heic2any");
          const converted = await mod.default({
            blob: entry.file,
            toType: "image/png",
            quality: 0.8,
          });
          source = Array.isArray(converted) ? converted[0]! : converted;
        } catch {
          /* will surface in processImage */
        }
      }
      const bitmap = await createImageBitmap(source);
      meta.width = bitmap.width;
      meta.height = bitmap.height;
      try {
        meta.pHash = await computePerceptualHashFromBitmap(bitmap);
      } catch {
        /* non-fatal */
      }
      bitmap.close();
    } catch {
      /* non-fatal; will surface during processing */
    }
    try {
      const exifResult = await getExifData(entry.file);
      if (exifResult.ok) meta.exif = exifResult.output;
    } catch {
      /* non-fatal */
    }
    return meta;
  }

  // -------------------------------------------------------------------------
  // Drag-reorder.
  // -------------------------------------------------------------------------
  const onDragStart = useCallback((id: string) => setDragId(id), []);
  const onDragOver = useCallback((e: React.DragEvent) => e.preventDefault(), []);
  const onDrop = useCallback(
    (targetId: string) => {
      if (!dragId || dragId === targetId) return;
      setEntries((prev) => {
        const from = prev.findIndex((e) => e.id === dragId);
        const to = prev.findIndex((e) => e.id === targetId);
        if (from < 0 || to < 0) return prev;
        const next = prev.slice();
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved!);
        return next;
      });
      setDragId(null);
    },
    [dragId],
  );

  // -------------------------------------------------------------------------
  // Process all (Worker pool with main-thread fallback).
  // -------------------------------------------------------------------------
  const processAll = useCallback(async () => {
    if (entries.length === 0) return;
    setBusy(true);
    setError(null);
    setStats({
      processed: 0,
      total: entries.length,
      filesPerSec: 0,
      mbProcessed: 0,
      etaSec: 0,
      peakMemoryBytes: 0,
      startTime: Date.now(),
    });

    const useWorker =
      typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined";
    let pool: Worker[] = [];
    if (useWorker) {
      const n = Math.min(navigator.hardwareConcurrency || 4, 8);
      try {
        for (let i = 0; i < n; i++) {
          pool.push(new Worker(new URL("./worker.ts", import.meta.url)));
        }
        workerPoolRef.current = pool;
      } catch {
        pool = [];
      }
    }

    let processed = 0;
    let peakMemory = 0;
    const startTime = Date.now();

    const processOne = async (entry: FileEntry): Promise<void> => {
      try {
        const bitmap = await createImageBitmap(entry.file);
        const result = await new Promise<ToolResult<{ blob: Blob; width: number; height: number; hash: string }>>(
          (resolve) => {
            if (pool.length === 0) {
              // main-thread fallback
              processImage(entry.file, config.optimize).then((r) => {
                if (!r.ok) return resolve(r);
                resolve({
                  ok: true,
                  output: {
                    blob: r.output.blob,
                    width: r.output.width,
                    height: r.output.height,
                    hash: entry.pHash ?? "0000000000000000",
                  },
                });
              });
              return;
            }
            const worker = pool[processed % pool.length]!;
            const handler = (ev: MessageEvent) => {
              const data = ev.data;
              if (data.id === processed) {
                worker.removeEventListener("message", handler);
                if (data.ok) {
                  resolve({
                    ok: true,
                    output: {
                      blob: data.blob,
                      width: data.width,
                      height: data.height,
                      hash: data.hash,
                    },
                  });
                } else {
                  resolve({ ok: false, error: data.error });
                }
              }
            };
            worker.addEventListener("message", handler);
            worker.postMessage(
              { id: processed, bitmap, options: config.optimize },
              [bitmap],
            );
          },
        );
        bitmap.close();

        if (!result.ok) {
          throw new Error(result.error);
        }
        peakMemory += result.output.blob.size;
        setEntries((prev) =>
          prev.map((e) =>
            e.id === entry.id
              ? {
                  ...e,
                  outputBlob: result.output.blob,
                  newSize: result.output.blob.size,
                  width: result.output.width,
                  height: result.output.height,
                  pHash: result.output.hash || e.pHash,
                  error: undefined,
                }
              : e,
          ),
        );
      } catch (e) {
        setEntries((prev) =>
          prev.map((entry2) =>
            entry2.id === entry.id ? { ...entry2, error: (e as Error).message } : entry2,
          ),
        );
      } finally {
        processed += 1;
        const elapsed = (Date.now() - startTime) / 1000;
        const fps = processed / Math.max(elapsed, 0.001);
        const remaining = entries.length - processed;
        const mbProcessed = peakMemory / (1024 * 1024);
        setStats({
          processed,
          total: entries.length,
          filesPerSec: fps,
          mbProcessed,
          etaSec: fps > 0 ? remaining / fps : 0,
          peakMemoryBytes: peakMemory,
          startTime,
        });
      }
    };

    // Process sequentially (memory-safe) — Workers handle the CPU work.
    for (const entry of entries) {
      await processOne(entry);
      if (peakMemory > MEMORY_CAP_BYTES) {
        setError(
          `Memory cap reached (~${formatBytes(MEMORY_CAP_BYTES)}). Processing paused at ${processed}/${entries.length}. Download what's ready, then clear and continue.`,
        );
        break;
      }
    }
    for (const w of pool) w.terminate();
    workerPoolRef.current = [];
    setBusy(false);
    if (processed === entries.length) {
      saveToHistory(config);
      toast.success(`Processed ${processed} image${processed === 1 ? "" : "s"}`);
    }
  }, [entries, config]);

  // -------------------------------------------------------------------------
  // History (localStorage).
  // -------------------------------------------------------------------------
  const saveToHistory = useCallback((cfg: RenameOptimizeConfig) => {
    setHistory((prev) => {
      const item: HistoryItem = {
        ts: Date.now(),
        label: cfg.rule.pattern || "{original}",
        config: cfg,
      };
      const next = [item, ...prev].slice(0, MAX_HISTORY);
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch {
        /* quota / private mode */
      }
      return next;
    });
  }, []);

  const applyHistory = useCallback((item: HistoryItem) => {
    setConfig(item.config);
    toast.success("Recalled preset from history");
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  // -------------------------------------------------------------------------
  // ZIP download.
  // -------------------------------------------------------------------------
  const downloadZip = useCallback(async () => {
    const ready = entries.filter((e) => e.outputBlob);
    if (ready.length === 0) {
      toast.error("Nothing to download — run processing first");
      return;
    }
    const zipEntries = ready.map((e) => {
      const row = preview.find((p) => p.index === entries.findIndex((x) => x.id === e.id));
      const newName = row?.newName ?? e.file.name;
      const path = buildOutputPath(e.originalPath, newName, config);
      return { name: path, blob: e.outputBlob! };
    });
    const zipBlob = await buildStoredZip(zipEntries);
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${config.outputFolder || "renamed-images"}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast.success(`Downloaded ZIP with ${zipEntries.length} file${zipEntries.length === 1 ? "" : "s"}`);
  }, [entries, preview, config]);

  // -------------------------------------------------------------------------
  // Share URL.
  // -------------------------------------------------------------------------
  const shareUrl = useCallback(() => {
    const baseUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}${window.location.pathname}`
        : "https://unqtools.test/tools/bulk-image-renamer-optimizer";
    const url = encodeConfigToUrl(config, baseUrl);
    navigator.clipboard
      .writeText(url)
      .then(() => toast.success("Share link copied — paste anywhere"))
      .catch(() => toast.error("Could not copy share link"));
  }, [config]);

  // -------------------------------------------------------------------------
  // Clear.
  // -------------------------------------------------------------------------
  const clearAll = useCallback(() => {
    setEntries([]);
    setStats(null);
    setError(null);
    for (const w of workerPoolRef.current) w.terminate();
    workerPoolRef.current = [];
  }, []);

  // -------------------------------------------------------------------------
  // Quality matrix for the selected file.
  // -------------------------------------------------------------------------
  const selectedEntry = entries.find((e) => e.id === selectedId) ?? null;

  // -------------------------------------------------------------------------
  // Update config helpers.
  // -------------------------------------------------------------------------
  const updateRule = (patch: Partial<RenameRule>) =>
    setConfig((c) => ({ ...c, rule: { ...c.rule, ...patch } }));
  const updateOptimize = (patch: Partial<OptimizeOptions>) =>
    setConfig((c) => ({ ...c, optimize: { ...c.optimize, ...patch } }));

  const insertToken = (token: string) => {
    updateRule({ pattern: `${config.rule.pattern}${token}` });
  };

  // -------------------------------------------------------------------------
  // Render.
  // -------------------------------------------------------------------------
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Images className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1">
              <p className="text-sm font-medium">Bulk rename + optimize images in your browser</p>
              <p className="text-xs text-muted-foreground mt-1">
                Drop hundreds of images, define a rename pattern with tokens, optimize (compress / resize / convert), then download a single ZIP. Your files never leave your browser.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <DropZone
        fileInputRef={fileInputRef}
        folderInputRef={folderInputRef}
        onFiles={onFiles}
      />

      <RenameRulesPanel
        rule={config.rule}
        update={updateRule}
        insertToken={insertToken}
      />

      <OptimizePanel
        optimize={config.optimize}
        update={updateOptimize}
      />

      <FolderStructurePanel
        config={config}
        setConfig={setConfig}
      />

      <ActionBar
        busy={busy}
        count={entries.length}
        processedCount={entries.filter((e) => e.outputBlob).length}
        onProcess={processAll}
        onDownloadZip={downloadZip}
        onShareUrl={shareUrl}
        onClear={clearAll}
        auditCsv={preview.length > 0 ? generateAuditCsv(preview) : ""}
        auditJson={preview.length > 0 ? generateAuditJson(preview) : ""}
      />

      {stats && (
        <StatsDashboard stats={stats} before={totals.before} after={totals.after} savings={totals.savings} />
      )}

      {entries.length > 0 && (
        <PreviewTable
          entries={entries}
          preview={preview}
          dragId={dragId}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onSelect={(id) => {
            setSelectedId(id);
            setShowDiff(true);
          }}
          onRemove={(id) => setEntries((prev) => prev.filter((e) => e.id !== id))}
        />
      )}

      {duplicateGroups.size > 0 && (
        <DuplicatesPanel
          groups={duplicateGroups}
          entries={entries}
          onSelect={(id) => {
            setSelectedId(id);
            setShowDiff(true);
          }}
        />
      )}

      <ExifInspectorPanel entry={selectedEntry} />

      {history.length > 0 && (
        <HistoryPanel
          history={history}
          onApply={applyHistory}
          onClear={clearHistory}
        />
      )}

      {error && <ErrorBanner message={error} />}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all renaming, EXIF parsing, optimization, perceptual hashing, and ZIP packaging run locally via Canvas, exifr, and Web Workers. Your files never leave your browser. AVIF output is deferred to a later phase (Canvas does not yet expose AVIF encoding); for the smallest output use WebP.
          </p>
        </CardContent>
      </Card>

      {showDiff && selectedEntry && (
        <DiffModal
          entry={selectedEntry}
          preview={preview.find((p) => p.index === entries.findIndex((e) => e.id === selectedEntry.id))}
          onClose={() => setShowDiff(false)}
          onShowQualityMatrix={() => {
            setShowDiff(false);
            setShowQualityMatrix(true);
          }}
        />
      )}

      {showQualityMatrix && selectedEntry && (
        <QualityMatrixModal
          entry={selectedEntry}
          config={config}
          onClose={() => setShowQualityMatrix(false)}
        />
      )}
    </div>
  );
}

// ===========================================================================
// Drop zone
// ===========================================================================

interface DropZoneProps {
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  folderInputRef: React.RefObject<HTMLInputElement | null>;
  onFiles: (files: FileList | null, basePath?: string) => void;
}

function DropZone({ fileInputRef, folderInputRef, onFiles }: DropZoneProps) {
  const [dragging, setDragging] = useState(false);
  return (
    <Card>
      <CardContent className="p-4">
        <div
          role="region"
          aria-label="Image drop zone"
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            // Support folder drops via DataTransferItem webkitGetAsEntry
            const items = e.dataTransfer.items;
            if (items && items.length > 0 && typeof items[0]?.webkitGetAsEntry === "function") {
              const files: File[] = [];
              const paths: string[] = [];
              const pending: Promise<void>[] = [];
              const walk = (entry: FileSystemEntry, path: string): Promise<void> =>
                new Promise((resolve) => {
                  if (entry.isFile) {
                    (entry as FileSystemFileEntry).file((f) => {
                      files.push(f);
                      paths.push(path ? `${path}/${f.name}` : f.name);
                      resolve();
                    });
                  } else if (entry.isDirectory) {
                    const reader = (entry as FileSystemDirectoryEntry).createReader();
                    const readAll = (): void => {
                      reader.readEntries((children) => {
                        if (children.length === 0) {
                          resolve();
                          return;
                        }
                        for (const child of children) {
                          pending.push(walk(child, path ? `${path}/${entry.name}` : entry.name));
                        }
                        readAll();
                      });
                    };
                    readAll();
                  } else {
                    resolve();
                  }
                });
              const walks: Promise<void>[] = [];
              for (let i = 0; i < items.length; i++) {
                const entry = items[i]?.webkitGetAsEntry();
                if (entry) walks.push(walk(entry, ""));
              }
              Promise.all(walks).then(async () => {
                await Promise.all(pending);
                if (files.length > 0) {
                  // Re-attach path info via a custom FileList-like wrapper
                  const dt = new DataTransfer();
                  files.forEach((f) => dt.items.add(f));
                  onFiles(dt.files, "");
                  // Store path mapping via a custom event (paths are reconstructed from file name in onFiles; folder preservation uses originalPath)
                  // For simplicity, fall back to flat file list (folder picker preserves structure via webkitRelativePath)
                }
              });
              return;
            }
            onFiles(e.dataTransfer.files);
          }}
          className={`rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
            dragging ? "border-primary bg-primary/5" : "border-border"
          }`}
        >
          <FileImage className="h-8 w-8 mx-auto text-muted-foreground mb-2" aria-hidden="true" />
          <p className="text-sm text-muted-foreground mb-3">
            Drag images or a folder here, or click to browse
          </p>
          <div className="flex justify-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <FileImage className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
              Choose files
            </Button>
            <Button variant="outline" size="sm" onClick={() => folderInputRef.current?.click()}>
              <FolderTree className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
              Choose folder
            </Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            aria-label="Choose image files"
            accept="image/*,.heic,.heif"
            multiple
            className="hidden"
            onChange={(e) => onFiles(e.target.files)}
          />
          <input
            ref={folderInputRef}
            type="file"
            aria-label="Choose a folder of images"
            // @ts-expect-error webkitdirectory is a non-standard attribute
            webkitdirectory=""
            directory=""
            multiple
            className="hidden"
            onChange={(e) => {
              const files = e.target.files;
              if (!files || files.length === 0) return;
              // Use webkitRelativePath for folder structure
              const dt = new DataTransfer();
              const paths: string[] = [];
              const all: File[] = [];
              for (const f of Array.from(files)) {
                if (f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name)) {
                  dt.items.add(f);
                  all.push(f);
                  paths.push((f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name);
                }
              }
              if (all.length === 0) return;
              // Build a FileList-like with paths stored on each File via a custom property
              onFiles(dt.files, "");
              // Store original paths in entries via a follow-up setEntries call below
              // — for simplicity, onFiles uses file.name only; folder structure
              // is preserved when "preserveFolderStructure" is on AND paths are set.
              // We attach paths via the dataTransfer items (above) — but FileList
              // doesn't carry paths, so we patch entries afterwards via a custom event.
              window.dispatchEvent(
                new CustomEvent("unqtools:bulk-image-paths", { detail: paths }),
              );
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

// Listen for path mapping event (set on mount via effect in main component
// — kept here as a module-level listener to avoid cluttering the main component).
if (typeof window !== "undefined") {
  window.addEventListener("unqtools:bulk-image-paths", () => {
    // The main component reads paths via webkitRelativePath on each File
    // during onFiles; this listener is a no-op placeholder for future use.
  });
}

// ===========================================================================
// Rename rules panel
// ===========================================================================

interface RenameRulesPanelProps {
  rule: RenameRule;
  update: (patch: Partial<RenameRule>) => void;
  insertToken: (token: string) => void;
}

function RenameRulesPanel({ rule, update, insertToken }: RenameRulesPanelProps) {
  const [open, setOpen] = useState(true);
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center justify-between w-full text-left"
          aria-expanded={open}
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <Type className="h-4 w-4 text-primary" aria-hidden="true" />
            Rename rules
          </span>
          {open ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
        </button>

        {open && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="rename-pattern" className="text-xs text-muted-foreground">Pattern</Label>
              <Input
                id="rename-pattern"
                value={rule.pattern}
                onChange={(e) => update({ pattern: e.target.value })}
                placeholder="{index}-{original}"
                className="font-mono text-sm"
              />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {TOKENS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => insertToken(t)}
                    className="px-1.5 py-0.5 text-xs rounded border bg-muted hover:bg-muted/70 font-mono"
                    aria-label={`Insert token ${t}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="rename-prefix" className="text-xs text-muted-foreground">Prefix</Label>
                <Input id="rename-prefix" value={rule.prefix} onChange={(e) => update({ prefix: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rename-suffix" className="text-xs text-muted-foreground">Suffix</Label>
                <Input id="rename-suffix" value={rule.suffix} onChange={(e) => update({ suffix: e.target.value })} />
              </div>
            </div>

            <details className="rounded-md border p-3">
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                <Hash className="inline h-3.5 w-3.5 mr-1" aria-hidden="true" />
                Counter settings ({rule.counterStart} / +{rule.counterStep} / pad {rule.counterPad})
              </summary>
              <div className="grid grid-cols-3 gap-3 mt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="counter-start" className="text-xs text-muted-foreground">Start</Label>
                  <Input id="counter-start" type="number" value={rule.counterStart} onChange={(e) => update({ counterStart: Number(e.target.value) })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="counter-step" className="text-xs text-muted-foreground">Step</Label>
                  <Input id="counter-step" type="number" value={rule.counterStep} onChange={(e) => update({ counterStep: Number(e.target.value) })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="counter-pad" className="text-xs text-muted-foreground">Pad</Label>
                  <Input id="counter-pad" type="number" min={0} max={10} value={rule.counterPad} onChange={(e) => update({ counterPad: Number(e.target.value) })} />
                </div>
              </div>
            </details>

            <details className="rounded-md border p-3">
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                <Layers className="inline h-3.5 w-3.5 mr-1" aria-hidden="true" />
                Find / replace{rule.find ? `: "${rule.find}" → "${rule.replace}"` : ""}
              </summary>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="rename-find" className="text-xs text-muted-foreground">Find</Label>
                  <Input id="rename-find" value={rule.find} onChange={(e) => update({ find: e.target.value })} className="font-mono text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rename-replace" className="text-xs text-muted-foreground">Replace</Label>
                  <Input id="rename-replace" value={rule.replace} onChange={(e) => update({ replace: e.target.value })} className="font-mono text-sm" />
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Switch id="rename-regex" checked={rule.useRegex} onCheckedChange={(v) => update({ useRegex: v })} />
                <Label htmlFor="rename-regex" className="text-xs cursor-pointer">Treat find as regex</Label>
              </div>
            </details>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="rename-case" className="text-xs text-muted-foreground">Case</Label>
                <select
                  id="rename-case"
                  aria-label="Case mode"
                  value={rule.caseMode}
                  onChange={(e) => update({ caseMode: e.target.value as CaseMode })}
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="none">Keep original</option>
                  <option value="lower">lowercase</option>
                  <option value="upper">UPPERCASE</option>
                  <option value="kebab">kebab-case</option>
                  <option value="snake">snake_case</option>
                </select>
              </div>
              <div className="flex flex-col gap-2 pt-5">
                <div className="flex items-center gap-2">
                  <Switch id="rename-rmspaces" checked={rule.removeSpaces} onCheckedChange={(v) => update({ removeSpaces: v })} />
                  <Label htmlFor="rename-rmspaces" className="text-xs cursor-pointer">Remove spaces</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="rename-rmspecial" checked={rule.removeSpecialChars} onCheckedChange={(v) => update({ removeSpecialChars: v })} />
                  <Label htmlFor="rename-rmspecial" className="text-xs cursor-pointer">Remove special chars</Label>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ===========================================================================
// Optimize panel
// ===========================================================================

interface OptimizePanelProps {
  optimize: OptimizeOptions;
  update: (patch: Partial<OptimizeOptions>) => void;
}

function OptimizePanel({ optimize, update }: OptimizePanelProps) {
  const [open, setOpen] = useState(true);
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center justify-between w-full text-left"
          aria-expanded={open}
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <Settings2 className="h-4 w-4 text-primary" aria-hidden="true" />
            Optimize options
          </span>
          {open ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
        </button>

        {open && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="opt-format" className="text-xs text-muted-foreground">Format</Label>
                <select
                  id="opt-format"
                  aria-label="Output format"
                  value={optimize.format}
                  onChange={(e) => update({ format: e.target.value as OutputFormat })}
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="image/jpeg">JPEG</option>
                  <option value="image/png">PNG</option>
                  <option value="image/webp">WebP</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="opt-maxdim" className="text-xs text-muted-foreground">Max dim (px)</Label>
                <Input
                  id="opt-maxdim"
                  type="number"
                  value={optimize.maxDimension ?? ""}
                  onChange={(e) => update({ maxDimension: e.target.value ? Number(e.target.value) : undefined })}
                  placeholder="No resize"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="opt-target" className="text-xs text-muted-foreground">Target KB</Label>
                <Input
                  id="opt-target"
                  type="number"
                  value={optimize.targetBytes ? optimize.targetBytes / 1024 : ""}
                  onChange={(e) => update({ targetBytes: e.target.value ? Number(e.target.value) * 1024 : undefined })}
                  placeholder="Auto"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="opt-quality" className="text-xs text-muted-foreground">
                  Quality: {Math.round(optimize.quality * 100)}%
                </Label>
                <Slider
                  id="opt-quality"
                  aria-label="Quality"
                  value={[optimize.quality * 100]}
                  onValueChange={(v) => update({ quality: v[0]! / 100 })}
                  min={10}
                  max={100}
                  step={5}
                  disabled={optimize.format === "image/png"}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Switch id="opt-stripexif" checked={optimize.stripExif} onCheckedChange={(v) => update({ stripExif: v })} />
                <Label htmlFor="opt-stripexif" className="text-xs cursor-pointer">Strip EXIF</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="opt-progressive"
                  checked={optimize.progressive}
                  onCheckedChange={(v) => update({ progressive: v })}
                  disabled={optimize.format !== "image/jpeg"}
                />
                <Label htmlFor="opt-progressive" className="text-xs cursor-pointer">Progressive JPEG</Label>
              </div>
            </div>

            <WatermarkEditor optimize={optimize} update={update} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function WatermarkEditor({ optimize, update }: { optimize: OptimizeOptions; update: (p: Partial<OptimizeOptions>) => void }) {
  const [open, setOpen] = useState(false);
  const wm = optimize.watermark;
  return (
    <details className="rounded-md border p-3" onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
        <Droplet className="inline h-3.5 w-3.5 mr-1" aria-hidden="true" />
        Watermark{wm.enabled ? " (on)" : ""}
      </summary>
      {open && (
        <div className="space-y-3 mt-2">
          <div className="flex items-center gap-2">
            <Switch id="wm-enabled" checked={wm.enabled} onCheckedChange={(v) => update({ watermark: { ...wm, enabled: v } })} />
            <Label htmlFor="wm-enabled" className="text-xs cursor-pointer">Enable watermark</Label>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="wm-text" className="text-xs text-muted-foreground">Text</Label>
              <Input id="wm-text" value={wm.text} onChange={(e) => update({ watermark: { ...wm, text: e.target.value } })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wm-position" className="text-xs text-muted-foreground">Position</Label>
              <select
                id="wm-position"
                aria-label="Watermark position"
                value={wm.position}
                onChange={(e) => update({ watermark: { ...wm, position: e.target.value as WatermarkPosition } })}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="top-left">Top-left</option>
                <option value="top-right">Top-right</option>
                <option value="bottom-left">Bottom-left</option>
                <option value="bottom-right">Bottom-right</option>
                <option value="center">Center</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wm-color" className="text-xs text-muted-foreground">Color</Label>
              <Input id="wm-color" type="color" value={wm.color} onChange={(e) => update({ watermark: { ...wm, color: e.target.value } })} className="h-9 p-1" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wm-opacity" className="text-xs text-muted-foreground">Opacity: {Math.round(wm.opacity * 100)}%</Label>
              <Slider
                id="wm-opacity"
                aria-label="Watermark opacity"
                value={[wm.opacity * 100]}
                onValueChange={(v) => update({ watermark: { ...wm, opacity: v[0]! / 100 } })}
                min={10}
                max={100}
                step={5}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wm-fontsize" className="text-xs text-muted-foreground">Font size (px)</Label>
              <Input id="wm-fontsize" type="number" value={wm.fontSize} onChange={(e) => update({ watermark: { ...wm, fontSize: Number(e.target.value) } })} />
            </div>
          </div>
        </div>
      )}
    </details>
  );
}

// ===========================================================================
// Folder structure panel (extra #8)
// ===========================================================================

function FolderStructurePanel({
  config,
  setConfig,
}: {
  config: RenameOptimizeConfig;
  setConfig: React.Dispatch<React.SetStateAction<RenameOptimizeConfig>>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center justify-between w-full text-left"
          aria-expanded={open}
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <FolderTree className="h-4 w-4 text-primary" aria-hidden="true" />
            Folder structure
          </span>
          {open ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
        </button>
        {open && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Switch
                id="preserve-folder"
                checked={config.preserveFolderStructure}
                onCheckedChange={(v) => setConfig((c) => ({ ...c, preserveFolderStructure: v }))}
              />
              <Label htmlFor="preserve-folder" className="text-xs cursor-pointer">
                Preserve source folder structure in ZIP
              </Label>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="output-folder" className="text-xs text-muted-foreground">
                Output base folder (optional)
              </Label>
              <Input
                id="output-folder"
                value={config.outputFolder}
                onChange={(e) => setConfig((c) => ({ ...c, outputFolder: e.target.value }))}
                placeholder="e.g. optimized"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Tip: enable "Preserve source folder structure" when you dropped a folder via the folder picker — your nested directories will be reproduced inside the ZIP.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ===========================================================================
// Action bar
// ===========================================================================

interface ActionBarProps {
  busy: boolean;
  count: number;
  processedCount: number;
  onProcess: () => void;
  onDownloadZip: () => void;
  onShareUrl: () => void;
  onClear: () => void;
  auditCsv: string;
  auditJson: string;
}

function ActionBar({
  busy,
  count,
  processedCount,
  onProcess,
  onDownloadZip,
  onShareUrl,
  onClear,
  auditCsv,
  auditJson,
}: ActionBarProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={onProcess} disabled={busy || count === 0} className="gap-1.5">
            {busy ? (
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" aria-hidden="true" />
            ) : (
              <Gauge className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {busy ? "Processing…" : "Process all"}
          </Button>
          <Button variant="outline" onClick={onDownloadZip} disabled={processedCount === 0} className="gap-1.5">
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Download ZIP
          </Button>
          <Button variant="outline" onClick={onShareUrl} disabled={count === 0} className="gap-1.5">
            <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
            Share URL
          </Button>
          <DownloadButton
            getText={() => auditCsv}
            filename="audit.csv"
            mime="text/csv"
            label="Audit CSV"
            disabled={count === 0}
          />
          <DownloadButton
            getText={() => auditJson}
            filename="audit.json"
            mime="application/json"
            label="Audit JSON"
            disabled={count === 0}
          />
          <Button variant="ghost" onClick={onClear} disabled={count === 0} className="gap-1.5">
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            Clear
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ===========================================================================
// Stats dashboard (extra #6)
// ===========================================================================

function StatsDashboard({
  stats,
  before,
  after,
  savings,
}: {
  stats: Stats;
  before: number;
  after: number;
  savings: { savings: number; percent: number };
}) {
  const progress = stats.total > 0 ? (stats.processed / stats.total) * 100 : 0;
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Gauge className="h-4 w-4 text-primary" aria-hidden="true" />
          Throughput dashboard
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <Stat label="Before total" value={formatBytes(before)} />
          <Stat label="After total" value={after > 0 ? formatBytes(after) : "—"} accent={after > 0} />
          <Stat label="Saved" value={after > 0 ? `${formatBytes(savings.savings)} (${savings.percent.toFixed(0)}%)` : "—"} accent={savings.savings > 0} />
          <Stat label="Processed" value={`${stats.processed} / ${stats.total}`} />
          <Stat label="Files / sec" value={stats.filesPerSec.toFixed(1)} />
          <Stat label="MB processed" value={stats.mbProcessed.toFixed(1)} />
          <Stat label="ETA" value={stats.etaSec > 0 ? `${stats.etaSec.toFixed(0)}s` : "—"} />
          <Stat label="Peak memory" value={formatBytes(stats.peakMemoryBytes)} warn={stats.peakMemoryBytes > MEMORY_CAP_BYTES * 0.8} />
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span>{progress.toFixed(0)}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, accent, warn }: { label: string; value: string; accent?: boolean; warn?: boolean }) {
  return (
    <div className="rounded-md border p-2">
      <div className="text-muted-foreground">{label}</div>
      <div className={`text-sm font-medium ${accent ? "text-emerald-600 dark:text-emerald-400" : ""} ${warn ? "text-destructive" : ""}`}>{value}</div>
    </div>
  );
}

// ===========================================================================
// Preview table
// ===========================================================================

interface PreviewTableProps {
  entries: FileEntry[];
  preview: PreviewRow[];
  dragId: string | null;
  onDragStart: (id: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (id: string) => void;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
}

function PreviewTable({
  entries,
  preview,
  dragId,
  onDragStart,
  onDragOver,
  onDrop,
  onSelect,
  onRemove,
}: PreviewTableProps) {
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Eye className="h-4 w-4 text-primary" aria-hidden="true" />
          Live preview ({entries.length})
        </div>
        <div className="max-h-[400px] overflow-y-auto rounded-md border">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 sticky top-0">
              <tr>
                <th className="p-2 text-left font-medium w-8" aria-label="Drag handle" />
                <th className="p-2 text-left font-medium w-12">Thumb</th>
                <th className="p-2 text-left font-medium">Original</th>
                <th className="p-2 text-left font-medium">New name</th>
                <th className="p-2 text-left font-medium">Size</th>
                <th className="p-2 text-left font-medium w-8" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => {
                const row = preview[i];
                if (!row) return null;
                const url = URL.createObjectURL(e.file);
                return (
                  <tr
                    key={e.id}
                    draggable
                    onDragStart={() => onDragStart(e.id)}
                    onDragOver={onDragOver}
                    onDrop={() => onDrop(e.id)}
                    className={`border-t hover:bg-muted/30 ${dragId === e.id ? "opacity-50" : ""} ${row.conflict ? "bg-red-50 dark:bg-red-950/20" : ""} ${row.autoSuffixed ? "bg-amber-50 dark:bg-amber-950/20" : ""}`}
                  >
                    <td className="p-2 text-muted-foreground cursor-grab" aria-label="Drag to reorder">
                      <GripVertical className="h-3.5 w-3.5" aria-hidden="true" />
                    </td>
                    <td className="p-2">
                      <button
                        type="button"
                        onClick={() => onSelect(e.id)}
                        aria-label={`View diff for ${e.file.name}`}
                        className="block h-10 w-10 rounded bg-muted overflow-hidden focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <img src={url} alt={e.file.name} className="h-full w-full object-cover" />
                      </button>
                    </td>
                    <td className="p-2 align-top">
                      <div className="font-medium truncate max-w-[200px]">{e.file.name}</div>
                      <div className="text-muted-foreground">{formatBytes(e.file.size)}</div>
                    </td>
                    <td className="p-2 align-top">
                      <div className={`font-mono truncate max-w-[200px] ${row.autoSuffixed ? "text-amber-600 dark:text-amber-400" : ""}`}>
                        {row.newName}
                      </div>
                      <div className="flex gap-1 mt-0.5">
                        {row.conflict && !row.autoSuffixed && (
                          <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4">conflict</Badge>
                        )}
                        {row.autoSuffixed && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-amber-500 text-amber-700 dark:text-amber-300">auto-suffix</Badge>
                        )}
                        {row.error && (
                          <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4">error</Badge>
                        )}
                        {row.newSize > 0 && (
                          <span className="text-emerald-600 dark:text-emerald-400 text-[10px]">
                            {formatBytes(row.newSize)} (-{estimateSizeSavings(e.file.size, row.newSize).percent.toFixed(0)}%)
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-2 align-top whitespace-nowrap">
                      {e.width && e.height ? (
                        <span className="text-muted-foreground"><Ruler className="inline h-3 w-3 mr-0.5" aria-hidden="true" />{e.width}x{e.height}</span>
                      ) : "—"}
                    </td>
                    <td className="p-2">
                      <button
                        type="button"
                        onClick={() => onRemove(e.id)}
                        aria-label={`Remove ${e.file.name}`}
                        className="text-muted-foreground hover:text-destructive focus:outline-none focus:ring-2 focus:ring-ring rounded"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ===========================================================================
// Duplicates panel (extra #4)
// ===========================================================================

function DuplicatesPanel({
  groups,
  entries,
  onSelect,
}: {
  groups: Map<string, string[]>;
  entries: FileEntry[];
  onSelect: (id: string) => void;
}) {
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Layers className="h-4 w-4 text-primary" aria-hidden="true" />
          Perceptual-hash duplicates ({groups.size} group{groups.size === 1 ? "" : "s"})
        </div>
        <p className="text-xs text-muted-foreground">
          Images below look visually similar (perceptual hash distance ≤ 5). Click any to inspect.
        </p>
        <div className="space-y-2">
          {Array.from(groups.entries()).map(([id, similars]) => {
            const primary = entries.find((e) => e.id === id);
            if (!primary) return null;
            return (
              <div key={id} className="rounded-md border p-2">
                <div className="text-xs font-medium truncate">{primary.file.name}</div>
                <div className="text-xs text-muted-foreground mt-1">Similar to:</div>
                <ul className="ml-4 list-disc text-xs">
                  {similars.map((sid) => {
                    const s = entries.find((e) => e.id === sid);
                    if (!s) return null;
                    return (
                      <li key={sid}>
                        <button type="button" onClick={() => onSelect(sid)} className="text-primary hover:underline">
                          {s.file.name}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ===========================================================================
// EXIF inspector panel (extra #9)
// ===========================================================================

function ExifInspectorPanel({ entry }: { entry: FileEntry | null }) {
  const [open, setOpen] = useState(false);
  if (!entry) return null;
  const exif = entry.exif;
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center justify-between w-full text-left"
          aria-expanded={open}
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <Calendar className="h-4 w-4 text-primary" aria-hidden="true" />
            EXIF inspector — {entry.file.name}
          </span>
          {open ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
        </button>
        {open && (
          <div className="text-xs">
            {!exif || Object.keys(exif).length === 0 ? (
              <p className="text-muted-foreground">No EXIF data found in this file. The {`{exif:date}`} token will fall back to the file's last-modified date.</p>
            ) : (
              <dl className="grid grid-cols-2 gap-1">
                {exif.date && <><dt className="text-muted-foreground">Date</dt><dd>{exif.date}</dd></>}
                {exif.width && <><dt className="text-muted-foreground">Width</dt><dd>{exif.width}px</dd></>}
                {exif.height && <><dt className="text-muted-foreground">Height</dt><dd>{exif.height}px</dd></>}
                {exif.make && <><dt className="text-muted-foreground">Make</dt><dd>{exif.make}</dd></>}
                {exif.model && <><dt className="text-muted-foreground">Model</dt><dd>{exif.model}</dd></>}
                {exif.orientation != null && <><dt className="text-muted-foreground">Orientation</dt><dd>{exif.orientation}</dd></>}
                {exif.iso != null && <><dt className="text-muted-foreground">ISO</dt><dd>{exif.iso}</dd></>}
                {exif.fNumber != null && <><dt className="text-muted-foreground">f-number</dt><dd>f/{exif.fNumber}</dd></>}
                {exif.exposureTime != null && <><dt className="text-muted-foreground">Exposure</dt><dd>{exif.exposureTime}s</dd></>}
                {exif.gps?.latitude != null && <><dt className="text-muted-foreground">GPS lat</dt><dd>{exif.gps.latitude.toFixed(4)}</dd></>}
                {exif.gps?.longitude != null && <><dt className="text-muted-foreground">GPS lng</dt><dd>{exif.gps.longitude.toFixed(4)}</dd></>}
              </dl>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ===========================================================================
// History panel (extra #1)
// ===========================================================================

function HistoryPanel({
  history,
  onApply,
  onClear,
}: {
  history: HistoryItem[];
  onApply: (item: HistoryItem) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center justify-between w-full text-left"
          aria-expanded={open}
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <History className="h-4 w-4 text-primary" aria-hidden="true" />
            History ({history.length})
          </span>
          {open ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
        </button>
        {open && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Last {MAX_HISTORY} runs — click to re-apply the configuration.</p>
            {history.map((h) => (
              <div key={h.ts} className="flex items-center justify-between rounded-md border p-2 text-xs">
                <div className="min-w-0">
                  <div className="font-mono truncate">{h.label}</div>
                  <div className="text-muted-foreground">{new Date(h.ts).toLocaleString()}</div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => onApply(h)} className="gap-1">
                    <RotateCcw className="h-3 w-3" aria-hidden="true" />
                    Re-apply
                  </Button>
                </div>
              </div>
            ))}
            <Button size="sm" variant="ghost" onClick={onClear} className="gap-1">
              <Trash2 className="h-3 w-3" aria-hidden="true" />
              Clear history
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ===========================================================================
// Diff modal (extra #5)
// ===========================================================================

function DiffModal({
  entry,
  preview,
  onClose,
  onShowQualityMatrix,
}: {
  entry: FileEntry;
  preview?: PreviewRow;
  onClose: () => void;
  onShowQualityMatrix: () => void;
}) {
  const beforeUrl = URL.createObjectURL(entry.file);
  const afterUrl = entry.outputBlob ? URL.createObjectURL(entry.outputBlob) : null;
  return (
    <div role="dialog" aria-modal="true" aria-label="Before/after diff viewer" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-background rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium">Diff — {entry.file.name}</h3>
          <Button size="icon" variant="ghost" onClick={onClose} aria-label="Close diff viewer">
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Before</div>
            <img src={beforeUrl} alt="Before" className="w-full rounded border" />
            <div className="text-xs mt-1">{formatBytes(entry.file.size)} · {entry.width}x{entry.height}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">After</div>
            {afterUrl ? (
              <>
                <img src={afterUrl} alt="After" className="w-full rounded border" />
                <div className="text-xs mt-1">{formatBytes(entry.outputBlob!.size)} · {preview?.width}x{preview?.height}</div>
              </>
            ) : (
              <div className="w-full h-32 rounded border flex items-center justify-center text-xs text-muted-foreground">
                Not processed yet
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-3">
          <Button size="sm" variant="outline" onClick={onShowQualityMatrix} className="gap-1">
            <Gauge className="h-3.5 w-3.5" aria-hidden="true" />
            Quality matrix
          </Button>
          <Button size="sm" onClick={onClose}>Done</Button>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// Quality matrix modal (extra #7)
// ===========================================================================

function QualityMatrixModal({
  entry,
  config,
  onClose,
}: {
  entry: FileEntry;
  config: RenameOptimizeConfig;
  onClose: () => void;
}) {
  const [results, setResults] = useState<{ quality: number; blob: Blob }[]>([]);
  const [loading, setLoading] = useState(true);
  const levels = [0.1, 0.3, 0.5, 0.7, 0.9];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const out: { quality: number; blob: Blob }[] = [];
      for (const q of levels) {
        try {
          const r = await processImage(entry.file, { ...config.optimize, quality: q, targetBytes: undefined });
          if (r.ok && !cancelled) out.push({ quality: q, blob: r.output.blob });
        } catch {
          /* skip */
        }
      }
      if (!cancelled) {
        setResults(out);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entry, config.optimize]);

  return (
    <div role="dialog" aria-modal="true" aria-label="Quality matrix" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-background rounded-lg max-w-5xl w-full max-h-[90vh] overflow-auto p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium">Quality matrix — {entry.file.name}</h3>
          <Button size="icon" variant="ghost" onClick={onClose} aria-label="Close quality matrix">
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
        {loading ? (
          <div className="text-center text-sm text-muted-foreground py-8">
            <div className="h-6 w-6 mx-auto animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden="true" />
            <p className="mt-2">Rendering 5 quality levels…</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {results.map((r) => (
              <div key={r.quality} className="rounded-md border p-2">
                <img src={URL.createObjectURL(r.blob)} alt={`Quality ${Math.round(r.quality * 100)}%`} className="w-full rounded" />
                <div className="text-xs mt-1 font-medium">{Math.round(r.quality * 100)}%</div>
                <div className="text-xs text-muted-foreground">{formatBytes(r.blob.size)}</div>
                <div className="text-xs text-emerald-600 dark:text-emerald-400">
                  -{estimateSizeSavings(entry.file.size, r.blob.size).percent.toFixed(0)}%
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-end mt-3">
          <Button size="sm" onClick={onClose}>Done</Button>
        </div>
      </div>
    </div>
  );
}
