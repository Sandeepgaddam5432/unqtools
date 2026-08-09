"use client";

/** Split PDF by File Size — real UI (per-part ZIP or individual downloads). */

import React, { useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, FileUp, FolderArchive, Scissors, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ActionBar, ClearButton, ErrorBanner, RunButton } from "../../_shared";
import { downloadBytes, formatBytes } from "../_shared/download";
import { splitBySize, type SplitPart } from "./logic";

type LoadedFile = { name: string; bytes: Uint8Array; pageCount: number };

export default function SplitBySize() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [target, setTarget] = useState("200");
  const [parts, setParts] = useState<SplitPart[]>([]);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  async function loadFile(f: File) {
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const doc = await PDFDocument.load(bytes);
      setFile({ name: f.name, bytes, pageCount: doc.getPageCount() });
      setParts([]);
      setError("");
    } catch {
      toast.error(`Could not read ${f.name}`);
    }
  }

  function reset() {
    setFile(null);
    setParts([]);
    setError("");
  }

  async function run() {
    if (!file) return;
    setWorking(true);
    setError("");
    setParts([]);
    const r = await splitBySize(file.bytes, {
      targetKB: Number(target) || 200,
      baseName: file.name.replace(/\.pdf$/i, "") || "part",
    });
    setWorking(false);
    if (r.ok) {
      setParts(r.output.parts);
      toast.success(`Split into ${r.output.parts.length} part(s)`);
    } else {
      setError(r.error);
    }
  }

  async function downloadAll() {
    if (parts.length === 0) return;
    if (parts.length === 1) {
      downloadBytes(parts[0]!.bytes, parts[0]!.name);
      return;
    }
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      for (const p of parts) zip.file(p.name, p.bytes.slice().buffer as ArrayBuffer);
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${file?.name.replace(/\.pdf$/i, "") ?? "split"}-parts.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      toast.error("Could not create ZIP — downloading individually.");
      for (const p of parts) downloadBytes(p.bytes, p.name);
    }
  }

  return (
    <div className="space-y-4">
      {file ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">{file.pageCount} pages • {formatBytes(file.bytes.length)}</p>
          </div>
          <Button variant="ghost" size="icon-sm" aria-label="Remove" onClick={reset}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) void loadFile(f);
          }}
          className="w-full rounded-xl border-2 border-dashed border-border p-10 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors"
        >
          <Scissors className="mx-auto mb-2 h-9 w-9 text-muted-foreground" />
          <p className="text-sm font-medium">Drop a large PDF here or click to browse</p>
          <p className="mt-1 text-xs text-muted-foreground">Split into parts that fit an upload size limit.</p>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        aria-label="Choose PDF"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void loadFile(f);
          e.target.value = "";
        }}
      />

      {file && (
        <div className="space-y-4 rounded-xl border bg-card p-4">
          <div className="flex items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="ss-kb">Max size per part (KB)</Label>
              <Input id="ss-kb" type="number" min={10} value={target} onChange={(e) => setTarget(e.target.value)} className="w-32" />
            </div>
            <p className="text-xs text-muted-foreground pb-2">e.g. 200, 500, 1000</p>
          </div>

          <ActionBar>
            <RunButton onClick={() => void run()} disabled={!file} loading={working} label={`Split into ≤ ${Number(target) || 200} KB parts`} />
            <ClearButton onClick={reset} disabled={!file && parts.length === 0 && !error} label="Clear" />
          </ActionBar>

          {error && <ErrorBanner message={error} />}

          {parts.length > 0 && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{parts.length} part(s)</p>
                <Button variant="outline" size="sm" className="gap-1.5 cursor-pointer" onClick={() => void downloadAll()}>
                  <FolderArchive className="h-3.5 w-3.5" /> {parts.length === 1 ? "Download" : "Download all (ZIP)"}
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b border-border">
                      <th className="py-1.5 pr-3 font-medium">Part</th>
                      <th className="py-1.5 pr-3 font-medium">Pages</th>
                      <th className="py-1.5 pr-3 font-medium">Size</th>
                      <th className="py-1.5 font-medium">Download</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parts.map((p) => (
                      <tr key={p.name} className="border-b border-border/60 last:border-0">
                        <td className="py-2 pr-3 font-medium">{p.name}</td>
                        <td className="py-2 pr-3 text-muted-foreground">p.{p.startPage}–{p.endPage}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{formatBytes(p.size)}</td>
                        <td className="py-2">
                          <Button variant="ghost" size="icon-sm" aria-label={`Download ${p.name}`} onClick={() => downloadBytes(p.bytes, p.name)}>
                            <Download className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Privacy: 100% local — your PDF never leaves your device.
      </p>
    </div>
  );
}
