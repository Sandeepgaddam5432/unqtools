"use client";
import React, { useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, FileUp, Trash2, ImageUp } from "lucide-react";
import { toast } from "sonner";
import { ActionBar, ClearButton, ErrorBanner, RunButton } from "../../_shared";
import { downloadBytes, formatBytes } from "../_shared/download";
import { drawSignature } from "./logic";
export default function PdfSignDraw() {
  const pdfRef = useRef<HTMLInputElement>(null); const imgRef = useRef<HTMLInputElement>(null);
  const [pdf, setPdf] = useState<{ name: string; bytes: Uint8Array; pageCount: number } | null>(null);
  const [img, setImg] = useState<{ name: string; bytes: Uint8Array; mime: string } | null>(null);
  const [page, setPage] = useState("1"); const [x, setX] = useState("100"); const [y, setY] = useState("100");
  const [w, setW] = useState("200"); const [h, setH] = useState("80");
  const [result, setResult] = useState<Uint8Array | null>(null); const [error, setError] = useState(""); const [working, setWorking] = useState(false);
  async function loadPdf(f: File) { try { const bytes = new Uint8Array(await f.arrayBuffer()); const doc = await PDFDocument.load(bytes); setPdf({ name: f.name, bytes, pageCount: doc.getPageCount() }); setResult(null); setError(""); } catch { toast.error(`Could not read ${f.name}`); } }
  async function loadImg(f: File) { try { const bytes = new Uint8Array(await f.arrayBuffer()); setImg({ name: f.name, bytes, mime: f.type || "image/png" }); setResult(null); } catch { toast.error(`Could not read ${f.name}`); } }
  function reset() { setPdf(null); setImg(null); setResult(null); setError(""); setPage("1"); setX("100"); setY("100"); setW("200"); setH("80"); }
  async function run() { if (!pdf || !img) return; setWorking(true); setError(""); setResult(null); const r = await drawSignature(pdf.bytes, { signatureBytes: img.bytes, signatureMime: img.mime, page: Number(page), x: Number(x), y: Number(y), width: Number(w), height: Number(h) }); setWorking(false); if (r.ok) { setResult(r.output); toast.success("Signature placed!"); } else setError(r.error); }
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1.5 text-sm font-medium">PDF document</p>
          {pdf ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3"><div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">{pdf.name}</p><p className="text-xs text-muted-foreground">{pdf.pageCount}p • {formatBytes(pdf.bytes.length)}</p></div><Button variant="ghost" size="icon-sm" aria-label="Remove PDF" onClick={() => setPdf(null)}><Trash2 className="h-4 w-4" /></Button></div>
          ) : (
            <button type="button" onClick={() => pdfRef.current?.click()} className="w-full rounded-lg border-2 border-dashed border-border p-4 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors"><FileUp className="mx-auto mb-1 h-6 w-6 text-muted-foreground" /><p className="text-xs font-medium">Drop PDF here</p></button>
          )}
          <input ref={pdfRef} type="file" accept="application/pdf,.pdf" className="hidden" aria-label="Choose PDF" onChange={(e) => { const f = e.target.files?.[0]; if (f) void loadPdf(f); e.target.value = ""; }} />
        </div>
        <div>
          <p className="mb-1.5 text-sm font-medium">Signature image (PNG/JPEG)</p>
          {img ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3"><div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">{img.name}</p><p className="text-xs text-muted-foreground">{formatBytes(img.bytes.length)}</p></div><Button variant="ghost" size="icon-sm" aria-label="Remove image" onClick={() => setImg(null)}><Trash2 className="h-4 w-4" /></Button></div>
          ) : (
            <button type="button" onClick={() => imgRef.current?.click()} className="w-full rounded-lg border-2 border-dashed border-border p-4 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors"><ImageUp className="mx-auto mb-1 h-6 w-6 text-muted-foreground" /><p className="text-xs font-medium">Drop signature image</p></button>
          )}
          <input ref={imgRef} type="file" accept="image/png,image/jpeg" className="hidden" aria-label="Choose signature image" onChange={(e) => { const f = e.target.files?.[0]; if (f) void loadImg(f); e.target.value = ""; }} />
        </div>
      </div>
      {pdf && img && (
        <div className="grid gap-3 sm:grid-cols-5">
          <div className="space-y-1.5"><Label htmlFor="sig-page">Page</Label><Input id="sig-page" type="number" min={1} max={pdf.pageCount} value={page} onChange={(e) => setPage(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="sig-x">X (pt)</Label><Input id="sig-x" type="number" value={x} onChange={(e) => setX(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="sig-y">Y (pt)</Label><Input id="sig-y" type="number" value={y} onChange={(e) => setY(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="sig-w">Width (pt)</Label><Input id="sig-w" type="number" value={w} onChange={(e) => setW(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="sig-h">Height (pt)</Label><Input id="sig-h" type="number" value={h} onChange={(e) => setH(e.target.value)} /></div>
        </div>
      )}
      <ActionBar><RunButton onClick={() => void run()} disabled={!pdf || !img} loading={working} label="Place signature" /><ClearButton onClick={reset} disabled={!pdf && !img && !result && !error} label="Clear" /></ActionBar>
      {error && <ErrorBanner message={error} />}
      {result && (<div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4"><p className="text-sm font-medium">Signed PDF ready • {formatBytes(result.length)}</p><Button onClick={() => downloadBytes(result, `signed-${pdf?.name ?? "output.pdf"}`)} className="gap-1.5"><Download className="h-4 w-4" /> Download</Button></div>)}
      <p className="text-xs text-muted-foreground">Privacy: signing runs 100% locally in your browser. Coordinates are in points from bottom-left corner.</p>
    </div>
  );
}
