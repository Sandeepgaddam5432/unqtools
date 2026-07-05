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
import { splitPdf, type SplitMode, type SplitOutputFile } from "./logic";

const MODES: { value: SplitMode; label: string; hint: string }[] = [
  {
    value: "ranges",
    label: "Custom ranges",
    hint: "Each comma-separated group becomes its own file, e.g. 1-3, 4-6",
  },
  { value: "every", label: "Every N pages", hint: "Split into equal chunks of N pages" },
  { value: "single", label: "One file per page", hint: "Extract every page as a separate PDF" },
];

export default function SplitPdf() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array; pageCount: number } | null>(null);
  const [mode, setMode] = useState<SplitMode>("ranges");
  const [ranges, setRanges] = useState("");
  const [every, setEvery] = useState("2");
  const [results, setResults] = useState<SplitOutputFile[]>([]);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  async function loadFile(f: File) {
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const doc = await PDFDocument.load(bytes);
      setFile({ name: f.name, bytes, pageCount: doc.getPageCount() });
      setResults([]);
      setError("");
    } catch {
      toast.error(`Could not read ${f.name} — it may be corrupted or password-protected.`);
    }
  }

  function reset() {
    setFile(null);
    setResults([]);
    setError("");
    setRanges("");
  }

  async function split() {
    if (!file) return;
    setWorking(true);
    setError("");
    setResults([]);
    const res = await splitPdf(file.bytes, {
      mode,
      ranges,
      every: Number(every),
      baseName: file.name,
    });
    setWorking(false);
    if (res.ok) {
      setResults(res.output);
      toast.success(`Split into ${res.output.length} file${res.output.length === 1 ? "" : "s"}`);
    } else {
      setError(res.error);
    }
  }

  function downloadAll() {
    results.forEach((r, i) => {
      setTimeout(() => downloadBytes(r.bytes, r.name), i * 300);
    });
  }

  return (
    <div className="space-y-4">
      {file ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {file.pageCount} page{file.pageCount === 1 ? "" : "s"} • {formatBytes(file.bytes.length)}
            </p>
          </div>
          <Button variant="ghost" size="icon-sm" aria-label={`Remove ${file.name}`} onClick={reset}>
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
            const dropped = e.dataTransfer.files[0];
            if (dropped) void loadFile(dropped);
          }}
          className="w-full rounded-xl border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary/50 hover:bg-primary/5"
        >
          <FileUp className="mx-auto mb-2 h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm font-medium text-foreground">Drop a PDF here or click to browse</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Split by custom ranges, every N pages, or one file per page.
          </p>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        aria-label="Choose a PDF file to split"
        onChange={(e) => {
          const picked = e.target.files?.[0];
          if (picked) void loadFile(picked);
          e.target.value = "";
        }}
      />

      <div role="radiogroup" aria-label="Split mode" className="grid gap-2 sm:grid-cols-3">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            role="radio"
            aria-checked={mode === m.value}
            onClick={() => setMode(m.value)}
            className={
              mode === m.value
                ? "rounded-lg border border-primary bg-primary/10 p-3 text-left"
                : "rounded-lg border border-border p-3 text-left transition-colors hover:border-primary/40"
            }
          >
            <p className="text-sm font-medium text-foreground">{m.label}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{m.hint}</p>
          </button>
        ))}
      </div>

      {mode === "ranges" && (
        <div className="space-y-1.5">
          <Label htmlFor="split-ranges">Page ranges (each group becomes a file)</Label>
          <Input
            id="split-ranges"
            value={ranges}
            onChange={(e) => setRanges(e.target.value)}
            placeholder="e.g. 1-3, 4-6"
          />
        </div>
      )}
      {mode === "every" && (
        <div className="space-y-1.5">
          <Label htmlFor="split-every">Pages per file</Label>
          <Input
            id="split-every"
            type="number"
            min={1}
            value={every}
            onChange={(e) => setEvery(e.target.value)}
            className="w-32"
          />
        </div>
      )}

      <ActionBar>
        <RunButton onClick={() => void split()} disabled={!file} loading={working} label="Split PDF" />
        <ClearButton onClick={reset} disabled={!file && results.length === 0 && !error} label="Clear" />
      </ActionBar>

      {error && <ErrorBanner message={error} />}

      {results.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">
              {results.length} file{results.length === 1 ? "" : "s"} ready
            </p>
            <Button variant="outline" size="sm" onClick={downloadAll} className="gap-1.5">
              <Download className="h-3.5 w-3.5" /> Download all
            </Button>
          </div>
          <ul className="space-y-2">
            {results.map((r, i) => (
              <li
                key={`${i}-${r.name}`}
                className="flex items-center justify-between gap-2 rounded-lg border bg-card p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{r.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.pageCount} page{r.pageCount === 1 ? "" : "s"} • {formatBytes(r.bytes.length)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Download ${r.name}`}
                  onClick={() => downloadBytes(r.bytes, r.name)}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Privacy: splitting runs 100% locally in your browser — your PDF never leaves your device.
      </p>
    </div>
  );
}
