"use client";
import React, { useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, FileUp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ActionBar, ClearButton, ErrorBanner, RunButton } from "../../_shared";
import { downloadBytes, formatBytes } from "../_shared/download";
import { scalePdf } from "./logic";
export default function ScalePdf() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array; pageCount: number } | null>(null);
  const [scale, setScale] = useState("100"); const [pages, setPages] = useState("");
  const [result, setResult] = useState<Uint8Array | null>(null); const [error, setError] = useState(""); const [working, setWorking] = useState(false);
  async function loadFile(f: File) { try { const bytes = new Uint8Array(await f.arrayBuffer()); const doc = await PDFDocument.load(bytes); setFile({ name: f.name, bytes, pageCount: doc.getPageCount() }); setResult(null); setError(""); } catch { toast.error(`Could not read ${f.name}`); } }
  function reset() { setFile(null); setResult(null); setError(""); setPages(""); setScale("100"); }
  async function run() { if (!file) return; setWorking(true); setError(""); setResult(null); const r = await scalePdf(file.bytes, { scale: Number(scale) / 100, pages }); setWorking(false); if (r.ok) { setResult(r.output); toast.success("Content scaled!"); } else setError(r.error); }
  return (
    <div className="space-y-4">
      {file ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{file.name}</p><p className="text-xs text-muted-foreground">{file.pageCount} pages • {formatBytes(file.bytes.length)}</p></div>
          <Button variant="ghost" size="icon-sm" aria-label="Remove" onClick={reset}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) void loadFile(f); }} className="w-full rounded-xl border-2 border-dashed border-border p-8 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors">
          <FileUp className="mx-auto mb-2 h-8 w-8 text-muted-foreground" /><p className="text-sm font-medium">Drop a PDF here or click to browse</p><p className="mt-1 text-xs text-muted-foreground">Scale content from 25% to 400%</p>
        </button>
      )}
      <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" aria-label="Choose PDF" onChange={(e) => { const f = e.target.files?.[0]; if (f) void loadFile(f); e.target.value = ""; }} />
      {file && (
        <>
          <div className="space-y-1.5"><Label htmlFor="scale-val">Scale percentage (25–400%)</Label><Input id="scale-val" type="number" min={25} max={400} value={scale} onChange={(e) => setScale(e.target.value)} className="w-32" /><p className="text-xs text-muted-foreground">100% = original size. 50% = half, 200% = double.</p></div>
          <div className="space-y-1.5"><Label htmlFor="scale-pages">Pages (optional)</Label><Input id="scale-pages" value={pages} onChange={(e) => setPages(e.target.value)} placeholder="All (e.g. 1-3, 5)" /></div>
        </>
      )}
      <ActionBar><RunButton onClick={() => void run()} disabled={!file} loading={working} label="Scale PDF" /><ClearButton onClick={reset} disabled={!file && !result && !error} label="Clear" /></ActionBar>
      {error && <ErrorBanner message={error} />}
      {result && (<div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4"><p className="text-sm font-medium">Scaled PDF ready • {formatBytes(result.length)}</p><Button onClick={() => downloadBytes(result, `scaled-${file?.name ?? "output.pdf"}`)} className="gap-1.5"><Download className="h-4 w-4" /> Download</Button></div>)}
      <p className="text-xs text-muted-foreground">Privacy: scaling runs 100% locally in your browser.</p>
    </div>
  );
}
