"use client";

import React, { useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowDown, ArrowUp, Download, FileUp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ActionBar, ClearButton, EmptyState, ErrorBanner, RunButton } from "../../_shared";
import { downloadBytes, formatBytes } from "../_shared/download";
import { mergePdfs } from "./logic";

interface PdfEntry {
  id: string;
  name: string;
  bytes: Uint8Array;
  pageCount: number;
  /** Optional page-range spec, e.g. "1-3, 5" — empty = all pages */
  pages: string;
}

let nextId = 0;

export default function MergePdf() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<PdfEntry[]>([]);
  const [result, setResult] = useState<Uint8Array | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  async function addFiles(list: FileList | File[]) {
    const added: PdfEntry[] = [];
    for (const file of Array.from(list)) {
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const doc = await PDFDocument.load(bytes);
        nextId += 1;
        added.push({
          id: `pdf-${nextId}`,
          name: file.name,
          bytes,
          pageCount: doc.getPageCount(),
          pages: "",
        });
      } catch {
        toast.error(`Could not read ${file.name} — it may be corrupted or password-protected.`);
      }
    }
    if (added.length > 0) {
      setFiles((prev) => [...prev, ...added]);
      setResult(null);
      setError("");
    }
  }

  function move(index: number, delta: number) {
    setFiles((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const tmp = next[index];
      next[index] = next[target];
      next[target] = tmp;
      return next;
    });
    setResult(null);
  }

  function removeFile(id: string) {
    setFiles((prev) => prev.filter((f) => f.id !== id));
    setResult(null);
  }

  function updatePages(id: string, value: string) {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, pages: value } : f)));
    setResult(null);
  }

  function reset() {
    setFiles([]);
    setResult(null);
    setError("");
  }

  async function merge() {
    setWorking(true);
    setError("");
    setResult(null);
    const res = await mergePdfs(files.map((f) => ({ name: f.name, bytes: f.bytes, pages: f.pages })));
    setWorking(false);
    if (res.ok) {
      setResult(res.output);
      toast.success("PDFs merged!");
    } else {
      setError(res.error);
    }
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void addFiles(e.dataTransfer.files);
        }}
        className="w-full rounded-xl border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary/50 hover:bg-primary/5"
      >
        <FileUp className="mx-auto mb-2 h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm font-medium text-foreground">Drop PDFs here or click to browse</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Add two or more PDFs, reorder them, and optionally pick page ranges per file.
        </p>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        className="hidden"
        aria-label="Choose PDF files to merge"
        onChange={(e) => {
          if (e.target.files) void addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {files.length === 0 ? (
        <EmptyState
          title="No files added yet"
          hint="Your files stay on your device — merging runs entirely in your browser."
        />
      ) : (
        <ul className="space-y-2">
          {files.map((f, i) => (
            <li key={f.id} className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
              <span className="w-5 text-center text-xs font-semibold text-muted-foreground">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{f.name}</p>
                <p className="text-xs text-muted-foreground">
                  {f.pageCount} page{f.pageCount === 1 ? "" : "s"} • {formatBytes(f.bytes.length)}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <Label htmlFor={`pages-${f.id}`} className="text-xs text-muted-foreground">
                  Pages
                </Label>
                <Input
                  id={`pages-${f.id}`}
                  value={f.pages}
                  onChange={(e) => updatePages(f.id, e.target.value)}
                  placeholder="All (e.g. 1-3, 5)"
                  className="h-8 w-36 text-xs"
                />
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Move ${f.name} up`}
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Move ${f.name} down`}
                  disabled={i === files.length - 1}
                  onClick={() => move(i, 1)}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${f.name}`}
                  onClick={() => removeFile(f.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ActionBar>
        <RunButton
          onClick={() => void merge()}
          disabled={files.length === 0}
          loading={working}
          label={files.length > 1 ? `Merge ${files.length} PDFs` : "Merge PDF"}
        />
        <ClearButton onClick={reset} disabled={files.length === 0 && !result && !error} label="Clear all" />
      </ActionBar>

      {error && <ErrorBanner message={error} />}

      {result && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <div>
            <p className="text-sm font-medium text-foreground">Merged PDF ready</p>
            <p className="text-xs text-muted-foreground">{formatBytes(result.length)}</p>
          </div>
          <Button onClick={() => downloadBytes(result, "merged.pdf")} className="gap-1.5">
            <Download className="h-4 w-4" /> Download merged.pdf
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Privacy: merging runs 100% locally in your browser — your PDFs never leave your device.
      </p>
    </div>
  );
}
