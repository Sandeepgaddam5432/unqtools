"use client";

/** Split PDF by Bookmarks — real UI. */

import React, { useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { Download, FileUp, FolderArchive, Trash2, Bookmark } from "lucide-react";
import { toast } from "sonner";
import { ActionBar, ClearButton, ErrorBanner, RunButton } from "../../_shared";
import { downloadBytes, formatBytes } from "../_shared/download";
import { splitByBookmarks, type BookmarkSplitPart } from "./logic";

type LoadedFile = { name: string; bytes: Uint8Array; pageCount: number };

export default function SplitByBookmarks() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [parts, setParts] = useState<BookmarkSplitPart[]>([]);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  async function loadFile(f: File) {
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const doc = await PDFDocument.load(bytes);
      setFile({ name: f.name, bytes, pageCount: doc.getPageCount() });
      setParts([]);
      setError("");
    } catch {
      toast.error(`Could not read ${f.name}`);
    }
  }

  function reset() {
    setFile(null);
    setParts([]);
    setError("");
  }

  async function run() {
    if (!file) return;
    setWorking(true);
    setError("");
    setParts([]);
    const r = await splitByBookmarks(file.bytes, file.name.replace(/\.pdf$/i, "") || "part");
    setWorking(false);
    if (r.ok) {
      setParts(r.output.parts);
      toast.success(`Split into ${r.output.parts.length} part(s)`);
    } else {
      setError(r.error);
    }
  }

  async function downloadAll() {
    if (parts.length === 0) return;
    if (parts.length === 1) {
      downloadBytes(parts[0]!.bytes, parts[0]!.name);
      return;
    }
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      for (const p of parts) zip.file(p.name, p.bytes.slice().buffer as ArrayBuffer);
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${file?.name.replace(/\.pdf$/i, "") ?? "book"}-chapters.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      toast.error("Could not create ZIP — downloading individually.");
      for (const p of parts) downloadBytes(p.bytes, p.name);
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
          <Bookmark className="mx-auto mb-2 h-9 w-9 text-muted-foreground" />
          <p className="text-sm font-medium">Drop a bookmarked PDF here</p>
          <p className="mt-1 text-xs text-muted-foreground">Split into chapters at each bookmark boundary.</p>
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
          <ActionBar>
            <RunButton onClick={() => void run()} disabled={!file} loading={working} label="Split by bookmarks" />
            <ClearButton onClick={reset} disabled={!file && parts.length === 0 && !error} label="Clear" />
          </ActionBar>

          {error && <ErrorBanner message={error} />}

          {parts.length > 0 && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{parts.length} chapter(s)</p>
                <Button variant="outline" size="sm" className="gap-1.5 cursor-pointer" onClick={() => void downloadAll()}>
                  <FolderArchive className="h-3.5 w-3.5" /> Download all (ZIP)
                </Button>
              </div>
              <div className="space-y-1.5">
                {parts.map((p, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border bg-card p-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{p.title}</p>
                      <p className="text-xs text-muted-foreground">p.{p.startPage}–{p.endPage} · {formatBytes(p.size)}</p>
                    </div>
                    <Button variant="ghost" size="icon-sm" aria-label={`Download ${p.name}`} onClick={() => downloadBytes(p.bytes, p.name)}>
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Privacy: 100% local — your PDF never leaves your device. Requires a PDF with at least 2 bookmarks that point to pages.
      </p>
    </div>
  );
}
