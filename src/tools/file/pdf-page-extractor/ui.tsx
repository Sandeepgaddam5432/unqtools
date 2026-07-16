"use client";
import React, { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, EmptyState, RunButton } from "../../_shared";
import { toast } from "sonner";
import { extractPages, formatBytes, loadHistory, saveToHistory, type ExtractOptions, type HistoryEntry } from "./logic";
import { Upload, Download, History as HistoryIcon } from "lucide-react";

export default function PdfPageExtractor() {
  const [file, setFile] = useState<File | null>(null);
  const [pageRanges, setPageRanges] = useState("");
  const [reverseOrder, setReverseOrder] = useState(false);
  const [result, setResult] = useState<{ bytes: Uint8Array; pageCount: number; originalPageCount: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const [showHistory, setShowHistory] = useState(false);

  const handleFile = useCallback((f: File) => { setFile(f); setResult(null); setError(null); }, []);
  const run = useCallback(async () => {
    if (!file) return; setWorking(true); setError(null);
    try {
      const buf = await file.arrayBuffer();
      const opts: ExtractOptions = { pageRanges, reverseOrder, shuffleOrder: false };
      const r = await extractPages(new Uint8Array(buf), opts);
      if (r.ok) { setResult(r.output); setHistory(saveToHistory({ filename: file.name, pageCount: r.output.pageCount, extractedAt: new Date().toISOString() })); toast.success(`Extracted ${r.output.pageCount} pages`); }
      else setError(r.error);
    } catch (e) { setError((e as Error).message); } finally { setWorking(false); }
  }, [file, pageRanges, reverseOrder]);

  const download = useCallback(() => {
    if (!result) return;
    const blob = new Blob([result.bytes as BlobPart], { type: "application/pdf" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = `extracted-${file?.name ?? "output.pdf"}`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [result, file]);

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4">
        <input type="file" accept=".pdf" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value=""; }} className="hidden" id="pdf-extract-input" />
        <button type="button" onClick={() => document.getElementById("pdf-extract-input")?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          className="w-full rounded-xl border-2 border-dashed border-border p-8 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer">
          <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" /><p className="text-sm font-medium">Drop PDF or click to browse</p>
        </button>
      </CardContent></Card>
      {file && (
        <Card><CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between"><div><p className="text-sm font-medium truncate">{file.name}</p><p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p></div></div>
          <div className="space-y-1.5"><Label htmlFor="page-ranges" className="text-xs text-muted-foreground">Pages to extract (e.g. 1-3, 5, 7-9)</Label>
            <Input id="page-ranges" placeholder="All pages" value={pageRanges} onChange={(e) => setPageRanges(e.target.value)} className="font-mono text-sm" aria-label="Page ranges" /></div>
          <label className="flex items-center gap-2 cursor-pointer text-sm"><input type="checkbox" checked={reverseOrder} onChange={(e) => setReverseOrder(e.target.checked)} className="h-4 w-4 rounded border-border accent-primary cursor-pointer" /><span>Reverse page order</span></label>
          <RunButton onClick={run} disabled={!file || working} loading={working} label="Extract pages" size="md" />
        </CardContent></Card>
      )}
      {error && <ErrorBanner message={error} />}
      {result && (
        <Card><CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between"><Label className="text-sm font-semibold">Extracted PDF ready</Label>
            <button type="button" onClick={download} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border bg-primary text-primary-foreground hover:opacity-90 cursor-pointer"><Download className="h-3 w-3" /> Download</button></div>
          <div className="flex gap-2"><Badge variant="outline" className="text-[10px]">{result.pageCount} pages extracted</Badge><Badge variant="outline" className="text-[10px]">{formatBytes(result.bytes.length)}</Badge></div>
        </CardContent></Card>
      )}
      {!file && !error && <EmptyState title="Drop a PDF to extract pages" hint="Select specific pages by range. Uses pdf-lib — all processing is local." icon={<Upload className="h-8 w-8" />} />}
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all PDF processing is in-browser via pdf-lib.</p></CardContent></Card>
    </div>
  );
}
