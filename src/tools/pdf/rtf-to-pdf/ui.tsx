"use client";
import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Download, FileUp, FileText } from "lucide-react";
import { toast } from "sonner";
import { ActionBar, ClearButton, ErrorBanner, RunButton } from "../../_shared";
import { downloadBytes, formatBytes } from "../_shared/download";
import { rtfToPdf } from "./logic";
export default function RtfToPdf() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [rtf, setRtf] = useState("");
  const [fileName, setFileName] = useState("");
  const [fontSize, setFontSize] = useState("12");
  const [pageSize, setPageSize] = useState<"a4" | "letter">("a4");
  const [orient, setOrient] = useState<"portrait" | "landscape">("portrait");
  const [result, setResult] = useState<Uint8Array | null>(null);
  const [error, setError] = useState(""); const [working, setWorking] = useState(false);
  async function loadFile(f: File) { try { const text = await f.text(); setRtf(text); setFileName(f.name); setResult(null); setError(""); } catch { toast.error(`Could not read ${f.name}`); } }
  async function run() { setWorking(true); setError(""); setResult(null); const r = await rtfToPdf(rtf, { fontSize: Number(fontSize), pageSize, orientation: orient, margin: 50 }); setWorking(false); if (r.ok) { setResult(r.output); toast.success("PDF created!"); } else setError(r.error); }
  return (
    <div className="space-y-4">
      <button type="button" onClick={() => inputRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) void loadFile(f); }} className="w-full rounded-xl border-2 border-dashed border-border p-6 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors">
        <FileUp className="mx-auto mb-2 h-7 w-7 text-muted-foreground" /><p className="text-sm font-medium">Drop an .rtf file here or paste RTF below</p>{fileName && <p className="mt-1 text-xs text-muted-foreground">Loaded: {fileName}</p>}
      </button>
      <input ref={inputRef} type="file" accept=".rtf,text/rtf,application/rtf" className="hidden" aria-label="Choose RTF file" onChange={(e) => { const f = e.target.files?.[0]; if (f) void loadFile(f); e.target.value = ""; }} />
      <div className="space-y-1.5"><Label htmlFor="rtp-text">RTF content</Label><Textarea id="rtp-text" value={rtf} onChange={(e) => { setRtf(e.target.value); setFileName(""); }} placeholder="{\rtf1\ansi..." className="min-h-[150px] resize-y font-mono text-xs" /></div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5"><Label htmlFor="rtp-size">Font size (8–24)</Label><Input id="rtp-size" type="number" min={8} max={24} value={fontSize} onChange={(e) => setFontSize(e.target.value)} className="w-24" /></div>
        <div className="space-y-1.5"><Label htmlFor="rtp-page">Page size</Label><select id="rtp-page" value={pageSize} onChange={(e) => setPageSize(e.target.value as "a4" | "letter")} className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="a4">A4</option><option value="letter">Letter</option></select></div>
        <div className="space-y-1.5"><Label htmlFor="rtp-orient">Orientation</Label><select id="rtp-orient" value={orient} onChange={(e) => setOrient(e.target.value as "portrait" | "landscape")} className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></div>
      </div>
      <ActionBar><RunButton onClick={() => void run()} disabled={!rtf.trim()} loading={working} label="Convert to PDF" /><ClearButton onClick={() => { setRtf(""); setFileName(""); setResult(null); setError(""); }} disabled={!rtf && !result && !error} label="Clear" /></ActionBar>
      {error && <ErrorBanner message={error} />}
      {result && (<div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4"><div><p className="text-sm font-medium flex items-center gap-1.5"><FileText className="h-4 w-4" />PDF ready</p><p className="text-xs text-muted-foreground">{formatBytes(result.length)}</p></div><Button onClick={() => downloadBytes(result, "rtf-output.pdf")} className="gap-1.5"><Download className="h-4 w-4" /> Download</Button></div>)}
      <p className="text-xs text-muted-foreground">Privacy: conversion runs 100% locally. RTF formatting (fonts, colors, styles) is stripped — only text content is preserved.</p>
    </div>
  );
}
