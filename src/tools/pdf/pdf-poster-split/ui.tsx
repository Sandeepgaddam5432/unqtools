"use client";

/** Split PDF Page into Poster Tiles — real UI. */

import React, { useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, FileUp, Trash2, Grid3X3 } from "lucide-react";
import { toast } from "sonner";
import { ActionBar, ClearButton, ErrorBanner, RunButton } from "../../_shared";
import { downloadBytes, formatBytes } from "../_shared/download";
import { posterSplit } from "./logic";

type LoadedFile = { name: string; bytes: Uint8Array; pageCount: number };

export default function PosterSplit() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [page, setPage] = useState("1");
  const [rows, setRows] = useState("2");
  const [cols, setCols] = useState("3");
  const [overlap, setOverlap] = useState("0");
  const [pageSize, setPageSize] = useState<"fit" | "a4" | "letter">("fit");
  const [result, setResult] = useState<Uint8Array | null>(null);
  const [report, setReport] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  async function loadFile(f: File) {
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const doc = await PDFDocument.load(bytes);
      setFile({ name: f.name, bytes, pageCount: doc.getPageCount() });
      setResult(null);
      setError("");
      setReport("");
    } catch {
      toast.error(`Could not read ${f.name}`);
    }
  }

  function reset() {
    setFile(null);
    setResult(null);
    setError("");
    setReport("");
  }

  async function run() {
    if (!file) return;
    setWorking(true);
    setError("");
    setResult(null);
    setReport("");
    const r = await posterSplit(file.bytes, {
      page: Number(page) || 1,
      rows: Number(rows) || 2,
      cols: Number(cols) || 3,
      overlap: Number(overlap) || 0,
      pageSize,
    });
    setWorking(false);
    if (r.ok) {
      setResult(r.output.bytes);
      setReport(`${r.output.rows}×${r.output.cols} = ${r.output.tiles} tiles`);
      toast.success(`Created ${r.output.tiles} tiles!`);
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
          <Grid3X3 className="mx-auto mb-2 h-9 w-9 text-muted-foreground" />
          <p className="text-sm font-medium">Drop a PDF here or click to browse</p>
          <p className="mt-1 text-xs text-muted-foreground">Slice a page into tiles to print a big poster.</p>
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
              <Label htmlFor="ps-page">Page</Label>
              <Input id="ps-page" type="number" min={1} max={file.pageCount} value={page} onChange={(e) => setPage(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ps-rows">Rows</Label>
              <Input id="ps-rows" type="number" min={1} max={10} value={rows} onChange={(e) => setRows(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ps-cols">Columns</Label>
              <Input id="ps-cols" type="number" min={1} max={10} value={cols} onChange={(e) => setCols(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ps-overlap">Overlap (pt)</Label>
              <Input id="ps-overlap" type="number" min={0} max={50} value={overlap} onChange={(e) => setOverlap(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Tile output size</Label>
            <select value={pageSize} onChange={(e) => setPageSize(e.target.value as typeof pageSize)} className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="fit">Fit to tile</option>
              <option value="a4">A4 sheet per tile</option>
              <option value="letter">Letter sheet per tile</option>
            </select>
          </div>

          <ActionBar>
            <RunButton onClick={() => void run()} disabled={!file} loading={working} label="Create poster tiles" />
            <ClearButton onClick={reset} disabled={!file && !result && !error} label="Clear" />
          </ActionBar>

          {error && <ErrorBanner message={error} />}

          {result && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
              <div>
                <p className="text-sm font-medium">Tiles ready • {formatBytes(result.length)}</p>
                {report && <p className="text-xs text-muted-foreground mt-0.5">{report} — print and assemble</p>}
              </div>
              <Button onClick={() => downloadBytes(result, `poster-${file?.name ?? "output.pdf"}`)} className="gap-1.5">
                <Download className="h-4 w-4" /> Download
              </Button>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Privacy: 100% local — your PDF never leaves your device. Tiles stay vector (no rasterization).
      </p>
    </div>
  );
}
