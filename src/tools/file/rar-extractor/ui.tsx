"use client";
import React, { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, EmptyState } from "../../_shared";
import { toast } from "sonner";
import { inspectRar, getRarMethodName, formatBytes, type RarInspectResult } from "./logic";
import { Upload, FileArchive } from "lucide-react";

export default function RarExtractor() {
  const [result, setResult] = useState<RarInspectResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(async (f: File) => {
    setError(null);
    try {
      const buf = await f.arrayBuffer();
      const r = inspectRar(new Uint8Array(buf));
      if (!r.archive.isValid) { setError(r.archive.error ?? "Invalid RAR"); setResult(null); return; }
      setResult(r);
      toast.success(`Parsed ${r.archive.entries.length} entries`);
    } catch (e) { setError((e as Error).message); }
  }, []);

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4">
        <input type="file" accept=".rar" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value=""; }} className="hidden" id="rar-input" />
        <button type="button" onClick={() => document.getElementById("rar-input")?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          className="w-full rounded-xl border-2 border-dashed border-border p-8 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer">
          <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" /><p className="text-sm font-medium">Drop .rar file or click to browse</p>
          <p className="mt-1 text-xs text-muted-foreground">RAR4/RAR5 header parsing — full extraction requires WASM</p>
        </button>
      </CardContent></Card>
      {error && <ErrorBanner message={error} />}
      {result && result.archive.isValid && (
        <Card><CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between"><Label className="text-sm font-semibold">Contents ({result.archive.entries.length})</Label>
            <div className="flex gap-2"><Badge variant="outline" className="text-[10px]">RAR{result.archive.version === "rar4" ? "4" : "5"}</Badge>
            <Badge variant="outline" className="text-[10px]">{result.archive.entries.length} files</Badge></div></div>
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            {result.archive.entries.map((e, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto] gap-2 items-center text-xs py-2 border-b border-border/40 last:border-0">
                <div><p className="truncate font-medium">{e.filename}</p>
                <p className="text-[10px] text-muted-foreground">{getRarMethodName(e.method ?? null, result.archive.version)}</p></div>
                <Badge variant="outline" className="text-[10px] font-mono">{e.uncompressedSize > 0 ? formatBytes(e.uncompressedSize) : "—"}</Badge>
              </div>
            ))}
          </div>
        </CardContent></Card>
      )}
      {!result && !error && <EmptyState title="Drop a RAR file to inspect" hint="Parses RAR4/RAR5 headers and lists file entries. Full extraction requires WASM (unrar.js)." icon={<FileArchive className="h-8 w-8" />} />}
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all parsing is in-browser.</p></CardContent></Card>
    </div>
  );
}
