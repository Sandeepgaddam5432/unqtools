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
import { reorderPdfPages, type ReorderMode } from "./logic";

const MODES: { value: ReorderMode; label: string; hint: string }[] = [
  { value: "custom", label: "Custom sequence", hint: "Enter page order manually" },
  { value: "reverse", label: "Reverse all", hint: "Flip pages last-to-first" },
  { value: "duplicate", label: "Duplicate all", hint: "Repeat every page twice" },
];

export default function ReorderPdfPages() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array; pageCount: number } | null>(null);
  const [mode, setMode] = useState<ReorderMode>("custom");
  const [sequence, setSequence] = useState("");
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

  function reset() { setFile(null); setResult(null); setError(""); setSequence(""); }

  async function run() {
    if (!file) return;
    setWorking(true); setError(""); setResult(null);
    const res = await reorderPdfPages(file.bytes, { mode, sequence });
    setWorking(false);
    if (res.ok) { setResult(res.output); toast.success("Pages reordered!"); }
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

      <div role="radiogroup" className="grid gap-2 sm:grid-cols-3">
        {MODES.map((m) => (
          <button key={m.value} type="button" role="radio" aria-checked={mode === m.value}
            onClick={() => setMode(m.value)}
            className={mode === m.value
              ? "rounded-lg border border-primary bg-primary/10 p-3 text-left"
              : "rounded-lg border border-border p-3 text-left transition-colors hover:border-primary/40"}>
            <p className="text-sm font-medium">{m.label}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{m.hint}</p>
          </button>
        ))}
      </div>

      {mode === "custom" && (
        <div className="space-y-1.5">
          <Label htmlFor="reorder-seq">
            Page sequence
            {file && <span className="ml-1 text-muted-foreground">(1–{file.pageCount})</span>}
          </Label>
          <Input id="reorder-seq" value={sequence} onChange={(e) => setSequence(e.target.value)}
            placeholder="e.g. 3,1,2" />
          <p className="text-xs text-muted-foreground">Enter each page number in the desired output order. Repeats allowed.</p>
        </div>
      )}

      <ActionBar>
        <RunButton onClick={() => void run()} disabled={!file || (mode === "custom" && !sequence.trim())}
          loading={working} label="Reorder pages" />
        <ClearButton onClick={reset} disabled={!file && !result && !error} label="Clear" />
      </ActionBar>

      {error && <ErrorBanner message={error} />}

      {result && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <p className="text-sm font-medium">Reordered PDF ready • {formatBytes(result.length)}</p>
          <Button onClick={() => downloadBytes(result, `reordered-${file?.name ?? "output.pdf"}`)} className="gap-1.5">
            <Download className="h-4 w-4" /> Download
          </Button>
        </div>
      )}
      <p className="text-xs text-muted-foreground">Privacy: runs 100% locally in your browser — your PDF never leaves your device.</p>
    </div>
  );
}
