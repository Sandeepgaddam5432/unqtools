"use client";

/**
 * EPUB to PDF — real UI.
 * Choose an .epub, pick page settings, convert to a selectable-text PDF.
 */

import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Download, BookOpen, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ActionBar, ClearButton, ErrorBanner, RunButton } from "../../_shared";
import { downloadBytes, formatBytes } from "../_shared/download";
import { epubToPdf, type EpubOptions } from "./logic";

type LoadedFile = { name: string; bytes: Uint8Array };

export default function EpubToPdf() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [pageSize, setPageSize] = useState<EpubOptions["pageSize"]>("a4");
  const [orientation, setOrientation] = useState<EpubOptions["orientation"]>("portrait");
  const [margin, setMargin] = useState("48");
  const [bodySize, setBodySize] = useState("12");
  const [chapterTitles, setChapterTitles] = useState(true);
  const [result, setResult] = useState<Uint8Array | null>(null);
  const [meta, setMeta] = useState<string>("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  async function loadFile(f: File) {
    try {
      if (!/\.epub$/i.test(f.name)) {
        toast.error("Please choose an .epub file");
        return;
      }
      const bytes = new Uint8Array(await f.arrayBuffer());
      setFile({ name: f.name, bytes });
      setResult(null);
      setError("");
      setMeta("");
    } catch {
      toast.error(`Could not read ${f.name}`);
    }
  }

  function reset() {
    setFile(null);
    setResult(null);
    setError("");
    setMeta("");
  }

  async function run() {
    if (!file) return;
    setWorking(true);
    setError("");
    setResult(null);
    setMeta("");
    const r = await epubToPdf(file.bytes, {
      pageSize,
      orientation,
      margin: Number(margin) || 48,
      bodySize: Number(bodySize) || 12,
      chapterTitles,
    });
    setWorking(false);
    if (r.ok) {
      setResult(r.output.bytes);
      setMeta(`${r.output.chapters} chapters • ${r.output.totalChars.toLocaleString()} characters`);
      toast.success("EPUB converted!");
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
            <p className="text-xs text-muted-foreground">{formatBytes(file.bytes.length)}</p>
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
          <BookOpen className="mx-auto mb-2 h-9 w-9 text-muted-foreground" />
          <p className="text-sm font-medium">Drop an .epub here or click to browse</p>
          <p className="mt-1 text-xs text-muted-foreground">Convert e-books to a clean, selectable-text PDF.</p>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept=".epub,application/epub+zip"
        className="hidden"
        aria-label="Choose EPUB"
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
              <Label>Page size</Label>
              <select value={pageSize} onChange={(e) => setPageSize(e.target.value as EpubOptions["pageSize"])} className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="a4">A4</option>
                <option value="letter">Letter</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Orientation</Label>
              <select value={orientation} onChange={(e) => setOrientation(e.target.value as EpubOptions["orientation"])} className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="epub-margin">Margin (pt)</Label>
              <input id="epub-margin" type="number" min={20} max={120} value={margin} onChange={(e) => setMargin(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="epub-size">Body size</Label>
              <input id="epub-size" type="number" min={9} max={20} value={bodySize} onChange={(e) => setBodySize(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={chapterTitles} onChange={(e) => setChapterTitles(e.target.checked)} className="h-4 w-4 accent-primary" />
            Include chapter titles
          </label>

          <ActionBar>
            <RunButton onClick={() => void run()} disabled={!file} loading={working} label="Convert to PDF" />
            <ClearButton onClick={reset} disabled={!file && !result && !error} label="Clear" />
          </ActionBar>

          {error && <ErrorBanner message={error} />}

          {result && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
              <div>
                <p className="text-sm font-medium">PDF ready • {formatBytes(result.length)}</p>
                {meta && <p className="text-xs text-muted-foreground">{meta}</p>}
              </div>
              <Button onClick={() => downloadBytes(result, `${file?.name.replace(/\.epub$/i, "") ?? "book"}.pdf`)} className="gap-1.5">
                <Download className="h-4 w-4" /> Download
              </Button>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Privacy: 100% local — your book never leaves your device. Text is converted (not scanned), so it stays selectable and searchable.
      </p>
    </div>
  );
}
