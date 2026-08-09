"use client";

/** Compress PDF to Target Size — real UI (target-first). */

import React, { useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, FileUp, Target, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ActionBar, ClearButton, ErrorBanner, RunButton } from "../../_shared";
import { downloadBytes, formatBytes } from "../_shared/download";
import { compressToTargetSize } from "./logic";

type LoadedFile = { name: string; bytes: Uint8Array; pageCount: number };

export default function CompressToTarget() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [target, setTarget] = useState("200");
  const [grayscale, setGrayscale] = useState(false);
  const [stripMeta, setStripMeta] = useState(false);
  const [result, setResult] = useState<Uint8Array | null>(null);
  const [report, setReport] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  async function loadFile(f: File) {
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const doc = await PDFDocument.load(bytes);
      setFile({ name: f.name, bytes, pageCount: doc.getPageCount() });
      setResult(null);
      setError("");
      setReport("");
    } catch {
      toast.error(`Could not read ${f.name}`);
    }
  }

  function reset() {
    setFile(null);
    setResult(null);
    setError("");
    setReport("");
  }

  async function run() {
    if (!file) return;
    setWorking(true);
    setError("");
    setResult(null);
    setReport("");
    const r = await compressToTargetSize(file.bytes, {
      targetKB: Number(target) || 200,
      grayscale,
      stripMetadata: stripMeta,
    });
    setWorking(false);
    if (r.ok) {
      setResult(r.output.bytes);
      setReport(
        `Target: ${r.output.targetKB} KB — ${r.output.targetReached ? "reached ✅" : "as close as possible"} · ${formatBytes(r.output.originalSize)} → ${formatBytes(r.output.compressedSize)} (${r.output.reductionPercent}% smaller)`
      );
      toast.success(r.output.targetReached ? "Target size reached!" : "Compressed to the smallest possible size");
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
          <Target className="mx-auto mb-2 h-9 w-9 text-muted-foreground" />
          <p className="text-sm font-medium">Drop a PDF here or click to browse</p>
          <p className="mt-1 text-xs text-muted-foreground">Auto-adjusts quality until the file fits your exact size.</p>
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
          <div className="flex items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="ct-kb">Target size (KB)</Label>
              <Input id="ct-kb" type="number" min={20} value={target} onChange={(e) => setTarget(e.target.value)} className="w-32" />
            </div>
            <p className="text-xs text-muted-foreground pb-2">e.g. 200, 500, 1000 — for portals with upload limits</p>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={grayscale} onChange={(e) => setGrayscale(e.target.checked)} className="h-4 w-4 accent-primary" />
              Grayscale (best for scans)
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={stripMeta} onChange={(e) => setStripMeta(e.target.checked)} className="h-4 w-4 accent-primary" />
              Strip metadata
            </label>
          </div>

          <ActionBar>
            <RunButton onClick={() => void run()} disabled={!file} loading={working} label={`Compress to ${Number(target) || 200} KB`} />
            <ClearButton onClick={reset} disabled={!file && !result && !error} label="Clear" />
          </ActionBar>

          {error && <ErrorBanner message={error} />}

          {result && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
              <div>
                <p className="text-sm font-medium">PDF ready • {formatBytes(result.length)}</p>
                {report && <p className="text-xs text-muted-foreground mt-0.5">{report}</p>}
              </div>
              <Button onClick={() => downloadBytes(result, `${file?.name.replace(/\.pdf$/i, "") ?? "output"}-${Number(target) || 200}kb.pdf`)} className="gap-1.5">
                <Download className="h-4 w-4" /> Download
              </Button>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Privacy: 100% local — your PDF never leaves your device. iLovePDF and Smallpdf only offer 3 vague presets; here you type an exact size.
      </p>
    </div>
  );
}
