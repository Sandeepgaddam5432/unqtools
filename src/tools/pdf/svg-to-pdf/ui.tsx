"use client";
import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Download, FileUp, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { ActionBar, ClearButton, ErrorBanner, RunButton } from "../../_shared";
import { downloadBytes, formatBytes } from "../_shared/download";
import { svgToPdf } from "./logic";
export default function SvgToPdf() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [svg, setSvg] = useState("");
  const [fileName, setFileName] = useState("");
  const [pageSize, setPageSize] = useState<"a4" | "letter" | "fit">("fit");
  const [orient, setOrient] = useState<"portrait" | "landscape">("portrait");
  const [margin, setMargin] = useState("20");
  const [result, setResult] = useState<Uint8Array | null>(null);
  const [error, setError] = useState(""); const [working, setWorking] = useState(false);
  async function loadFile(f: File) { try { const text = await f.text(); setSvg(text); setFileName(f.name); setResult(null); setError(""); } catch { toast.error(`Could not read ${f.name}`); } }
  async function run() { setWorking(true); setError(""); setResult(null); const r = await svgToPdf(svg, { pageSize, orientation: orient, margin: Number(margin) }); setWorking(false); if (r.ok) { setResult(r.output); toast.success("PDF created!"); } else setError(r.error); }
  return (
    <div className="space-y-4">
      <button type="button" onClick={() => inputRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) void loadFile(f); }} className="w-full rounded-xl border-2 border-dashed border-border p-6 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors">
        <FileUp className="mx-auto mb-2 h-7 w-7 text-muted-foreground" /><p className="text-sm font-medium">Drop an .svg file here or paste SVG below</p>{fileName && <p className="mt-1 text-xs text-muted-foreground">Loaded: {fileName}</p>}
      </button>
      <input ref={inputRef} type="file" accept=".svg,image/svg+xml" className="hidden" aria-label="Choose SVG file" onChange={(e) => { const f = e.target.files?.[0]; if (f) void loadFile(f); e.target.value = ""; }} />
      <div className="space-y-1.5"><Label htmlFor="stp-text">SVG content</Label><Textarea id="stp-text" value={svg} onChange={(e) => { setSvg(e.target.value); setFileName(""); }} placeholder={'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">\n  <circle cx="100" cy="100" r="80" fill="orange"/>\n</svg>'} className="min-h-[150px] resize-y font-mono text-xs" /></div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5"><Label htmlFor="stp-page">Page size</Label><select id="stp-page" value={pageSize} onChange={(e) => setPageSize(e.target.value as "a4" | "letter" | "fit")} className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="fit">Fit to SVG</option><option value="a4">A4</option><option value="letter">Letter</option></select></div>
        <div className="space-y-1.5"><Label htmlFor="stp-orient">Orientation</Label><select id="stp-orient" value={orient} onChange={(e) => setOrient(e.target.value as "portrait" | "landscape")} className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm" disabled={pageSize === "fit"}><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></div>
        <div className="space-y-1.5"><Label htmlFor="stp-margin">Margin (pt)</Label><Input id="stp-margin" type="number" min={0} value={margin} onChange={(e) => setMargin(e.target.value)} className="w-24" /></div>
      </div>
      <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => setSvg('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200">\n  <rect width="300" height="200" fill="#f0f0f0"/>\n  <circle cx="150" cy="100" r="60" fill="#ff6b6b" stroke="#333" stroke-width="2"/>\n  <text x="150" y="105" text-anchor="middle" font-family="Arial" font-size="24" fill="white">SVG</text>\n</svg>')}>Load sample</Button></div>
      <ActionBar><RunButton onClick={() => void run()} disabled={!svg.trim()} loading={working} label="Convert to PDF" /><ClearButton onClick={() => { setSvg(""); setFileName(""); setResult(null); setError(""); }} disabled={!svg && !result && !error} label="Clear" /></ActionBar>
      {error && <ErrorBanner message={error} />}
      {result && (<div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4"><div><p className="text-sm font-medium flex items-center gap-1.5"><ImageIcon className="h-4 w-4" />PDF ready</p><p className="text-xs text-muted-foreground">{formatBytes(result.length)}</p></div><Button onClick={() => downloadBytes(result, "svg-output.pdf")} className="gap-1.5"><Download className="h-4 w-4" /> Download</Button></div>)}
      <p className="text-xs text-muted-foreground">Privacy: conversion runs 100% locally. SVG is rasterized at 2x DPI — high quality but not true vector.</p>
    </div>
  );
}
