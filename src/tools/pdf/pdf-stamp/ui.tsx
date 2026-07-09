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
import { addStamp } from "./logic";
const PRESETS = ["APPROVED", "DRAFT", "CONFIDENTIAL", "PAID", "RECEIVED", "REJECTED", "URGENT", "FINAL"];
const POSITIONS = ["top-left","top-center","top-right","center","bottom-left","bottom-center","bottom-right"] as const;
const COLORS = [{ v: "red", l: "Red" }, { v: "blue", l: "Blue" }, { v: "green", l: "Green" }, { v: "black", l: "Black" }];
export default function PdfStamp() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array; pageCount: number } | null>(null);
  const [text, setText] = useState("APPROVED"); const [includeDate, setIncludeDate] = useState(true);
  const [fontSize, setFontSize] = useState("24"); const [color, setColor] = useState("red");
  const [position, setPosition] = useState<typeof POSITIONS[number]>("center");
  const [pages, setPages] = useState(""); const [result, setResult] = useState<Uint8Array | null>(null);
  const [error, setError] = useState(""); const [working, setWorking] = useState(false);
  async function loadFile(f: File) { try { const bytes = new Uint8Array(await f.arrayBuffer()); const doc = await PDFDocument.load(bytes); setFile({ name: f.name, bytes, pageCount: doc.getPageCount() }); setResult(null); setError(""); } catch { toast.error(`Could not read ${f.name}`); } }
  function reset() { setFile(null); setResult(null); setError(""); setPages(""); }
  async function run() { if (!file) return; setWorking(true); setError(""); setResult(null); const r = await addStamp(file.bytes, { text, includeDate, fontSize: Number(fontSize), color, position, pages }); setWorking(false); if (r.ok) { setResult(r.output); toast.success("Stamp added!"); } else setError(r.error); }
  return (
    <div className="space-y-4">
      {file ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{file.name}</p><p className="text-xs text-muted-foreground">{file.pageCount} pages • {formatBytes(file.bytes.length)}</p></div>
          <Button variant="ghost" size="icon-sm" aria-label="Remove" onClick={reset}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) void loadFile(f); }} className="w-full rounded-xl border-2 border-dashed border-border p-8 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors">
          <FileUp className="mx-auto mb-2 h-8 w-8 text-muted-foreground" /><p className="text-sm font-medium">Drop a PDF here or click to browse</p><p className="mt-1 text-xs text-muted-foreground">Add APPROVED, DRAFT, CONFIDENTIAL or custom stamps</p>
        </button>
      )}
      <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" aria-label="Choose PDF" onChange={(e) => { const f = e.target.files?.[0]; if (f) void loadFile(f); e.target.value = ""; }} />
      {file && (
        <>
          <div className="space-y-1.5"><Label htmlFor="stamp-text">Stamp text</Label><Input id="stamp-text" value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. APPROVED" /></div>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => <Button key={p} variant="outline" size="sm" onClick={() => setText(p)}>{p}</Button>)}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5"><Label htmlFor="stamp-size">Font size</Label><Input id="stamp-size" type="number" min={10} max={72} value={fontSize} onChange={(e) => setFontSize(e.target.value)} className="w-24" /></div>
            <div className="space-y-1.5"><Label htmlFor="stamp-color">Color</Label><select id="stamp-color" value={color} onChange={(e) => setColor(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="" disabled>Select</option>{COLORS.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}</select></div>
            <div className="space-y-1.5"><Label htmlFor="stamp-pos">Position</Label><select id="stamp-pos" value={position} onChange={(e) => setPosition(e.target.value as typeof POSITIONS[number])} className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm">{POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}</select></div>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={includeDate} onChange={(e) => setIncludeDate(e.target.checked)} className="h-4 w-4 rounded border-border" /><span>Include current date in stamp</span></label>
          <div className="space-y-1.5"><Label htmlFor="stamp-pages">Pages (optional)</Label><Input id="stamp-pages" value={pages} onChange={(e) => setPages(e.target.value)} placeholder="All (e.g. 1-3, 5)" /></div>
        </>
      )}
      <ActionBar><RunButton onClick={() => void run()} disabled={!file || !text.trim()} loading={working} label="Add stamp" /><ClearButton onClick={reset} disabled={!file && !result && !error} label="Clear" /></ActionBar>
      {error && <ErrorBanner message={error} />}
      {result && (<div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4"><p className="text-sm font-medium">Stamped PDF ready • {formatBytes(result.length)}</p><Button onClick={() => downloadBytes(result, `stamped-${file?.name ?? "output.pdf"}`)} className="gap-1.5"><Download className="h-4 w-4" /> Download</Button></div>)}
      <p className="text-xs text-muted-foreground">Privacy: stamping runs 100% locally in your browser.</p>
    </div>
  );
}
