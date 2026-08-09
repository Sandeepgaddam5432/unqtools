"use client";

/**
 * Compress PDF — 100x UI.
 * Multi-file batch, 5 quality presets, custom quality slider, downscale,
 * grayscale, exact target-size mode, metadata strip, per-file results table,
 * ZIP download (jszip) or individual downloads. 100% client-side.
 */

import React, { useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, FileUp, Trash2, FolderArchive, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { ActionBar, ClearButton, ErrorBanner, RunButton } from "../../_shared";
import { downloadBytes, formatBytes } from "../_shared/download";
import {
  compressPdf,
  compressPdfs,
  QUALITY_PRESETS,
  presetFor,
  type CompressOptions,
  type QualityPreset,
  type CompressResult,
} from "./logic";

type LoadedFile = { name: string; bytes: Uint8Array; pageCount: number };
type DoneItem = { name: string; result: CompressResult };

export default function CompressPdf() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<LoadedFile[]>([]);
  const [preset, setPreset] = useState<QualityPreset>("high");
  const [customQuality, setCustomQuality] = useState(false);
  const [quality, setQuality] = useState(80);
  const [scale, setScale] = useState(1);
  const [grayscale, setGrayscale] = useState(false);
  const [stripMeta, setStripMeta] = useState(false);
  const [targetMode, setTargetMode] = useState(false);
  const [targetKB, setTargetKB] = useState(200);
  const [results, setResults] = useState<DoneItem[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  async function loadFiles(list: FileList | File[]) {
    const arr = Array.from(list);
    const loaded: LoadedFile[] = [];
    for (const f of arr) {
      try {
        if (!/\.pdf$/i.test(f.name)) {
          toast.error(`${f.name} is not a PDF`);
          continue;
        }
        const bytes = new Uint8Array(await f.arrayBuffer());
        const doc = await PDFDocument.load(bytes);
        loaded.push({ name: f.name, bytes, pageCount: doc.getPageCount() });
      } catch {
        toast.error(`Could not read ${f.name} — it may be corrupted or password-protected.`);
      }
    }
    if (loaded.length > 0) {
      setFiles((prev) => [...prev, ...loaded]);
      setResults([]);
      setErrors([]);
      setError("");
      toast.success(`Loaded ${loaded.length} PDF${loaded.length === 1 ? "" : "s"}`);
    }
  }

  function removeFile(name: string) {
    setFiles((prev) => prev.filter((f) => f.name !== name));
    setResults([]);
  }

  function reset() {
    setFiles([]);
    setResults([]);
    setErrors([]);
    setError("");
  }

  function buildOptions(): CompressOptions {
    const p = presetFor(preset);
    return {
      quality: customQuality ? quality / 100 : p.quality,
      scaleFactor: customQuality ? scale : p.scale,
      grayscale,
      stripMetadata: stripMeta,
      ...(targetMode && targetKB > 0 ? { targetSizeKB: targetKB } : {}),
    };
  }

  async function run() {
    if (files.length === 0) return;
    setWorking(true);
    setError("");
    setResults([]);
    setErrors([]);

    const opts = buildOptions();
    // Target-size mode is per-file (each file hits its own target).
    if (targetMode && targetKB > 0) {
      const done: DoneItem[] = [];
      const errs: string[] = [];
      for (const f of files) {
        try {
          const res = await compressPdf(f.bytes, opts);
          if (res.ok) done.push({ name: f.name, result: res.output });
          else errs.push(`${f.name}: ${res.error}`);
        } catch {
          errs.push(`${f.name}: unexpected error`);
        }
      }
      setResults(done);
      setErrors(errs);
    } else {
      const out = await compressPdfs(
        files.map((f) => ({ name: f.name, bytes: f.bytes })),
        opts
      );
      const done: DoneItem[] = [];
      const errs: string[] = [];
      for (const item of out) {
        if (item.ok && item.result) done.push({ name: item.name, result: item.result });
        else if (item.error) errs.push(`${item.name}: ${item.error}`);
      }
      setResults(done);
      setErrors(errs);
    }
    setWorking(false);
    if (results.length === 0 && errors.length === 0 && files.length > 0) {
      // compute after state set — use local counts
    }
  }

  const doneCount = results.length;
  const totalSaved =
    results.reduce((acc, r) => acc + Math.max(0, r.result.originalSize - r.result.compressedSize), 0) || 0;

  async function downloadAll() {
    if (results.length === 0) return;
    if (results.length === 1) {
      downloadBytes(results[0]!.result.bytes, results[0]!.name.replace(/\.pdf$/i, "") + "-compressed.pdf");
      return;
    }
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      for (const r of results) {
        zip.file(r.name.replace(/\.pdf$/i, "") + "-compressed.pdf", r.result.bytes.slice().buffer as ArrayBuffer);
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "unqtools-compressed.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      toast.error("Could not create ZIP — downloading files individually instead.");
      for (const r of results) {
        downloadBytes(r.result.bytes, r.name.replace(/\.pdf$/i, "") + "-compressed.pdf");
      }
    }
  }

  const seg = (v: number) => {
    const s = Math.max(0, Math.round(v));
    return `${s}% smaller`;
  };

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      {files.length === 0 ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void loadFiles(e.dataTransfer.files);
          }}
          className="w-full rounded-xl border-2 border-dashed border-border p-10 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors"
        >
          <FileUp className="mx-auto mb-2 h-9 w-9 text-muted-foreground" />
          <p className="text-sm font-medium">Drop one or more PDFs here or click to browse</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Batch up to 20 files — each one compressed with the same settings. 100% local.
          </p>
        </button>
      ) : (
        <div className="space-y-2">
          {files.map((f) => (
            <div key={f.name} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{f.name}</p>
                <p className="text-xs text-muted-foreground">{f.pageCount} pages • {formatBytes(f.bytes.length)}</p>
              </div>
              <Button variant="ghost" size="icon-sm" aria-label={`Remove ${f.name}`} onClick={() => removeFile(f.name)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 cursor-pointer" onClick={() => inputRef.current?.click()}>
              <FileUp className="h-3.5 w-3.5" /> Add more
            </Button>
          </div>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        className="hidden"
        aria-label="Choose PDFs"
        onChange={(e) => {
          if (e.target.files) void loadFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {files.length > 0 && (
        <div className="space-y-4 rounded-xl border bg-card p-4">
          {/* Quality presets */}
          <div className="space-y-2">
            <Label>Compression level</Label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(QUALITY_PRESETS) as QualityPreset[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setPreset(p);
                    setCustomQuality(false);
                  }}
                  aria-pressed={!customQuality && preset === p}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                    !customQuality && preset === p
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground/80 hover:bg-muted/80"
                  }`}
                >
                  {p.replace("-", " ")}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCustomQuality(true)}
                aria-pressed={customQuality}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                  customQuality ? "bg-primary text-primary-foreground" : "bg-muted text-foreground/80 hover:bg-muted/80"
                }`}
              >
                Custom
              </button>
            </div>
            {!customQuality && (
              <p className="text-xs text-muted-foreground">{QUALITY_PRESETS[preset].label}</p>
            )}
            {customQuality && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <Label htmlFor="c-q">JPEG quality: {quality}%</Label>
                  <Input
                    id="c-q"
                    type="range"
                    min={10}
                    max={100}
                    value={quality}
                    onChange={(e) => setQuality(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="c-s">Downscale: {Math.round(scale * 100)}%</Label>
                  <Input
                    id="c-s"
                    type="range"
                    min={25}
                    max={100}
                    step={5}
                    value={scale * 100}
                    onChange={(e) => setScale(Number(e.target.value) / 100)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Target size mode */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                id="target-mode"
                type="checkbox"
                checked={targetMode}
                onChange={(e) => setTargetMode(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              <Label htmlFor="target-mode" className="cursor-pointer">
                Exact target size (auto-adjust quality until it fits)
              </Label>
            </div>
            {targetMode && (
              <div className="flex items-center gap-2">
                <Input
                  id="target-kb"
                  type="number"
                  min={20}
                  max={102400}
                  value={targetKB}
                  onChange={(e) => setTargetKB(Math.max(20, Number(e.target.value) || 20))}
                  className="w-32"
                />
                <span className="text-sm text-muted-foreground">KB — e.g. 200, 500, 1000</span>
              </div>
            )}
          </div>

          {/* Toggles */}
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={grayscale} onChange={(e) => setGrayscale(e.target.checked)} className="h-4 w-4 accent-primary" />
              Grayscale (best for scans/docs)
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={stripMeta} onChange={(e) => setStripMeta(e.target.checked)} className="h-4 w-4 accent-primary" />
              Strip metadata (privacy)
            </label>
          </div>

          <ActionBar>
            <RunButton
              onClick={() => void run()}
              disabled={files.length === 0}
              loading={working}
              label={targetMode ? `Compress to ${targetKB} KB` : `Compress ${files.length} file${files.length === 1 ? "" : "s"}`}
            />
            <ClearButton onClick={reset} disabled={files.length === 0} label="Clear" />
          </ActionBar>

          {error && <ErrorBanner message={error} />}

          {/* Per-file errors */}
          {errors.length > 0 && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive space-y-1">
              {errors.map((e, i) => (
                <p key={i}>{e}</p>
              ))}
            </div>
          )}

          {/* Results table */}
          {results.length > 0 && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  {doneCount} file{doneCount === 1 ? "" : "s"} compressed
                  {totalSaved > 0 && (
                    <span className="text-muted-foreground font-normal">
                      — saved {formatBytes(totalSaved)} total ({seg((totalSaved / results.reduce((a, r) => a + r.result.originalSize, 0)) * 100)})
                    </span>
                  )}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" className="gap-1.5 cursor-pointer" onClick={() => void downloadAll()}>
                    <FolderArchive className="h-3.5 w-3.5" />
                    {results.length === 1 ? "Download" : "Download all (ZIP)"}
                  </Button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b border-border">
                      <th className="py-1.5 pr-3 font-medium">File</th>
                      <th className="py-1.5 pr-3 font-medium">Before</th>
                      <th className="py-1.5 pr-3 font-medium">After</th>
                      <th className="py-1.5 pr-3 font-medium">Saved</th>
                      <th className="py-1.5 font-medium">Download</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r) => (
                      <tr key={r.name} className="border-b border-border/60 last:border-0">
                        <td className="py-2 pr-3 font-medium max-w-[220px] truncate">{r.name}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{formatBytes(r.result.originalSize)}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{formatBytes(r.result.compressedSize)}</td>
                        <td className="py-2 pr-3 text-emerald-600 dark:text-emerald-400 font-medium">
                          {r.result.reductionPercent}%
                        </td>
                        <td className="py-2">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Download ${r.name}`}
                            onClick={() =>
                              downloadBytes(r.result.bytes, r.name.replace(/\.pdf$/i, "") + "-compressed.pdf")
                            }
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {results.some((r) => r.result.imagesRecompressed === 0) && (
                <p className="text-xs text-muted-foreground">
                  Files with no re-encoded images were optimized structurally (object streams, metadata) — quality is
                  preserved exactly.
                </p>
              )}
              {results.some((r) => r.result.targetReached) && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3" /> Target size reached — quality was auto-adjusted to fit.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Privacy: 100% local — files never leave your device. Real image recompression happens in your browser (JPEG
        re-encoding + optional downscale/grayscale). iLovePDF and Smallpdf only offer 3 presets and upload to servers —
        here you get 5 presets, a custom quality slider, exact target size and batch.
      </p>
    </div>
  );
}
