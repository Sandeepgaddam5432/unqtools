"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Download, FileText } from "lucide-react";
import { toast } from "sonner";
import { ActionBar, ClearButton, ErrorBanner, RunButton } from "../../_shared";
import { downloadBytes, formatBytes } from "../_shared/download";
import { textToPdf } from "./logic";
export default function TextToPdf() {
  const [text, setText] = useState("");
  const [fontSize, setFontSize] = useState("12");
  const [pageSize, setPageSize] = useState<"a4" | "letter">("a4");
  const [orient, setOrient] = useState<"portrait" | "landscape">("portrait");
  const [result, setResult] = useState<Uint8Array | null>(null);
  const [error, setError] = useState(""); const [working, setWorking] = useState(false);
  async function run() { setWorking(true); setError(""); setResult(null); const r = await textToPdf(text, { fontSize: Number(fontSize), pageSize, orientation: orient, margin: 50 }); setWorking(false); if (r.ok) { setResult(r.output); toast.success("PDF created!"); } else setError(r.error); }
  return (
    <div className="space-y-4">
      <div className="space-y-1.5"><Label htmlFor="ttp-text">Text content</Label><Textarea id="ttp-text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Type or paste text here…" className="min-h-[200px] resize-y font-mono text-sm" /></div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5"><Label htmlFor="ttp-size">Font size (8–24)</Label><Input id="ttp-size" type="number" min={8} max={24} value={fontSize} onChange={(e) => setFontSize(e.target.value)} className="w-24" /></div>
        <div className="space-y-1.5"><Label htmlFor="ttp-page">Page size</Label><select id="ttp-page" value={pageSize} onChange={(e) => setPageSize(e.target.value as "a4" | "letter")} className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="a4">A4</option><option value="letter">Letter</option></select></div>
        <div className="space-y-1.5"><Label htmlFor="ttp-orient">Orientation</Label><select id="ttp-orient" value={orient} onChange={(e) => setOrient(e.target.value as "portrait" | "landscape")} className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></div>
      </div>
      <ActionBar><RunButton onClick={() => void run()} disabled={!text.trim()} loading={working} label="Convert to PDF" /><ClearButton onClick={() => { setText(""); setResult(null); setError(""); }} disabled={!text && !result && !error} label="Clear" /></ActionBar>
      {error && <ErrorBanner message={error} />}
      {result && (<div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4"><div><p className="text-sm font-medium flex items-center gap-1.5"><FileText className="h-4 w-4" />PDF ready</p><p className="text-xs text-muted-foreground">{formatBytes(result.length)}</p></div><Button onClick={() => downloadBytes(result, "text-output.pdf")} className="gap-1.5"><Download className="h-4 w-4" /> Download</Button></div>)}
      <p className="text-xs text-muted-foreground">Privacy: conversion runs 100% locally in your browser.</p>
    </div>
  );
}
