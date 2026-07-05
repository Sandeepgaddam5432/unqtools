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
import { addPageNumbers, type NumberFormat, type NumberPosition } from "./logic";

const POSITIONS: { value: NumberPosition; label: string }[] = [
  { value: "bottom-left", label: "Bottom left" },
  { value: "bottom-center", label: "Bottom center" },
  { value: "bottom-right", label: "Bottom right" },
  { value: "top-left", label: "Top left" },
  { value: "top-center", label: "Top center" },
  { value: "top-right", label: "Top right" },
];

const FORMATS: { value: NumberFormat; label: string }[] = [
  { value: "page-x-of-n", label: "Page X of N" },
  { value: "page-x", label: "Page X" },
  { value: "x-of-n", label: "X / N" },
  { value: "x", label: "X" },
];

export default function PdfPageNumbers() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array; pageCount: number } | null>(null);
  const [position, setPosition] = useState<NumberPosition>("bottom-center");
  const [format, setFormat] = useState<NumberFormat>("page-x-of-n");
  const [startAt, setStartAt] = useState("1");
  const [fontSize, setFontSize] = useState("12");
  const [skipPages, setSkipPages] = useState("");
  const [result, setResult] = useState<Uint8Array | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  async function loadFile(f: File) {
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const doc = await PDFDocument.load(bytes);
      setFile({ name: f.name, bytes, pageCount: doc.getPageCount() });
      setResult(null); setError("");
    } catch { toast.error(`Could not read ${f.name}`); }
  }

  function reset() { setFile(null); setResult(null); setError(""); }

  async function run() {
    if (!file) return;
    setWorking(true); setError(""); setResult(null);
    const res = await addPageNumbers(file.bytes, {
      position, format, startAt: Number(startAt) || 1,
      fontSize: Number(fontSize) || 12, skipPages,
    });
    setWorking(false);
    if (res.ok) { setResult(res.output); toast.success("Page numbers added!"); }
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
          <Button variant="ghost" size="icon-sm" aria-label="Remove" onClick={reset}><Trash2 className="h-4 w-4" /></Button>
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

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Position</Label>
          <div className="flex flex-wrap gap-2">
            {POSITIONS.map((p) => <Button key={p.value} variant={position === p.value ? "default" : "outline"} size="sm" onClick={() => setPosition(p.value)}>{p.label}</Button>)}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Format</Label>
          <div className="flex flex-wrap gap-2">
            {FORMATS.map((f) => <Button key={f.value} variant={format === f.value ? "default" : "outline"} size="sm" onClick={() => setFormat(f.value)}>{f.label}</Button>)}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="pn-start">Start at page</Label>
          <Input id="pn-start" type="number" min={0} value={startAt} onChange={(e) => setStartAt(e.target.value)} className="w-24" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pn-size">Font size (px)</Label>
          <Input id="pn-size" type="number" min={6} max={72} value={fontSize} onChange={(e) => setFontSize(e.target.value)} className="w-24" />
        </div>
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="pn-skip">Skip pages (optional)</Label>
          <Input id="pn-skip" value={skipPages} onChange={(e) => setSkipPages(e.target.value)} placeholder="e.g. 1, 3" />
        </div>
      </div>

      <ActionBar>
        <RunButton onClick={() => void run()} disabled={!file} loading={working} label="Add page numbers" />
        <ClearButton onClick={reset} disabled={!file && !result && !error} label="Clear" />
      </ActionBar>

      {error && <ErrorBanner message={error} />}

      {result && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <p className="text-sm font-medium">Numbered PDF ready • {formatBytes(result.length)}</p>
          <Button onClick={() => downloadBytes(result, `numbered-${file?.name ?? "output.pdf"}`)} className="gap-1.5">
            <Download className="h-4 w-4" /> Download
          </Button>
        </div>
      )}
      <p className="text-xs text-muted-foreground">Privacy: runs 100% locally in your browser — your PDF never leaves your device.</p>
    </div>
  );
}
