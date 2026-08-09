"use client";

/** PDF Batch Processor (Pipeline) — real UI (rotate/compress/strip/watermark × many files). */

import React, { useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, FileUp, FolderArchive, Layers, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ActionBar, ClearButton, ErrorBanner, RunButton } from "../../_shared";
import { downloadBytes, formatBytes } from "../_shared/download";
import { runBatch, type BatchOp, type BatchFileResult } from "./logic";

type LoadedFile = { name: string; bytes: Uint8Array; pageCount: number };

export default function BatchPipeline() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<LoadedFile[]>([]);
  const [op, setOp] = useState<BatchOp>("rotate");
  const [rotation, setRotation] = useState<"90" | "180" | "270">("90");
  const [watermarkText, setWatermarkText] = useState("DRAFT");
  const [stripMeta, setStripMeta] = useState(false);
  const [results, setResults] = useState<BatchFileResult[]>([]);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  async function loadFiles(list: FileList | File[]) {
    const arr = Array.from(list);
    const loaded: LoadedFile[] = [];
    for (const f of arr) {
      try {
        const bytes = new Uint8Array(await f.arrayBuffer());
        const doc = await PDFDocument.load(bytes);
        loaded.push({ name: f.name, bytes, pageCount: doc.getPageCount() });
      } catch {
        toast.error(`Could not read ${f.name}`);
      }
    }
    if (loaded.length > 0) {
      setFiles((prev) => [...prev, ...loaded]);
      setResults([]);
      setError("");
      toast.success(`Loaded ${loaded.length} PDF(s)`);
    }
  }

  function reset() {
    setFiles([]);
    setResults([]);
    setError("");
  }

  async function run() {
    if (files.length === 0) return;
    setWorking(true);
    setError("");
    setResults([]);
    const r = await runBatch(
      files.map((f) => ({ name: f.name, bytes: f.bytes })),
      {
        op,
        rotation: Number(rotation) as 90 | 180 | 270,
        watermarkText,
        compress: { stripMetadata: stripMeta },
      }
    );
    setWorking(false);
    if (r.ok) {
      setResults(r.output);
      const okCount = r.output.filter((x) => x.ok).length;
      toast.success(`${okCount}/${r.output.length} processed`);
    } else {
      setError(r.error);
    }
  }

  async function downloadAll() {
    const ok = results.filter((r) => r.ok && r.bytes);
    if (ok.length === 0) return;
    if (ok.length === 1) {
      downloadBytes(ok[0]!.bytes!, `batch-${ok[0]!.name}`);
      return;
    }
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      for (const r of ok) zip.file(`batch-${r.name}`, r.bytes!.slice().buffer as ArrayBuffer);
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "unqtools-batch.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      toast.error("Could not create ZIP — downloading individually.");
      for (const r of ok) downloadBytes(r.bytes!, `batch-${r.name}`);
    }
  }

  return (
    <div className="space-y-4">
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
          <Layers className="mx-auto mb-2 h-9 w-9 text-muted-foreground" />
          <p className="text-sm font-medium">Drop one or more PDFs here or click to browse</p>
          <p className="mt-1 text-xs text-muted-foreground">Apply one operation to many files at once.</p>
        </button>
      ) : (
        <div className="space-y-2">
          {files.map((f) => (
            <div key={f.name} className="flex items-center justify-between rounded-lg border bg-card p-2.5">
              <p className="truncate text-sm font-medium flex-1">{f.name}</p>
              <span className="text-xs text-muted-foreground mr-3">{f.pageCount}p</span>
              <Button variant="ghost" size="icon-sm" aria-label={`Remove ${f.name}`} onClick={() => setFiles((p) => p.filter((x) => x.name !== f.name))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="gap-1.5 cursor-pointer" onClick={() => inputRef.current?.click()}>
            <FileUp className="h-3.5 w-3.5" /> Add more
          </Button>
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
          <div className="flex flex-wrap gap-2">
            {(["rotate", "compress", "strip-metadata", "watermark"] as BatchOp[]).map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setOp(o)}
                aria-pressed={op === o}
                className={`px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer ${op === o ? "bg-primary text-primary-foreground" : "bg-muted text-foreground/80"}`}
              >
                {o}
              </button>
            ))}
          </div>

          {op === "rotate" && (
            <div className="flex flex-wrap gap-2">
              {(["90", "180", "270"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRotation(r)}
                  aria-pressed={rotation === r}
                  className={`px-3 py-1.5 rounded-full text-xs cursor-pointer ${rotation === r ? "bg-primary text-primary-foreground" : "bg-muted text-foreground/80"}`}
                >
                  {r}°
                </button>
              ))}
            </div>
          )}

          {op === "watermark" && (
            <div className="space-y-1">
              <Label htmlFor="bp-wm">Watermark text</Label>
              <Input id="bp-wm" value={watermarkText} onChange={(e) => setWatermarkText(e.target.value)} />
            </div>
          )}

          {op === "compress" && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={stripMeta} onChange={(e) => setStripMeta(e.target.checked)} className="h-4 w-4 accent-primary" />
              Also strip metadata
            </label>
          )}

          <ActionBar>
            <RunButton onClick={() => void run()} disabled={files.length === 0} loading={working} label={`Run on ${files.length} file(s)`} />
            <ClearButton onClick={reset} disabled={files.length === 0} label="Clear" />
          </ActionBar>

          {error && <ErrorBanner message={error} />}

          {results.length > 0 && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{results.filter((r) => r.ok).length}/{results.length} processed</p>
                <Button variant="outline" size="sm" className="gap-1.5 cursor-pointer" onClick={() => void downloadAll()}>
                  <FolderArchive className="h-3.5 w-3.5" /> Download all (ZIP)
                </Button>
              </div>
              <div className="space-y-1.5">
                {results.map((r) => (
                  <div key={r.name} className="flex items-center justify-between rounded-lg border bg-card p-2 text-sm">
                    <span className="truncate">{r.name}</span>
                    {r.ok ? (
                      <Button variant="ghost" size="icon-sm" aria-label={`Download ${r.name}`} onClick={() => r.bytes && downloadBytes(r.bytes, `batch-${r.name}`)}>
                        <Download className="h-4 w-4" />
                      </Button>
                    ) : (
                      <span className="text-xs text-destructive">{r.error}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Privacy: 100% local — files never leave your device.
      </p>
    </div>
  );
}
