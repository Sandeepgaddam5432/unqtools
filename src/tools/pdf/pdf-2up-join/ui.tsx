"use client";

/**
 * Combine Pages Side-by-Side (2-up) — real UI.
 * Sheet size, orientation, margin, gutter, duplicate-last, divider.
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
import { twoUpJoin } from "./logic";

type LoadedFile = { name: string; bytes: Uint8Array; pageCount: number };

export default function TwoUpJoin() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [sheet, setSheet] = useState<"a4" | "letter" | "custom">("a4");
  const [orientation, setOrientation] = useState<"landscape" | "portrait">("landscape");
  const [margin, setMargin] = useState("10");
  const [gutter, setGutter] = useState("8");
  const [duplicateLast, setDuplicateLast] = useState(false);
  const [divider, setDivider] = useState(false);
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
    const r = await twoUpJoin(file.bytes, {
      sheet,
      orientation,
      margin: Number(margin) || 10,
      gutter: Number(gutter) || 8,
      duplicateLast,
      divider,
    });
    setWorking(false);
    if (r.ok) {
      setResult(r.output.bytes);
      toast.success(`${r.output.outputSheets} sheet(s) created`);
    } else {
      setError(r.error);
    }
  }

  const pairs = file ? Math.ceil(file.pageCount / 2) : 0;

  return (
    <div className="space-y-4">
      {file ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {file.pageCount} pages • {pairs} output sheet{pairs === 1 ? "" : "s"}
            </p>
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
          <p className="mt-1 text-xs text-muted-foreground">Combine two pages side-by-side on each sheet.</p>
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
              <Label>Sheet size</Label>
              <select value={sheet} onChange={(e) => setSheet(e.target.value as typeof sheet)} className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="a4">A4</option>
                <option value="letter">Letter</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Orientation</Label>
              <select value={orientation} onChange={(e) => setOrientation(e.target.value as typeof orientation)} className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="landscape">Landscape</option>
                <option value="portrait">Portrait</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="2up-margin">Margin (pt)</Label>
              <Input id="2up-margin" type="number" min={0} value={margin} onChange={(e) => setMargin(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="2up-gutter">Gutter (pt)</Label>
              <Input id="2up-gutter" type="number" min={0} value={gutter} onChange={(e) => setGutter(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={duplicateLast} onChange={(e) => setDuplicateLast(e.target.checked)} className="h-4 w-4 accent-primary" />
              Repeat last page when odd (fill the sheet)
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={divider} onChange={(e) => setDivider(e.target.checked)} className="h-4 w-4 accent-primary" />
              Divider line in the gutter
            </label>
          </div>

          <ActionBar>
            <RunButton onClick={() => void run()} disabled={!file} loading={working} label="Create 2-up PDF" />
            <ClearButton onClick={reset} disabled={!file && !result && !error} label="Clear" />
          </ActionBar>

          {error && <ErrorBanner message={error} />}

          {result && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
              <p className="text-sm font-medium">2-up PDF ready • {formatBytes(result.length)}</p>
              <Button onClick={() => downloadBytes(result, `2up-${file?.name ?? "output.pdf"}`)} className="gap-1.5">
                <Download className="h-4 w-4" /> Download
              </Button>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Privacy: 100% local — your PDF never leaves your device. Text stays selectable (no rasterization).
      </p>
    </div>
  );
}
