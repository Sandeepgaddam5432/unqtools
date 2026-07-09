"use client";
import React, { useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, FileUp, Trash2, Plus, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { ActionBar, ClearButton, ErrorBanner, RunButton } from "../../_shared";
import { downloadBytes, formatBytes } from "../_shared/download";
import { setBookmarks, type Bookmark } from "./logic";
let nextBmId = 0;
export default function PdfBookmarksEditor() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array; pageCount: number } | null>(null);
  const [bookmarks, setBookmarks] = useState<{ id: string; title: string; page: string }[]>([]);
  const [result, setResult] = useState<Uint8Array | null>(null); const [error, setError] = useState(""); const [working, setWorking] = useState(false);
  async function loadFile(f: File) { try { const bytes = new Uint8Array(await f.arrayBuffer()); const doc = await PDFDocument.load(bytes); setFile({ name: f.name, bytes, pageCount: doc.getPageCount() }); setResult(null); setError(""); setBookmarks([{ id: `bm-${++nextBmId}`, title: "Start", page: "1" }]); } catch { toast.error(`Could not read ${f.name}`); } }
  function reset() { setFile(null); setResult(null); setError(""); setBookmarks([]); }
  function addBm() { setBookmarks((p) => [...p, { id: `bm-${++nextBmId}`, title: "", page: "1" }]); }
  function updateBm(id: string, field: "title" | "page", val: string) { setBookmarks((p) => p.map((b) => b.id === id ? { ...b, [field]: val } : b)); }
  function removeBm(id: string) { setBookmarks((p) => p.filter((b) => b.id !== id)); }
  function moveBm(idx: number, delta: number) { setBookmarks((p) => { const t = idx + delta; if (t < 0 || t >= p.length) return p; const n = [...p]; [n[idx], n[t]] = [n[t], n[idx]]; return n; }); }
  async function run() { if (!file) return; setWorking(true); setError(""); setResult(null); const bms: Bookmark[] = bookmarks.map((b) => ({ title: b.title, page: Number(b.page) })); const r = await setBookmarks(file.bytes, bms); setWorking(false); if (r.ok) { setResult(r.output); toast.success("Bookmarks set!"); } else setError(r.error); }
  return (
    <div className="space-y-4">
      {file ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{file.name}</p><p className="text-xs text-muted-foreground">{file.pageCount} pages • {formatBytes(file.bytes.length)}</p></div>
          <Button variant="ghost" size="icon-sm" aria-label="Remove" onClick={reset}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) void loadFile(f); }} className="w-full rounded-xl border-2 border-dashed border-border p-8 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors">
          <FileUp className="mx-auto mb-2 h-8 w-8 text-muted-foreground" /><p className="text-sm font-medium">Drop a PDF here or click to browse</p><p className="mt-1 text-xs text-muted-foreground">Add a table of contents / outline</p>
        </button>
      )}
      <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" aria-label="Choose PDF" onChange={(e) => { const f = e.target.files?.[0]; if (f) void loadFile(f); e.target.value = ""; }} />
      {file && (
        <>
          <div className="space-y-2">
            {bookmarks.map((bm, i) => (
              <div key={bm.id} className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2">
                <span className="w-5 text-center text-xs font-semibold text-muted-foreground">{i + 1}</span>
                <Input value={bm.title} onChange={(e) => updateBm(bm.id, "title", e.target.value)} placeholder="Bookmark title" className="min-w-[150px] flex-1" aria-label={`Bookmark ${i + 1} title`} />
                <div className="flex items-center gap-1"><Label htmlFor={`bm-page-${bm.id}`} className="text-xs text-muted-foreground">Page</Label><Input id={`bm-page-${bm.id}`} type="number" min={1} max={file.pageCount} value={bm.page} onChange={(e) => updateBm(bm.id, "page", e.target.value)} className="h-8 w-16 text-xs" /></div>
                <div className="flex items-center gap-0.5"><Button variant="ghost" size="icon-sm" aria-label="Move up" disabled={i === 0} onClick={() => moveBm(i, -1)}><ArrowUp className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="icon-sm" aria-label="Move down" disabled={i === bookmarks.length - 1} onClick={() => moveBm(i, 1)}><ArrowDown className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="icon-sm" aria-label="Remove bookmark" onClick={() => removeBm(bm.id)}><Trash2 className="h-3.5 w-3.5" /></Button></div>
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={addBm}><Plus className="h-3.5 w-3.5" /> Add bookmark</Button>
        </>
      )}
      <ActionBar><RunButton onClick={() => void run()} disabled={!file || bookmarks.length === 0} loading={working} label="Set bookmarks" /><ClearButton onClick={reset} disabled={!file && !result && !error} label="Clear" /></ActionBar>
      {error && <ErrorBanner message={error} />}
      {result && (<div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4"><p className="text-sm font-medium">PDF with bookmarks ready • {formatBytes(result.length)}</p><Button onClick={() => downloadBytes(result, `bookmarked-${file?.name ?? "output.pdf"}`)} className="gap-1.5"><Download className="h-4 w-4" /> Download</Button></div>)}
      <p className="text-xs text-muted-foreground">Privacy: bookmark editing runs 100% locally in your browser.</p>
    </div>
  );
}
