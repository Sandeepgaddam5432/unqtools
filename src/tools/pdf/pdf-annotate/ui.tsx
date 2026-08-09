"use client";

/** Edit/Annotate PDF — real UI (highlight / note / square / line). */

import React, { useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, FileUp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ActionBar, ClearButton, ErrorBanner, RunButton } from "../../_shared";
import { downloadBytes, formatBytes } from "../_shared/download";
import { annotatePdf, type AnnotType } from "./logic";

type LoadedFile = { name: string; bytes: Uint8Array; pageCount: number };

export default function AnnotatePdf() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [type, setType] = useState<AnnotType>("highlight");
  const [x, setX] = useState("40");
  const [y, setY] = useState("120");
  const [w, setW] = useState("160");
  const [h, setH] = useState("16");
  const [color, setColor] = useState("#ffeb3b");
  const [opacity, setOpacity] = useState("0.6");
  const [text, setText] = useState("Note");
  const [pages, setPages] = useState("1");
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
      toast.error(`Could not read ${f.name}`);
    }
  }

  function reset() {
    setFile(null);
    setResult(null);
    setError("");
  }

  async function run() {
    if (!file) return;
    setWorking(true);
    setError("");
    setResult(null);
    const r = await annotatePdf(file.bytes, {
      type,
      x: Number(x) || 0,
      y: Number(y) || 0,
      width: Number(w) || 10,
      height: Number(h) || 10,
      color,
      opacity: Number(opacity) || 0.6,
      text,
      pages,
    });
    setWorking(false);
    if (r.ok) {
      setResult(r.output.bytes);
      toast.success(`Added ${r.output.annotationsAdded} annotation(s)`);
    } else {
      setError(r.error);
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
          <FileUp className="mx-auto mb-2 h-9 w-9 text-muted-foreground" />
          <p className="text-sm font-medium">Drop a PDF here or click to browse</p>
          <p className="mt-1 text-xs text-muted-foreground">Add highlights, notes, boxes or lines.</p>
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
          <div className="flex flex-wrap gap-2">
            {(["highlight", "note", "square", "line"] as AnnotType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                aria-pressed={type === t}
                className={`px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer ${type === t ? "bg-primary text-primary-foreground" : "bg-muted text-foreground/80"}`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label htmlFor="an-x">X (pt)</Label>
              <Input id="an-x" type="number" value={x} onChange={(e) => setX(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="an-y">Y (pt)</Label>
              <Input id="an-y" type="number" value={y} onChange={(e) => setY(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="an-w">Width (pt)</Label>
              <Input id="an-w" type="number" value={w} onChange={(e) => setW(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="an-h">Height (pt)</Label>
              <Input id="an-h" type="number" value={h} onChange={(e) => setH(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="an-color">Color</Label>
              <Input id="an-color" type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 p-1" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="an-op">Opacity: {Math.round(Number(opacity) * 100)}%</Label>
              <input id="an-op" type="range" min={5} max={100} value={Math.round((Number(opacity) || 0.6) * 100)} onChange={(e) => setOpacity((Number(e.target.value) / 100).toFixed(2))} className="w-full" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="an-text">Text (note)</Label>
              <Input id="an-text" value={text} onChange={(e) => setText(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="an-pages">Pages</Label>
            <Input id="an-pages" value={pages} onChange={(e) => setPages(e.target.value)} placeholder="e.g. 1 or 1,3" />
          </div>

          <ActionBar>
            <RunButton onClick={() => void run()} disabled={!file} loading={working} label={`Add ${type}`} />
            <ClearButton onClick={reset} disabled={!file && !result && !error} label="Clear" />
          </ActionBar>

          {error && <ErrorBanner message={error} />}

          {result && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
              <p className="text-sm font-medium">Annotated PDF ready • {formatBytes(result.length)}</p>
              <Button onClick={() => downloadBytes(result, `annotated-${file?.name ?? "output.pdf"}`)} className="gap-1.5">
                <Download className="h-4 w-4" /> Download
              </Button>
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
