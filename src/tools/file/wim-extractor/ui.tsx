"use client";
import React, { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, EmptyState } from "../../_shared";
import { toast } from "sonner";
import { parseHeader, type WimHeader } from "./logic";
import { Upload, FileArchive } from "lucide-react";

export default function WimExtractor() {
  const [header, setHeader] = useState<WimHeader | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(async (f: File) => {
    setError(null);
    try {
      const buf = await f.arrayBuffer();
      const h = parseHeader(new Uint8Array(buf));
      setHeader(h);
      toast.success(`Parsed WIM — version ${h.version}`);
    } catch (e) { setError((e as Error).message); }
  }, []);

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4">
        <input type="file" accept=".wim,.swm" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value=""; }} className="hidden" id="wim-input" />
        <button type="button" onClick={() => document.getElementById("wim-input")?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          className="w-full rounded-xl border-2 border-dashed border-border p-8 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer">
          <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" /><p className="text-sm font-medium">Drop .wim file or click to browse</p>
          <p className="mt-1 text-xs text-muted-foreground">Windows Imaging Format — header parsing only</p>
        </button>
      </CardContent></Card>
      {error && <ErrorBanner message={error} />}
      {header && (
        <Card><CardContent className="p-4 space-y-2">
          <Label className="text-sm font-semibold">WIM Info</Label>
          <div className="space-y-1 text-xs">
            <p><strong>Version:</strong> {header.version}</p>
            <p><strong>Flags:</strong> {header.flags}</p>
            <p><strong>Header size:</strong> {header.headerSize}</p>
          </div>
        </CardContent></Card>
      )}
      {!header && !error && <EmptyState title="Drop a WIM file to inspect" hint="Parses Windows Imaging Format headers. Full extraction requires HFS+/NTFS parsing." icon={<FileArchive className="h-8 w-8" />} />}
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all parsing is in-browser.</p></CardContent></Card>
    </div>
  );
}
