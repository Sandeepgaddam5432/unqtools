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
import { addWatermark, type WatermarkPlacement } from "./logic";

const PLACEMENTS: { value: WatermarkPlacement; label: string; hint: string }[] = [
  { value: "diagonal", label: "Diagonal", hint: "45° across center" },
  { value: "tiled", label: "Tiled", hint: "Repeated grid" },
  { value: "centered", label: "Centered", hint: "Horizontal, center" },
];

export default function PdfWatermark() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array; pageCount: number } | null>(null);
  const [text, setText] = useState("DRAFT");
  const [placement, setPlacement] = useState<WatermarkPlacement>("diagonal");
  const [opacity, setOpacity] = useState("0.30");
  const [fontSize, setFontSize] = useState("48");
  const [color, setColor] = useState("#808080");
  const [pages, setPages] = useState("");
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
    const res = await addWatermark(file.bytes, {
      text, placement, opacity: parseFloat(opacity) || 0.3,
      fontSize: parseInt(fontSize, 10) || 48, color, pages,
    });
    setWorking(false);
    if (res.ok) { setResult(res.output); toast.success("Watermark added!"); }
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

      <div className="space-y-1.5">
        <Label htmlFor="wm-text">Watermark text</Label>
        <Input id="wm-text" value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. DRAFT" />
      </div>

      <div role="radiogroup" className="grid gap-2 sm:grid-cols-3">
        {PLACEMENTS.map((p) => (
          <button key={p.value} type="button" role="radio" aria-checked={placement === p.value}
            onClick={() => setPlacement(p.value)}
            className={placement === p.value
              ? "rounded-lg border border-primary bg-primary/10 p-3 text-left"
              : "rounded-lg border border-border p-3 text-left hover:border-primary/40 transition-colors"}>
            <p className="text-sm font-medium">{p.label}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{p.hint}</p>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="wm-opacity">Opacity (0–1)</Label>
          <Input id="wm-opacity" type="number" min="0.01" max="1" step="0.05" value={opacity}
            onChange={(e) => setOpacity(e.target.value)} className="w-24" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wm-size">Font size</Label>
          <Input id="wm-size" type="number" min="8" max="200" value={fontSize}
            onChange={(e) => setFontSize(e.target.value)} className="w-24" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wm-color">Color</Label>
          <input id="wm-color" type="color" value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-9 w-24 cursor-pointer rounded-md border border-input bg-background p-1" />
        </div>
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="wm-pages">Pages (optional)</Label>
          <Input id="wm-pages" value={pages} onChange={(e) => setPages(e.target.value)}
            placeholder="All (e.g. 1, 3-5)" />
        </div>
      </div>

      <ActionBar>
        <RunButton onClick={() => void run()} disabled={!file || !text.trim()} loading={working} label="Add watermark" />
        <ClearButton onClick={reset} disabled={!file && !result && !error} label="Clear" />
      </ActionBar>

      {error && <ErrorBanner message={error} />}

      {result && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <p className="text-sm font-medium">Watermarked PDF ready • {formatBytes(result.length)}</p>
          <Button onClick={() => downloadBytes(result, `watermarked-${file?.name ?? "output.pdf"}`)} className="gap-1.5">
            <Download className="h-4 w-4" /> Download
          </Button>
        </div>
      )}
      <p className="text-xs text-muted-foreground">Privacy: runs 100% locally in your browser — your PDF never leaves your device.</p>
    </div>
  );
}
