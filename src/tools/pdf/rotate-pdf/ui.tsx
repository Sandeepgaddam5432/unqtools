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
import { rotatePdf, type RotateTarget, type RotationDeg } from "./logic";

const ROTATIONS: { value: RotationDeg; label: string }[] = [
  { value: 90, label: "90° clockwise" },
  { value: 180, label: "180°" },
  { value: 270, label: "90° counter-clockwise" },
];

const TARGETS: { value: RotateTarget; label: string }[] = [
  { value: "all", label: "All pages" },
  { value: "odd", label: "Odd pages" },
  { value: "even", label: "Even pages" },
  { value: "custom", label: "Custom pages" },
];

export default function RotatePdf() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array; pageCount: number } | null>(null);
  const [rotation, setRotation] = useState<RotationDeg>(90);
  const [target, setTarget] = useState<RotateTarget>("all");
  const [customPages, setCustomPages] = useState("");
  const [result, setResult] = useState<Uint8Array | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  async function loadFile(f: File) {
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const doc = await PDFDocument.load(bytes);
      setFile({ name: f.name, bytes, pageCount: doc.getPageCount() });
      setResult(null);
      setError("");
    } catch {
      toast.error(`Could not read ${f.name} — it may be corrupted or password-protected.`);
    }
  }

  function reset() { setFile(null); setResult(null); setError(""); }

  async function run() {
    if (!file) return;
    setWorking(true); setError(""); setResult(null);
    const res = await rotatePdf(file.bytes, { rotation, target, customPages });
    setWorking(false);
    if (res.ok) { setResult(res.output); toast.success("Rotation applied!"); }
    else setError(res.error);
  }

  return (
    <div className="space-y-4">
      {file ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">{file.pageCount} pages • {formatBytes(file.bytes.length)}</p>
          </div>
          <Button variant="ghost" size="icon-sm" aria-label="Remove file" onClick={reset}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) void loadFile(f); }}
          className="w-full rounded-xl border-2 border-dashed border-border p-8 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors">
          <FileUp className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">Drop a PDF here or click to browse</p>
        </button>
      )}
      <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" aria-label="Choose PDF"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void loadFile(f); e.target.value = ""; }} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Rotation</Label>
          <div className="flex flex-wrap gap-2">
            {ROTATIONS.map((r) => (
              <Button key={r.value} variant={rotation === r.value ? "default" : "outline"} size="sm"
                onClick={() => setRotation(r.value)}>{r.label}</Button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Apply to</Label>
          <div className="flex flex-wrap gap-2">
            {TARGETS.map((t) => (
              <Button key={t.value} variant={target === t.value ? "default" : "outline"} size="sm"
                onClick={() => setTarget(t.value)}>{t.label}</Button>
            ))}
          </div>
        </div>
      </div>

      {target === "custom" && (
        <div className="space-y-1.5">
          <Label htmlFor="rotate-custom">Page numbers / ranges</Label>
          <Input id="rotate-custom" value={customPages} onChange={(e) => setCustomPages(e.target.value)} placeholder="e.g. 1, 3-5" />
        </div>
      )}

      <ActionBar>
        <RunButton onClick={() => void run()} disabled={!file} loading={working} label="Rotate PDF" />
        <ClearButton onClick={reset} disabled={!file && !result && !error} label="Clear" />
      </ActionBar>

      {error && <ErrorBanner message={error} />}

      {result && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <p className="text-sm font-medium">Rotated PDF ready • {formatBytes(result.length)}</p>
          <Button onClick={() => downloadBytes(result, `rotated-${file?.name ?? "output.pdf"}`)} className="gap-1.5">
            <Download className="h-4 w-4" /> Download
          </Button>
        </div>
      )}
      <p className="text-xs text-muted-foreground">Privacy: rotation runs 100% locally in your browser — your PDF never leaves your device.</p>
    </div>
  );
}
