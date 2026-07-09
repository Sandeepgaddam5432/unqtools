"use client";

import React, { useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { Download, FileUp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ActionBar, ClearButton, ErrorBanner, RunButton } from "../../_shared";
import { downloadBytes, formatBytes } from "../_shared/download";
import { compressPdf } from "./logic";

export default function CompressPdf() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array; pageCount: number } | null>(null);
  const [stripMeta, setStripMeta] = useState(false);
  const [result, setResult] = useState<{ bytes: Uint8Array; originalSize: number; compressedSize: number; reductionPercent: number } | null>(null);
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
      toast.error(`Could not read ${f.name} — it may be corrupted or password-protected.`);
    }
  }

  function reset() {
    setFile(null);
    setResult(null);
    setError("");
    setStripMeta(false);
  }

  async function run() {
    if (!file) return;
    setWorking(true);
    setError("");
    setResult(null);
    const res = await compressPdf(file.bytes, { stripMetadata: stripMeta });
    setWorking(false);
    if (res.ok) {
      setResult(res.output);
      toast.success(`Compressed! ${res.output.reductionPercent}% smaller`);
    } else {
      setError(res.error);
    }
  }

  return (
    <div className="space-y-4">
      {file ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {file.pageCount} page{file.pageCount === 1 ? "" : "s"} • {formatBytes(file.bytes.length)}
            </p>
          </div>
          <Button variant="ghost" size="icon-sm" aria-label="Remove file" onClick={reset}>
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
            const f = e.dataTransfer.files[0];
            if (f) void loadFile(f);
          }}
          className="w-full rounded-xl border-2 border-dashed border-border p-8 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors"
        >
          <FileUp className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">Drop a PDF here or click to browse</p>
          <p className="mt-1 text-xs text-muted-foreground">Re-saves with object streams for smaller size.</p>
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
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none rounded-lg border p-3">
          <input
            type="checkbox"
            checked={stripMeta}
            onChange={(e) => setStripMeta(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          <span>Strip metadata (Title, Author, Subject, Keywords) — saves extra space + enhances privacy</span>
        </label>
      )}

      <ActionBar>
        <RunButton onClick={() => void run()} disabled={!file} loading={working} label="Compress PDF" />
        <ClearButton onClick={reset} disabled={!file && !result && !error} label="Clear" />
      </ActionBar>

      {error && <ErrorBanner message={error} />}

      {result && (
        <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Compressed PDF ready</p>
              <p className="text-xs text-muted-foreground">
                {formatBytes(result.originalSize)} → {formatBytes(result.compressedSize)}
                {result.reductionPercent > 0 && (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    {" "}({result.reductionPercent}% smaller)
                  </span>
                )}
                {result.reductionPercent === 0 && (
                  <span className="text-muted-foreground"> (already optimized)</span>
                )}
              </p>
            </div>
            <Button
              onClick={() => downloadBytes(result.bytes, `compressed-${file?.name ?? "output.pdf"}`)}
              className="gap-1.5"
            >
              <Download className="h-4 w-4" /> Download
            </Button>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Privacy: compression runs 100% locally in your browser — your PDF never leaves your device.
      </p>
    </div>
  );
}
