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
import { duplicatePdfPages } from "./logic";

export default function DuplicatePdfPages() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array; pageCount: number } | null>(null);
  const [pages, setPages] = useState("");
  const [count, setCount] = useState("1");
  const [result, setResult] = useState<{ bytes: Uint8Array; newPageCount: number } | null>(null);
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

  function reset() {
    setFile(null);
    setResult(null);
    setError("");
    setPages("");
    setCount("1");
  }

  async function run() {
    if (!file) return;
    setWorking(true);
    setError("");
    setResult(null);
    const res = await duplicatePdfPages(file.bytes, { pages, count: Number(count) });
    setWorking(false);
    if (res.ok) {
      setResult({ bytes: res.output.bytes, newPageCount: res.output.newPageCount });
      toast.success(`Done! ${res.output.newPageCount} pages total`);
    } else {
      setError(res.error);
    }
  }

  return (
    <div className="space-y-4">
      {file ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {file.pageCount} page{file.pageCount === 1 ? "" : "s"} • {formatBytes(file.bytes.length)}
            </p>
          </div>
          <Button variant="ghost" size="icon-sm" aria-label="Remove file" onClick={reset}>
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
            const f = e.dataTransfer.files[0];
            if (f) void loadFile(f);
          }}
          className="w-full rounded-xl border-2 border-dashed border-border p-8 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors"
        >
          <FileUp className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">Drop a PDF here or click to browse</p>
          <p className="mt-1 text-xs text-muted-foreground">Clone selected pages N times — copies appended at end.</p>
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
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="dup-pages">Pages to duplicate</Label>
            <Input
              id="dup-pages"
              value={pages}
              onChange={(e) => setPages(e.target.value)}
              placeholder="e.g. 3 or 1-3, 5"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dup-count">Duplicate count (1–100)</Label>
            <Input
              id="dup-count"
              type="number"
              min={1}
              max={100}
              value={count}
              onChange={(e) => setCount(e.target.value)}
              className="w-32"
            />
          </div>
        </div>
      )}

      <ActionBar>
        <RunButton onClick={() => void run()} disabled={!file || !pages.trim()} loading={working} label="Duplicate pages" />
        <ClearButton onClick={reset} disabled={!file && !result && !error} label="Clear" />
      </ActionBar>

      {error && <ErrorBanner message={error} />}

      {result && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <div>
            <p className="text-sm font-medium">Duplicated PDF ready</p>
            <p className="text-xs text-muted-foreground">
              {result.newPageCount} pages • {formatBytes(result.bytes.length)}
            </p>
          </div>
          <Button
            onClick={() => downloadBytes(result.bytes, `duplicated-${file?.name ?? "output.pdf"}`)}
            className="gap-1.5"
          >
            <Download className="h-4 w-4" /> Download
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Privacy: duplicating runs 100% locally in your browser — your PDF never leaves your device.
      </p>
    </div>
  );
}
