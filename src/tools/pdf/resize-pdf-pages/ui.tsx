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
import { resizePdfPages } from "./logic";
const PRESETS = [{ v: "a4", l: "A4 (595×842pt)" }, { v: "letter", l: "Letter (612×792pt)" }, { v: "legal", l: "Legal (612×1008pt)" }, { v: "a3", l: "A3 (842×1191pt)" }, { v: "custom", l: "Custom" }] as const;
export default function ResizePdfPages() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array; pageCount: number } | null>(null);
  const [preset, setPreset] = useState<"a4" | "letter" | "legal" | "a3" | "custom">("a4");
  const [orient, setOrient] = useState<"portrait" | "landscape">("portrait");
  const [w, setW] = useState("595"); const [h, setH] = useState("842"); const [pages, setPages] = useState("");
  const [result, setResult] = useState<Uint8Array | null>(null); const [error, setError] = useState(""); const [working, setWorking] = useState(false);
  async function loadFile(f: File) { try { const bytes = new Uint8Array(await f.arrayBuffer()); const doc = await PDFDocument.load(bytes); setFile({ name: f.name, bytes, pageCount: doc.getPageCount() }); setResult(null); setError(""); } catch { toast.error(`Could not read ${f.name}`); } }
  function reset() { setFile(null); setResult(null); setError(""); setPages(""); }
  async function run() { if (!file) return; setWorking(true); setError(""); setResult(null); const r = await resizePdfPages(file.bytes, { preset, orientation: orient, customWidth: Number(w), customHeight: Number(h), pages }); setWorking(false); if (r.ok) { setResult(r.output); toast.success("Pages resized!"); } else setError(r.error); }
  return (
    <div className="space-y-4">
      {file ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{file.name}</p><p className="text-xs text-muted-foreground">{file.pageCount} pages • {formatBytes(file.bytes.length)}</p></div>
          <Button variant="ghost" size="icon-sm" aria-label="Remove" onClick={reset}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) void loadFile(f); }} className="w-full rounded-xl border-2 border-dashed border-border p-8 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors">
          <FileUp className="mx-auto mb-2 h-8 w-8 text-muted-foreground" /><p className="text-sm font-medium">Drop a PDF here or click to browse</p><p className="mt-1 text-xs text-muted-foreground">Change page dimensions to A4, Letter, Legal, A3, or custom</p>
        </button>
      )}
      <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" aria-label="Choose PDF" onChange={(e) => { const f = e.target.files?.[0]; if (f) void loadFile(f); e.target.value = ""; }} />
      {file && (
        <>
          <div role="radiogroup" aria-label="Page size" className="grid gap-2 sm:grid-cols-5">
            {PRESETS.map((p) => <button key={p.v} type="button" role="radio" aria-checked={preset === p.v} onClick={() => setPreset(p.v)} className={preset === p.v ? "rounded-lg border border-primary bg-primary/10 p-2 text-left text-sm" : "rounded-lg border border-border p-2 text-left text-sm hover:border-primary/40"}>{p.l}</button>)}
          </div>
          {preset === "custom" && (
            <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="resize-w">Width (pt)</Label><Input id="resize-w" type="number" min={1} value={w} onChange={(e) => setW(e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="resize-h">Height (pt)</Label><Input id="resize-h" type="number" min={1} value={h} onChange={(e) => setH(e.target.value)} /></div></div>
          )}
          <div role="radiogroup" aria-label="Orientation" className="flex gap-2">
            {(["portrait", "landscape"] as const).map((o) => <button key={o} type="button" role="radio" aria-checked={orient === o} onClick={() => setOrient(o)} className={orient === o ? "rounded-lg border border-primary bg-primary/10 px-4 py-2 text-sm capitalize" : "rounded-lg border border-border px-4 py-2 text-sm capitalize hover:border-primary/40"}>{o}</button>)}
          </div>
          <div className="space-y-1.5"><Label htmlFor="resize-pages">Pages (optional)</Label><Input id="resize-pages" value={pages} onChange={(e) => setPages(e.target.value)} placeholder="All (e.g. 1-3, 5)" /></div>
        </>
      )}
      <ActionBar><RunButton onClick={() => void run()} disabled={!file} loading={working} label="Resize PDF" /><ClearButton onClick={reset} disabled={!file && !result && !error} label="Clear" /></ActionBar>
      {error && <ErrorBanner message={error} />}
      {result && (<div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4"><p className="text-sm font-medium">Resized PDF ready • {formatBytes(result.length)}</p><Button onClick={() => downloadBytes(result, `resized-${file?.name ?? "output.pdf"}`)} className="gap-1.5"><Download className="h-4 w-4" /> Download</Button></div>)}
      <p className="text-xs text-muted-foreground">Privacy: resizing runs 100% locally in your browser.</p>
    </div>
  );
}
