"use client";

/**
 * Black & White (1-bit) Scan Optimizer — real UI.
 * Threshold, dithering, despeckle, quality, page ranges. Works on
 * image-based (scanned) PDFs; processed images are swapped in place.
 */

import React, { useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, FileUp, Trash2, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { ActionBar, ClearButton, ErrorBanner, RunButton } from "../../_shared";
import { downloadBytes, formatBytes } from "../_shared/download";
import { optimizeBwPdf } from "./logic";

type LoadedFile = { name: string; bytes: Uint8Array; pageCount: number };

export default function BwScanOptimizer() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [threshold, setThreshold] = useState("128");
  const [dither, setDither] = useState(false);
  const [despeckle, setDespeckle] = useState("0");
  const [quality, setQuality] = useState("92");
  const [pages, setPages] = useState("");
  const [result, setResult] = useState<Uint8Array | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  async function loadFile(f: File) {
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const doc = await PDFDocument.load(bytes);
      setFile({ name: f.name, bytes, pageCount: doc.getPageCount() });
      setResult(null);
      setError("");
    } catch {
      toast.error(`Could not read ${f.name}`);
    }
  }

  function reset() {
    setFile(null);
    setResult(null);
    setError("");
  }

  async function run() {
    if (!file) return;
    setWorking(true);
    setError("");
    setResult(null);
    const r = await optimizeBwPdf(file.bytes, {
      threshold: Number(threshold) || 128,
      dither,
      despeckle: Number(despeckle) || 0,
      quality: (Number(quality) || 92) / 100,
      pages,
    });
    setWorking(false);
    if (r.ok) {
      setResult(r.output.bytes);
      toast.success(`Optimized ${r.output.imagesProcessed} image(s)`);
    } else {
      setError(r.error);
    }
  }

  return (
    <div className="space-y-4">
      {file ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">{file.pageCount} pages • {formatBytes(file.bytes.length)}</p>
          </div>
          <Button variant="ghost" size="icon-sm" aria-label="Remove" onClick={reset}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) void loadFile(f);
          }}
          className="w-full rounded-xl border-2 border-dashed border-border p-10 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors"
        >
          <ScanLine className="mx-auto mb-2 h-9 w-9 text-muted-foreground" />
          <p className="text-sm font-medium">Drop a scanned PDF here or click to browse</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Converts embedded images to crisp 1-bit black &amp; white — great before B&amp;W printing or faxing.
          </p>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        aria-label="Choose PDF"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void loadFile(f);
          e.target.value = "";
        }}
      />

      {file && (
        <div className="space-y-4 rounded-xl border bg-card p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label htmlFor="bw-thresh">Threshold: {threshold}</Label>
              <Input id="bw-thresh" type="range" min={0} max={255} value={threshold} onChange={(e) => setThreshold(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bw-desp">Despeckle</Label>
              <select value={despeckle} onChange={(e) => setDespeckle(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="0">Off</option>
                <option value="1">Light (3×3)</option>
                <option value="2">Strong (5×5)</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="bw-q">Quality: {quality}%</Label>
              <Input id="bw-q" type="range" min={50} max={100} value={quality} onChange={(e) => setQuality(e.target.value)} />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={dither} onChange={(e) => setDither(e.target.checked)} className="h-4 w-4 accent-primary" />
                Dither (halftones)
              </label>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="bw-pages">Pages (optional)</Label>
            <Input id="bw-pages" value={pages} onChange={(e) => setPages(e.target.value)} placeholder={`All — or e.g. 1, 3-5`} />
          </div>

          <ActionBar>
            <RunButton onClick={() => void run()} disabled={!file} loading={working} label="Optimize to B&W" />
            <ClearButton onClick={reset} disabled={!file && !result && !error} label="Clear" />
          </ActionBar>

          {error && <ErrorBanner message={error} />}

          {result && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
              <p className="text-sm font-medium">Optimized PDF ready • {formatBytes(result.length)}</p>
              <Button onClick={() => downloadBytes(result, `bw-${file?.name ?? "output.pdf"}`)} className="gap-1.5">
                <Download className="h-4 w-4" /> Download
              </Button>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Privacy: 100% local — your scan never leaves your device. Works best on scanned/image-based PDFs (embedded photos are re-encoded as crisp 1-bit images).
      </p>
    </div>
  );
}
