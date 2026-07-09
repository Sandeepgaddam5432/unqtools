"use client";
import React, { useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { Download, FileUp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ActionBar, ClearButton, ErrorBanner, RunButton } from "../../_shared";
import { downloadBytes, formatBytes } from "../_shared/download";
import { nUpPdf, type NUpLayout } from "./logic";
const LAYOUTS: { v: NUpLayout; l: string; h: string }[] = [
  { v: 2, l: "2-up", h: "2 pages side by side" }, { v: 4, l: "4-up", h: "2×2 grid" },
  { v: 6, l: "6-up", h: "3×2 grid" }, { v: 8, l: "8-up", h: "4×2 grid" }, { v: 16, l: "16-up", h: "4×4 grid" },
];
export default function NUpPdf() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array; pageCount: number } | null>(null);
  const [layout, setLayout] = useState<NUpLayout>(4);
  const [result, setResult] = useState<Uint8Array | null>(null); const [error, setError] = useState(""); const [working, setWorking] = useState(false);
  async function loadFile(f: File) { try { const bytes = new Uint8Array(await f.arrayBuffer()); const doc = await PDFDocument.load(bytes); setFile({ name: f.name, bytes, pageCount: doc.getPageCount() }); setResult(null); setError(""); } catch { toast.error(`Could not read ${f.name}`); } }
  function reset() { setFile(null); setResult(null); setError(""); }
  async function run() { if (!file) return; setWorking(true); setError(""); setResult(null); const r = await nUpPdf(file.bytes, layout); setWorking(false); if (r.ok) { setResult(r.output); toast.success("N-up layout created!"); } else setError(r.error); }
  return (
    <div className="space-y-4">
      {file ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{file.name}</p><p className="text-xs text-muted-foreground">{file.pageCount} pages • {formatBytes(file.bytes.length)}</p></div>
          <Button variant="ghost" size="icon-sm" aria-label="Remove" onClick={reset}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) void loadFile(f); }} className="w-full rounded-xl border-2 border-dashed border-border p-8 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors">
          <FileUp className="mx-auto mb-2 h-8 w-8 text-muted-foreground" /><p className="text-sm font-medium">Drop a PDF here or click to browse</p><p className="mt-1 text-xs text-muted-foreground">Arrange multiple pages per sheet</p>
        </button>
      )}
      <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" aria-label="Choose PDF" onChange={(e) => { const f = e.target.files?.[0]; if (f) void loadFile(f); e.target.value = ""; }} />
      {file && (
        <div role="radiogroup" aria-label="N-up layout" className="grid gap-2 sm:grid-cols-5">
          {LAYOUTS.map((l) => <button key={l.v} type="button" role="radio" aria-checked={layout === l.v} onClick={() => setLayout(l.v)} className={layout === l.v ? "rounded-lg border border-primary bg-primary/10 p-3 text-left" : "rounded-lg border border-border p-3 text-left hover:border-primary/40"}><p className="text-sm font-medium">{l.l}</p><p className="mt-0.5 text-xs text-muted-foreground">{l.h}</p></button>)}
        </div>
      )}
      <ActionBar><RunButton onClick={() => void run()} disabled={!file} loading={working} label="Create N-up PDF" /><ClearButton onClick={reset} disabled={!file && !result && !error} label="Clear" /></ActionBar>
      {error && <ErrorBanner message={error} />}
      {result && (<div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4"><p className="text-sm font-medium">N-up PDF ready • {formatBytes(result.length)}</p><Button onClick={() => downloadBytes(result, `nup-${file?.name ?? "output.pdf"}`)} className="gap-1.5"><Download className="h-4 w-4" /> Download</Button></div>)}
      <p className="text-xs text-muted-foreground">Privacy: N-up layout runs 100% locally in your browser.</p>
    </div>
  );
}
