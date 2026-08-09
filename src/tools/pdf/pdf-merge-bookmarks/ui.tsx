"use client";

/** Merge PDFs with Bookmarks — real UI. */

import React, { useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { Download, FileUp, Trash2, BookmarkCheck } from "lucide-react";
import { toast } from "sonner";
import { ActionBar, ClearButton, ErrorBanner, RunButton } from "../../_shared";
import { downloadBytes, formatBytes } from "../_shared/download";
import { mergePdfsWithBookmarks } from "./logic";

type LoadedFile = { name: string; bytes: Uint8Array; pageCount: number };

export default function MergeWithBookmarks() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<LoadedFile[]>([]);
  const [result, setResult] = useState<Uint8Array | null>(null);
  const [report, setReport] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  async function loadFiles(list: FileList | File[]) {
    const arr = Array.from(list);
    const loaded: LoadedFile[] = [];
    for (const f of arr) {
      try {
        const bytes = new Uint8Array(await f.arrayBuffer());
        const doc = await PDFDocument.load(bytes);
        loaded.push({ name: f.name, bytes, pageCount: doc.getPageCount() });
      } catch {
        toast.error(`Could not read ${f.name}`);
      }
    }
    if (loaded.length > 0) {
      setFiles((prev) => [...prev, ...loaded]);
      setResult(null);
      setReport("");
      setError("");
      toast.success(`Loaded ${loaded.length} PDF(s)`);
    }
  }

  function reset() {
    setFiles([]);
    setResult(null);
    setReport("");
    setError("");
  }

  async function run() {
    if (files.length === 0) return;
    setWorking(true);
    setError("");
    setResult(null);
    setReport("");
    const r = await mergePdfsWithBookmarks(files.map((f) => ({ name: f.name, bytes: f.bytes })));
    setWorking(false);
    if (r.ok) {
      setResult(r.output.bytes);
      setReport(`${r.output.files} file(s) · ${r.output.totalPages} pages · ${r.output.bookmarks} bookmark(s)`);
      toast.success("Merged with bookmarks!");
    } else {
      setError(r.error);
    }
  }

  return (
    <div className="space-y-4">
      {files.length === 0 ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void loadFiles(e.dataTransfer.files);
          }}
          className="w-full rounded-xl border-2 border-dashed border-border p-10 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors"
        >
          <BookmarkCheck className="mx-auto mb-2 h-9 w-9 text-muted-foreground" />
          <p className="text-sm font-medium">Drop PDFs here (or click to browse)</p>
          <p className="mt-1 text-xs text-muted-foreground">Merge and keep a clickable outline for every file.</p>
        </button>
      ) : (
        <div className="space-y-2">
          {files.map((f) => (
            <div key={f.name} className="flex items-center justify-between rounded-lg border bg-card p-2.5">
              <p className="truncate text-sm font-medium flex-1">{f.name}</p>
              <span className="text-xs text-muted-foreground mr-3">{f.pageCount}p</span>
              <Button variant="ghost" size="icon-sm" aria-label={`Remove ${f.name}`} onClick={() => setFiles((p) => p.filter((x) => x.name !== f.name))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="gap-1.5 cursor-pointer" onClick={() => inputRef.current?.click()}>
            <FileUp className="h-3.5 w-3.5" /> Add more
          </Button>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        className="hidden"
        aria-label="Choose PDFs"
        onChange={(e) => {
          if (e.target.files) void loadFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {files.length > 0 && (
        <div className="space-y-4 rounded-xl border bg-card p-4">
          <ActionBar>
            <RunButton onClick={() => void run()} disabled={files.length === 0} loading={working} label={`Merge ${files.length} file(s)`} />
            <ClearButton onClick={reset} disabled={files.length === 0 && !result && !error} label="Clear" />
          </ActionBar>

          {error && <ErrorBanner message={error} />}

          {result && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
              <div>
                <p className="text-sm font-medium">Merged PDF ready • {formatBytes(result.length)}</p>
                {report && <p className="text-xs text-muted-foreground mt-0.5">{report}</p>}
              </div>
              <Button onClick={() => downloadBytes(result, "merged-with-bookmarks.pdf")} className="gap-1.5">
                <Download className="h-4 w-4" /> Download
              </Button>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Privacy: 100% local — your PDFs never leave your device. Each file becomes a top-level bookmark; internal
        bookmarks are re-anchored to their new page numbers.
      </p>
    </div>
  );
}
