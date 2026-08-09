"use client";

/**
 * Add Page Border to PDF — real UI.
 * Width, color, solid/dashed/double style, inset + page ranges.
 */

import React, { useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, FileUp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ActionBar, ClearButton, ErrorBanner, RunButton } from "../../_shared";
import { downloadBytes, formatBytes } from "../_shared/download";
import { addPageBorder, type BorderStyle } from "./logic";

type LoadedFile = { name: string; bytes: Uint8Array; pageCount: number };

export default function AddPageBorder() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [width, setWidth] = useState("2");
  const [color, setColor] = useState("#000000");
  const [style, setStyle] = useState<BorderStyle>("solid");
  const [inset, setInset] = useState("12");
  const [pages, setPages] = useState("");
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
    const r = await addPageBorder(file.bytes, {
      width: Number(width) || 2,
      color,
      style,
      inset: Number(inset) || 12,
      pages,
    });
    setWorking(false);
    if (r.ok) {
      setResult(r.output.bytes);
      toast.success(`Border added to ${r.output.pagesBordered} page(s)`);
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
          <p className="mt-1 text-xs text-muted-foreground">Add a crisp vector border around every page.</p>
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label htmlFor="bd-w">Width (pt)</Label>
              <Input id="bd-w" type="number" min={0.25} max={24} step={0.25} value={width} onChange={(e) => setWidth(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bd-inset">Inset (pt)</Label>
              <Input id="bd-inset" type="number" min={0} max={100} value={inset} onChange={(e) => setInset(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bd-color">Color</Label>
              <Input id="bd-color" type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 p-1" />
            </div>
            <div className="space-y-1">
              <Label>Style</Label>
              <div className="flex flex-wrap gap-1 pt-0.5">
                {(["solid", "dashed", "double"] as BorderStyle[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStyle(s)}
                    aria-pressed={style === s}
                    className={`px-2 py-1 rounded text-xs cursor-pointer ${
                      style === s ? "bg-primary text-primary-foreground" : "bg-muted text-foreground/80"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="bd-pages">Pages (optional)</Label>
            <Input id="bd-pages" value={pages} onChange={(e) => setPages(e.target.value)} placeholder={`All — or e.g. 1, 3-5`} />
          </div>

          <ActionBar>
            <RunButton onClick={() => void run()} disabled={!file} loading={working} label="Add border" />
            <ClearButton onClick={reset} disabled={!file && !result && !error} label="Clear" />
          </ActionBar>

          {error && <ErrorBanner message={error} />}

          {result && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
              <p className="text-sm font-medium">Border added • {formatBytes(result.length)}</p>
              <Button onClick={() => downloadBytes(result, `bordered-${file?.name ?? "output.pdf"}`)} className="gap-1.5">
                <Download className="h-4 w-4" /> Download
              </Button>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Privacy: 100% local — your PDF never leaves your device. Borders are vector, so they stay crisp at any zoom.
      </p>
    </div>
  );
}
